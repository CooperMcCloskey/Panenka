import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '$lib/engine/constants';
import { OUTLINE_WIDTH } from './style';

// Drawing happens in the same world units as GameState: (0, 0) at the top-left of
// the player area, (WORLD_WIDTH, WORLD_HEIGHT) at its bottom-right, x → right, y → down.

// What the canvas shows: the player area plus enough padding that a player standing
// at the edge is drawn in full. An outline is centered on the circle's edge, so half
// of it sticks out past the radius; pad by the full outline width to leave room for
// that plus anti-aliasing.
export const VIEW_PAD = PLAYER_RADIUS + OUTLINE_WIDTH;
export const VIEW_W = WORLD_WIDTH + VIEW_PAD * 2;
export const VIEW_H = WORLD_HEIGHT + VIEW_PAD * 2;

// Size the canvas to fit the available CSS pixels, keeping the view's aspect ratio,
// with backing pixels matched to the screen so it stays sharp on high-DPI displays.
// Returns the scale in CSS pixels per world unit.
export function fitCanvas(canvas: HTMLCanvasElement, availableW: number, availableH: number): number {
  const scale = Math.min(availableW / VIEW_W, availableH / VIEW_H);
  const cssW = VIEW_W * scale;
  const cssH = VIEW_H * scale;
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  return scale;
}

// Map world units → device pixels, with world (0, 0) VIEW_PAD in from the canvas's
// top-left corner. After this, everything is drawn in world units.
export function applyWorldTransform(ctx: CanvasRenderingContext2D, scale: number) {
  const k = scale * (window.devicePixelRatio || 1);
  ctx.setTransform(k, 0, 0, k, VIEW_PAD * k, VIEW_PAD * k);
}
