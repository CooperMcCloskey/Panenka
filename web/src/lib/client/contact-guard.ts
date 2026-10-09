import { resolveCollisions } from '$lib/engine/physics/collision';
import type { World } from '$lib/engine/types';

export const CONTACT_GUARD_SETTINGS = {
  // Usually converges in one or two passes; packed teams need more. Keep a hard
  // bound so malformed or impossible contacts cannot stall a render frame.
  maxPasses: 128,
  tolerance: 0.00000001,
} as const;

// Linear interpolation can cut through a curved contact, even when both
// snapshots are valid. Project the drawn positions onto the existing collision
// constraints. This never advances physics or changes a received snapshot.
export function guardContacts(world: World): World {
  const players = world.players.map(player => ({ ...player }));
  const ball = { ...world.ball };
  const bodies = [...players, ball];
  let changed = false;
  for (let pass = 0; pass < CONTACT_GUARD_SETTINGS.maxPasses; pass++) {
    const positions = bodies.map(body => body.pos);
    resolveCollisions(players, ball);
    let maxMovement = 0;
    for (let index = 0; index < bodies.length; index++) {
      const before = positions[index], after = bodies[index].pos;
      maxMovement = Math.max(maxMovement, Math.abs(after.x - before.x), Math.abs(after.y - before.y));
    }
    changed ||= maxMovement > 0;
    if (maxMovement < CONTACT_GUARD_SETTINGS.tolerance) break;
  }
  if (!changed) return world;
  // Only presentation positions change. Keep velocities, kick state and all
  // match decisions exactly as supplied by the authoritative snapshots.
  players.forEach((player, index) => { player.vel = world.players[index].vel; });
  ball.vel = world.ball.vel;
  return { players, ball };
}
