import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEW_LOBBY_STATE, type ClientMessage, type ServerMessage } from '$lib/shared/protocol';
import { NetworkSource } from './network-source';
import { IDLE } from '$lib/engine/actions';
import { BALL_RADIUS, PLAYER_RADIUS } from '$lib/engine/constants';
import { createState } from '$lib/engine/state';
import { encodeState } from '$lib/shared/codec';
import { vec } from '$lib/engine/vec';

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  bufferedAmount = 0;
  messages: ClientMessage[] = [];
  onmessage?: (event: { data: string }) => void;
  onclose?: (() => void) | null;
  constructor() { Socket.latest = this; }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close() { this.readyState = 3; }
  receive(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('network keyboard delivery', () => {
  it.each([true, false])('predicts collision-safe local movement before the send slot (enabled: %s)', enabled => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('window', { location: { href: 'https://example.com/lobby/online/test' } });
    const listeners = new Map<string, Set<(event: { code: string }) => void>>();
    vi.stubGlobal('addEventListener', (type: string, listener: (event: { code: string }) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    });
    vi.stubGlobal('removeEventListener', (type: string, listener: (event: { code: string }) => void) => listeners.get(type)?.delete(listener));
    // Navigation time must not be mistaken for simulation time before the first snapshot.
    vi.advanceTimersByTime(5000);
    const lobby = { ...NEW_LOBBY_STATE(), rev: 1, started: true, playerMapping: ['blue', 'orange'], players: {
      blue: { username: 'You', team: 'blue' as const }, orange: { username: 'Other', team: 'orange' as const },
    } };
    const source = new NetworkSource('test', 'token', lobby, () => {}, () => {}, { prediction: enabled ? {} : false });
    source.start();
    const socket = Socket.latest;
    try {
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 2 }, controlledPlayerIds: ['blue'] });
      const original = createState({ blue: 1, orange: 1 }, lobby.rules);
      original.match.phase = { kind: 'play' };
      original.world.players[0].pos = vec(0.5, 0.5);
      original.world.players[1].pos = vec(1.3, 0.5);
      original.world.ball.pos = vec(0.545, 0.5);
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(original)), network: {
        heldActions: [IDLE, IDLE], rttMs: 50, serverFrameMs: 17, serverTickDelayMs: 0.3,
      } });
      socket.messages = [];
      vi.advanceTimersByTime(1);
      listeners.get('keydown')?.forEach(listener => listener({ code: 'KeyD' }));
      vi.advanceTimersByTime(4);
      expect(socket.messages).toHaveLength(0);
      const drawn = source.currentState();
      expect(drawn.match).toEqual(original.match);
      expect(source.diagnostics).toMatchObject({ predictionActive: enabled, rttMs: 50, serverTickDelayMs: 0.3 });
      if (enabled) {
        expect(drawn.world.players[0].pos.x).toBeGreaterThan(0.5);
        expect(drawn.world.ball.vel.x).toBeGreaterThan(0);
        expect(source.diagnostics.localResponseMs).toBe(4);
      } else expect(drawn.world.players[0].pos.x).toBe(0.5);
      expect(drawn.world.ball.pos.sub(drawn.world.players[0].pos).length()).toBeGreaterThanOrEqual(PLAYER_RADIUS + BALL_RADIUS - 1e-8);
      vi.advanceTimersByTime(10);
      expect(socket.messages[0]).toMatchObject({ type: 'input', sequence: 2, actions: { blue: { ...IDLE, moveX: 1 } } });
    } finally { source.stop(); }
  });

  it.each([false, true])('preserves a coalesced kick and sends its release promptly (congested: %s)', congested => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('window', { location: { href: 'https://example.com/lobby/online/test' } });
    const listeners = new Map<string, Set<(event: { code: string }) => void>>();
    vi.stubGlobal('addEventListener', (type: string, listener: (event: { code: string }) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    });
    vi.stubGlobal('removeEventListener', (type: string, listener: (event: { code: string }) => void) => {
      listeners.get(type)?.delete(listener);
    });
    const key = (type: string, code = '') => listeners.get(type)?.forEach(listener => listener({ code }));
    const lobby = { ...NEW_LOBBY_STATE(), rev: 1, started: true, playerMapping: ['blue'],
      players: { blue: { username: 'You', team: 'blue' as const } } };
    const source = new NetworkSource('test', 'token', lobby, () => {}, () => {});
    source.start();
    const socket = Socket.latest;
    const inputs = () => socket.messages.filter(message => message.type === 'input');
    try {
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 2 }, controlledPlayerIds: ['blue'] });
      // The first input was sent at time 0. Both edges of the tap arrive before
      // the next send slot, and may also have to wait for a backed-up socket.
      socket.messages = [];
      if (congested) socket.bufferedAmount = 200;
      vi.advanceTimersByTime(1);
      key('keydown', 'KeyD');
      key('keydown', 'Space');
      key('keyup', 'Space');
      expect(inputs()).toHaveLength(0);
      if (congested) {
        vi.advanceTimersByTime(36);
        expect(inputs()).toHaveLength(0);
        expect(source.diagnostics.queuedInputBytes).toBe(200);
        socket.bufferedAmount = 0;
      }
      vi.advanceTimersByTime(12);
      expect(inputs().map(message => message.actions.blue)).toEqual([{ moveX: 1, moveY: 0, kick: true }]);
      vi.advanceTimersByTime(12);
      expect(inputs().map(message => message.actions.blue)).toEqual([
        { moveX: 1, moveY: 0, kick: true }, { moveX: 1, moveY: 0, kick: false },
      ]);
      vi.advanceTimersByTime(12);
      key('blur');
      expect(inputs().at(-1)?.actions.blue).toEqual({ moveX: 0, moveY: 0, kick: false });
    } finally { source.stop(); }
    const sent = socket.messages.length;
    vi.advanceTimersByTime(1000);
    expect(socket.messages).toHaveLength(sent);
    expect([...listeners.values()].every(handlers => handlers.size === 0)).toBe(true);
  });
});
