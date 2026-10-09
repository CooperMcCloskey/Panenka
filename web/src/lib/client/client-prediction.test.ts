import { describe, expect, it } from 'vitest';
import { IDLE } from '$lib/engine/actions';
import { BALL_RADIUS, PLAYER_RADIUS, POST_RADIUS, TICK_MS } from '$lib/engine/constants';
import { physicsStep } from '$lib/engine/physics';
import { createState } from '$lib/engine/state';
import { MAX_TEAMSIZE } from '$lib/engine/rules';
import { BALL_WALLS, PLAYER_WALLS, POSTS } from '$lib/engine/stadium';
import { vec } from '$lib/engine/vec';
import type { Action, GameState, World } from '$lib/engine/types';
import { encodeState } from '$lib/shared/codec';
import type { SnapshotNetwork } from '$lib/shared/protocol';
import { ClientPrediction } from './client-prediction';

const ids = ['blue', 'orange'];
const right: Action = { ...IDLE, moveX: 1 };
const network = (heldActions: Action[] = [IDLE, IDLE]): SnapshotNetwork => ({
  heldActions, serverFrameMs: TICK_MS, serverTickDelayMs: 0,
});

function state(): GameState {
  const result = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
  result.match.phase = { kind: 'play' };
  result.world.players[0].pos = vec(0.5, 0.5);
  result.world.players[1].pos = vec(1.3, 0.5);
  result.world.ball.pos = vec(0.9, 0.5);
  return result;
}

function expectContacts(world: World) {
  const bodies = [...world.players, world.ball];
  const radii = [...world.players.map(() => PLAYER_RADIUS), BALL_RADIUS];
  for (let i = 0; i < bodies.length; i++) {
    expect(Number.isFinite(bodies[i].pos.x + bodies[i].pos.y + bodies[i].vel.x + bodies[i].vel.y)).toBe(true);
    for (let j = i + 1; j < bodies.length; j++)
      expect(bodies[i].pos.sub(bodies[j].pos).length()).toBeGreaterThanOrEqual(radii[i] + radii[j] - 0.00001);
    for (const post of POSTS)
      expect(bodies[i].pos.sub(post).length()).toBeGreaterThanOrEqual(radii[i] + POST_RADIUS - 0.00001);
    for (const wall of i === bodies.length - 1 ? BALL_WALLS : PLAYER_WALLS) {
      const ab = wall.b.sub(wall.a);
      const t = Math.max(0, Math.min(1, bodies[i].pos.sub(wall.a).dot(ab) / ab.dot(ab)));
      expect(bodies[i].pos.sub(wall.a.add(ab.scale(t))).length()).toBeGreaterThanOrEqual(radii[i] - 0.00001);
    }
  }
}

describe('whole-world client prediction', () => {
  it.each(['ball', 'player', 'post', 'wall'] as const)('uses the shared collision impulses for %s contacts', contact => {
    const original = state();
    let action = right;
    if (contact === 'ball') original.world.ball.pos = vec(0.545, 0.5);
    if (contact === 'player') original.world.players[1].pos = vec(0.56, 0.5);
    if (contact === 'post') {
      original.world.ball.pos = POSTS[0].add(vec(-BALL_RADIUS - POST_RADIUS - 0.002, 0));
      original.world.ball.vel = vec(0.01, 0);
    }
    if (contact === 'wall') {
      original.world.players[0].pos = vec(0, 0.2);
      action = { ...IDLE, moveX: -1 };
    }
    const untouched = Array.from(encodeState(original));
    const prediction = new ClientPrediction();
    prediction.input({ blue: action }, 0, 0);
    prediction.push(original, network(), ids, 0, 0);
    let expected = original.world;
    for (let tick = 1; tick <= 10; tick++) {
      expected = physicsStep(expected, [action, IDLE]);
      const drawn = prediction.sample(tick * TICK_MS, tick)!;
      expectContacts(drawn.world);
      expect(drawn.world.players.map(p => p.vel)).toEqual(expected.players.map(p => p.vel));
      expect(drawn.world.ball.vel).toEqual(expected.ball.vel);
      expect(drawn.world.players[0].pos.x).toBeCloseTo(expected.players[0].pos.x, 6);
      expectContacts(prediction.sample((tick + 0.5) * TICK_MS, tick + 0.5)!.world);
    }
    if (contact === 'ball') expect(expected.ball.vel.x).toBeGreaterThan(0);
    if (contact === 'player') expect(expected.players[1].vel.x).toBeGreaterThan(0);
    if (contact === 'wall') expect(expected.players[0].vel.x).toBeGreaterThanOrEqual(0);
    expect(Array.from(encodeState(original))).toEqual(untouched);
  });

  it('replays unacknowledged changes after rollback and preserves held input after acknowledgement', () => {
    const prediction = new ClientPrediction();
    const original = state();
    prediction.input({ blue: IDLE }, 0, 0);
    prediction.inputSent(1);
    prediction.push(original, network(), ids, 0, 0);
    prediction.input({ blue: right }, 1, 1);
    prediction.inputSent(2);
    prediction.sample(20, 3);
    const delayed = { ...original, world: physicsStep(original.world, [IDLE, IDLE]), match: { ...original.match, tick: 1 } };
    prediction.push(delayed, { ...network(), inputAck: { sequence: 1, tick: 1, queueMs: 5 } }, ids, 21, 3);
    const expected = physicsStep(physicsStep(delayed.world, [right, IDLE]), [right, IDLE]);
    expect(prediction.sample(22, 3)!.world.players[0].vel).toEqual(expected.players[0].vel);
    expect(prediction.diagnostics.pendingInputChanges).toBe(1);
    const accepted = { ...delayed, world: physicsStep(delayed.world, [right, IDLE]), match: { ...delayed.match, tick: 2 } };
    prediction.push(accepted, { ...network([right, IDLE]), inputAck: { sequence: 2, tick: 2, queueMs: 3 } }, ids, 23, 3);
    expect(prediction.diagnostics.pendingInputChanges).toBe(0);
    const continuing = prediction.sample(24, 4)!;
    expect(continuing.world.players[0].vel).toEqual(physicsStep(expected, [right, IDLE]).players[0].vel);
    expect(prediction.diagnostics.reconciliations).toBe(2);
  });

  it('preserves a short kick through replay without applying an extra impulse after acknowledgement', () => {
    const original = state();
    original.world.ball.pos = vec(0.55, 0.5);
    const prediction = new ClientPrediction();
    prediction.input({ blue: IDLE }, 0, 0);
    prediction.push(original, network(), ids, 0, 0);
    prediction.input({ blue: { ...IDLE, kick: true } }, 1, 1);
    prediction.input({ blue: IDLE }, 2, 1);
    prediction.inputSent(1);
    const kicked = physicsStep(original.world, [{ ...IDLE, kick: true }, IDLE]);
    const released = physicsStep(kicked, [IDLE, IDLE]);
    expect(prediction.sample(17, 1)!.world.ball.vel).toEqual(kicked.ball.vel);
    expect(prediction.sample(34, 2)!.world.ball.vel).toEqual(released.ball.vel);
    const accepted = { ...original, world: kicked, match: { ...original.match, tick: 1 } };
    prediction.push(accepted, { ...network(), inputAck: { sequence: 1, tick: 1, queueMs: 0 } }, ids, 40, 2);
    for (let frame = 0; frame < 5; frame++)
      expect(prediction.sample(41 + frame, 2)!.world.ball.vel).toEqual(released.ball.vel);
    expect(prediction.diagnostics.pendingInputChanges).toBe(0);
  });

  it('uses player IDs rather than controller order when one client controls two players', () => {
    const original = state();
    const prediction = new ClientPrediction();
    const up: Action = { ...IDLE, moveY: -1 };
    prediction.input({ orange: up, blue: right }, 0, 0);
    prediction.push(original, network(), ids, 0, 0);
    const expected = physicsStep(original.world, [right, up]);
    expect(prediction.sample(17, 1)!.world).toEqual(expected);
  });

  it('keeps delayed, bunched and missing snapshots collision-safe while remote inputs change', () => {
    let authoritative = state();
    authoritative.world.players[0].pos = vec(0.855, 0.5);
    authoritative.world.players[1].pos = vec(0.945, 0.5);
    const prediction = new ClientPrediction();
    prediction.input({ blue: right }, 0, 0);
    prediction.inputSent(1);
    prediction.push(authoritative, network([right, { ...IDLE, moveX: -1 }]), ids, 0, 3);
    const packets: { state: GameState; network: SnapshotNetwork; at: number; original: number[] }[] = [];
    let arrival = 0;
    for (let tick = 1; tick <= 240; tick++) {
      const remote: Action = { moveX: tick % 80 < 60 ? -1 : 1, moveY: tick % 100 < 50 ? 0 : 1, kick: tick % 60 < 10 };
      authoritative = { ...authoritative, world: physicsStep(authoritative.world, [right, remote]),
        match: { ...authoritative.match, tick } };
      if (tick % 17 === 0) continue;
      arrival = Math.max(arrival, tick * TICK_MS + 40 + (tick % 30 === 15 ? 65 : 0));
      packets.push({ state: authoritative, at: arrival, original: Array.from(encodeState(authoritative)),
        network: { ...network([right, remote]), inputAck: { sequence: 1, tick: 1, queueMs: 0 } } });
    }
    let packet = 0;
    for (let now = 0; now <= 4000; now += 5) {
      while (packet < packets.length && packets[packet].at <= now) {
        const received = packets[packet++];
        prediction.push(received.state, received.network, ids, now, now / TICK_MS + 3);
      }
      expectContacts(prediction.sample(now, now / TICK_MS + 3)!.world);
      expect(prediction.diagnostics.predictionLeadMs).toBeLessThanOrEqual(250 + 1e-8);
    }
    expect(prediction.diagnostics.reconciliations).toBeGreaterThan(100);
    expect(packets.every(packet => Array.from(encodeState(packet.state)).every((value, i) => value === packet.original[i]))).toBe(true);
  });

  it('resets at kickoff, freezes countdowns, bounds outages and keeps scores authoritative', () => {
    const original = state();
    const prediction = new ClientPrediction();
    prediction.input({ blue: right }, 0, 0);
    prediction.push(original, network(), ids, 0, 0);
    const exhausted = prediction.sample(1000, 60)!;
    expect(prediction.diagnostics.predictionLeadMs).toBe(250);
    expect(prediction.sample(2000, 120)!.world).toEqual(exhausted.world);
    expect(exhausted.match).toEqual(original.match);
    const kickoff = state();
    kickoff.match.tick = 20;
    kickoff.match.phase = { kind: 'countdown', ticksLeft: 180 };
    kickoff.match.score.blue = 1;
    kickoff.world.players[0].pos = vec(0.6, 0.5);
    prediction.push(kickoff, network(), ids, 2010, 120);
    expect(prediction.sample(2011, 120)!.world).toEqual(kickoff.world);
    expect(prediction.sample(2011, 120)!.match.score.blue).toBe(1);
    prediction.clear();
    expect(prediction.sample(2020, 121)).toBeUndefined();
  });

  it('keeps maximum-size teams separated while reconciling crowded kicks and collisions', () => {
    let authoritative = createState({ blue: MAX_TEAMSIZE, orange: MAX_TEAMSIZE }, { kind: 'goals', target: 99 });
    authoritative.match.phase = { kind: 'play' };
    const playerIds = authoritative.world.players.map((_, i) => String(i));
    const prediction = new ClientPrediction();
    prediction.input({ '0': IDLE }, 0, 0);
    let worstPenetration = 0;
    for (let tick = 0; tick < 240; tick++) {
      const actions = authoritative.world.players.map((player, i): Action => ({
        moveX: Math.sign(authoritative.world.ball.pos.x - player.pos.x) as Action['moveX'],
        moveY: Math.sign(authoritative.world.ball.pos.y - player.pos.y) as Action['moveY'],
        kick: (tick + i * 10) % 120 < 15,
      }));
      prediction.input({ '0': actions[0] }, tick * TICK_MS, tick + 4);
      if (tick % 3 === 0) prediction.push(authoritative, network(actions), playerIds, tick * TICK_MS, tick + 4);
      for (const fraction of [0, 0.5]) {
        const drawn = prediction.sample((tick + fraction) * TICK_MS, tick + 4 + fraction)!;
        const bodies = [...drawn.world.players, drawn.world.ball];
        const radii = [...drawn.world.players.map(() => PLAYER_RADIUS), BALL_RADIUS];
        for (let i = 0; i < bodies.length; i++) {
          expect(Number.isFinite(bodies[i].pos.x + bodies[i].vel.x)).toBe(true);
          for (let j = i + 1; j < bodies.length; j++)
            worstPenetration = Math.max(worstPenetration, radii[i] + radii[j] - bodies[i].pos.sub(bodies[j].pos).length());
          for (const post of POSTS)
            worstPenetration = Math.max(worstPenetration, radii[i] + POST_RADIUS - bodies[i].pos.sub(post).length());
        }
      }
      authoritative = { ...authoritative, world: physicsStep(authoritative.world, actions),
        match: { ...authoritative.match, tick: tick + 1 } };
    }
    expect(worstPenetration).toBeLessThan(0.00005);
  });

  it('falls back safely for legacy snapshots and bounded input-history overflow', () => {
    const original = state();
    const prediction = new ClientPrediction({ maxInputChanges: 2 });
    prediction.input({ blue: IDLE }, 0, 0);
    prediction.push(original, undefined, ids, 0, 0);
    expect(prediction.sample(10, 1)).toBeUndefined();
    prediction.push(original, network(), ids, 10, 0);
    prediction.input({ blue: right }, 11, 1);
    prediction.input({ blue: IDLE }, 12, 1);
    prediction.input({ blue: right }, 13, 1);
    expect(prediction.sample(17, 1)).toBeUndefined();
    expect(prediction.diagnostics.pendingInputChanges).toBe(2);
    prediction.inputSent(1);
    const accepted = { ...original, match: { ...original.match, tick: 1 } };
    prediction.push(accepted, { ...network([right, IDLE]), inputAck: { sequence: 1, tick: 1, queueMs: 0 } }, ids, 20, 2);
    expect(prediction.sample(21, 2)).toBeDefined();
  });
});
