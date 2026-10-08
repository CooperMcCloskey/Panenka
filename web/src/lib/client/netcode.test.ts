import { describe, expect, it } from 'vitest';
import { IDLE } from '$lib/engine/actions';
import { TICK_MS } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import { createState } from '$lib/engine/state';
import type { GameState } from '$lib/engine/types';
import { vec } from '$lib/engine/vec';
import { NETCODE_SETTINGS } from '$lib/shared/netcode';
import { LocalPrediction } from './local-prediction';
import { SnapshotBuffer } from './snapshot-buffer';

function snapshot(tick = 0): GameState {
  const state = createState({ blue: 1, orange: 1 }, { kind: 'time', minutes: 5 });
  state.match = { ...state.match, tick, phase: { kind: 'play' } };
  state.world.players[0].pos = vec(0.3 + tick * 0.001, 0.5);
  state.world.ball.pos = vec(0.9 + tick * 0.001, 0.5);
  return state;
}

describe('SnapshotBuffer', () => {
  it('keeps a continuous delayed timeline across jittered arrivals', () => {
    const buffer = new SnapshotBuffer();
    const arrivals = [[0, 0], [2, 40], [4, 70], [6, 115], [8, 135], [10, 180], [12, 200]];
    let previous = 0.3;
    for (let now = 0; now <= 200; now += 5) {
      while (arrivals.length && arrivals[0][1] <= now) {
        const [tick, received] = arrivals.shift()!;
        const before = buffer.sample(received)?.world.players[0].pos.x;
        buffer.push(snapshot(tick), received);
        // Receiving a packet must not restart interpolation or jump the render clock.
        if (before !== undefined) expect(buffer.sample(received)!.world.players[0].pos.x).toBeCloseTo(before, 8);
      }
      const current = buffer.sample(now)!.world.players[0].pos.x;
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current - previous).toBeLessThan(0.001);
      previous = current;
    }
    expect(previous).toBeGreaterThan(0.304);
    expect(previous).toBeLessThan(0.308);
    expect(buffer.sample(200)!.match.tick).toBe(12); // match metadata stays authoritative
  });

  it('holds during outages, ignores stale packets, and snaps at kickoff', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshot(0), 0);
    buffer.push(snapshot(2), 2 * TICK_MS);
    expect(buffer.sample(1000)!.world.players[0].pos.x).toBeCloseTo(0.302);
    buffer.push(snapshot(1), 1010);
    expect(buffer.sample(1010)!.match.tick).toBe(2);
    const kickoff = snapshot(4);
    kickoff.match.phase = { kind: 'countdown', ticksLeft: 180 };
    kickoff.world.players[0].pos = vec(0.6, 0.5);
    buffer.push(kickoff, 1020);
    expect(buffer.sample(1020)!.world.players[0].pos.x).toBe(0.6);
    buffer.clear();
    buffer.push(snapshot(0), 1030);
    expect(buffer.sample(1030)!.match.tick).toBe(0);
  });
});

describe('LocalPrediction', () => {
  const input = (sequence: number) => ({ sequence, actions: { blue: { ...IDLE, moveX: 1 as const } } });
  function prediction() {
    const client = new LocalPrediction();
    client.setPlayers(['blue', 'orange'], ['blue']);
    client.reconcile(snapshot(), 0, 1);
    return client;
  }

  it('moves before a server reply and replays only unacknowledged inputs', () => {
    const client = prediction();
    const initial = snapshot();
    const encodedInitial = JSON.stringify(initial);
    let server = initial;
    for (let sequence = 1; sequence <= 5; sequence++) {
      client.update(TICK_MS);
      client.predict(input(sequence));
      if (sequence <= 2) server = { ...server, world: physicsStep(server.world, [input(sequence).actions.blue, IDLE]) };
    }
    const before = client.currentPlayers(1)![0].pos.x;
    expect(before).toBeGreaterThan(initial.world.players[0].pos.x);
    server.match = { ...server.match, tick: 2 };
    client.reconcile(server, 2, 1);
    expect(client.currentPlayers(1)![0].pos.x).toBeCloseTo(before, 12);
    client.update(1000); // a replay error cannot be hidden indefinitely by visual smoothing
    expect(client.currentPlayers(1)![0].pos.x).toBeCloseTo(before, 7);
    expect(JSON.stringify(initial)).toBe(encodedInitial);
  });

  it('eases small errors with frame-rate-independent visual offsets and snaps large errors', () => {
    const a = prediction();
    const b = prediction();
    const corrected = snapshot(2);
    corrected.world.players[0].pos = vec(0.28, 0.5);
    a.reconcile(corrected, 0, 1);
    b.reconcile(corrected, 0, 1);
    expect(a.currentPlayers(1)![0].pos.x).toBe(0.3);
    a.update(NETCODE_SETTINGS.correctionHalfLifeMs);
    for (let i = 0; i < 6; i++) b.update(NETCODE_SETTINGS.correctionHalfLifeMs / 6);
    expect(a.currentPlayers(1)![0].pos.x).toBeCloseTo(0.29);
    expect(b.currentPlayers(1)![0].pos.x).toBeCloseTo(0.29);
    const teleport = snapshot(4);
    teleport.world.players[0].pos = vec(0.7, 0.5);
    a.reconcile(teleport, 0, 1);
    expect(a.currentPlayers(1)![0].pos.x).toBe(0.7);
  });

  it('freezes prediction after a stall and never slides through kickoff resets', () => {
    const client = prediction();
    client.predict(input(1));
    client.update(1000);
    const before = client.currentPlayers(1)![0].pos.x;
    client.predict(input(2));
    expect(client.currentPlayers(1)![0].pos.x).toBe(before);
    const kickoff = snapshot(2);
    kickoff.match.phase = { kind: 'countdown', ticksLeft: 180 };
    client.reconcile(kickoff, 2, 1);
    expect(client.currentPlayers(1)![0].pos.x).toBe(kickoff.world.players[0].pos.x);
    client.predict(input(3));
    expect(client.currentPlayers(1)![0].pos.x).toBe(kickoff.world.players[0].pos.x);
  });
});
