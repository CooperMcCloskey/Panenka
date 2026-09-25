import { PLAYER_DAMPING, SUBSTEPS } from '../constants';
import type { Action, Body, Player } from '../types';
import { vec } from '../vec';
import { resolveCollisions } from './collision';
import { playerForce, playerMass } from './player';

export function applyInput(p: Player, action: Action): Player {
  const accel = vec(action.moveX, action.moveY).normalize().scale(playerForce(action.kick) / playerMass(action.kick));
  const vel = p.vel.add(accel).scale(PLAYER_DAMPING);
  return {
    ...p,
    vel,
    kickHeld: action.kick,
    kickUsed: action.kick && p.kickUsed, // releasing kick re-arms it
    kickCooldown: Math.max(0, p.kickCooldown - 1),
  };
}

// Mutates the bodies.
export function move(players: Player[], ball: Body) {
  const bodies = [...players, ball];
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const body of bodies) body.pos = body.pos.add(body.vel.scale(1 / SUBSTEPS));
    resolveCollisions(players, ball);
  }
}
