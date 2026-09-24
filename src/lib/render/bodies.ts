import { KICK_COOLDOWN } from '$lib/engine/constants';
import type { GameState, Player } from '$lib/engine/types';
import { colors } from './colors';
import { circle } from './shapes';
import { OUTLINE_WIDTH } from './style';

// How long the outline stays white after a kick fires (ticks). Without this, a kick
// pressed with the ball already in reach fires the same tick and never shows.
const KICK_FLASH_TICKS = 5;

// White while a kick is ready, and briefly right after one fires.
function showKickOutline(p: Player): boolean {
  const ticksSinceKick = KICK_COOLDOWN - p.kickCooldown;
  return p.kicking || (p.kickCooldown > 0 && ticksSinceKick < KICK_FLASH_TICKS);
}

export function drawPlayers(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = OUTLINE_WIDTH;
  for (const [i, p] of state.players.entries()) {
    const fill = i % 2 === 0 ? colors.blue : colors.orange;
    circle(ctx, p.pos.x, p.pos.y, p.radius, fill, showKickOutline(p) ? colors.white : colors.black);
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.lineWidth = OUTLINE_WIDTH;
  const { pos, radius } = state.ball;
  circle(ctx, pos.x, pos.y, radius, colors.white, colors.black);
}
