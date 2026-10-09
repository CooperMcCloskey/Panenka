export const INPUT_SEND_SETTINGS = {
  maxPerSecond: 90, // leaves room for lobby messages under the socket's 120/s limit
  heartbeatMs: 100,
} as const;

// Send key changes immediately; coalesce rapid changes and refresh held inputs.
export class InputSender {
  private heartbeat?: ReturnType<typeof setInterval>;
  private pending?: ReturnType<typeof setTimeout>;
  private lastSentMs = -Infinity;

  constructor(private send: () => boolean | void, private active: () => boolean) {}

  start() {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => this.changed(), INPUT_SEND_SETTINGS.heartbeatMs);
  }

  changed = () => {
    if (!this.heartbeat || !this.active()) return;
    const wait = 1000 / INPUT_SEND_SETTINGS.maxPerSecond - (performance.now() - this.lastSentMs);
    if (wait > 0) {
      this.pending ??= setTimeout(() => { this.pending = undefined; this.changed(); }, Math.ceil(wait));
      return;
    }
    clearTimeout(this.pending);
    this.pending = undefined;
    this.lastSentMs = performance.now();
    if (this.send() === false) {
      // A full socket must not consume or lose a quick tap. Retry as soon as
      // the send budget allows, rather than waiting for the 100 ms heartbeat.
      this.pending = setTimeout(() => { this.pending = undefined; this.changed(); },
        Math.ceil(1000 / INPUT_SEND_SETTINGS.maxPerSecond));
    }
  };

  stop() {
    clearInterval(this.heartbeat);
    clearTimeout(this.pending);
    this.heartbeat = this.pending = undefined;
    this.lastSentMs = -Infinity;
  }
}
