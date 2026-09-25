import { BALL_RADIUS, KICK_COOLDOWN, KICK_DIRECTION_BONUS, KICK_POWER, KICK_REACH, PLAYER_RADIUS } from '../constants';
import type { Body, Player } from '../types';
import { canKick } from './player';

// Pushes the ball away from each kicking player in reach; players aim by where they stand.
// Mutates the ball and players.
export function applyKicks(players: Player[], ball: Body) {
  for (const p of players) {
    if (!canKick(p)) continue;

    const delta = ball.pos.sub(p.pos);
    if (delta.length() > PLAYER_RADIUS + BALL_RADIUS + KICK_REACH) continue;

    const dir = delta.normalize();
    const runSpeed = Math.max(0, p.vel.dot(dir)); // running away from the ball doesn't weaken the kick
    ball.vel = ball.vel.add(dir.scale(KICK_POWER + KICK_DIRECTION_BONUS * runSpeed));

    p.kickUsed = true;
    p.kickCooldown = KICK_COOLDOWN;
  }
}
