// Keep in sync with src/app.css, which the menus use.
export const colors = {
  green0: '#2E7D4F',
  green1: '#358A58',
  pitchLines: '#E9F2EA',
  white: '#FFF6E0',
  black: '#14202B',
  orange: '#FF8A2B',
  blue: '#2F7FF5',
} as const;

// World units.
export const LINE_WIDTH = 0.007;
export const OUTLINE_WIDTH = LINE_WIDTH / 2;

// Outline width comes from the current ctx.lineWidth.
export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
