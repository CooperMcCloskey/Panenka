import { SNAPSHOT_NUM, TICK_MS } from '$lib/engine/constants';

export type AdaptiveDelaySettings = {
  minMs: number;
  maxMs: number;
  recoveryMsPerSecond: number;
};

export const ADAPTIVE_DELAY_SETTINGS: Readonly<AdaptiveDelaySettings> = {
  minMs: SNAPSHOT_NUM * TICK_MS,
  maxMs: 100,
  recoveryMsPerSecond: 30,
};

// Grow the target when delivery becomes uneven; shed excess delay gradually.
// SnapshotInterpolator moves its single timeline towards this target without
// rewinding bodies or changing the simulation's timestep.
export class AdaptiveDelay {
  private settings: AdaptiveDelaySettings;
  private lastMs?: number;
  private delayMs: number;
  private underrunFloorMs = 0;
  private lastUnderrunMs = -Infinity;

  constructor(private initialMs: number, options: Partial<AdaptiveDelaySettings> = {}) {
    this.settings = { ...ADAPTIVE_DELAY_SETTINGS, ...options };
    this.delayMs = initialMs;
  }

  clear() {
    this.lastMs = undefined;
    this.delayMs = this.initialMs;
    this.underrunFloorMs = 0;
    this.lastUnderrunMs = -Infinity;
  }

  underrun(nowMs: number) {
    this.underrunFloorMs = Math.min(this.settings.maxMs, this.delayMs + SNAPSHOT_NUM * TICK_MS);
    this.lastUnderrunMs = nowMs;
  }

  sample(jitterMs: number, nowMs: number): number {
    const elapsed = Math.max(0, Math.min(250, nowMs - (this.lastMs ?? nowMs)));
    this.lastMs = nowMs;
    const recovery = elapsed * this.settings.recoveryMsPerSecond / 1000;
    if (nowMs - this.lastUnderrunMs >= 1000) this.underrunFloorMs = Math.max(0, this.underrunFloorMs - recovery);
    const required = Math.min(this.settings.maxMs,
      Math.max(this.underrunFloorMs, this.settings.minMs + Math.max(0, jitterMs)));
    this.delayMs = Math.max(required, this.delayMs - recovery);
    return this.delayMs;
  }
}
