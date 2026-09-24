import {
  CENTER_X, CENTER_Y, GOAL_DEPTH, GOAL_WIDTH, PITCH_BOTTOM, PITCH_HEIGHT, PITCH_LEFT, PITCH_RIGHT, PITCH_TOP,
  PITCH_WIDTH, POST_RADIUS,
} from '$lib/engine/constants';
import { GOAL_BOTTOM, GOAL_TOP } from '$lib/engine/stadium';
import { colors } from './colors';
import { circle } from './shapes';
import { LINE_WIDTH, OUTLINE_WIDTH } from './style';
import { VIEW_H, VIEW_PAD, VIEW_W } from './view';

// The static pitch: grass, markings, goals. Nothing here depends on the game state.

const STRIPES = 9;
const CENTER_CIRCLE_RADIUS = PITCH_HEIGHT * 0.15;

export function drawPitch(ctx: CanvasRenderingContext2D) {
  drawGrass(ctx);
  drawLines(ctx);
  drawGoals(ctx);
}

// Covers the whole canvas, so no clearRect is needed.
function drawGrass(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = colors.green1;
  ctx.fillRect(-VIEW_PAD, -VIEW_PAD, VIEW_W, VIEW_H);

  const stripeW = PITCH_WIDTH / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.green0 : colors.green1;
    ctx.fillRect(PITCH_LEFT + i * stripeW, PITCH_TOP, stripeW, PITCH_HEIGHT);
  }
}

function drawLines(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = colors.pitchLines;
  ctx.lineWidth = LINE_WIDTH;
  // Lines are centered on the pitch edge, where the ball's walls and the posts are.
  ctx.strokeRect(PITCH_LEFT, PITCH_TOP, PITCH_WIDTH, PITCH_HEIGHT);

  ctx.beginPath();
  ctx.moveTo(CENTER_X, PITCH_TOP);
  ctx.lineTo(CENTER_X, PITCH_BOTTOM);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

// A net box behind each goal line: blue defends the left, orange the right.
function drawGoals(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = OUTLINE_WIDTH;

  for (const side of [-1, 1]) {
    const mouthX = side === -1 ? PITCH_LEFT : PITCH_RIGHT;
    const backX = mouthX + side * GOAL_DEPTH;

    // Net: shaded inside, outlined on the back and both sides (open at the mouth)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(Math.min(mouthX, backX), GOAL_TOP, GOAL_DEPTH, GOAL_WIDTH);
    ctx.strokeStyle = colors.black;
    ctx.beginPath();
    ctx.moveTo(mouthX, GOAL_TOP);
    ctx.lineTo(backX, GOAL_TOP);
    ctx.lineTo(backX, GOAL_BOTTOM);
    ctx.lineTo(mouthX, GOAL_BOTTOM);
    ctx.stroke();

    const teamColor = side === -1 ? colors.blue : colors.orange;
    circle(ctx, mouthX, GOAL_TOP, POST_RADIUS, teamColor, colors.black);
    circle(ctx, mouthX, GOAL_BOTTOM, POST_RADIUS, teamColor, colors.black);
  }
}
