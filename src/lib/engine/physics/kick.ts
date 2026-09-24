import { KICK_COOLDOWN, KICK_POWER, KICK_REACH, KICK_DIRECTION_BONUS } from '../constants';
import type { Player, RigidBody } from '../types';

// Kick the ball for every player whose kick is ready (see applyInput) and who is
// within reach. The ball is pushed along the line from the player's center through
// the ball's center, so players aim by where they stand. Running in that direction
// makes the kick stronger. Each kick starts a cooldown, so rapid press/release
// can't keep adding speed to the ball.
// Mutates the ball and players passed in; players are checked in index order so
// the result is deterministic when two players kick on the same tick.
export function applyKicks(players: Player[], ball: RigidBody) {
  for (const p of players) {
    if (!p.kicking) continue;

    const delta = ball.pos.sub(p.pos);
    if (delta.length() > p.radius + ball.radius + KICK_REACH) continue;

    const dir = delta.normalize();
    // Only the part of the player's velocity toward the kick counts; moving away doesn't weaken it.
    const runSpeed = Math.max(0, p.vel.dot(dir));
    ball.vel = ball.vel.add(dir.scale(KICK_POWER + KICK_DIRECTION_BONUS * runSpeed));

    p.kicking = false;
    p.kickUsed = true;
    p.kickCooldown = KICK_COOLDOWN;
  }
}
