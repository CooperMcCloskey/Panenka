import { TICK_MS } from '$lib/engine/constants';
import type { GameState } from '$lib/engine/types';
import { interpolateWorld, NETCODE_SETTINGS, worldWasReset, type NetcodeSettings } from '$lib/shared/netcode';

// Advance a delayed server clock independently of packet arrivals. Keeping several
// snapshots lets uneven arrivals still produce a continuous stream of positions.
export class SnapshotBuffer {
  private snapshots: GameState[] = [];
  private clockOffset = -Infinity;
  private renderTick = 0;
  private lastSampleMs?: number;

  constructor(private settings: NetcodeSettings = NETCODE_SETTINGS) {}

  clear() {
    this.snapshots = [];
    this.clockOffset = -Infinity;
    this.lastSampleMs = undefined;
  }

  push(state: GameState, nowMs: number) {
    const latest = this.snapshots.at(-1);
    if (latest && state.match.tick <= latest.match.tick) return;
    if (latest && worldWasReset(latest, state)) this.clear();

    this.clockOffset = Math.max(this.clockOffset, state.match.tick - nowMs / TICK_MS);
    if (this.snapshots.length === 0) {
      this.renderTick = state.match.tick - this.settings.interpolationDelayMs / TICK_MS;
      this.lastSampleMs = nowMs;
    }
    this.snapshots.push(state);
    if (this.snapshots.length > this.settings.maxSnapshots) this.snapshots.shift();
  }

  sample(nowMs: number): GameState | undefined {
    const latest = this.snapshots.at(-1);
    if (!latest) return;

    const elapsed = Math.max(0, nowMs - (this.lastSampleMs ?? nowMs));
    this.lastSampleMs = nowMs;
    const target = nowMs / TICK_MS + this.clockOffset - this.settings.interpolationDelayMs / TICK_MS;
    // Gradually correct clock drift rather than jumping on every incoming packet.
    const error = target - this.renderTick;
    const speed = Math.max(0.9, Math.min(1.1, 1 + error * 0.05));
    this.renderTick = elapsed > this.settings.maxPredictionMs
      ? target : this.renderTick + elapsed / TICK_MS * speed;
    // Hold at the newest snapshot during a stall instead of extrapolating through walls.
    this.renderTick = Math.min(this.renderTick, latest.match.tick);

    while (this.snapshots.length > 2 && this.snapshots[1].match.tick <= this.renderTick)
      this.snapshots.shift();

    const [a, b] = this.snapshots;
    if (!b || this.renderTick <= a.match.tick) return { ...latest, world: a.world };
    const t = Math.max(0, Math.min(1, (this.renderTick - a.match.tick) / (b.match.tick - a.match.tick)));
    return { ...latest, world: interpolateWorld(a.world, b.world, t) };
  }
}
