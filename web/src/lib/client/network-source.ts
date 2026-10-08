import { IDLE } from '$lib/engine/actions';
import { TICK_MS } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import type { GameState, MatchRules, TeamSizes } from '$lib/engine/types';
import { decodeState } from '$lib/shared/codec';
import { KeyboardController } from '$lib/shared/controller';
import { loadControls } from '$lib/client/bindings';
import type { ClientMessage, LobbyPlayer, LobbyState, PlayerId, ServerMessage } from '$lib/shared/protocol';
import type { StateSource } from '$lib/shared/sources';
import { SnapshotInterpolator, type InterpolationSettings } from './snapshot-interpolator';

export class NetworkSource implements StateSource {
  private controllers: Record<PlayerId, KeyboardController> = {} 
  private socket?: WebSocket;

  private snapshots: SnapshotInterpolator;

  private controlledPlayers: PlayerId[] = []

  private sendInputTimer?: ReturnType<typeof setInterval>;

  constructor(
    private code: string, 
    private token: string, 
    private lobbyState: LobbyState,
    private onMessageCallback: (message: ServerMessage) => void,
    private onStatus: (status: string) => void,
    interpolation: Partial<InterpolationSettings> = {},
  ) {
    this.snapshots = new SnapshotInterpolator(interpolation);
  }
  
  start() {
    Object.values(this.controllers).forEach(c => c.attach());

    if (this.socket) return;
    const url = new URL(window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws'; url.search = ''; url.hash = ''; // same host and port as the page
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

    this.sendInputTimer = setInterval(() => { if(this.lobbyState.started) this.sendInput() }, TICK_MS);
  }
  stop() {
    Object.values(this.controllers).forEach(c => c.detach());
    clearInterval(this.sendInputTimer)

    const idleActions = Object.fromEntries(this.controlledPlayers.map((playerId)=>[playerId, IDLE]))
    this.send({ type: 'input', actions: idleActions});
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onclose = null; socket.close(); }
  }

  private onMessage(message: ServerMessage){
    this.onMessageCallback(message);
    if(message.type === "lobby") this.onLobbyMessage(message);
    else if(message.type === "snapshot") this.onSnapshotMessage(message);
    else if(message.type === "error") this.onErrorMessage(message);
    else throw new Error("Unknown error type");
  }
  private onLobbyMessage(message: ServerMessage & {type: "lobby"}){
    if(message.lobbyState.rev <= this.lobbyState.rev) return;
    this.lobbyState = message.lobbyState
    this.setControlledPlayers(message.controlledPlayerIds);
    // Back in the lobby: forget the old match so the next one doesn't blend from its last frame
    if (!this.lobbyState.started) this.snapshots.clear();
  }
  private setControlledPlayers(playerIds: PlayerId[]) {
    if (playerIds.join() === this.controlledPlayers.join()) return; // keeps held keys on unrelated lobby updates
    this.controlledPlayers = playerIds;
    this.reloadControls();
  }
  // One keyboard controller per player this client controls: the first uses the left side
  // of the keyboard, the second the right (the same bindings as local play).
  // Also called after the key bindings are edited, so they apply straight away
  reloadControls() {
    Object.values(this.controllers).forEach(c => c.detach());
    const controls = loadControls();
    this.controllers = Object.fromEntries(
      this.controlledPlayers.slice(0, controls.length).map((id, i) => [id, new KeyboardController(controls[i])])
    );
    if (this.socket) Object.values(this.controllers).forEach(c => c.attach());
  }
  private onSnapshotMessage(message: ServerMessage & {type: "snapshot"}){
    const next = decodeState(
      new Float64Array(message.state), 
    );
    this.snapshots.push(next, performance.now());
    this.lobbyState.started = true;
  }
  private onErrorMessage(message: ServerMessage & {type: "error"}){
    //TODO
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 8192)
      this.socket.send(JSON.stringify(message));
  }
  private sendInput() {
    const actions = Object.fromEntries(Object.entries(this.controllers).map(([id, c])=>([id, c.getAction()])))
    this.send({ type: 'input', actions });
  }
  startMatch() { this.send({ 
    type: 'start', 
    lobbyState: {...this.lobbyState, started: true} 
  }); }
  
  addPlayer(player: LobbyPlayer) {
    this.send({
      type: "addPlayer",
      player,
      rev: this.lobbyState.rev + 1
    })
  }
  deletePlayer(playerId: PlayerId) {
    this.send({
      type: 'removePlayer',
      playerId,
      rev: this.lobbyState.rev + 1
    })
  }
  setRules(rules: MatchRules) {
    this.send({
      type: 'setRules',
      newRules: rules,
      rev: this.lobbyState.rev + 1
    })
  }
  endMatch() { this.send({ type: 'endMatch' }); }
  getTeamSizes(): TeamSizes{
    let blue = 0;
    let orange = 0;
    Object.values(this.lobbyState.players).forEach(p => p.team === "blue" ? blue++ : orange++)
    return {blue, orange}
  }

  // Snapshot playback uses the monotonic clock when the current frame is drawn.
  update(_dtMs: number) {}
  currentState(): GameState {
    return this.snapshots.sample(performance.now())
      ?? createState(this.getTeamSizes(), this.lobbyState.rules);
  }
}
