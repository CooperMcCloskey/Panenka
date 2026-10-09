import { IDLE } from '$lib/engine/actions';
import { createState } from '$lib/engine/state';
import type { GameState, MatchRules, TeamSizes } from '$lib/engine/types';
import { decodeState } from '$lib/shared/codec';
import { KeyboardController } from '$lib/shared/controller';
import { loadControls } from '$lib/client/bindings';
import type { ClientMessage, LobbyPlayer, LobbyState, PlayerId, ServerMessage } from '$lib/shared/protocol';
import type { StateSource } from '$lib/shared/sources';
import { SnapshotInterpolator, type InterpolationSettings } from './snapshot-interpolator';
import { InputSender } from './input-sender';
import { TICK_MS } from '$lib/engine/constants';
import { ClientPrediction, type PredictionSettings } from './client-prediction';
import { NetworkMetrics } from './network-metrics';
import type { ClientAction } from '$lib/shared/protocol';

export type NetworkPlaybackSettings = Partial<InterpolationSettings> & {
  prediction?: false | Partial<PredictionSettings>;
};

export class NetworkSource implements StateSource {
  private controllers: Record<PlayerId, KeyboardController> = {} 
  private socket?: WebSocket;

  private snapshots: SnapshotInterpolator;
  private prediction?: ClientPrediction;
  private metrics = new NetworkMetrics();
  private inputSequence = 0;
  private lastSnapshotTick = -1;

  private controlledPlayers: PlayerId[] = []

  private inputSender = new InputSender(() => this.sendInput(), () => this.lobbyState.started);

  get diagnostics() {
    return { ...this.snapshots.diagnostics, ...this.metrics.diagnostics,
      ...this.prediction?.diagnostics, predictionActive: this.prediction?.diagnostics.predictionActive ?? false,
      queuedInputBytes: this.socket?.bufferedAmount ?? 0 };
  }

  constructor(
    private code: string, 
    private token: string, 
    private lobbyState: LobbyState,
    private onMessageCallback: (message: ServerMessage) => void,
    private onStatus: (status: string) => void,
    interpolation: NetworkPlaybackSettings = {},
  ) {
    this.snapshots = new SnapshotInterpolator(interpolation);
    if (interpolation.prediction !== false) this.prediction = new ClientPrediction(interpolation.prediction);
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

    this.inputSender.start();
  }
  stop() {
    Object.values(this.controllers).forEach(c => c.detach());
    this.inputSender.stop();
    this.prediction?.clear();
    this.metrics.clear();

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
    if (!this.lobbyState.started) {
      this.snapshots.clear();
      this.prediction?.clear();
      this.metrics.clear();
      this.lastSnapshotTick = -1;
    }
    if (this.lobbyState.started) this.onInputChanged(false);
    else this.inputSender.changed();
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
    this.prediction?.clear();
    const controls = loadControls();
    this.controllers = Object.fromEntries(
      this.controlledPlayers.slice(0, controls.length).map((id, i) => [id,
        new KeyboardController(controls[i], this.onInputChanged)])
    );
    if (this.socket) Object.values(this.controllers).forEach(c => c.attach());
    this.onInputChanged(false);
  }
  private onSnapshotMessage(message: ServerMessage & {type: "snapshot"}){
    const now = performance.now();
    const next = decodeState(
      new Float64Array(message.state), 
    );
    if (next.match.tick <= this.lastSnapshotTick) return;
    this.lastSnapshotTick = next.match.tick;
    this.snapshots.push(next, now);
    this.metrics.snapshot(message.network, now);
    this.prediction?.input(this.heldInput(), now, this.predictionTick(now));
    this.prediction?.push(next, message.network, this.lobbyState.playerMapping, now, this.predictionTick(now));
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
    // Preserve latched kicks until a packet can actually be sent. Don't queue
    // additional movement behind an earlier packet on a congested connection.
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 0) return false;
    const actions = Object.fromEntries(Object.entries(this.controllers).map(([id, c])=>([id, c.getAction()])))
    const now = performance.now();
    const sequence = ++this.inputSequence;
    this.send({ type: 'input', actions, sequence });
    this.metrics.sent(sequence, now);
    this.prediction?.inputSent(sequence);
    // A press and release coalesced into a short kick needs its release sent
    // promptly too, otherwise the server would hold kick until the heartbeat.
    if (Object.entries(this.controllers).some(([id, controller]) => actions[id].kick && !controller.peekHeldAction().kick)) {
      // The kick packet acknowledges the tap, not the release that still needs
      // sending. Retain that release in prediction until its own acknowledgement.
      this.prediction?.input(this.heldInput(), now, this.predictionTick(now), true);
      this.inputSender.changed();
    }
    return true;
  }

  private heldInput(): ClientAction {
    return Object.fromEntries(Object.entries(this.controllers).map(([id, controller]) => [id, controller.peekHeldAction()]));
  }

  private predictionTick(nowMs: number): number {
    // The arrival clock already trails the server by downstream delay. A full
    // measured RTT leads it to the estimated tick at which new inputs arrive.
    return this.lastSnapshotTick < 0 ? 0 : this.snapshots.estimatedTick(nowMs) + this.metrics.rttMs / TICK_MS;
  }

  private onInputChanged = (measure = true) => {
    const now = performance.now();
    this.prediction?.input(this.heldInput(), now, this.predictionTick(now));
    if (measure) this.metrics.changed(now);
    this.inputSender.changed();
  };
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
    const now = performance.now();
    const authoritative = this.snapshots.sample(now);
    this.metrics.frame(this.snapshots.diagnostics.renderTick, now);
    return this.prediction?.sample(now, this.predictionTick(now))
      ?? authoritative ?? createState(this.getTeamSizes(), this.lobbyState.rules);
  }
}
