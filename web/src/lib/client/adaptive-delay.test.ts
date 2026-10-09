import { describe, expect, it } from 'vitest';
import { TICK_MS } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import { vec } from '$lib/engine/vec';
import { SnapshotInterpolator } from './snapshot-interpolator';
import { AdaptiveDelay } from './adaptive-delay';

function play(tick: number) {
  const state = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
  state.match.tick = tick;
  state.match.phase = { kind: 'play' };
  // Stay away from contacts throughout the long clock test.
  state.world.players[0].pos = vec(0.2 + tick * 0.0001, 0.5);
  return state;
}

function run(adaptive: boolean, jitter: (tick: number) => number) {
  const buffer = new SnapshotInterpolator({ adaptiveDelay: adaptive ? {} : false });
  const packets = Array.from({ length: 1201 }, (_, tick) => ({ tick, at: tick * TICK_MS + jitter(tick) }));
  for (let index = 1; index < packets.length; index++)
    packets[index].at = Math.max(packets[index].at, packets[index - 1].at);
  let index = 0, previous = 0.2, lateStalls = 0;
  const samples: { now: number; delay: number; target: number }[] = [];
  for (let now = 0; now <= 19900; now += 5) {
    while (index < packets.length && packets[index].at <= now) {
      const packet = packets[index++];
      buffer.push(play(packet.tick), packet.at);
    }
    const x = buffer.sample(now)!.world.players[0].pos.x;
    expect(x).toBeGreaterThanOrEqual(previous - 1e-12);
    expect(x - previous).toBeLessThanOrEqual(0.0001 * 5 / TICK_MS * 1.051 + 1e-12);
    if (now >= 5000 && x === previous) lateStalls++;
    if (now % 100 === 0) samples.push({ now, delay: buffer.diagnostics.playbackDelayMs, target: buffer.diagnostics.targetDelayMs });
    previous = x;
  }
  return { samples, lateStalls, diagnostics: buffer.diagnostics };
}

describe('adaptive snapshot playback', () => {
  it('reduces steady-connection delay to about one tick without rewinding or jumping', () => {
    const adaptive = run(true, () => 0);
    const fixed = run(false, () => 0);
    expect(adaptive.diagnostics.playbackDelayMs).toBeLessThan(20);
    expect(adaptive.diagnostics.playbackDelayMs).toBeGreaterThan(15);
    expect(fixed.diagnostics.playbackDelayMs).toBeCloseTo(50);
    expect(adaptive.lateStalls).toBe(0);
  });

  it('absorbs recurring delivery gaps after adapting, then sheds the extra delay', () => {
    const jitter = (tick: number) => tick < 600 && tick % 30 === 15 ? 65 : 0;
    const adaptive = run(true, jitter);
    const fixed = run(false, jitter);
    expect(adaptive.lateStalls).toBeLessThan(fixed.lateStalls);
    expect(adaptive.samples.find(sample => sample.now === 9000)!.target).toBeGreaterThan(60);
    expect(adaptive.diagnostics.playbackDelayMs).toBeLessThan(20);
    expect(adaptive.diagnostics.targetDelayMs).toBeLessThanOrEqual(100);
  });

  it('caps buffering during severe jitter and retains an explicit fixed-delay override', () => {
    const jitter = (tick: number) => tick % 30 === 15 ? 180 : 0;
    const adaptive = run(true, jitter);
    expect(adaptive.samples.every(sample => sample.target <= 100)).toBe(true);
    const fixed = new SnapshotInterpolator({ delayMs: 20 });
    fixed.push(play(0), 0);
    fixed.sample(0);
    fixed.push(play(1), 90);
    fixed.sample(90);
    expect(fixed.diagnostics.targetDelayMs).toBe(20);
  });

  it('starts at 25 ms, ignores isolated outliers and recovers quickly after a delivery spike', () => {
    const buffer = new SnapshotInterpolator();
    buffer.push(play(0), 0);
    buffer.sample(0);
    expect(buffer.diagnostics.targetDelayMs).toBe(25);
    const isolated = run(true, tick => tick === 300 ? 60 : 0);
    expect(isolated.samples.find(sample => sample.now === 7000)!.target).toBeLessThan(30);
    expect(isolated.diagnostics.playbackDelayMs).toBeLessThan(20);
  });

  it('adds reserve on an underrun, holds it briefly, then removes it on a steady link', () => {
    const delay = new AdaptiveDelay(TICK_MS);
    delay.sample(0, 0);
    delay.underrun(0);
    expect(delay.sample(0, 500)).toBeCloseTo(2 * TICK_MS);
    for (let now = 1000; now <= 2500; now += 100) delay.sample(0, now);
    expect(delay.sample(0, 2600)).toBeCloseTo(TICK_MS);
  });
});
