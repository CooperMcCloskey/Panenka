import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { step } from '$lib/engine/step';
import { type Action, type GameState, type MatchRules } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import { NEW_LOBBY_STATE, type ClientAction, type LobbyState, type ServerMessage } from '$lib/shared/protocol';
import type { Client, ClientId, LobbyPlayer, PublicClient } from "$lib/shared/protocol";
import { createState } from '$lib/engine/state'
import { MAX_TEAMSIZE } from '$lib/engine/rules';
import { isValidRules, isValidUsername, MAX_LOCAL_PLAYERS } from '$lib/shared/limits';
import { GAME_END_DELAY, MAX_SNAPSHOT_BACKLOG_BYTES } from './constants';
import { InputBuffer } from './input-buffer';

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
  lobbyState: LobbyState = NEW_LOBBY_STATE();
  state: GameState = createState({blue: 0, orange: 0}, this.lobbyState.rules);

  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private last = 0;
  private accumulator = 0;

  //maps playerId to playerAction
  private readonly playerActions: Record<string, Action> = {};
  private readonly inputBuffers: Record<ClientId, InputBuffer> = {};

  constructor(readonly code: string, adminUsername: string) {
    const {clientId: adminId, client: adminClient} = this.addClient(adminUsername);
    this.adminId = adminId;
    this.adminToken = adminClient.token;
    this.broadcastLobby()
  };
  cleanup() {
    clearInterval(this.timer); this.timer = undefined;
    clearTimeout(this.endTimer); this.endTimer = undefined;
  }

  private update() {
    // setInterval drifts, so run however many ticks of real time have passed (capped after a stall)
    const now = performance.now();
    this.accumulator += Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;

    let snapshotDue = false;
    while (this.accumulator >= TICK_MS) {
      for (const [clientId, client] of Object.entries(this.clients)) {
        const input = this.inputBuffers[clientId]?.consume();
        if (input) for (const id of client.controlledPlayers)
          this.playerActions[id] = input.actions[id] ?? IDLE;
      }
      const actions = this.playerMapping.map((id)=>this.playerActions[id])
      this.state = step(this.state, actions);
      this.accumulator -= TICK_MS;
      // After the final whistle players can keep moving (step() ignores goals then)
      // for GAME_END_DELAY, then everyone goes back to the lobby
      if (this.state.match.winner !== null && !this.endTimer) {
        this.endTimer = setTimeout(() => this.returnToLobby(), GAME_END_DELAY);
      }
      if (this.state.match.tick % SNAPSHOT_NUM === 0) snapshotDue = true;
    }
    // After an event-loop stall, send the current state once instead of a burst
    // of intermediate states that would already be stale when they arrive.
    if (snapshotDue) this.broadcastSnapshot();
  }

  // -----------------------------------------------------------------------------
  // GETTERS --------------------------------------------------------------------
  // -----------------------------------------------------------------------------

  get players() { return this.lobbyState.players }
  get rules() { return this.lobbyState.rules }
  get started() { return this.lobbyState.started }
  get playerMapping() { return this.lobbyState.playerMapping }
  get usernames() { return Object.values(this.players).map( p => p.username); }
  // What every client may see about each client: never the token or socket
  get publicClients(): Record<ClientId, PublicClient> {
    return Object.fromEntries(Object.entries(this.clients).map(([id, c]) =>
      [id, { username: c.username, controlledPlayers: [...c.controlledPlayers] }]));
  }

  get teamSizes(): {blue: number, orange: number} {
    const blue: number = Object.values(this.players).filter(c => c.team === "blue").length;
    const orange: number = Object.keys(this.players).length - blue;
    return {blue, orange}
  }
  // Modular get player func
  getPlayerFromClient(c: Client, index?: number):LobbyPlayer {
    if (!index) {index = 0};
    const playerID = c.controlledPlayers[index];
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

    this.lobbyState.adminId = this.adminId;
    this.lobbyState.clients = this.publicClients;

    for (const client of clients) {
      if (client.socket) {
        this.send(client.socket, {
          type: 'lobby',
          lobbyState: this.lobbyState,
          controlledPlayerIds: client.controlledPlayers,
        });
      }
    }
  };
  private broadcastSnapshot() {
    const state = Array.from(encodeState(this.state));
    for (const [clientId, client] of Object.entries(this.clients)) {
      if (client.socket && client.socket.bufferedAmount <= MAX_SNAPSHOT_BACKLOG_BYTES) this.send(client.socket, {
        type: 'snapshot', state,
        acknowledgedSequence: this.inputBuffers[clientId]?.acknowledgedSequence ?? 0,
      });
    }
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
    this.inputBuffers[clientId] = new InputBuffer();

    this.broadcastLobby();

    if (this.started && this.state) this.send(socket, {
      type: 'snapshot', state: Array.from(encodeState(this.state)), acknowledgedSequence: 0,
    });

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
    const clientId = Object.keys(this.clients).find(id => this.clients[id] === c)!;
    this.inputBuffers[clientId] = new InputBuffer();

    // Loop for each player in a client
    for (let i = 0; i < c.controlledPlayers.length; i++){
      // Get playerID
      let playerId = c.controlledPlayers[i];
      //Then get the p object from inputs and set them to nothing
      // TODO figure out if this actually needs doing
      this.playerActions[playerId] = IDLE;
    }

    this.broadcastLobby();
    if (!Object.values(this.clients).some(c=> c.socket)) {
      // Pause, unless the match is already over: then there's nothing to resume, so go to the lobby
      if (this.state.match.winner !== null) this.returnToLobby();
      else this.cleanup();
    }
  }

  addClient(username: string): {clientId: string, client: Client}{ 
    const client: Client = { token: nanoid(32), controlledPlayers: [], username};
    const clientId = Uuid();
    this.clients[clientId] = client;
    this.inputBuffers[clientId] = new InputBuffer();
    this.broadcastLobby();
    return {clientId, client};
  }
  removeClient(token: string): Result {
    const found = this.findClient(token);
    if(!found) return {type: "error", message: "Invalid Token"}
    const {clientId, client} = found;

    for (const playerId of client.controlledPlayers) delete this.players[playerId];
    delete this.clients[clientId];
    delete this.inputBuffers[clientId];
    this.broadcastLobby()
    return {type: "ok"}
  }

  // ------------------------------------------------------------------------------------
  // RECIEVING MESSAGES -----------------------------------------------------------------
  // ------------------------------------------------------------------------------------

  startMatch(lobbyState: LobbyState, token: string): Result {
    if(token != this.adminToken) return {type: "fail", message: "No permission"}
    if (this.started) return {type: "fail", message: "Match already started"};
    if(!lobbyState.started) return {type: "fail", message: "Lobby state not started"}
    
    const playingClients = Object.values(this.clients).filter((c) => c.controlledPlayers.length > 0);
    if(!playingClients.every(c => c.socket?.readyState === WebSocket.OPEN)) return {type: "fail", message: "Not all players connected"}; //TODO: show this on the frontend

    this.lobbyState = lobbyState;
    this.resetInputs();
    this.state = createState(this.teamSizes, this.rules);
    this.last = performance.now();
    this.accumulator = 0;
    this.broadcastLobby();
    this.broadcastSnapshot();
    this.timer = setInterval(() => this.update(), TICK_MS);

    this.broadcastLobby();
    return {type: "ok"};
  }

  input(token: string, actions: ClientAction, sequence: number): Result {
    const found = this.findClient(token);
    if (!found) return {type: "error", message: "Invalid token"}
    const {clientId, client} = found

    for (const [playerID, action] of Object.entries(actions)) {
      if (!client.controlledPlayers.includes(playerID)) return {type: "fail", message: "Sent an action for a player the client doesn't control."};
    }
    if (this.started) this.inputBuffers[clientId].push({ sequence, actions });
    return {type: "ok"}
  }
  // Add player
  addPlayer(token: string, player: LobbyPlayer, rev: number): Result {
    if(rev <= this.lobbyState.rev) return {type: "fail", message: "Outdated action"};

    const found = this.findClient(token);
    if(!found) return {type: "error", message: "Invalid token"}
    const {clientId, client} = found;
    // The add menu enforces these too, but only the server's check counts
    if(player.team !== "blue" && player.team !== "orange") return {type: "fail", message: "Invalid team"};
    if(!isValidUsername(player.username)) return {type: "fail", message: "Invalid username"};
    if(client.controlledPlayers.length >= MAX_LOCAL_PLAYERS) return {type: "fail", message: "Too many players on one client"};
    if(this.teamSizes[player.team] >= MAX_TEAMSIZE) return {type: "fail", message: "Team is full"};

    const playerId = Uuid();
    client.controlledPlayers.push(playerId);

    // Blue players go before orange ones; teamSizes doesn't count this player yet
    if(player.team === "blue") this.lobbyState.playerMapping.splice(this.teamSizes.blue, 0, playerId);
    if(player.team === "orange") this.lobbyState.playerMapping.push(playerId)
    // Rebuilt so no extra fields from the client message are stored
    this.players[playerId] = { username: player.username.trim(), team: player.team };
    this.playerActions[playerId] = IDLE;

    this.broadcastLobby();
    return {type: "ok"};
  };
  switchPlayerTeam(token: string, playerId: string, rev: number){
    //TODO
  }
  removePlayer(token: string, playerId: string, rev: number): Result {
    if(rev <= this.lobbyState.rev) return {type: "fail", message: "Outdated action"};
    if(this.started) return {type: "fail", message: "Match already started"};

    const player = this.players[playerId];
    if (!player) return {type: "fail", message: `playerId ${playerId} doesn't exist`};
    const found = this.findClient(token);
    if(!found) return {type: "fail", message: "Invalid token"}
    const {clientId, client} = found;
    // A client can remove its own players; the admin can remove anyone's
    if(clientId !== this.adminId && !client.controlledPlayers.includes(playerId)) return {type: "fail", message: "No permission"};

    const owner = Object.values(this.clients).find(c => c.controlledPlayers.includes(playerId));
    if(owner) owner.controlledPlayers = owner.controlledPlayers.filter(id => id !== playerId);
    delete this.players[playerId];
    delete this.playerActions[playerId];
    this.lobbyState.playerMapping = this.playerMapping.filter(id => id !== playerId);
    this.state = createState(this.teamSizes, this.rules);

    this.broadcastLobby();
    return {type: "ok"};
  }

  // Ends the match early and sends everyone back to the lobby
  endMatch(token: string): Result {
    if(token !== this.adminToken) return {type: "fail", message: "No permission"};
    if(!this.started) return {type: "fail", message: "No match in progress"};

    this.returnToLobby();
    return {type: "ok"};
  }

  // Stops the match (tick loop and any pending end-of-match timer) and sends everyone to the lobby
  private returnToLobby() {
    this.cleanup();
    this.resetInputs();
    this.lobbyState.started = false;
    this.broadcastLobby();
  }

  private resetInputs() {
    for (const clientId of Object.keys(this.clients)) this.inputBuffers[clientId] = new InputBuffer();
    for (const id of Object.keys(this.playerActions)) this.playerActions[id] = IDLE;
  }

  // No rev check: only the admin changes rules, so their latest message should win
  // even if it was sent before the previous change came back
  setRules(token: string, rules: MatchRules, rev: number): Result {
    if(token !== this.adminToken) return {type: "fail", message: "No permission"};
    if(this.started) return {type: "fail", message: "Match already started"};
    if(!isValidRules(rules)) return {type: "fail", message: "Invalid rules"};

    // Rebuilt so no extra fields from the client message are stored
    this.lobbyState.rules = rules.kind === "time"
      ? { kind: "time", minutes: rules.minutes }
      : { kind: "goals", target: rules.target };
    this.broadcastLobby();
    return {type: "ok"};
  }
}
