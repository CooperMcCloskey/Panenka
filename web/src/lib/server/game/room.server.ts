import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { step } from '$lib/engine/step';
import { DEFAULT_MATCH_RULES, type Action, type GameState, type MatchRules } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ClientAction, LobbyState, ServerMessage } from '$lib/shared/protocol';
import type { Client, LobbyPlayer } from "$lib/shared/protocol";
import { createState } from '$lib/engine/state'
import { GAME_END_DELAY } from './constants';

type Result = 
  | {type: "ok", message?: string} 
  | {type: "warn", message: string}
  | {type: "fail", message: string}
  | {type: "error", message: string} 

const Uuid = () => crypto.randomUUID();

// Creating room class
export class Room {

  readonly adminId: string;
  readonly adminToken: string;
  // Client ID mapped to client
  readonly clients: Record<string, Client> = {};
  lobbyState: LobbyState = {rev: 0, rules: DEFAULT_MATCH_RULES, players: {}, started: false};
  state: GameState = createState({blue: 0, orange: 0}, this.lobbyState.rules);

  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private last = 0;
  private accumulator = 0;

  //maps playerId to playerAction
  private readonly playerActions: Record<string, Action> = {};

  constructor(readonly code: string, adminUsername: string) {
    const {clientId: adminId, client: adminClient} = this.addClient(adminUsername);
    this.adminId = adminId;
    this.adminToken = adminClient.token;
  };
  cleanup() {
    clearInterval(this.timer); this.timer = undefined;
    clearTimeout(this.endTimer); this.endTimer = undefined;
  }

  private update() {



    while (this.accumulator >= TICK_MS) {
      this.state = step(this.state, this.playerActions);
      this.accumulator -= TICK_MS;
      if (this.state.match.winner !== null) {
        this.broadcastSnapshot();
        clearInterval(this.timer); this.timer = undefined;
        this.endTimer = setTimeout(() => {
          this.lobbyState.started = false;
          this.endTimer = undefined;
          this.broadcastLobby();
        }, GAME_END_DELAY);
        return;
      }
      if (this.state.match.tick % SNAPSHOT_NUM === 0) {
        this.broadcastSnapshot();
      }
    }
  }

  // -----------------------------------------------------------------------------
  // GETTERS --------------------------------------------------------------------
  // -----------------------------------------------------------------------------

  get players() { return this.lobbyState.players }
  get rules() { return this.lobbyState.rules }
  get started() { return this.lobbyState.started }
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
    const blue: number = Object.values(this.players).filter(c => c.team === "blue").length;
    const orange: number = Object.keys(this.players).length - blue;
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

  // -----------------------------------------------------------------------------
  // BROADCASTING ----------------------------------------------------------------
  // -----------------------------------------------------------------------------

  send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 256_000) { socket.close(1013, 'Connection too slow'); return; }
      socket.send(JSON.stringify(message));
    }
  }
  broadcastLobby() {
    this.lobbyState.rev += 1;
    const clients = Object.values(this.clients);

    for (const client of clients) {
      if (client.socket) {
        this.send(client.socket, {
          type: 'lobby',
          lobbyState: this.lobbyState,
          controlledPlayerIds: client.playerIDs,
        });
      }
    }
  };
  private broadcastSnapshot() {
    const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
    Object.values(this.clients).forEach(c => { if (c.socket) this.send(c.socket, message); });
  }

  // -----------------------------------------------------------------------------
  // CONNECTION ------------------------------------------------------------------
  // -----------------------------------------------------------------------------

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
    if (!Object.values(this.clients).some(c=> c.socket)) this.cleanup();
  }

  addClient(username: string): {clientId: string, client: Client}{ 
    const client = { token: nanoid(32), playerIDs: [], username};
    const clientId = Uuid();
    this.clients[clientId] = client;
    return {clientId, client};
  }
  removeClient(token: string): Result {
    const found = this.findClient(token);
    if(!found) return {type: "error", message: "Invalid Token"}
    const {clientId, client} = found;

    for (const playerId of c.playerIDs) {
      this.removePlayer(playerId);
    }

    delete this.clients[clientId];
  
    // Old code
    // Basically ends the game
    // Object.values(this.inputs).forEach(p => { p.action = IDLE; p.queue = []; });
    // this.stop;
    // this.start = false;
  }

  // ------------------------------------------------------------------------------------
  // RECIEVING MESSAGES -----------------------------------------------------------------
  // ------------------------------------------------------------------------------------

  startMatch(lobbyState: LobbyState, token: string): Result {
    if(token != this.adminToken) return {type: "fail", message: "No permission"}
    if (this.started) return {type: "fail", message: "Match already started"};
    if(!lobbyState.started) return {type: "fail", message: "Lobby state not started"}
    
    const playingClients = Object.values(this.clients).filter((c) => c.playerIDs.length > 0);
    if(!playingClients.every(c => c.socket?.readyState === WebSocket.OPEN)) return {type: "fail", message: "Not all players connected"}; //TODO: show this on the frontend

    this.lobbyState = lobbyState;
    this.state = createState(this.teamSizes, this.rules);
    this.last = performance.now();
    this.accumulator = 0;
    this.broadcastLobby();
    this.broadcastSnapshot();
    this.timer = setInterval(() => this.update(), TICK_MS);

    this.broadcastLobby();
    return {type: "ok"};
  }

  input(token: string, clientAction: ClientAction): Result {
    const found = this.findClient(token);
    if (!found) return {type: "error", message: "Invalid token"}
    const {clientId, client} = found

    for (const playerID of Object.keys(clientAction.actions)) {
      if (!client.playerIDs.includes(playerID)) return {type: "fail", message: "Sent an action for a player the client doesn't control."};
      const kick = clientAction.queue[playerID].some((a)=>a.kick)
      const action = {...this.playerActions[playerID], kick};
      this.playerActions[playerID] = action;
    }
    return {type: "ok"}
  }
  // Add player
  addPlayer(token: string, player: LobbyPlayer, rev: number): Result {
    if(rev <= this.lobbyState.rev) return {type: "fail", message: "Outdated action"};

    const playerID = Uuid();
    const found = this.findClient(token);
    if(!found) return {type: "error", message: "Invalid token"}
    const {clientId, client} = found;
    client.playerIDs.push(playerID);

    this.players[playerID] = player;
    this.broadcastLobby();
    // Initialising player input state
    this.playerActions[playerID] = IDLE;

    this.broadcastLobby();
    return {type: "ok"};
  };
  switchPlayerTeam(token: string, playerId: string, rev: number){
    //TODO
  }
  removePlayer(token: string, playerId: string, rev: number): Result {
    if(rev <= this.lobbyState.rev) return {type: "fail", message: "Outdated action"};
    
    const player = this.players[playerId];
    if (!player) return {type: "fail", message: `playerId ${playerId} doesn't exist`};
    const found = this.findClient(token);
    if(!found) return {type: "fail", message: "Invalid token"}
    const {clientId, client} = found;

    delete this.players[playerId];
    delete this.playerActions[playerId];
    client.playerIDs = client.playerIDs.filter(id => id !== playerId);
    this.state = createState(this.teamSizes, this.rules);

    this.broadcastLobby();
    return {type: "ok"};
  }

  setRules(token: string, rules: MatchRules, rev: number){
    //TODO
  }  
}