import { PLAYER_RADIUS, WORLD_WIDTH } from '$lib/engine/constants';
import type { Player } from '$lib/engine/types';
import { colors } from './style';

export type PlayerLabel = {
  username: string;
  isCurrentUser: boolean;
};

export type PlayerLabelStyle = {
  enabled: boolean;
  currentUserColor: string;
  otherUserColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  gap: number;
  maxWidth: number;
  outlineColor: string;
  outlineWidth: number;
};

// Change the label appearance here. Sizes and spacing are in world units.
export const PLAYER_LABEL_STYLE: Readonly<PlayerLabelStyle> = {
  enabled: true,
  currentUserColor: '#FFE082',
  otherUserColor: colors.white,
  fontFamily: 'sans-serif-condensed, sans-serif',
  fontSize: 0.022,
  fontWeight: 700,
  gap: 0.008,
  maxWidth: 0.35,
  outlineColor: colors.black,
  outlineWidth: 0.003,
};

// Labels follow the same array order as the rendered players. Missing metadata
// leaves that player's label blank without shifting any of the other labels.
export function drawPlayerLabels(
  ctx: CanvasRenderingContext2D,
  players: readonly Player[],
  labels: readonly (PlayerLabel | undefined)[],
) {
  const style = PLAYER_LABEL_STYLE;
  if (!style.enabled || labels.length === 0) return;

  ctx.save();
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = style.outlineWidth;
  ctx.strokeStyle = style.outlineColor;

  for (const [i, player] of players.entries()) {
    const label = labels[i];
    if (!label?.username) continue;

    const halfWidth = Math.min(ctx.measureText(label.username).width, style.maxWidth) / 2;
    // Keep long names visible when a player reaches the left or right edge.
    const x = Math.max(halfWidth, Math.min(WORLD_WIDTH - halfWidth, player.pos.x));
    const y = player.pos.y - PLAYER_RADIUS - style.gap;
    ctx.fillStyle = label.isCurrentUser ? style.currentUserColor : style.otherUserColor;
    ctx.strokeText(label.username, x, y, style.maxWidth);
    ctx.fillText(label.username, x, y, style.maxWidth);
  }

  ctx.restore();
}
