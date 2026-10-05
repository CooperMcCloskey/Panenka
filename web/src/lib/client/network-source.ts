import { IDLE } from '$lib/engine/actions';
import { SNAPSHOT_NUM, TICK_MS } from '$lib/engine/constants';
import type { Body, GameState, MatchRules } from '$lib/engine/types';
import { decodeState } from '$lib/shared/codec';
import type { KeyboardController } from '$lib/shared/controller';
import type { ClientMessage, LobbyPlayer, LobbyPlayers, ServerMessage } from '$lib/shared/protocol';
import type { StateSource } from '$lib/shared/sources';

const SNAPSHOT_MS = TICK_MS * SNAPSHOT_NUM;

export class NetworkSource implements StateSource {
  private controllers: Record<string, KeyboardController> = {} 
  private socket?: WebSocket;

  private state?: GameState;
  private previous?: GameState;

  private lobbyRev = 0;
  private lobbyPlayers: LobbyPlayers = {};
  private controlledPlayers: string[] = []

  private age = SNAPSHOT_MS;
  private seq = 0;
  private timer?: ReturnType<typeof setInterval>;

  private started = false;

  constructor(
    private code: string, 
    private token: string, 
    private rules: MatchRules,
    private onMessageCallback: (message: ServerMessage) => void,
    private onStatus: (status: string) => void
  ){}
  
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
    socket.onclose = event => {
      this.stop();
      this.onStatus(event.reason || 'Disconnected — reload to reconnect');
    };
    socket.onmessage = event => {
      const message: ServerMessage = JSON.parse(event.data);
      this.onMessage(message)
    };
    socket.onerror = () => this.onStatus('Connection failed');

    this.timer = setInterval(() => this.sendInput(), 100);
  }

  private onMessage(message: ServerMessage){
    this.onMessageCallback(message);
    if(message.type === "lobby") this.onLobbyMessage(message);
    else if(message.type === "snapshot") this.onSnapshotMessage(message);
    else if(message.type === "error") this.onErrorMessage(message);
    throw new Error("Unknown error type");
  }
  private onLobbyMessage(message: ServerMessage & {type: "lobby"}){
    if(message.rev <= this.lobbyRev || this.started) return;
    this.rules = message.rules;
    this.lobbyPlayers = message.players;
    this.controlledPlayers = message.you;
    this.started = message.start;
  }
  private onSnapshotMessage(message: ServerMessage & {type: "snapshot"}){
    const next = decodeState(
      new Float64Array(message.state), 
    );
    this.previous = this.started ? this.state : next;
    this.state = next; this.age = 0; this.started = true;
  }
  private onErrorMessage(message: ServerMessage & {type: "error"}){

  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 8192)
      this.socket.send(JSON.stringify(message));
  }

  startMatch() { this.send({ type: 'start' }); }
  private sendInput() {
    if(!this.state) return; 
    const actions = Object.fromEntries(Object.entries(this.controllers).map(([id, c])=>([id, c.getAction(this.state)])))
    this.send({ type: 'input', seq: this.seq++, actions });
  }

  stop() {
    Object.values(this.controllers).forEach(c => c.detach());
    const idleActions = Object.fromEntries(Object.keys(this.controllers).map(k => [k, IDLE]))
    this.send({ type: 'input', seq: this.seq++, actions: idleActions });
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onclose = null; socket.close(); }
  }

  update(dtMs: number) { this.age += dtMs; }
  currentState() {
    const t = Math.min(this.age / SNAPSHOT_MS, 1);
    const blend = <T extends Body>(a: T, b: T): T => ({ ...b, pos: a.pos.lerp(b.pos, t) });
    return { ...this.state, world: {
      ball: blend(this.previous.world.ball, this.state.world.ball),
      players: this.state.world.players.map((p, i) => blend(this.previous.world.players[i], p)),
    } };
  }
}
