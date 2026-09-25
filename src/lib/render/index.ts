import { KICK_COOLDOWN } from '$lib/engine/constants';
import type { GameState, Player } from '$lib/engine/types';
import { drawPitch } from './pitch';
import { circle, colors, OUTLINE_WIDTH } from './style';
import { applyWorldTransform } from './view';

export { fitCanvas } from './view';

// A kick pressed with the ball already in reach fires the same tick, so keep the
// outline white briefly afterwards or it would never show.
const KICK_FLASH_TICKS = 5;

const showKickOutline = (p: Player) =>
  p.kicking || (p.kickCooldown > 0 && KICK_COOLDOWN - p.kickCooldown < KICK_FLASH_TICKS);

export function render(ctx: CanvasRenderingContext2D, state: GameState, scale: number) {
  applyWorldTransform(ctx, scale);
  drawPitch(ctx);

  ctx.lineWidth = OUTLINE_WIDTH;
  for (const [i, p] of state.players.entries()) {
    const fill = i % 2 === 0 ? colors.blue : colors.orange;
    circle(ctx, p.pos.x, p.pos.y, p.radius, fill, showKickOutline(p) ? colors.white : colors.black);
  }
  const { pos, radius } = state.ball;
  circle(ctx, pos.x, pos.y, radius, colors.white, colors.black);
}
