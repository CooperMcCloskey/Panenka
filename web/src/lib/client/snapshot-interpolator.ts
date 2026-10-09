import { MAX_FRAME_MS, SNAPSHOT_NUM, TICK_MS } from '$lib/engine/constants';
import type { Body, GameState } from '$lib/engine/types';
import { SnapshotClock } from './snapshot-clock';
import { AdaptiveDelay, type AdaptiveDelaySettings } from './adaptive-delay';
import { guardContacts } from './contact-guard';

export type InterpolationSettings = {
  delayMs: number;
  maxSnapshots: number;
  maxPlaybackAdjustment: number;
  resyncAfterMs: number;
  clockWindowMs: number;
  clockDeadbandMs: number;
  adaptiveDelay: false | Partial<AdaptiveDelaySettings>;
};

// Start with three snapshots; adaptive playback sheds delay on steady links.
export const INTERPOLATION_SETTINGS: Readonly<InterpolationSettings> = {
  delayMs: TICK_MS * SNAPSHOT_NUM * 3,
  maxSnapshots: 32,
  maxPlaybackAdjustment: 0.05,
  resyncAfterMs: MAX_FRAME_MS,
  clockWindowMs: 2000,
  clockDeadbandMs: 2,
  adaptiveDelay: {},
};

// Presentation only: interpolate received positions, without predicting physics
// or feeding the interpolated state back to the server.
export class SnapshotInterpolator {
  private snapshots: GameState[] = [];
  private clock: SnapshotClock;
  private renderTick = 0;
  private lastSampleMs?: number;
  private settings: InterpolationSettings;
  private delay?: AdaptiveDelay;
  private targetDelayMs: number;
  private underruns = 0;
  private exhausted = false;

  constructor(options: Partial<InterpolationSettings> = {}) {
    this.settings = { ...INTERPOLATION_SETTINGS, ...options };
    // An explicitly supplied delay keeps its previous fixed-delay meaning.
    const adaptive = options.adaptiveDelay ?? (options.delayMs === undefined ? this.settings.adaptiveDelay : false);
    if (adaptive !== false) this.delay = new AdaptiveDelay(this.settings.delayMs, adaptive);
    this.targetDelayMs = this.settings.delayMs;
    this.clock = new SnapshotClock(this.settings.clockWindowMs);
  }

  get diagnostics() {
    return {
      targetDelayMs: this.targetDelayMs,
      playbackDelayMs: this.lastSampleMs === undefined ? 0
        : (this.clock.tickAt(this.lastSampleMs) - this.renderTick) * TICK_MS,
      jitterMs: this.clock.jitterMs,
      underruns: this.underruns,
    };
  }

  clear() {
    this.snapshots = [];
    this.lastSampleMs = undefined;
    this.clock.clear();
    this.delay?.clear();
    this.targetDelayMs = this.settings.delayMs;
    this.exhausted = false;
    this.underruns = 0;
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
    this.clock.observe(state.match.tick, nowMs);
    this.snapshots.push(state);
    if (this.snapshots.length > this.settings.maxSnapshots) this.snapshots.shift();
  }

  sample(nowMs: number): GameState | undefined {
    const latest = this.snapshots.at(-1);
    if (!latest) return;

    const elapsed = Math.max(0, nowMs - (this.lastSampleMs ?? nowMs));
    this.lastSampleMs = nowMs;
    this.targetDelayMs = this.delay?.sample(this.clock.jitterMs, nowMs) ?? this.settings.delayMs;
    const target = this.clock.tickAt(nowMs) - this.targetDelayMs / TICK_MS;
    const expected = this.renderTick + elapsed / TICK_MS;
    const error = target - expected;
    if (elapsed > this.settings.resyncAfterMs || Math.abs(error) * TICK_MS > this.settings.resyncAfterMs) {
      // Resume near the current snapshots after a long pause instead of spending
      // seconds playing through old history at an accelerated speed.
      this.renderTick = Math.max(this.renderTick, target);
    } else {
      // Small scheduling differences do not need visible speed corrections.
      const adjustment = Math.abs(error) * TICK_MS <= this.settings.clockDeadbandMs ? 0
        : Math.max(-this.settings.maxPlaybackAdjustment,
          Math.min(this.settings.maxPlaybackAdjustment, error * 0.05));
      this.renderTick += elapsed / TICK_MS * (1 + adjustment);
    }
    // During a network gap, hold at the newest known position. Never extrapolate.
    const exhausted = this.renderTick > latest.match.tick + 1e-8;
    if (exhausted && !this.exhausted) this.underruns++;
    this.exhausted = exhausted;
    this.renderTick = Math.min(this.renderTick, latest.match.tick);

    while (this.snapshots.length > 2 && this.snapshots[1].match.tick <= this.renderTick)
      this.snapshots.shift();
    const [a, b] = this.snapshots;
    if (!b || this.renderTick <= a.match.tick) return { ...latest, world: guardContacts(a.world) };

    const t = Math.max(0, Math.min(1, (this.renderTick - a.match.tick) / (b.match.tick - a.match.tick)));
    const blend = <T extends Body>(previous: T, next: T): T => ({ ...next, pos: previous.pos.lerp(next.pos, t) });
    return {
      ...latest, // scores, timer and match phase remain authoritative
      world: guardContacts({
        ball: blend(a.world.ball, b.world.ball),
        players: b.world.players.map((player, i) => blend(a.world.players[i], player)),
      }),
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
