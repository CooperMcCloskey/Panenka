import type { InputAck, SnapshotNetwork } from '$lib/shared/protocol';

type InputTiming = { changedAtMs: number; sentAtMs: number; appliedTick?: number };

// Each duration uses one machine's monotonic clock; no clock synchronization is
// needed to measure an input's send, confirmation and authoritative playback.
export class NetworkMetrics {
  private inputs = new Map<number, InputTiming>();
  private changedAtMs?: number;
  private lastFrameMs?: number;
  private lastSnapshotMs?: number;
  private lastAckSequence = 0;
  private values: {
    rttMs?: number; inputSendDelayMs?: number; inputAckMs?: number;
    inputToAuthoritativeMs?: number; serverInputQueueMs?: number;
    snapshotGapMs?: number; frameMs?: number; serverFrameMs?: number; serverTickDelayMs?: number;
  } = {};

  get diagnostics() { return { ...this.values }; }
  get rttMs(): number { return this.values.rttMs ?? 0; }

  changed(nowMs: number) { this.changedAtMs ??= nowMs; }

  sent(sequence: number, nowMs: number) {
    if (this.changedAtMs !== undefined) {
      this.inputs.set(sequence, { changedAtMs: this.changedAtMs, sentAtMs: nowMs });
      this.values.inputSendDelayMs = Math.max(0, nowMs - this.changedAtMs);
      this.changedAtMs = undefined;
    }
    while (this.inputs.size > 256) this.inputs.delete(this.inputs.keys().next().value!);
  }

  snapshot(network: SnapshotNetwork | undefined, nowMs: number) {
    if (this.lastSnapshotMs !== undefined) this.values.snapshotGapMs = Math.max(0, nowMs - this.lastSnapshotMs);
    this.lastSnapshotMs = nowMs;
    if (!network) return;
    if (network.rttMs !== undefined && Number.isFinite(network.rttMs) && network.rttMs >= 0)
      this.values.rttMs = network.rttMs;
    this.values.serverFrameMs = network.serverFrameMs;
    this.values.serverTickDelayMs = network.serverTickDelayMs;
    if (network.inputAck) this.acknowledge(network.inputAck, nowMs);
  }

  private acknowledge(ack: InputAck, nowMs: number) {
    if (ack.sequence <= this.lastAckSequence) return;
    this.lastAckSequence = ack.sequence;
    this.values.serverInputQueueMs = ack.queueMs;
    for (const [sequence, input] of this.inputs) {
      if (sequence > ack.sequence || input.appliedTick !== undefined) continue;
      input.appliedTick = ack.tick;
      this.values.inputAckMs = Math.max(0, nowMs - input.sentAtMs);
      // An input confirmation also measures the round trip if no ping exists yet.
      if (this.values.rttMs === undefined) this.values.rttMs = Math.max(0, this.values.inputAckMs - ack.queueMs);
    }
  }

  frame(authoritativeRenderTick: number, nowMs: number) {
    if (this.lastFrameMs !== undefined && nowMs > this.lastFrameMs) this.values.frameMs = nowMs - this.lastFrameMs;
    this.lastFrameMs = nowMs;
    for (const [sequence, input] of this.inputs) {
      if (input.appliedTick === undefined || authoritativeRenderTick < input.appliedTick) continue;
      this.values.inputToAuthoritativeMs = Math.max(0, nowMs - input.changedAtMs);
      this.inputs.delete(sequence);
    }
  }

  clear() {
    this.inputs.clear();
    this.changedAtMs = this.lastFrameMs = this.lastSnapshotMs = undefined;
    this.lastAckSequence = 0;
    this.values = {};
  }
}
