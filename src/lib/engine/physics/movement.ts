import { BALL_RADIUS, KICK_FORCE_MULTIPLIER, KICK_MASS_MULTIPLIER, PLAYER_DAMPING, PLAYER_FORCE, PLAYER_MASS } from '../constants';
import type { Action, Player, RigidBody } from '../types';
import { vec } from '../vec';
import { resolveCollisions } from './collision';

// Max distance a body may move between collision checks. If a body moves further than
// its radius in one go it can jump past a wall's center line and get pushed out the
// wrong side ("tunneling"), so fast ticks are split into smaller substeps.
const MAX_SUBSTEP_MOVE = BALL_RADIUS / 2;

// Push the player in the input direction with PLAYER_FORCE, then damp:
// vel = (vel + force / mass) * damping. Holding kick makes the player heavier (harder
// to bump) and stronger (wins pushing contests); the net effect is a bit slower running.
// Also tracks the kick button: releasing it re-arms the kick for the next press,
// and the cooldown counts down by one each tick.
// Returns a new player; `p` is not changed.
export function applyInput(p: Player, action: Action): Player {
  const mass = action.kick ? PLAYER_MASS * KICK_MASS_MULTIPLIER : PLAYER_MASS;
  const force = action.kick ? PLAYER_FORCE * KICK_FORCE_MULTIPLIER : PLAYER_FORCE;
  const accel = vec(action.moveX, action.moveY)
    .normalize()
    .scale(force / mass);
  const vel = p.vel.add(accel).scale(PLAYER_DAMPING);

  const kickUsed = action.kick && p.kickUsed;
  const kickCooldown = Math.max(0, p.kickCooldown - 1);
  const kicking = action.kick && !kickUsed && kickCooldown === 0;
  return { ...p, vel, mass, kicking, kickUsed, kickCooldown };
}

// Move every body by its velocity, in as many equal substeps as the fastest one
// needs, resolving collisions after each. Mutates the bodies passed in.
export function move(players: Player[], ball: RigidBody) {
  const bodies = [...players, ball];
  const maxSpeed = Math.max(...bodies.map((b) => b.vel.length()));
  const substeps = Math.max(1, Math.ceil(maxSpeed / MAX_SUBSTEP_MOVE));

  for (let s = 0; s < substeps; s++) {
    for (const body of bodies) body.pos = body.pos.add(body.vel.scale(1 / substeps));
    resolveCollisions(players, ball);
  }
}
