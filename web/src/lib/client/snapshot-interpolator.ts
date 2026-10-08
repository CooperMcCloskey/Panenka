import { MAX_FRAME_MS, SNAPSHOT_NUM, TICK_MS } from '$lib/engine/constants';
import type { Body, GameState } from '$lib/engine/types';

export type InterpolationSettings = {
  delayMs: number;
  maxSnapshots: number;
  maxPlaybackAdjustment: number;
  resyncAfterMs: number;
};

// Two snapshot intervals absorb modest jitter with a small display delay.
export const INTERPOLATION_SETTINGS: Readonly<InterpolationSettings> = {
  delayMs: TICK_MS * SNAPSHOT_NUM * 2,
  maxSnapshots: 32,
  maxPlaybackAdjustment: 0.1,
  resyncAfterMs: MAX_FRAME_MS,
};

// Presentation only: interpolate received positions, without predicting physics
// or feeding the interpolated state back to the server.
export class SnapshotInterpolator {
  private snapshots: GameState[] = [];
  private receivedAtMs = 0;
  private renderTick = 0;
  private lastSampleMs?: number;
  private settings: InterpolationSettings;

  constructor(options: Partial<InterpolationSettings> = {}) {
    this.settings = { ...INTERPOLATION_SETTINGS, ...options };
  }

  clear() {
    this.snapshots = [];
    this.lastSampleMs = undefined;
  }

  push(state: GameState, nowMs: number) {
    const latest = this.snapshots.at(-1);
    if (latest && state.match.tick <= latest.match.tick) return;
    // A kickoff or a changed lineup must appear immediately, without blending
    // old player positions into their new starting positions.
    if (latest && (this.worldWasReset(latest, state)
      || (state.match.tick - latest.match.tick) * TICK_MS > this.settings.resyncAfterMs)) this.clear();

    if (this.snapshots.length === 0) {
      this.renderTick = state.match.tick - this.settings.delayMs / TICK_MS;
      this.lastSampleMs = nowMs;
    }
    this.receivedAtMs = nowMs;
    this.snapshots.push(state);
    if (this.snapshots.length > this.settings.maxSnapshots) this.snapshots.shift();
  }

  sample(nowMs: number): GameState | undefined {
    const latest = this.snapshots.at(-1);
    if (!latest) return;

    const elapsed = Math.max(0, nowMs - (this.lastSampleMs ?? nowMs));
    this.lastSampleMs = nowMs;
    const target = latest.match.tick + Math.max(0, nowMs - this.receivedAtMs) / TICK_MS
      - this.settings.delayMs / TICK_MS;
    const expected = this.renderTick + elapsed / TICK_MS;
    const error = target - expected;
    if (elapsed > this.settings.resyncAfterMs || Math.abs(error) * TICK_MS > this.settings.resyncAfterMs) {
      // Resume near the current snapshots after a long pause instead of spending
      // seconds playing through old history at an accelerated speed.
      this.renderTick = target;
    } else {
      const adjustment = Math.max(-this.settings.maxPlaybackAdjustment,
        Math.min(this.settings.maxPlaybackAdjustment, error * 0.05));
      this.renderTick += elapsed / TICK_MS * (1 + adjustment);
    }
    // During a network gap, hold at the newest known position. Never extrapolate.
    this.renderTick = Math.min(this.renderTick, latest.match.tick);

    while (this.snapshots.length > 2 && this.snapshots[1].match.tick <= this.renderTick)
      this.snapshots.shift();
    const [a, b] = this.snapshots;
    if (!b || this.renderTick <= a.match.tick) return { ...latest, world: a.world };

    const t = Math.max(0, Math.min(1, (this.renderTick - a.match.tick) / (b.match.tick - a.match.tick)));
    const blend = <T extends Body>(previous: T, next: T): T => ({ ...next, pos: previous.pos.lerp(next.pos, t) });
    return {
      ...latest, // scores, timer and match phase remain authoritative
      world: {
        ball: blend(a.world.ball, b.world.ball),
        players: b.world.players.map((player, i) => blend(a.world.players[i], player)),
      },
    };
  }

  private worldWasReset(previous: GameState, next: GameState): boolean {
    return previous.world.players.length !== next.world.players.length
      || previous.match.teamSizes.blue !== next.match.teamSizes.blue
      || previous.match.teamSizes.orange !== next.match.teamSizes.orange
      || (next.match.phase.kind === 'countdown'
        && (previous.match.phase.kind !== 'countdown'
          || next.match.phase.ticksLeft > previous.match.phase.ticksLeft));
  }
}
