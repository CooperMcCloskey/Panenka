import { afterEach, describe, expect, it, vi } from 'vitest';
import { TICK_MS } from '$lib/engine/constants';
import { TickScheduler } from './tick-scheduler';
import { Room } from './room.server';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('server tick pacing', () => {
  it('retries an early timer wake without skipping the physics deadline', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const update = vi.fn();
    const scheduler = new TickScheduler(update);
    scheduler.start();
    now = 16;
    vi.advanceTimersByTime(17);
    expect(update).not.toHaveBeenCalled();
    now = 17;
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('paces 60 updates per second without periodic 32 ms gaps', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const times: number[] = [];
    const scheduler = new TickScheduler(() => times.push(performance.now()));
    scheduler.start();
    vi.advanceTimersByTime(5000);
    scheduler.stop();
    expect(times).toHaveLength(300);
    expect(Math.max(...times.slice(1).map((now, i) => now - times[i]))).toBeLessThanOrEqual(17);
    vi.advanceTimersByTime(1000);
    expect(times).toHaveLength(300);
  });

  it('keeps room physics at 60 Hz and catches up without sending a burst of old snapshots', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const room = new Room('pacing', 'Test');
    room.startMatch({ ...room.lobbyState, started: true }, room.adminToken);
    try {
      vi.advanceTimersByTime(1000);
      expect(room.state.match.tick).toBe(60);
      let now = performance.now();
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      const broadcast = vi.spyOn(room as unknown as { broadcastSnapshot(): void }, 'broadcastSnapshot');
      now += 100;
      vi.advanceTimersToNextTimer();
      expect(room.state.match.tick).toBe(66);
      expect(broadcast).toHaveBeenCalledTimes(1);
      expect(TICK_MS).toBe(1000 / 60);
    } finally { room.cleanup(); }
  });
});
