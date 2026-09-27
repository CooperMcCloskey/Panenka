import { IDLE } from '$lib/engine/actions';
import { createState } from '$lib/engine/state';
import type { Action, Body, MatchRules } from '$lib/engine/types';
import { decodeState } from '$lib/shared/codec';
import type { ClientMessage, ServerMessage } from '$lib/shared/protocol';
import type { StateSource } from '$lib/shared/sources';
import { loadControls } from './bindings';

export class NetworkSource implements StateSource {
  private socket?: WebSocket;
  private held = new Set<string>();
  private controls = loadControls()[0];
  private state;
  private previous;
  private age = 50;
  private seq = 0;
  private timer?: ReturnType<typeof setInterval>;
  private started = false;
  constructor(private code: string, private token: string, private rules: MatchRules,
    private numPlayers: number, private onMessage: (message: ServerMessage) => void,
    private onStatus: (status: string) => void) {
    this.state = createState({ blue: numPlayers, orange: numPlayers }, rules);
    this.previous = this.state;
  }
  start() {
    if (this.socket) return;
    const url = new URL(window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.port = '8080'; url.pathname = '/'; url.search = ''; url.hash = '';
    const socket = this.socket = new WebSocket(url);
    this.onStatus('Connecting');
    socket.onopen = () => {
      this.send({ type: 'join', code: this.code, token: this.token });
      this.onStatus('Connected');
    };
    socket.onmessage = event => {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.type === 'snapshot') {
        const next = decodeState(new Float64Array(message.state), this.rules,
          { blue: this.numPlayers, orange: this.numPlayers });
        this.previous = this.started ? this.state : next;
        this.state = next; this.age = 0; this.started = true;
      }
      this.onMessage(message);
    };
    socket.onclose = event => {
      this.stop();
      this.onStatus(event.reason || 'Disconnected — reload to reconnect');
    };
    socket.onerror = () => this.onStatus('Connection failed');
    addEventListener('keydown', this.keydown);
    addEventListener('keyup', this.keyup);
    addEventListener('blur', this.blur);
    this.timer = setInterval(() => this.sendInput(), 100);
  }
  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 8192)
      this.socket.send(JSON.stringify(message));
  }
  private sendInput() {
    const key = (name: string) => this.held.has(name) ? 1 : 0;
    const c = this.controls;
    const action: Action = { moveX: (key(c.right) - key(c.left)) as Action['moveX'],
      moveY: (key(c.down) - key(c.up)) as Action['moveY'], kick: !!key(c.kick) };
    this.send({ type: 'input', seq: this.seq++, action });
  }
  private keydown = (e: KeyboardEvent) => {
    if (!Object.values(this.controls).includes(e.code)) return;
    e.preventDefault();
    if (this.held.has(e.code)) return;
    this.held.add(e.code); this.sendInput();
  };
  private keyup = (e: KeyboardEvent) => {
    if (!Object.values(this.controls).includes(e.code)) return;
    e.preventDefault(); this.held.delete(e.code); this.sendInput();
  };
  private blur = () => { this.held.clear(); this.sendInput(); };
  stop() {
    clearInterval(this.timer);
    removeEventListener('keydown', this.keydown);
    removeEventListener('keyup', this.keyup);
    removeEventListener('blur', this.blur);
    this.held.clear();
    this.send({ type: 'input', seq: this.seq++, action: IDLE });
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onclose = null; socket.close(); }
  }
  update(dtMs: number) { this.age += dtMs; }
  currentState() {
    const t = Math.min(this.age / 50, 1);
    const blend = <T extends Body>(a: T, b: T): T => ({ ...b, pos: a.pos.lerp(b.pos, t) });
    return { ...this.state, world: {
      ball: blend(this.previous.world.ball, this.state.world.ball),
      players: this.state.world.players.map((p, i) => blend(this.previous.world.players[i], p)),
    } };
  }
}
