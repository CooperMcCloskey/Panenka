import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '$lib/engine/constants';
import { OUTLINE_WIDTH } from './style';

// Padding so a player at the world edge is drawn in full, outline included.
export const VIEW_PAD = PLAYER_RADIUS + OUTLINE_WIDTH;
export const VIEW_W = WORLD_WIDTH + VIEW_PAD * 2;
export const VIEW_H = WORLD_HEIGHT + VIEW_PAD * 2;

// Fits the view into the available CSS pixels at the screen's pixel density.
// Returns CSS pixels per world unit.
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

// After this, everything is drawn in world units.
export function applyWorldTransform(ctx: CanvasRenderingContext2D, scale: number) {
  const k = scale * (window.devicePixelRatio || 1);
  ctx.setTransform(k, 0, 0, k, VIEW_PAD * k, VIEW_PAD * k);
}
