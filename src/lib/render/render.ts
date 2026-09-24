import type { GameState } from '$lib/engine/types';
import { drawBall, drawPlayers } from './bodies';
import { drawPitch } from './pitch';
import { applyWorldTransform } from './view';

// Draw one frame, back to front.
export function render(ctx: CanvasRenderingContext2D, state: GameState, scale: number) {
  applyWorldTransform(ctx, scale);
  drawPitch(ctx);
  drawPlayers(ctx, state);
  drawBall(ctx, state);
}
