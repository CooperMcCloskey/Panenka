import { describe, expect, it } from 'vitest';
import { NetworkMetrics } from './network-metrics';

describe('network latency measurements', () => {
  it('separates send wait, confirmation, server queue and authoritative playback', () => {
    const metrics = new NetworkMetrics();
    metrics.changed(0);
    metrics.sent(1, 5);
    metrics.snapshot({ heldActions: [], rttMs: 40, serverFrameMs: 17, serverTickDelayMs: 0.4,
      inputAck: { sequence: 1, tick: 12, queueMs: 10 } }, 55);
    metrics.frame(11, 60);
    expect(metrics.diagnostics).toMatchObject({ rttMs: 40, inputSendDelayMs: 5, inputAckMs: 50, serverInputQueueMs: 10 });
    expect(metrics.diagnostics.inputToAuthoritativeMs).toBeUndefined();
    metrics.frame(12, 70);
    expect(metrics.diagnostics.inputToAuthoritativeMs).toBe(70);
    expect(metrics.diagnostics.frameMs).toBe(10);
    metrics.clear();
    expect(metrics.diagnostics).toEqual({});
  });

  it('handles coalesced acknowledgements once and uses confirmations until a ping is available', () => {
    const metrics = new NetworkMetrics();
    metrics.changed(0); metrics.sent(1, 2);
    metrics.changed(10); metrics.sent(2, 12);
    const network = { heldActions: [], serverFrameMs: 17, serverTickDelayMs: 1,
      inputAck: { sequence: 2, tick: 3, queueMs: 8 } };
    metrics.snapshot(network, 50);
    expect(metrics.diagnostics.inputAckMs).toBe(38);
    metrics.snapshot(network, 60);
    expect(metrics.diagnostics.inputAckMs).toBe(38);
    metrics.frame(3, 65);
    expect(metrics.diagnostics.inputToAuthoritativeMs).toBe(55);
    expect(metrics.diagnostics.snapshotGapMs).toBe(10);
  });
});
