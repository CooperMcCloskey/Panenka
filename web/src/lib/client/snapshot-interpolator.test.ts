import { afterEach, describe, expect, it, vi } from 'vitest';
import { BALL_RADIUS, PLAYER_RADIUS, TICK_MS } from '$lib/engine/constants';
import { IDLE } from '$lib/engine/actions';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import type { GameState } from '$lib/engine/types';
import { vec } from '$lib/engine/vec';
import { encodeState } from '$lib/shared/codec';
import { KeyboardController } from '$lib/shared/controller';
import { NEW_LOBBY_STATE, type ClientMessage, type ServerMessage } from '$lib/shared/protocol';
import { NetworkSource } from './network-source';
import { INTERPOLATION_SETTINGS, SnapshotInterpolator } from './snapshot-interpolator';

function snapshot(tick = 0) {
  const state = createState({ blue: 1, orange: 1 }, { kind: 'time', minutes: 5 });
  state.match = { ...state.match, tick, clock: tick, phase: { kind: 'play' } };
  state.world.players[0].pos = vec(0.3 + tick * 0.001, 0.5);
  state.world.ball.pos = vec(0.9 + tick * 0.001, 0.5);
  return state;
}

describe('server snapshot interpolation', () => {
  it('keeps a constant playback speed through jitter and bunched deliveries without building extra delay', () => {
    const buffer = new SnapshotInterpolator({ adaptiveDelay: false });
    // Model the 60 Hz stream arriving unevenly within the buffer's jitter budget.
    const delays = [0, 20, 5, 30, 0, 15, 25, 0];
    const packets = Array.from({ length: 361 }, (_, index) => ({
      tick: index,
      at: index * TICK_MS + delays[index % delays.length],
    }));
    // WebSocket delivery is ordered; a delayed packet can hold up the next one.
    for (let index = 1; index < packets.length; index++)
      packets[index].at = Math.max(packets[index].at, packets[index - 1].at);
    let previous = 0;
    for (let now = 0; now <= 5900; now += 5) {
      while (packets.length && packets[0].at <= now) {
        const packet = packets.shift()!;
        buffer.push(snapshot(packet.tick), packet.at);
      }
      const x = buffer.sample(now)!.world.players[0].pos.x;
      if (now > 100) expect(x - previous).toBeCloseTo(0.001 * 5 / TICK_MS, 10);
      if (now >= 100) {
        const displayedTick = (x - 0.3) / 0.001;
        expect(now - displayedTick * TICK_MS).toBeCloseTo(INTERPOLATION_SETTINGS.delayMs, 8);
      }
      previous = x;
    }
  });

  it.each(['ball', 'player'] as const)('keeps player-%s contacts on the same timeline while moving', contact => {
    const buffer = new SnapshotInterpolator();
    let state = snapshot();
    state.world.players[0].pos = vec(0.5, 0.5);
    state.world.players[1].pos = vec(contact === 'player' ? 0.56 : 1.3, 0.5);
    state.world.ball.pos = vec(contact === 'ball' ? 0.545 : 0.9, contact === 'ball' ? 0.5 : 0.2);
    const states: GameState[] = [state];
    for (let tick = 1; tick <= 60; tick++) {
      state = step(state, [{ ...IDLE, moveX: 1 }, IDLE]);
      states.push(state);
    }
    let packet = 0;
    for (let now = 0; now <= 1000; now += 5) {
      while (packet < states.length && states[packet].match.tick * TICK_MS <= now) {
        const received = states[packet++];
        buffer.push(received, received.match.tick * TICK_MS);
      }
      const { players, ball } = buffer.sample(now)!.world;
      const other = contact === 'ball' ? ball : players[1];
      const distance = other.pos.sub(players[0].pos).length();
      expect(distance).toBeGreaterThanOrEqual(PLAYER_RADIUS + (contact === 'ball' ? BALL_RADIUS : PLAYER_RADIUS) - 1e-9);
    }
    expect(buffer.sample(1000)!.world.players[0].pos.x).toBeGreaterThan(0.6);
  });

  it('does not rewind when persistent delivery delay changes the clock estimate', () => {
    const buffer = new SnapshotInterpolator({ clockWindowMs: 200 });
    buffer.push(snapshot(), 0);
    let previous = 0.3;
    for (let now = 0; now <= 1500; now += 5) {
      if (now >= 400 && (now - 400) % 100 === 0)
        buffer.push(snapshot((now - 400) / 100 * 6 + 2), now);
      const x = buffer.sample(now)!.world.players[0].pos.x;
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it('keeps positions continuous across early, late and bunched packet arrivals', () => {
    const buffer = new SnapshotInterpolator();
    const arrivals = [[0, 0], [2, 50], [4, 68], [6, 118], [8, 136], [10, 180], [12, 201], [14, 250], [16, 270]];
    let previous = 0.3;
    for (let now = 0; now <= 270; now++) {
      while (arrivals.length && arrivals[0][1] === now) {
        const [tick] = arrivals.shift()!;
        const before = buffer.sample(now)?.world.players[0].pos.x;
        buffer.push(snapshot(tick), now);
        if (before !== undefined) expect(buffer.sample(now)!.world.players[0].pos.x).toBeCloseTo(before, 10);
      }
      const state = buffer.sample(now)!;
      const current = state.world.players[0].pos.x;
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current - previous).toBeLessThanOrEqual(0.001 / TICK_MS * 1.1 + 1e-10);
      expect(state.world.ball.pos.x - current).toBeCloseTo(0.6);
      previous = current;
    }
    expect(previous).toBeGreaterThan(0.310);
    expect(previous).toBeLessThan(0.314);
    expect(buffer.sample(270)!.match.tick).toBe(16);
  });

  it('holds received positions during outages and resets after a large snapshot gap', () => {
    const buffer = new SnapshotInterpolator();
    buffer.push(snapshot(0), 0);
    buffer.push(snapshot(2), 2 * TICK_MS);
    expect(buffer.sample(1000)!.world.players[0].pos.x).toBeCloseTo(0.302);
    expect(buffer.sample(2000)!.world.players[0].pos.x).toBeCloseTo(0.302);
    buffer.push(snapshot(60), 2010);
    expect(buffer.sample(2010)!.world.players[0].pos.x).toBeCloseTo(0.36);
  });

  it('ignores duplicate and old snapshots, and preserves the latest authoritative match metadata', () => {
    const buffer = new SnapshotInterpolator({ adaptiveDelay: false });
    buffer.push(snapshot(0), 0);
    const newest = snapshot(2);
    newest.match.score.blue = 1;
    buffer.push(newest, 30);
    buffer.push(snapshot(1), 31);
    buffer.push(snapshot(2), 32);
    expect(buffer.sample(32)!.match).toEqual(newest.match);
    expect(buffer.sample(32)!.world.players[0].pos.x).toBe(0.3);
  });

  it('snaps at kickoff, handles changed lineups and clears history between matches', () => {
    const buffer = new SnapshotInterpolator();
    buffer.push(snapshot(0), 0);
    const kickoff = snapshot(2);
    kickoff.match.phase = { kind: 'countdown', ticksLeft: 180 };
    kickoff.world.players[0].pos = vec(0.6, 0.5);
    buffer.push(kickoff, 30);
    expect(buffer.sample(30)!.world).toEqual(kickoff.world);
    const lineup = createState({ blue: 2, orange: 1 }, kickoff.match.rules);
    lineup.match.tick = 4;
    buffer.push(lineup, 60);
    expect(buffer.sample(60)!.world).toEqual(lineup.world);
    buffer.clear();
    expect(buffer.sample(100)).toBeUndefined();
    buffer.push(snapshot(0), 110);
    expect(buffer.sample(110)!.match.tick).toBe(0);
  });

  it('resumes near the current snapshots after the renderer was suspended', () => {
    const buffer = new SnapshotInterpolator({ maxSnapshots: 8 });
    for (let tick = 0; tick <= 60; tick += 2) buffer.push(snapshot(tick), tick * TICK_MS);
    const expectedTick = 60 - INTERPOLATION_SETTINGS.delayMs / TICK_MS;
    expect(buffer.sample(1000)!.world.players[0].pos.x).toBeCloseTo(0.3 + expectedTick * 0.001);
  });

  it('supports a configurable delay and never mutates received snapshots', () => {
    const buffer = new SnapshotInterpolator({ delayMs: 0 });
    const a = snapshot(0);
    const b = snapshot(2);
    const originals = [Array.from(encodeState(a)), Array.from(encodeState(b))];
    buffer.push(a, 0);
    buffer.push(b, 2 * TICK_MS);
    expect(buffer.sample(2 * TICK_MS)!.world).toEqual(b.world);
    buffer.sample(50);
    expect([Array.from(encodeState(a)), Array.from(encodeState(b))]).toEqual(originals);
  });
});

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  bufferedAmount = 0;
  messages: ClientMessage[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (() => void) | null;
  constructor(readonly url: URL) { Socket.latest = this; }
  send(text: string) { this.messages.push(JSON.parse(text)); }
  close() { this.readyState = 3; }
  receive(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NetworkSource authoritative playback', () => {
  it('sends keyboard changes immediately without moving a player ahead of the authoritative world', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', Socket);
    const listeners = new Map<string, Set<(event: { code: string }) => void>>();
    vi.stubGlobal('addEventListener', (type: string, listener: (event: { code: string }) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    });
    vi.stubGlobal('removeEventListener', (type: string, listener: (event: { code: string }) => void) => {
      listeners.get(type)?.delete(listener);
    });
    vi.stubGlobal('window', { location: { href: 'https://example.com/lobby/online/test' } });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const lobby = {
      ...NEW_LOBBY_STATE(), rev: 1, started: true, playerMapping: ['orange', 'blue'],
      players: { blue: { username: 'You', team: 'blue' as const }, orange: { username: 'Other', team: 'orange' as const } },
    };
    const source = new NetworkSource('test', 'token', lobby, () => {}, () => {});
    source.start();
    const socket = Socket.latest;
    try {
      socket.onopen?.();
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 2 }, controlledPlayerIds: ['blue'] });
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(snapshot())) });
      const before = source.currentState();
      now = 20;
      for (const listener of listeners.get('keydown')!) listener({ code: 'KeyD' });
      expect(socket.messages.at(-1)).toMatchObject({ type: 'input', actions: { blue: { moveX: 1, moveY: 0, kick: false } } });
      const after = source.currentState();
      expect(after.world.players[1].pos).toEqual(before.world.players[1].pos);
      expect(after.world.players[0].pos).toEqual(before.world.players[0].pos);
      expect(after.world.ball).toEqual(before.world.ball);
      expect(after.match).toEqual(before.match);
      now = 40;
      for (const listener of listeners.get('blur')!) listener({ code: '' });
      expect(socket.messages.at(-1)).toMatchObject({ type: 'input', actions: { blue: { moveX: 0, moveY: 0, kick: false } } });
    } finally { source.stop(); }
    expect([...listeners.values()].every(handlers => handlers.size === 0)).toBe(true);
  });

  it('sends inputs as before and moves players only when server positions arrive', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('removeEventListener', vi.fn());
    vi.stubGlobal('window', { location: { href: 'https://example.com/lobby/online/test' } });
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(KeyboardController.prototype, 'getAction').mockReturnValue({ moveX: 1, moveY: 0, kick: false });
    const lobby = {
      ...NEW_LOBBY_STATE(), rev: 1, started: true, playerMapping: ['blue', 'orange'],
      players: { blue: { username: 'You', team: 'blue' as const }, orange: { username: 'Other', team: 'orange' as const } },
    };
    const source = new NetworkSource('test', 'token', lobby, () => {}, () => {});
    source.start();
    const socket = Socket.latest;
    try {
      expect(socket.url.href).toBe('wss://example.com/ws');
      socket.onopen?.();
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 2 }, controlledPlayerIds: ['blue'] });
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(snapshot())) });
      now = 100;
      vi.advanceTimersByTime(100);
      source.update(100);
      expect(socket.messages.filter(message => message.type === 'input').length).toBeGreaterThan(0);
      expect(socket.messages.filter(message => message.type === 'input')[0]).toMatchObject({
        type: 'input', actions: { blue: { moveX: 1, moveY: 0, kick: false } },
      });
      expect(source.currentState().world.players[0].pos.x).toBe(0.3);
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(snapshot(6))) });
      now += 16;
      source.update(16);
      expect(source.currentState().world.players[0].pos.x).toBeGreaterThan(0.3);
      expect(source.currentState().world.players[0].pos.x).toBeLessThan(0.306);
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 3, started: false }, controlledPlayerIds: ['blue'] });
      expect(source.currentState().match.tick).toBe(0);
      socket.receive({ type: 'lobby', lobbyState: { ...lobby, rev: 4 }, controlledPlayerIds: ['blue'] });
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(snapshot())) });
      expect(source.currentState().world.players[0].pos.x).toBe(0.3);
      socket.receive({ type: 'snapshot', state: Array.from(encodeState(snapshot(2))) });
      now += 1000;
      expect(source.currentState().world.players[0].pos.x).toBeCloseTo(0.302);
    } finally { source.stop(); }
    const sent = socket.messages.length;
    vi.advanceTimersByTime(100);
    expect(socket.messages.length).toBe(sent);
    expect(source.currentState().match.tick).toBe(2);
    expect(source.currentState().world.players[0].pos.x).toBeCloseTo(0.302);
  });
});
