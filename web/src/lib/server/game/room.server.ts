import { nanoid } from 'nanoid';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS, MAX_FRAME_MS, SNAPSHOT_NUM } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { Action, MatchRules } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { ServerMessage } from '$lib/shared/protocol';

export class Room {
  readonly players: { token: string; username: string; socket?: WebSocket;
    action: Action; queue: Action[]; seq: number; received: number }[] = [];
  state;
  private timer?: ReturnType<typeof setInterval>;
  private last = 0;
  private accumulator = 0;
  constructor(readonly code: string, readonly rules: MatchRules, readonly numPlayers: number) {
    this.state = createState({ blue: numPlayers, orange: numPlayers }, rules);
  }
  get usernames() { return this.players.map(p => p.username); }
  summary() { return { code: this.code, rules: this.rules, numPlayers: this.numPlayers, usernames: this.usernames }; }
  addPlayer(username: string) {
    if (this.players.length >= this.numPlayers * 2) return undefined;
    const player = { token: nanoid(32), username, action: IDLE, queue: [] as Action[], seq: -1, received: 0 };
    this.players.push(player);
    this.broadcastLobby();
    return player;
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
        connected: this.players.map(p => !!p.socket), playerIndex });
    });
  }
  connect(token: string, socket: WebSocket) {
    const player = this.players.find(p => p.token === token);
    if (!player) return undefined;
    player.socket?.close(1000, 'Reconnected elsewhere');
    player.socket = socket;
    player.action = IDLE; player.queue = []; player.seq = -1; player.received = performance.now();
    this.broadcastLobby();
    if (this.state.match.tick > 0) this.send(socket, { type: 'snapshot', state: Array.from(encodeState(this.state)) });
    if (!this.timer && this.players.length === this.numPlayers * 2 && this.players.every(p => p.socket)) {
      this.last = performance.now();
      this.accumulator = 0;
      this.timer = setInterval(() => this.update(), TICK_MS);
    }
    return player;
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
      if (this.state.match.tick % SNAPSHOT_NUM === 0) {
        const message: ServerMessage = { type: 'snapshot', state: Array.from(encodeState(this.state)) };
        this.players.forEach(p => { if (p.socket) this.send(p.socket, message); });
      }
    }
  }
  stop() { clearInterval(this.timer); this.timer = undefined; }
}
