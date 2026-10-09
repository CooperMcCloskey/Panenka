import { TICK_MS } from '$lib/engine/constants';

// Arrival time includes network jitter and the server timer's scheduling delay.
// Track the earliest recent delivery relative to simulation time, rather than
// moving the playback clock backwards every time a packet arrives late.
export class SnapshotClock {
  private observations: { receivedAtMs: number; offsetMs: number }[] = [];
  private offsetMs = 0;
  private spreadMs = 0;

  /** Variation in snapshot delivery offsets over the current observation window. */
  public get jitterMs(): number {
    return this.spreadMs;
  }

  constructor(private windowMs = 2000) {}

  clear() {
    this.observations = [];
    this.offsetMs = 0;
    this.spreadMs = 0;
  }

  observe(tick: number, receivedAtMs: number) {
    this.observations.push({ receivedAtMs, offsetMs: receivedAtMs - tick * TICK_MS });
    while (this.observations.length > 1
      && this.observations[0].receivedAtMs < receivedAtMs - this.windowMs) this.observations.shift();
    let earliest = Infinity, latest = -Infinity;
    for (const observation of this.observations) {
      earliest = Math.min(earliest, observation.offsetMs);
      latest = Math.max(latest, observation.offsetMs);
    }
    this.offsetMs = earliest;
    this.spreadMs = latest - earliest;
  }

  tickAt(nowMs: number): number {
    return (nowMs - this.offsetMs) / TICK_MS;
  }
}
