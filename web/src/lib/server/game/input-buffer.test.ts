import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import { decodeState } from '$lib/shared/codec';
import { isLegalInputMessage, type ServerMessage } from '$lib/shared/protocol';
import { InputBuffer } from './input-buffer';
import { Room } from './room.server';
import { MAX_SNAPSHOT_BACKLOG_BYTES } from './constants';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('sequenced server inputs', () => {
  const input = (sequence: number) => ({ sequence, actions: { blue: IDLE } });

  it('acknowledges consumed inputs and preserves brief presses followed by releases', () => {
    const buffer = new InputBuffer();
    buffer.push({ sequence: 1, actions: { blue: { ...IDLE, kick: true } } });
    buffer.push(input(2));
    expect(buffer.acknowledgedSequence).toBe(0);
    expect(buffer.consume()!.actions.blue.kick).toBe(true);
    expect(buffer.acknowledgedSequence).toBe(1);
    expect(buffer.consume()!.actions.blue.kick).toBe(false);
    expect(buffer.acknowledgedSequence).toBe(2);
    buffer.push(input(1));
    buffer.push(input(2));
    expect(buffer.consume()).toBeUndefined();
  });

  it('bounds bursts and rejects invalid sequence numbers', () => {
    const buffer = new InputBuffer(2);
    for (let sequence = 1; sequence <= 10; sequence++) buffer.push(input(sequence));
    expect(buffer.consume()!.sequence).toBe(9);
    expect(buffer.consume()!.sequence).toBe(10);
    expect(buffer.consume()).toBeUndefined();
    for (const sequence of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined])
      expect(isLegalInputMessage({ type: 'input', sequence, actions: { blue: IDLE } })).toBe(false);
    expect(isLegalInputMessage({ type: 'input', ...input(1) })).toBe(true);
  });

  it('simulates one command per tick and sends the matching acknowledgement in snapshots', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    const room = new Room('test', 'Admin');
    const messages: ServerMessage[] = [];
    const socket = {
      readyState: 1, bufferedAmount: 0,
      send: (text: string) => { messages.push(JSON.parse(text)); },
    } as unknown as WebSocket;
    try {
      room.connect(room.adminToken, socket);
      room.addPlayer(room.adminToken, { username: 'Admin', team: 'blue' }, room.lobbyState.rev + 1);
      expect(room.startMatch({ ...room.lobbyState, started: true }, room.adminToken).type).toBe('ok');
      room.state.match.phase = { kind: 'play' };
      const id = room.playerMapping[0];
      const action = { ...IDLE, moveX: 1 as const };
      const initial = room.state.world;
      room.input(room.adminToken, { [id]: action }, 1);
      room.input(room.adminToken, { [id]: IDLE }, 2);
      expect(messages.filter(m => m.type === 'snapshot').at(-1)!.acknowledgedSequence).toBe(0);
      vi.advanceTimersByTime(TICK_MS * 3 + 1);
      const message = messages.filter(m => m.type === 'snapshot').at(-1)!;
      expect(message.acknowledgedSequence).toBe(2);
      const expected = physicsStep(physicsStep(initial, [action]), [IDLE]);
      expect(decodeState(new Float64Array(message.state)).world).toEqual(expected);
      expect(room.input(room.adminToken, { stranger: action }, 3).type).toBe('fail');
      const sent = messages.filter(m => m.type === 'snapshot').length;
      Object.defineProperty(socket, 'bufferedAmount', { value: MAX_SNAPSHOT_BACKLOG_BYTES + 1, writable: true });
      vi.advanceTimersByTime(100);
      expect(messages.filter(m => m.type === 'snapshot').length).toBe(sent);
      Object.defineProperty(socket, 'bufferedAmount', { value: 0 });
      vi.advanceTimersByTime(40);
      expect(messages.filter(m => m.type === 'snapshot').length).toBeGreaterThan(sent);
    } finally {
      room.cleanup();
    }
  });

  it('coalesces snapshots after a server stall', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    const room = new Room('stall', 'Admin');
    const messages: ServerMessage[] = [];
    const socket = {
      readyState: 1, bufferedAmount: 0,
      send: (text: string) => { messages.push(JSON.parse(text)); },
    } as unknown as WebSocket;
    try {
      room.connect(room.adminToken, socket);
      room.addPlayer(room.adminToken, { username: 'Admin', team: 'blue' }, room.lobbyState.rev + 1);
      room.startMatch({ ...room.lobbyState, started: true }, room.adminToken);
      const sent = messages.filter(m => m.type === 'snapshot').length;
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      vi.advanceTimersByTime(TICK_MS);
      expect(messages.filter(m => m.type === 'snapshot').length).toBe(sent + 1);
      expect(room.state.match.tick).toBeGreaterThan(10);
    } finally { room.cleanup(); }
  });
});
