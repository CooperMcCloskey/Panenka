import { BALL_DAMPING, MAX_BALL_SPEED } from '../constants';
import type { Action, World } from '../types';
import { applyKicks } from './kick';
import { applyInput, move } from './movement';

export { canKick, playerMass } from './player';

// One tick of physics only: input, kicks, movement, collisions. Pure: `world` is not changed.
export function physicsStep(world: World, actions: Action[]): World {
  const players = world.players.map((p, i) => applyInput(p, actions[i]));
  const ball = { ...world.ball, vel: world.ball.vel.scale(BALL_DAMPING) };
  applyKicks(players, ball);
  ball.vel = ball.vel.clampLength(MAX_BALL_SPEED);
  move(players, ball);
  return { players, ball };
}
