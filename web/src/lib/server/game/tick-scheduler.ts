import { TICK_MS } from '$lib/engine/constants';

// Schedule against fixed deadlines. setInterval(16.667) is truncated to 16 ms
// in Node, which creates periodic empty updates followed by a longer gap.
export class TickScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private deadlineMs = 0;
  public latenessMs = 0;

  constructor(private update: () => void, private intervalMs = TICK_MS) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.deadlineMs = performance.now() + this.intervalMs;
    this.schedule();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      // A timer may wake slightly early. Keep this deadline rather than skipping
      // it, which would turn an empty physics update into a two-tick gap.
      if (performance.now() + 1e-7 < this.deadlineMs) {
        this.schedule();
        return;
      }
      this.latenessMs = Math.max(0, performance.now() - this.deadlineMs);
      this.update(); // the room's accumulator handles any missed simulation ticks
      const now = performance.now();
      this.deadlineMs += this.intervalMs * Math.max(1,
        Math.floor((now - this.deadlineMs) / this.intervalMs) + 1);
      this.schedule();
    }, Math.max(1, Math.ceil(this.deadlineMs - performance.now() - 1e-7)));
  }
}
