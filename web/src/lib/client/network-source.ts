import { IDLE } from '$lib/engine/actions';
import { MAX_FRAME_MS, TICK_MS } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import type { GameState, MatchRules, TeamSizes } from '$lib/engine/types';
import { decodeState } from '$lib/shared/codec';
import { KeyboardController } from '$lib/shared/controller';
import { loadControls } from '$lib/client/bindings';
import type { ClientMessage, LobbyPlayer, LobbyState, PlayerId, ServerMessage } from '$lib/shared/protocol';
import type { StateSource } from '$lib/shared/sources';
import { NETCODE_SETTINGS, type NetcodeSettings } from '$lib/shared/netcode';
import { SnapshotBuffer } from './snapshot-buffer';
import { LocalPrediction } from './local-prediction';

export class NetworkSource implements StateSource {
  private controllers: Record<PlayerId, KeyboardController> = {} 
  private socket?: WebSocket;

  private state?: GameState;
  private snapshots: SnapshotBuffer;
  private prediction: LocalPrediction;
  private settings: NetcodeSettings;

  private controlledPlayers: PlayerId[] = []

  private inputAccumulator = 0;
  private sequence = 0;

  constructor(
    private code: string, 
    private token: string, 
    private lobbyState: LobbyState,
    private onMessageCallback: (message: ServerMessage) => void,
    private onStatus: (status: string) => void,
    options: Partial<NetcodeSettings> = {},
  ) {
    this.settings = { ...NETCODE_SETTINGS, ...options };
    this.snapshots = new SnapshotBuffer(this.settings);
    this.prediction = new LocalPrediction(this.settings);
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

    window.addEventListener('blur', this.releaseInput);
  }
  stop() {
    Object.values(this.controllers).forEach(c => c.detach());
    window.removeEventListener('blur', this.releaseInput);
    this.releaseInput();
    const socket = this.socket; this.socket = undefined;
    if (socket) { socket.onclose = null; socket.close(); }
    this.clearSmoothing();
  }

  private onMessage(message: ServerMessage){
    this.onMessageCallback(message);
    if(message.type === "lobby") this.onLobbyMessage(message);
    else if(message.type === "snapshot") this.onSnapshotMessage(message);
    else if(message.type === "error") this.onErrorMessage(message);
    else throw new Error("Unknown error type");
  }
  private onLobbyMessage(message: ServerMessage & {type: "lobby"}){
    if(message.lobbyState.rev < this.lobbyState.rev) return;
    this.lobbyState = message.lobbyState
    this.setControlledPlayers(message.controlledPlayerIds);
    // Back in the lobby: forget the old match so the next one doesn't blend from its last frame
    this.prediction.setPlayers(this.lobbyState.playerMapping, this.controlledPlayers);
    if (!this.lobbyState.started) this.clearSmoothing();
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
    if (this.state && next.match.tick <= this.state.match.tick) return;
    this.snapshots.push(next, performance.now());
    this.prediction.reconcile(next, message.acknowledgedSequence, this.inputAccumulator / TICK_MS);
    this.state = next;
    this.lobbyState.started = true;
  }
  private onErrorMessage(message: ServerMessage & {type: "error"}){
    //TODO
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 8192) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  private sendInput() {
    if (Object.keys(this.controllers).length === 0) return;
    const actions = Object.fromEntries(Object.entries(this.controllers).map(([id, c])=>([id, c.getAction()])))
    const input = { sequence: ++this.sequence, actions };
    if (this.send({ type: 'input', ...input })) this.prediction.predict(input);
  }
  private releaseInput = () => {
    if (!this.lobbyState.started || this.controlledPlayers.length === 0) return;
    const actions = Object.fromEntries(this.controlledPlayers.map(id => [id, IDLE]));
    const input = { sequence: ++this.sequence, actions };
    if (this.send({ type: 'input', ...input })) this.prediction.predict(input);
  };

  private clearSmoothing() {
    this.state = undefined;
    this.snapshots.clear();
    this.prediction.clear();
    this.inputAccumulator = 0;
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

  update(dtMs: number) {
    this.prediction.update(Math.max(0, dtMs));
    if (!this.state || !this.lobbyState.started || this.socket?.readyState !== WebSocket.OPEN) return;
    // Input collection, sending and prediction use the same fixed tick. Avoid a
    // burst of old inputs after returning to a backgrounded tab.
    this.inputAccumulator += dtMs > MAX_FRAME_MS ? 0 : Math.max(0, dtMs);
    while (this.inputAccumulator >= TICK_MS) {
      this.sendInput();
      this.inputAccumulator -= TICK_MS;
    }
  }
  currentState(): GameState {
    const remote = this.snapshots.sample(performance.now());
    if (!remote) return createState(this.getTeamSizes(), this.lobbyState.rules);
    if (!this.settings.prediction) return remote;
    const predicted = this.prediction.currentPlayers(this.inputAccumulator / TICK_MS);
    if (!predicted) return remote;
    return { ...remote, world: { ...remote.world, players: remote.world.players.map((player, i) =>
      this.controlledPlayers.includes(this.lobbyState.playerMapping[i]) ? predicted[i] ?? player : player,
    ) } };
  }
}
