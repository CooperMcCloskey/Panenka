import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { step } from '$lib/engine/step';
import type { Action, GameState, MatchRules, Team } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ClientAction, LobbyPlayers, LobbyState, PlayerInput, ServerMessage } from '$lib/shared/protocol';
import type { Client, LobbyPlayer } from "$lib/shared/protocol";
import { MAX_TEAMSIZE } from '$lib/engine/rules';
import { createState } from '$lib/engine/state'

// Uuid for playerID and clientID. Wrapped rather than `crypto.randomUUID` on its own:
// it has to be called on crypto, or it throws "Value of this must be of type Crypto"
const Uuid = () => crypto.randomUUID();

// Creating room class
export class Room {

  readonly adminId: string;
  // Client ID mapped to client
  readonly clients: Record<string, Client> = {};
  readonly players: LobbyPlayers = {};
  readonly rules: MatchRules = {kind:"time", minutes: 5};
  state?: GameState;

  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private start = false;
  private last = 0;
  private accumulator = 0;
  private rev = 0;
  // Maps playerID to playerAction
  private readonly inputs: Record<string,PlayerInput> = {};

  constructor(readonly code: string, adminUsername: string) {
    const {clientId: adminId, client: adminClient} = this.addClient(adminUsername);
    this.adminId = adminId;
  };

  get usernames() { return Object.values(this.players).map( p => p.username); }

  // Id's mapped to usernames
  get spectators(): Record<string, string> { 
    return Object.fromEntries(
      Object.entries(this.clients)
      .filter(([_, client])=>(client.playerIDs.length === 0))
      .map(([id, client])=>([id, client.username]))
    )
  }

  get lobbyState(): LobbyState { 
    const {rules, players, spectators, rev} = this;
    return { rev, rules, players, spectators } 
  }

  getTeams(): {blue: number, orange: number} {
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

  // Add player and client
  addPlayer(token: string, username: string, num: number, team: Team) {
    const playerID = Uuid();
    const client = this.clients[token];
      for (let i = 0; i < num; i++){
        client.playerIDs.push(playerID);
    }
    const player: LobbyPlayer = {username, team};
    this.players[playerID] = player;
    this.broadcastLobby();
    // Initialising player input state
    this.inputs[playerID] = {
      action: IDLE,
      queue: [],
      seq: -1,
      received: performance.now(),
    };
    return player;
  };
  
  getToken(id: string): string | undefined { return this.clients[id].token };

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

  send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 256_000) { socket.close(1013, 'Connection too slow'); return; }
      socket.send(JSON.stringify(message));
    }
  }

  // Probablly getting axed
  broadcastLobby() {
    const clients = Object.values(this.clients);
    const lobbyState = this.lobbyState;
    const start = this.start;

    for (const client of clients) {
      if (client.socket) {
        this.send(client.socket, {
          type: 'lobby',
          lobbyState,
          controlledPlayerIds: client.playerIDs,
          start,
        });
      }
    }
  };

  connect(token: string, socket: WebSocket) {
    const found = this.findClient(token)!;
    if (!found) return undefined;
    const {clientId, client} = found;
    client.socket?.close(1000, 'Reconnected elsewhere');
    client.socket = socket;

    this.broadcastLobby();

    if (this.start && this.state) this.send(socket, { type: 'snapshot', state: Array.from(encodeState(this.state)) });

    if (this.state && this.start && !this.state.match.winner && !this.timer) {
      this.last = performance.now();
      this.accumulator = 0;
      this.timer = setInterval(() => this.update(), TICK_MS);
    }
    return client;
  }
  // TODO Fix, implement adminID check at some point
  startMatch(token: string, socket: WebSocket ) {
    if (this.start || !Object.values(this.clients).some(c => c.token === token && c.socket === socket)
      || Object.keys(this.players).length < MAX_TEAMSIZE * 2 || !Object.values(this.clients).every(c => c.socket)) return;
    // Getting number of blue players and orange players
    const {blue, orange} = this.getTeams();

    // TODO make sure this.rules has been updated before creating state
    this.state = createState({ blue: blue, orange: orange }, this.rules);
    this.start = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.broadcastLobby();
    this.broadcastSnapshot();
    this.timer = setInterval(() => this.update(), TICK_MS);
  }

  private broadcastSnapshot() {
    if (!this.state) return undefined;
    const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
    Object.values(this.clients).forEach(c => { if (c.socket) this.send(c.socket, message); });
  }

  input(token: string, socket: WebSocket, clientAction: ClientAction) {
    const c = Object.values(this.clients).find(c => c.token === token && c.socket === socket);
    if (!c) return undefined;

    const { seq } = clientAction;
    const received = performance.now();

    for (const [playerID, action] of Object.entries(clientAction.action)) {
      if (!c.playerIDs.includes(playerID)) continue;
      const p = this.inputs[playerID];
      if (!p || seq <= p.seq) continue;
      p.seq = seq; p.received = received;
      // Keep kick transitions until a simulation tick consumes them
      const previous = p.queue.at(-1) ?? p.action;
      if (previous.kick !== action.kick) {
        if (p.queue.length >= 16) {   socket.close(1008, 'Too many inputs'); return; }
        p.queue.push(action);
      } else if (p.queue.length) p.queue[p.queue.length - 1] = action;
      else p.action = action;
    }
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
      let player = this.inputs[playerId];
      player.action = IDLE; player.queue = [];
    }

    this.broadcastLobby();
    if (!Object.values(this.clients).some(c=> c.socket)) this.stop();
  }

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
  removePlayer(playerId: string) {
    const player = this.players[playerId];
    if (!player) return;
    const client = Object.values(this.clients).find(c => c.playerIDs.includes(playerId));
    if (!client) return;
    // Remove player from player array
    delete this.players[playerId];
    // Remove the players input state
    delete this.inputs[playerId];
    // Removing the player from the associated client
    client.playerIDs = client.playerIDs.filter(id => id !== playerId);
    const {blue, orange} = this.getTeams();
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
      const actions = Object.values(this.inputs).map(p => {
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
          this.start = false;
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
    if (this.state.match.winner !== null) this.start = false;
  }
}
