import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { IDLE } from '$lib/engine/actions';
import { isLegalInputMessage, type ServerMessage } from '$lib/shared/protocol';
import { InputAcknowledgements } from './input-acknowledgements';
import { Room } from './room.server';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('authoritative input acknowledgements', () => {
  it('acknowledges the newest coalesced input only after a tick consumes it', () => {
    const acks = new InputAcknowledgements();
    acks.receive('a', 1, 10); acks.receive('a', 2, 12);
    expect(acks.get('a')).toBeUndefined();
    expect(acks.accepts('a', 2)).toBe(false);
    acks.appliedAt(3, 17);
    expect(acks.get('a')).toEqual({ sequence: 2, tick: 3, queueMs: 5 });
    acks.appliedAt(4, 34);
    expect(acks.get('a')?.tick).toBe(3);
    acks.remove('a');
    expect(acks.accepts('a', 1)).toBe(true);
  });

  it('keeps short kicks through coalescing, rejects stale input and includes safe snapshot metadata', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const room = new Room('ack', 'Test');
    room.addPlayer(room.adminToken, { username: 'Test', team: 'blue' }, room.lobbyState.rev + 1);
    const messages: ServerMessage[] = [];
    const socket = { readyState: WebSocket.OPEN, bufferedAmount: 0,
      send: (payload: string) => messages.push(JSON.parse(payload)) } as unknown as WebSocket;
    room.clients[room.adminId].socket = socket;
    room.clients[room.adminId].rttMs = 42;
    room.startMatch({ ...room.lobbyState, started: true }, room.adminToken);
    room.state.match.phase = { kind: 'play' };
    const id = room.playerMapping[0];
    const snapshot = () => messages.filter(message => message.type === 'snapshot').at(-1)!;
    try {
      room.input(room.adminToken, { [id]: { ...IDLE, kick: true } }, 1);
      room.input(room.adminToken, { [id]: IDLE }, 2);
      expect(snapshot().network?.inputAck).toBeUndefined();
      vi.advanceTimersByTime(17);
      expect(room.state.world.players[0].kickHeld).toBe(true);
      expect(snapshot().network).toMatchObject({ heldActions: [IDLE], rttMs: 42,
        inputAck: { sequence: 2, tick: 1 } });
      room.input(room.adminToken, { [id]: { ...IDLE, moveX: 1 } }, 2);
      vi.advanceTimersByTime(17);
      expect(room.state.world.players[0].kickHeld).toBe(false);
      expect(room.state.world.players[0].vel.x).toBe(0);
      expect(snapshot().network?.inputAck?.tick).toBe(1);
      expect(JSON.stringify(snapshot())).not.toContain(room.adminToken);
    } finally { room.cleanup(); }
  });

  it.each([0, -1, 1.2, Infinity, '1'])('rejects invalid sequence %s while accepting legacy inputs', sequence => {
    expect(isLegalInputMessage({ type: 'input', actions: {}, sequence })).toBe(false);
    expect(isLegalInputMessage({ type: 'input', actions: {} })).toBe(true);
    expect(isLegalInputMessage({ type: 'input', actions: {}, sequence: 1 })).toBe(true);
  });
});
