import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { Action, MatchRules } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ServerMessage } from '$lib/shared/protocol';
import type { Client, LobbyPlayer } from "$lib/shared/protocol";

// Uuid for playerID and clientID
const Uuid = self.crypto.randomUUID

// Creating room class
export class Room {
  
  readonly clients: Record<string, Client> = {};
  readonly players: Record<string, LobbyPlayer> = {};
  readonly rules: MatchRules = {kind:"time", minutes: 5};
  state = null!;
  private timer?: ReturnType<typeof setInterval>;
  private endTimer?: ReturnType<typeof setTimeout>;
  private active = false;
  private last = 0;
  private accumulator = 0;
  constructor(readonly code: string) {};

  // Methods
  get usernames() { return Object.values(this.players); }

  summary() { return { code: this.code, rules: this.rules, usernames: this.usernames }; }

  // Add player and client
  addPlayer(username: string) {
    const playerID = Uuid();
    const player: LobbyPlayer = {username, action: IDLE, queue: [], seq: -1, recieved: 0};
    this.players[playerID] = player;
    this.broadcastLobby();
    return player;
  }

  addClient(){
    const client = { token: nanoid(32) }
    return client;
  }

  send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 256_000) { socket.close(1013, 'Connection too slow'); return; }
      socket.send(JSON.stringify(message));
    }
  }
  
  broadcastLobby() {
    this.players.forEach((p, playerIndex) => {
      if (p.socket) this.send(p.socket, { type: 'lobby', usernames: this.usernames,
        connected: this.players.map(p => !!p.socket), playerIndex, active: this.active });
    });
  }
  connect(token: string, socket: WebSocket) {
    const player = this.players.find(p => p.token === token);
    if (!player) return undefined;
    player.socket?.close(1000, 'Reconnected elsewhere');
    player.socket = socket;
    player.action = IDLE; player.queue = []; player.seq = -1; player.received = performance.now();
    this.broadcastLobby();
    if (this.active) this.send(socket, { type: 'snapshot', state: Array.from(encodeState(this.state)) });
    if (this.active && !this.state.match.winner && !this.timer) {
      this.last = performance.now();
      this.accumulator = 0;
      this.timer = setInterval(() => this.update(), TICK_MS);
    }
    return player;
  }
  startMatch(token: string, socket: WebSocket) {
    if (this.active || !this.players.some(p => p.token === token && p.socket === socket)
      || this.players.length !== this.numPlayers * 2 || !this.players.every(p => p.socket)) return;
    this.state = createState({ blue: this.numPlayers, orange: this.numPlayers }, this.rules);
    this.players.forEach(p => { p.action = IDLE; p.queue = []; p.received = performance.now(); });
    this.active = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.broadcastLobby();
    this.broadcastSnapshot();
    this.timer = setInterval(() => this.update(), TICK_MS);
  }
  private broadcastSnapshot() {
    const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
    this.players.forEach(p => { if (p.socket) this.send(p.socket, message); });
  }
  input(token: string, socket: WebSocket, seq: number, action: Action) {
    const p = this.players.find(p => p.token === token && p.socket === socket);
    if (!p || seq <= p.seq) return;
    p.seq = seq; p.received = performance.now();
    // Keep kick transitions until a simulation tick consumes them.
    const previous = p.queue.at(-1) ?? p.action;
    if (previous.kick !== action.kick) {
      if (p.queue.length >= 16) { socket.close(1008, 'Too many inputs'); return; }
      p.queue.push(action);
    } else if (p.queue.length) p.queue[p.queue.length - 1] = action;
    else p.action = action;
  }
  disconnect(socket: WebSocket) {
    const p = this.players.find(p => p.socket === socket);
    if (!p) return;
    p.socket = undefined; p.action = IDLE; p.queue = [];
    this.broadcastLobby();
    if (!this.players.some(p => p.socket)) this.stop();
  }
  removePlayer(token: string) {
    const index = this.players.findIndex(p => p.token === token);
    if (index === -1) return;
    this.stop();
    this.active = false;
    this.players.splice(index, 1);
    this.state = createState({ blue: this.numPlayers, orange: this.numPlayers }, this.rules);
    this.players.forEach(p => { p.action = IDLE; p.queue = []; });
    this.broadcastLobby();
  }
  private update() {
    const now = performance.now();
    this.accumulator += Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    while (this.accumulator >= TICK_MS) {
      const actions = this.players.map(p => {
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
