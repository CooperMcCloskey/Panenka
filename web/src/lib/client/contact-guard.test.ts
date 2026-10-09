import { describe, expect, it } from 'vitest';
import { IDLE } from '$lib/engine/actions';
import { BALL_RADIUS, PLAYER_RADIUS, POST_RADIUS, TICK_MS } from '$lib/engine/constants';
import { BALL_WALLS, PLAYER_WALLS, POSTS } from '$lib/engine/stadium';
import { MAX_TEAMSIZE } from '$lib/engine/rules';
import { createState } from '$lib/engine/state';
import { step } from '$lib/engine/step';
import { vec } from '$lib/engine/vec';
import { encodeState } from '$lib/shared/codec';
import type { Action, World } from '$lib/engine/types';
import { guardContacts } from './contact-guard';
import { SnapshotInterpolator } from './snapshot-interpolator';

function expectSeparate(world: World) {
  const bodies = [...world.players, world.ball];
  const radii = [...world.players.map(() => PLAYER_RADIUS), BALL_RADIUS];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++)
      expect(bodies[i].pos.sub(bodies[j].pos).length()).toBeGreaterThanOrEqual(radii[i] + radii[j] - 0.00001);
    for (const post of POSTS)
      expect(bodies[i].pos.sub(post).length()).toBeGreaterThanOrEqual(radii[i] + POST_RADIUS - 0.00001);
  }
}

describe('snapshot contact guard', () => {
  it('keeps crowded maximum-size teams separated while chasing and kicking the ball', () => {
    let state = createState({ blue: MAX_TEAMSIZE, orange: MAX_TEAMSIZE }, { kind: 'goals', target: 99 });
    state.match.phase = { kind: 'play' };
    let worstPenetration = 0;
    for (let tick = 0; tick < 3600; tick++) {
      const actions = state.world.players.map((p, i): Action => ({
        moveX: Math.sign(state.world.ball.pos.x - p.pos.x) as Action['moveX'],
        moveY: Math.sign(state.world.ball.pos.y - p.pos.y) as Action['moveY'],
        kick: (tick + i * 10) % 120 < 15,
      }));
      state = step(state, actions);
      const result = guardContacts(state.world);
      const bodies = [...result.players, result.ball];
      const radii = [...result.players.map(() => PLAYER_RADIUS), BALL_RADIUS];
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++)
          worstPenetration = Math.max(worstPenetration, radii[i] + radii[j] - bodies[i].pos.sub(bodies[j].pos).length());
        for (const post of POSTS)
          worstPenetration = Math.max(worstPenetration, radii[i] + POST_RADIUS - bodies[i].pos.sub(post).length());
        for (const wall of (i === bodies.length - 1 ? BALL_WALLS : PLAYER_WALLS)) {
          const ab = wall.b.sub(wall.a);
          const t = Math.max(0, Math.min(1, bodies[i].pos.sub(wall.a).dot(ab) / ab.dot(ab)));
          worstPenetration = Math.max(worstPenetration, radii[i] - bodies[i].pos.sub(wall.a.add(ab.scale(t))).length());
        }
      }
    }
    // Below 0.05 pixels at 1000 pixels per world unit, even in dense scrums.
    expect(worstPenetration).toBeLessThan(0.00005);
  }, 15_000);

  it('separates touching bodies without changing snapshots, velocities or kick state', () => {
    const state = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
    state.world.players[0].pos = vec(0.86, 0.5);
    state.world.players[1].pos = vec(0.94, 0.5);
    state.world.players[0].vel = vec(0.005, 0);
    state.world.players[1].vel = vec(-0.005, 0);
    state.world.players[1].kickHeld = true;
    const before = Array.from(encodeState(state));
    const result = guardContacts(state.world);
    expectSeparate(result);
    expect(Array.from(encodeState(state))).toEqual(before);
    expect(result.players.map(player => player.vel)).toEqual(state.world.players.map(player => player.vel));
    expect(result.players[1].kickHeld).toBe(true);
    expect(result.ball.vel).toEqual(state.world.ball.vel);
  });

  it('protects goalposts and walls as well as player-player contacts', () => {
    const state = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
    state.world.players[0].pos = vec(0.01, 0.2);
    state.world.players[1].pos = vec(0.03, 0.2);
    state.world.ball.pos = POSTS[0].add(vec(0.015, 0));
    const result = guardContacts(state.world);
    expectSeparate(result);
    expect(result.players.every(player => player.pos.x >= -0.00001)).toBe(true);
  });

  it('keeps contacts separated when interpolation cuts across a curved path', () => {
    const before = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
    before.match.phase = { kind: 'play' };
    before.world.players[0].pos = vec(0.9, 0.5);
    before.world.ball.pos = vec(0.9 + 0.045 * Math.cos(-0.5), 0.5 + 0.045 * Math.sin(-0.5));
    const after = { ...before, match: { ...before.match, tick: 1 }, world: {
      ...before.world, ball: { ...before.world.ball, pos: vec(0.9 + 0.045 * Math.cos(0.5), 0.5 + 0.045 * Math.sin(0.5)) },
    } };
    const buffer = new SnapshotInterpolator({ delayMs: 0 });
    buffer.push(before, 0);
    buffer.push(after, TICK_MS);
    for (let now = 0; now <= TICK_MS; now++) expectSeparate(buffer.sample(now)!.world);
  });

  it('handles a ball squeezed between opponents under delayed and bunched snapshots', () => {
    let state = createState({ blue: 1, orange: 1 }, { kind: 'goals', target: 3 });
    state.match.phase = { kind: 'play' };
    const packets = [{ state, at: 0 }];
    for (let tick = 1; tick <= 360; tick++) {
      state = step(state, [{ ...IDLE, moveX: 1 }, { ...IDLE, moveX: -1 }]);
      packets.push({ state, at: Math.max(packets.at(-1)!.at, tick * TICK_MS + (tick % 30 === 15 ? 65 : 0)) });
    }
    const originals = packets.map(packet => Array.from(encodeState(packet.state)));
    const buffer = new SnapshotInterpolator();
    let packet = 0;
    for (let now = 0; now <= 5900; now += 5) {
      while (packet < packets.length && packets[packet].at <= now) {
        const received = packets[packet++];
        buffer.push(received.state, received.at);
      }
      const drawn = buffer.sample(now)!;
      expectSeparate(drawn.world);
      expect(drawn.world.players[0].pos.x).toBeLessThan(drawn.world.ball.pos.x);
      expect(drawn.world.players[1].pos.x).toBeGreaterThan(drawn.world.ball.pos.x);
    }
    expect(packets.map(packet => Array.from(encodeState(packet.state)))).toEqual(originals);
  });
});
