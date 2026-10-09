import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createState } from '$lib/engine/state';
import { broadcastSnapshot } from './snapshot-broadcast';

describe('snapshot backpressure', () => {
  it('skips a backed-up client and sends only its current state when it drains', () => {
    const fast = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: vi.fn() };
    const slow = { readyState: WebSocket.OPEN, bufferedAmount: 100, send: vi.fn() };
    const closed = { readyState: WebSocket.CLOSED, bufferedAmount: 0, send: vi.fn() };
    const sockets = [fast, slow, closed] as unknown as WebSocket[];
    const state = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
    for (let tick = 0; tick < 60; tick++) {
      state.match.tick = tick;
      broadcastSnapshot(state, sockets);
    }
    expect(fast.send).toHaveBeenCalledTimes(60);
    expect(slow.send).not.toHaveBeenCalled();
    expect(closed.send).not.toHaveBeenCalled();
    slow.bufferedAmount = 0;
    state.match.tick = 60;
    broadcastSnapshot(state, sockets);
    expect(slow.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(slow.send.mock.calls[0][0]).state[0]).toBe(60);
  });
});
