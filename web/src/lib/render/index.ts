import { BALL_RADIUS, KICK_COOLDOWN, PLAYER_RADIUS } from '$lib/engine/constants';
import { canKick } from '$lib/engine/physics';
import type { GameState, Player } from '$lib/engine/types';
import { drawPitch } from './pitch';
import { circle, colors, OUTLINE_WIDTH } from './style';
import { applyWorldTransform } from './view';

export { fitCanvas } from './view';

// A kick pressed with the ball already in reach fires the same tick, so keep the
// outline white briefly afterwards or it would never show.
const KICK_FLASH_TICKS = 5;

const showKickOutline = (p: Player) =>
  canKick(p) || (p.kickCooldown > 0 && KICK_COOLDOWN - p.kickCooldown < KICK_FLASH_TICKS);

export function render(ctx: CanvasRenderingContext2D, state: GameState, scale: number) {
  applyWorldTransform(ctx, scale);
  drawPitch(ctx);

  ctx.lineWidth = OUTLINE_WIDTH;
  const { players, ball } = state.world;
  for (const [i, p] of players.entries()) {
    const fill = i % 2 === 0 ? colors.blue : colors.orange;
    circle(ctx, p.pos.x, p.pos.y, PLAYER_RADIUS, fill, showKickOutline(p) ? colors.white : colors.black);
  }
  circle(ctx, ball.pos.x, ball.pos.y, BALL_RADIUS, colors.white, colors.black);
}
