import { BALL_RADIUS, KICK_FORCE_MULTIPLIER, KICK_MASS_MULTIPLIER, PLAYER_DAMPING, PLAYER_FORCE, PLAYER_MASS } from '../constants';
import type { Action, Player, RigidBody } from '../types';
import { vec } from '../vec';
import { resolveCollisions } from './collision';

// A body moving further than its radius between collision checks can tunnel through a wall.
const MAX_SUBSTEP_MOVE = BALL_RADIUS / 2;

export function applyInput(p: Player, action: Action): Player {
  const mass = action.kick ? PLAYER_MASS * KICK_MASS_MULTIPLIER : PLAYER_MASS;
  const force = action.kick ? PLAYER_FORCE * KICK_FORCE_MULTIPLIER : PLAYER_FORCE;
  const accel = vec(action.moveX, action.moveY).normalize().scale(force / mass);
  const vel = p.vel.add(accel).scale(PLAYER_DAMPING);

  const kickUsed = action.kick && p.kickUsed; // releasing kick re-arms it
  const kickCooldown = Math.max(0, p.kickCooldown - 1);
  const kicking = action.kick && !kickUsed && kickCooldown === 0;
  return { ...p, vel, mass, kicking, kickUsed, kickCooldown };
}

// Mutates the bodies.
export function move(players: Player[], ball: RigidBody) {
  const bodies = [...players, ball];
  const maxSpeed = Math.max(...bodies.map((b) => b.vel.length()));
  const substeps = Math.max(1, Math.ceil(maxSpeed / MAX_SUBSTEP_MOVE));

  for (let s = 0; s < substeps; s++) {
    for (const body of bodies) body.pos = body.pos.add(body.vel.scale(1 / substeps));
    resolveCollisions(players, ball);
  }
}
