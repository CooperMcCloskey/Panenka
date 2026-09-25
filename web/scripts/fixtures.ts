// Writes physics trajectories and goal checks for the RL port's parity tests to rl/fixtures/physics.json.
// Run with `npm run fixtures` after any engine change.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_COUNT, decodeAction, encodeAction, IDLE } from '../src/lib/engine/actions';
import * as constants from '../src/lib/engine/constants';
import {
  BALL_RADIUS, CENTER_X, CENTER_Y, MAX_BALL_SPEED, PITCH_LEFT, PITCH_RIGHT, WORLD_HEIGHT, WORLD_WIDTH,
} from '../src/lib/engine/constants';
import { physicsStep } from '../src/lib/engine/physics';
import { goalScoredBy } from '../src/lib/engine/rules';
import { BALL_WALLS, GOAL_BOTTOM, GOAL_TOP, PLAYER_WALLS, POSTS, type Wall } from '../src/lib/engine/stadium';
import { kickoffWorld, teamOf } from '../src/lib/engine/state';
import type { Action, Teams, World } from '../src/lib/engine/types';
import { vec, type Vec2 } from '../src/lib/engine/vec';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../rl/fixtures/physics.json');
const TICKS = 600;
const SHOT_TICKS = 240; // long enough for a shot ball to nearly stop

// World as plain numbers: ball [px, py, vx, vy], players [px, py, vx, vy, kickHeld, kickUsed, kickCooldown].
const flatWorld = (w: World) => ({
  ball: [w.ball.pos.x, w.ball.pos.y, w.ball.vel.x, w.ball.vel.y],
  players: w.players.map((p) => [p.pos.x, p.pos.y, p.vel.x, p.vel.y, +p.kickHeld, +p.kickUsed, p.kickCooldown]),
});
const flatWall = (w: Wall) => [w.a.x, w.a.y, w.b.x, w.b.y, w.elasticity];

type Policy = (w: World, tick: number) => Action[];

const ONE_V_ONE: Teams = { blue: 1, orange: 1 };

function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
}

// Players mostly chase the ball and kick; sometimes move randomly. Re-decided every 8 ticks.
function chasePolicy(seed: number): Policy {
  const rnd = rng(seed);
  let current: Action[] = [];
  return (w, tick) => {
    if (tick % 8 === 0) {
      current = w.players.map((p) => {
        if (rnd() < 0.7) {
          const dx = w.ball.pos.x - p.pos.x, dy = w.ball.pos.y - p.pos.y;
          return { moveX: Math.sign(Math.round(dx * 20)), moveY: Math.sign(Math.round(dy * 20)), kick: rnd() < 0.6 } as Action;
        }
        return decodeAction(Math.floor(rnd() * ACTION_COUNT));
      });
    }
    return current;
  };
}

// Players run into posts, world edges and corners; orange mirrors blue. [moveX, moveY, kick] per 100 ticks.
const SCRIPT = [[-1, -1, 0], [0, 1, 1], [-1, 0, 0], [0, -1, 0], [1, 1, 1], [-1, 1, 0]] as const;

function scriptedPolicy(teams: Teams): Policy {
  return (w, tick) => {
    const [moveX, moveY, kick] = SCRIPT[Math.floor(tick / 100)];
    return w.players.map((_, i) => ({ moveX: teamOf(teams, i) === 'orange' ? -moveX : moveX, moveY, kick: kick === 1 }) as Action);
  };
}

function run(name: string, teams: Teams, policy: Policy, initial = kickoffWorld(teams), ticks = TICKS) {
  const actions: number[][] = [];
  const states = [];
  let w = initial;
  for (let t = 0; t < ticks; t++) {
    const a = policy(w, t);
    actions.push(a.map(encodeAction));
    w = physicsStep(w, a);
    states.push(flatWorld(w));
  }
  return { name, teams, initial: flatWorld(initial), actions, states };
}

const idle = (w: World) => w.players.map(() => IDLE);

// The ball from `from` toward `to`, with idle players out of the way. Starts over the speed cap so it gets clamped.
function shot(name: string, from: Vec2, to: Vec2) {
  const w = kickoffWorld(ONE_V_ONE);
  const start: World = {
    players: w.players.map((p, j) => ({ ...p, pos: vec(j ? 1.7 : 0.1, 0.02) })),
    ball: { pos: from, vel: to.sub(from).normalize().scale(2 * MAX_BALL_SPEED) },
  };
  return run(name, ONE_V_ONE, idle, start, SHOT_TICKS);
}

const center = vec(CENTER_X, CENTER_Y);

const cases = [
  run('1v1_chase', ONE_V_ONE, chasePolicy(1)),
  run('2v2_chase', { blue: 2, orange: 2 }, chasePolicy(2)),
  run('3v3_chase', { blue: 3, orange: 3 }, chasePolicy(3)),
  run('3v1_chase', { blue: 3, orange: 1 }, chasePolicy(4)),
  run('1v1_scripted', ONE_V_ONE, scriptedPolicy(ONE_V_ONE)),
  // Walls and nets, then each post head-on and glancing.
  ...[0.3, 1.2, 2.5, 3.14, 4.0, 5.5].map((angle, i) =>
    shot(`ball_shot_${i}`, center, center.add(vec(Math.cos(angle), Math.sin(angle)))),
  ),
  ...POSTS.flatMap((post, i) => [
    shot(`post_${i}`, center, post),
    shot(`post_${i}_glancing`, center, post.add(vec(0, BALL_RADIUS))),
  ]),
];

// Ball positions on and just either side of every goal boundary.
const EPS = 1e-9;
const around = (v: number) => [v - EPS, v, v + EPS];
const goalXs = [0, ...around(PITCH_LEFT - BALL_RADIUS), CENTER_X, ...around(PITCH_RIGHT + BALL_RADIUS), WORLD_WIDTH];
const goalYs = [0, ...around(GOAL_TOP), CENTER_Y, ...around(GOAL_BOTTOM), WORLD_HEIGHT];
const goals = goalXs.flatMap((x) =>
  goalYs.map((y) => {
    const scorer = goalScoredBy({ pos: vec(x, y), vel: vec() });
    return [x, y, scorer === 'blue' ? 1 : scorer === 'orange' ? -1 : 0];
  }),
);

const fixture = {
  description: 'physicsStep trajectories from the TypeScript engine (web/src/lib/engine). states[t] is the world after applying actions[t].',
  constants: Object.fromEntries(Object.entries(constants).filter(([, v]) => typeof v === 'number')),
  geometry: {
    ball_walls: BALL_WALLS.map(flatWall), // [ax, ay, bx, by, elasticity], in collision order
    player_walls: PLAYER_WALLS.map(flatWall),
    posts: POSTS.map((p) => [p.x, p.y]),
  },
  action_encoding: 'index = (moveX + 1) * 6 + (moveY + 1) * 2 + kick',
  goals, // [ball x, ball y, scorer]: 1 blue, -1 orange, 0 nobody
  cases,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture));
console.log(`Wrote ${cases.length} cases to ${OUT}`);
