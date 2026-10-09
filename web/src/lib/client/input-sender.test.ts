import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputSender } from './input-sender';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('input sending', () => {
  it('retries congested sends promptly and cancels retries when stopped', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    const send = vi.fn().mockReturnValue(false);
    const sender = new InputSender(send, () => true);
    sender.start();
    sender.changed();
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(12);
    expect(send).toHaveBeenCalledTimes(2);
    send.mockReturnValue(true);
    vi.advanceTimersByTime(12);
    expect(send).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(12);
    expect(send).toHaveBeenCalledTimes(3);
    send.mockReturnValue(false);
    sender.changed();
    sender.stop();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('sends the first change immediately and coalesces bursts below the socket limit', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const send = vi.fn();
    const sender = new InputSender(send, () => true);
    sender.start();
    sender.changed();
    expect(send).toHaveBeenCalledTimes(1);
    for (now = 1; now <= 1000; now++) {
      sender.changed();
      vi.advanceTimersByTime(1);
    }
    expect(send.mock.calls.length).toBeGreaterThan(80);
    expect(send.mock.calls.length).toBeLessThanOrEqual(91);
    sender.stop();
    const count = send.mock.calls.length;
    vi.advanceTimersByTime(1000);
    sender.changed();
    expect(send).toHaveBeenCalledTimes(count);
  });

  it('refreshes held inputs, skips lobby input and cancels pending changes', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    let playing = false;
    const send = vi.fn();
    const sender = new InputSender(send, () => playing);
    sender.start();
    sender.start();
    sender.changed();
    expect(send).not.toHaveBeenCalled();
    playing = true;
    now = 100;
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(1);
    now = 200;
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
    sender.changed();
    sender.stop();
    now = 300;
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
