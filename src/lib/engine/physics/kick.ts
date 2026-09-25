import { KICK_COOLDOWN, KICK_DIRECTION_BONUS, KICK_POWER, KICK_REACH } from '../constants';
import type { Player, RigidBody } from '../types';

// Pushes the ball away from each kicking player in reach; players aim by where they stand.
// Mutates the ball and players.
export function applyKicks(players: Player[], ball: RigidBody) {
  for (const p of players) {
    if (!p.kicking) continue;

    const delta = ball.pos.sub(p.pos);
    if (delta.length() > p.radius + ball.radius + KICK_REACH) continue;

    const dir = delta.normalize();
    const runSpeed = Math.max(0, p.vel.dot(dir)); // running away from the ball doesn't weaken the kick
    ball.vel = ball.vel.add(dir.scale(KICK_POWER + KICK_DIRECTION_BONUS * runSpeed));

    p.kicking = false;
    p.kickUsed = true;
    p.kickCooldown = KICK_COOLDOWN;
  }
}
