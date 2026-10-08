import { IDLE } from '$lib/engine/actions';
import { TICK_MS, WORLD_HEIGHT, WORLD_WIDTH } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import type { GameState, Player, World } from '$lib/engine/types';
import { vec, type Vec2 } from '$lib/engine/vec';
import { NETCODE_SETTINGS, worldWasReset, type NetcodeSettings, type SequencedInput } from '$lib/shared/netcode';
import type { PlayerId } from '$lib/shared/protocol';

// Reuses the game physics for local movement, then replays unacknowledged inputs
// from each authoritative snapshot. Only visual offsets are eased; physics is corrected immediately.
export class LocalPrediction {
  private state?: GameState;
  private previous?: World;
  private pending: SequencedInput[] = [];
  private offsets: Vec2[] = [];
  private mapping: PlayerId[] = [];
  private owned = new Set<PlayerId>();
  private snapshotAgeMs = 0;

  constructor(private settings: NetcodeSettings = NETCODE_SETTINGS) {}

  setPlayers(mapping: PlayerId[], controlled: PlayerId[]) {
    if (mapping.join() !== this.mapping.join() || controlled.join() !== [...this.owned].join()) this.clear();
    this.mapping = [...mapping];
    this.owned = new Set(controlled);
  }

  clear() {
    this.state = this.previous = undefined;
    this.pending = [];
    this.offsets = [];
    this.snapshotAgeMs = 0;
  }

  update(dtMs: number) {
    this.snapshotAgeMs += dtMs;
    const decay = this.settings.correctionHalfLifeMs > 0
      ? Math.pow(0.5, dtMs / this.settings.correctionHalfLifeMs) : 0;
    this.offsets = this.offsets.map(offset => offset.scale(decay));
  }

  predict(input: SequencedInput) {
    if (!this.state || !this.settings.prediction) return;
    this.pending.push(input);
    if (this.pending.length > this.settings.maxPendingInputs) this.pending.shift();
    this.previous = this.state.world;
    if (this.snapshotAgeMs <= this.settings.maxPredictionMs
      && this.pending.length <= Math.ceil(this.settings.maxPredictionMs / TICK_MS))
      this.state = { ...this.state, world: this.stepWorld(this.state, input) };
  }

  reconcile(next: GameState, acknowledgedSequence: number, alpha: number) {
    const reset = !this.state || worldWasReset(this.state, next);
    const visible = this.currentPlayers(alpha);
    if (reset) this.pending = [];
    this.pending = this.pending.filter(input => input.sequence > acknowledgedSequence);
    this.state = next;
    this.previous = next.world;
    this.snapshotAgeMs = 0;
    // Bound prediction during a long outage, rather than simulating seconds into the future.
    for (const input of this.pending.slice(0, Math.ceil(this.settings.maxPredictionMs / TICK_MS))) {
      this.previous = this.state.world;
      this.state = { ...this.state, world: this.stepWorld(this.state, input) };
    }
    this.offsets = [];
    const corrected = this.currentPlayers(alpha)!;
    this.offsets = corrected.map((player, i) => {
      if (reset || !visible?.[i] || !this.owned.has(this.mapping[i])) return vec();
      const offset = visible[i].pos.sub(player.pos);
      return offset.length() <= this.settings.snapDistance ? offset : vec();
    });
  }

  currentPlayers(alpha: number): Player[] | undefined {
    if (!this.state || !this.previous) return;
    return this.state.world.players.map((player, i) => {
      const pos = this.previous!.players[i].pos.lerp(player.pos, alpha).add(this.offsets[i] ?? vec());
      return { ...player, pos: vec(Math.max(0, Math.min(WORLD_WIDTH, pos.x)), Math.max(0, Math.min(WORLD_HEIGHT, pos.y))) };
    });
  }

  private stepWorld(state: GameState, input: SequencedInput): World {
    if (state.match.phase.kind === 'countdown') return state.world;
    const actions = this.mapping.map(id => this.owned.has(id) ? input.actions[id] ?? IDLE : IDLE);
    return physicsStep(state.world, actions);
  }
}
