import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { step } from '$lib/engine/step';
import type { Action, GameState, MatchRules, Team } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { LobbyPlayers, LobbyState, ServerMessage } from '$lib/shared/protocol';
import type { Client, LobbyPlayer } from "$lib/shared/protocol";

// Uuid for playerID and clientID. Wrapped rather than `crypto.randomUUID` on its own:
// it has to be called on crypto, or it throws "Value of this must be of type Crypto"
const Uuid = () => crypto.randomUUID();

// Creating room class
export class Room {

  readonly adminId: string;
  readonly clients: Record<string, Client> = {};
  readonly players: LobbyPlayers = {};
  readonly rules: MatchRules = {kind:"time", minutes: 5};
  state?: GameState;

  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private active = false;
  private last = 0;
  private accumulator = 0;

  constructor(readonly code: string, adminUsername: string) {
    const {clientId: adminId, client: adminClient} = this.addClient(adminUsername);
    this.adminId = adminId;
  };

  get usernames() { return Object.values(this.players).map( p => p.username); }

  get spectators(): Record<string, string> { 
    return Object.fromEntries(
      Object.entries(this.clients)
      .filter(([_, client])=>(client.playerIDs.length === 0))
      .map(([id, client])=>([id, client.username]))
    )
  }

  get lobbyState(): LobbyState { 
    const {rules, players, spectators} = this;
    return { rev: 0, rules, players, spectators } 
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
    return player;
  };
  
  getToken(id: string): string | undefined { return this.clients[id].token }
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

  // TODO Refactor
  // Probablly getting axed
  broadcastLobby() {
    const clients = Object.values(this.clients);
    const usernames = clients.map(c => c.username);
    const connected = clients.map(c => c.socket?.readyState === WebSocket.OPEN);
    const lobbyState = { rules: this.rules, players: this.players };

    for (const client of clients) {
      if (client.socket) {
        this.send(client.socket, {
          type: 'lobby',
          usernames,
          connected,
          lobbyState,
          controlledPlayerIds: client.playerIDs,
          active: this.active,
        });
      }
    }
  }

  connect(token: string, socket: WebSocket, index?: number) {
    const client = this.clients[token];
    if (!client) return undefined;
    client.socket?.close(1000, 'Reconnected elsewhere');
    client.socket = socket;

    const player = this.getPlayerFromClient(client, index)

    player.action = IDLE; player.queue = []; player.seq = -1; player.received = performance.now();

    // TODO Fix broadcast function
    this.broadcastLobby();

    if (this.active) this.send(socket, { type: 'snapshot', state: Array.from(encodeState(this.state)) });

    // Fix
    if (this.state && this.active && !this.state.match.winner && !this.timer) {
      this.last = performance.now();
      this.accumulator = 0;
      this.timer = setInterval(() => this.update(), TICK_MS);
    }
    return player;
  }

  // TODO Getting axed by Cooper
  // startMatch(token: string, socket: WebSocket) {
  //   if (this.active || !Object.values(this.clients).some(c => c.token === token && c.socket === socket)
  //     || this.players.length !== this.numPlayers * 2 || !this.players.every(p => p.socket)) return;
  //   this.state = createState({ blue: this.numPlayers, orange: this.numPlayers }, this.rules);
  //   this.players.forEach(p => { p.action = IDLE; p.queue = []; p.received = performance.now(); });
  //   this.active = true;
  //   this.last = performance.now();
  //   this.accumulator = 0;
  //   this.broadcastLobby();
  //   this.broadcastSnapshot();
  //   this.timer = setInterval(() => this.update(), TICK_MS);
  // }

  private broadcastSnapshot() {
    if (!this.state) return undefined;
    const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
    Object.values(this.clients).forEach(c => { if (c.socket) this.send(c.socket, message); });
  }

  input(token: string, socket: WebSocket, seq: number, action: Action, playerIndex?: number) {
    const c = Object.values(this.clients).find(c => c.token === token && c.socket === socket);
    if (!c) return undefined;

    const p = this.getPlayerFromClient(c, playerIndex)

    if (!p || seq <= p.seq) return;
    p.seq = seq; p.received = performance.now();
    // Keep kick transitions until a simulation tick consumes them
    const previous = p.queue.at(-1) ?? p.action;
    if (previous.kick !== action.kick) {
      if (p.queue.length >= 16) { socket.close(1008, 'Too many inputs'); return; }
      p.queue.push(action);
    } else if (p.queue.length) p.queue[p.queue.length - 1] = action;
    else p.action = action;
  }

  disconnect(socket: WebSocket) {
    const c = Object.values(this.clients).find(c => c.socket === socket);
    if (!c) return;
    c.socket = undefined; 

    for (let i = 0; i < c.playerIDs.length; i++){
      const player = this.getPlayerFromClient(c,i)
      player.action = IDLE; player.queue = [];
    }

    this.broadcastLobby();
    if (!Object.values(this.clients).some(c=> c.socket)) this.stop();
  }

  removePlayer(playerID: string) {
    const player = this.players[playerID];
    if (!player) return;
    this.stop();
    this.active = false;
    delete this.players[playerID];

    // TODO (fix) createState is being altered by cooper so i have no idea how this is gna work
    // this.state = createState({ blue: this.numPlayers, orange: this.numPlayers }, this.rules);

    // Basically ends the game
    Object.values(this.players).forEach(p => { p.action = IDLE; p.queue = []; });
    this.broadcastLobby();
  }

  private update() {
    const now = performance.now();
    this.accumulator += Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    while (this.accumulator >= TICK_MS) {
      const actions = Object.values(this.players).map(p => {
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
          this.active = false;
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
    if (this.state.match.winner !== null) this.active = false;
  }
}
