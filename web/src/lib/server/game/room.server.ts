import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { step } from '$lib/engine/step';
import { DEFAULT_MATCH_RULES, type GameState } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ClientAction, LobbyState, ServerMessage } from '$lib/shared/protocol';
import type { Client, LobbyPlayer } from "$lib/shared/protocol";
import { createState } from '$lib/engine/state'
import type { Action } from '@sveltejs/kit';

type Result = 
  | {type: "ok", message?: string} 
  | {type: "warn", message: string}
  | {type: "error", message: string} 

const Uuid = () => crypto.randomUUID();

// Creating room class
export class Room {

  readonly adminId: string;
  readonly adminToken: string;
  // Client ID mapped to client
  readonly clients: Record<string, Client> = {};
  lobbyState: LobbyState = {rev: 0, rules: DEFAULT_MATCH_RULES, players: {}};
  state?: GameState;

  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  private last = 0;
  private accumulator = 0;

  private readonly sequenceNumber: Record<string, number> = {};
  //maps playerId to playerAction
  private readonly playerActions: Record<string, Action> = {};

  constructor(readonly code: string, adminUsername: string) {
    const {clientId: adminId, client: adminClient} = this.addClient(adminUsername);
    this.adminId = adminId;
    this.adminToken = adminClient.token;
  };

  get players() { return this.lobbyState.players }
  get rules() { return this.lobbyState.rules }
  get usernames() { return Object.values(this.players).map( p => p.username); }
  // Ids mapped to usernames
  get spectators(): Record<string, string> { 
    return Object.fromEntries(
      Object.entries(this.clients)
      .filter(([_, client])=>(client.playerIDs.length === 0))
      .map(([id, client])=>([id, client.username]))
    )
  }
  get teamSizes(): {blue: number, orange: number} {
    const orange: number = Object.values(this.players).filter(c => c.team === "blue").length;
    const blue: number = Object.keys(this.players).length - orange;
    return {blue, orange}
  }
  // Modular get player func
  getPlayerFromClient(c: Client, index?: number):LobbyPlayer {
    if (!index) {index = 0};
    const playerID = c.playerIDs[index];
    const player = this.players[playerID];
    return player;
  };

  findClient(token: string | undefined): {clientId: string, client: Client} | undefined {
    const entry = Object.entries(this.clients).find(([, c]) => c.token === token);
    return entry && { clientId: entry[0], client: entry[1] };
  }
  addClient(username: string): {clientId: string, client: Client}{ 
    const client = { token: nanoid(32), playerIDs: [], username};
    const clientId = Uuid();
    this.clients[clientId] = client;
    return {clientId, client};
  }

  // BROADCASTING ------------------------------------------------------------------

  send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 256_000) { socket.close(1013, 'Connection too slow'); return; }
      socket.send(JSON.stringify(message));
    }
  }
  broadcastLobby() {
    const clients = Object.values(this.clients);

    for (const client of clients) {
      if (client.socket) {
        this.send(client.socket, {
          type: 'lobby',
          lobbyState: this.lobbyState,
          controlledPlayerIds: client.playerIDs,
          started: this.started,
        });
      }
    }
  };
  private broadcastSnapshot() {
    if (!this.state) return undefined;
    const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
    Object.values(this.clients).forEach(c => { if (c.socket) this.send(c.socket, message); });
  }

  // Connection

  connect(token: string, socket: WebSocket) {
    const found = this.findClient(token)!;
    if (!found) return undefined;
    const {clientId, client} = found;
    client.socket?.close(1000, 'Reconnected elsewhere');
    client.socket = socket;

    this.broadcastLobby();

    if (this.started && this.state) this.send(socket, { type: 'snapshot', state: Array.from(encodeState(this.state)) });

    if (this.state && this.started && !this.state.match.winner && !this.timer) {
      this.last = performance.now();
      this.accumulator = 0;
      this.timer = setInterval(() => this.update(), TICK_MS);
    }
    return client;
  }
  disconnect(socket: WebSocket) {
    const c = Object.values(this.clients).find(c => c.socket === socket);
    if (!c) return;
    c.socket = undefined; 

    // Loop for each player in a client
    for (let i = 0; i < c.playerIDs.length; i++){
      // Get playerID
      let playerId = c.playerIDs[i];
      //Then get the p object from inputs and set them to nothing
      // TODO figure out if this actually needs doing
      this.playerActions[playerId] = IDLE;
    }

    this.broadcastLobby();
    if (!Object.values(this.clients).some(c=> c.socket)) this.stop();
  }

  // RECIEVING MESSAGES ------------------------------------------------------------------

  // TODO implement adminID check at some point
  startMatch(lobbyState: LobbyState, token: string): Result {
    if(token != this)
    if(!Object.values(!Object.values(this.clients).some(c => c.token === token))) return {type: "error", message: "Invalid token"}
    if (this.started) return {type: "warn", message: "Match already started"};
    
    const playingClients = Object.values(this.clients).filter((c) => c.playerIDs.length > 0);
    if(!playingClients.every(c => c.socket?.readyState === WebSocket.OPEN)) return {type: "warn", message: "Not all players connected"};

    this.lobbyState = lobbyState;

    this.state = createState(this.teamSizes, this.rules);
    this.started = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.broadcastLobby();
    this.broadcastSnapshot();
    this.timer = setInterval(() => this.update(), TICK_MS);

    return {type: "ok"}
  }

  input(token: string, clientAction: ClientAction): Result {
    const c = Object.values(this.clients).find(c => c.token === token);
    if (!c) return {type: "error", message: "Invalid token"}

    const seq = clientAction.seq;
    const received = performance.now();

    for (const [playerID, playerAction] of Object.entries(clientAction.actions)) {
      if (!c.playerIDs.includes(playerID)) continue;
      const p = this.playerActions[playerID];
      if (!p || seq <= p.seq) continue;
      p.seq = seq; p.received = received;
      // Keep kick transitions until a simulation tick consumes them
      const previous = p.queue.at(-1) ?? p.action;
      if (previous.kick !== playerAction.kick) {
        if (p.queue.length >= 16) {   socket.close(1008, 'Too many inputs'); return; }
        p.queue.push(playerAction);
      } else if (p.queue.length) p.queue[p.queue.length - 1] = playerAction;
      else p.action = playerAction;
    }
  }
  // Add player
  addPlayer(token: string, player: LobbyPlayer, rev: number): Result {
    if(rev <= this.rev) return {type: "error", message: "Outdated action"};

    const playerID = Uuid();
    const found = this.findClient(token);
    if(!found) return {type: "error", message: "Invalid token"}
    const {clientId, client} = found;
    client.playerIDs.push(playerID);

    this.players[playerID] = player;
    this.broadcastLobby();
    // Initialising player input state
    this.playerActions[clientId].actions[playerID] = {
      input: IDLE,
      queue: [],
    };
    return {type: "ok"}
  };

  // Function no longer ends the game if a client is removed
  removeClient(token: string) {
    const c = Object.values(this.clients).find(c => c.token === token);
    if (!c) return;
    for (const playerId of [...c.playerIDs]) {
      this.removePlayer(playerId);
    } 

    const found = this.findClient(token);
    if (!found) return;

    const { clientId, client: client } = found;

    delete this.clients[clientId];
  
    // Old code
    // Basically ends the game
    // Object.values(this.inputs).forEach(p => { p.action = IDLE; p.queue = []; });
    // this.stop;
    // this.start = false;
  }

  // Remove player without ending the game, useful for when reverting back to spectator
  removePlayer(token: string, playerId: string, rev: number) {
    const player = this.players[playerId];
    if (!player) return;
    const client = Object.values(this.clients).find(c => c.playerIDs.includes(playerId));
    if (!client) return;
    // Remove player from player array
    delete this.players[playerId];
    // Remove the players input state
    delete this.playerActions[playerId];
    // Removing the player from the associated client
    client.playerIDs = client.playerIDs.filter(id => id !== playerId);
    const {blue, orange} = this.getTeamSizes();
    this.state = createState({ blue: blue, orange: orange }, this.rules);
    this.broadcastLobby()
  }

  private update() {
    // TODO need a way to initialise state instead of having this each time
    if (!this.state) return;
    const now = performance.now();
    this.accumulator += Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    //TODO need to check this actuall works because its been janked together
    while (this.accumulator >= TICK_MS) {
      const actions = Object.values(this.playerActions).map(p => {
        if (now - p.received > 1000) { p.action = IDLE; p.queue = []; }
        else p.action = p.queue.shift() ?? p.action;
        return p.action;
      });
      this.state = step(this.state, actions);
      this.accumulator -= TICK_MS;
      if (this.state.match.winner !== null) {
        this.broadcastSnapshot();
        clearInterval(this.timer); this.timer = undefined;
        this.endTimer = setTimeout(() => {
          this.started = false;
          this.endTimer = undefined;
          this.broadcastLobby();
        }, 3000);
        return;
      }
      if (this.state.match.tick % SNAPSHOT_NUM === 0) {
        this.broadcastSnapshot();
      }
    }
  }
  stop() {
    clearInterval(this.timer); this.timer = undefined;
    clearTimeout(this.endTimer); this.endTimer = undefined;
    if (!this.state) return; // TODO Same jank fix that should be changed
    if (this.state.match.winner !== null) this.started = false;
  }
}
