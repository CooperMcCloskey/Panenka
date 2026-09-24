import {
  BALL_MARGIN, CENTER_Y, GOAL_DEPTH, GOAL_WIDTH, NET_ELASTICITY, PITCH_BOTTOM, PITCH_LEFT, PITCH_RIGHT, PITCH_TOP, PLAYER_RADIUS,
  POST_ELASTICITY, POST_RADIUS, WALL_ELASTICITY, WORLD_HEIGHT, WORLD_WIDTH,
} from './constants';
import { Vec2, vec } from './vec';

// Static geometry of the pitch, in world units. Nothing here ever moves.

// What a wall stops: the pitch lines and nets only stop the ball; the outer
// boundary only stops players, so they can run past the lines and behind the goals.
export type WallTarget = 'ball' | 'players';

export interface Wall {
  a: Vec2;
  b: Vec2;
  elasticity: number;
  stops: WallTarget;
}

export interface Post {
  pos: Vec2;
  radius: number;
  elasticity: number;
}

export const GOAL_TOP = CENTER_Y - GOAL_WIDTH / 2;
export const GOAL_BOTTOM = CENTER_Y + GOAL_WIDTH / 2;

// Where a body's center can be once collisions are resolved (e.g. for normalizing
// observations or sanity checks). Allow a tiny tolerance: crowded collisions can
// leave a very small leftover overlap for a tick.
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Players: anywhere in the world rectangle (the player boundary walls sit one radius outside it).
export const PLAYER_BOUNDS: Bounds = { minX: 0, maxX: WORLD_WIDTH, minY: 0, maxY: WORLD_HEIGHT };

// Ball on the pitch: BALL_MARGIN inside the world on every side (lines are one radius further out).
export const BALL_PITCH_BOUNDS: Bounds = {
  minX: BALL_MARGIN,
  maxX: WORLD_WIDTH - BALL_MARGIN,
  minY: BALL_MARGIN,
  maxY: WORLD_HEIGHT - BALL_MARGIN,
};

// Ball anywhere, including inside either goal (GOAL_DEPTH = BALL_MARGIN, so the net lets the
// center reach the world edge). Inside a goal y is further limited to GOAL_TOP/GOAL_BOTTOM ± BALL_RADIUS.
export const BALL_BOUNDS: Bounds = {
  minX: 0,
  maxX: WORLD_WIDTH,
  minY: BALL_MARGIN,
  maxY: WORLD_HEIGHT - BALL_MARGIN,
};

const wall = (ax: number, ay: number, bx: number, by: number, elasticity: number, stops: WallTarget): Wall => ({
  a: vec(ax, ay),
  b: vec(bx, by),
  elasticity,
  stops,
});

// Player boundary: one radius outside the world, so player centers stay in [0, WORLD_WIDTH] × [0, WORLD_HEIGHT].
const OUT_LEFT = -PLAYER_RADIUS;
const OUT_RIGHT = WORLD_WIDTH + PLAYER_RADIUS;
const OUT_TOP = -PLAYER_RADIUS;
const OUT_BOTTOM = WORLD_HEIGHT + PLAYER_RADIUS;

const L = PITCH_LEFT, R = PITCH_RIGHT, T = PITCH_TOP, B = PITCH_BOTTOM;

export const WALLS: readonly Wall[] = [
  // Touchlines
  wall(L, T, R, T, WALL_ELASTICITY, 'ball'),
  wall(L, B, R, B, WALL_ELASTICITY, 'ball'),

  // Goal lines, above and below each goal mouth
  wall(L, T, L, GOAL_TOP, WALL_ELASTICITY, 'ball'),
  wall(L, GOAL_BOTTOM, L, B, WALL_ELASTICITY, 'ball'),
  wall(R, T, R, GOAL_TOP, WALL_ELASTICITY, 'ball'),
  wall(R, GOAL_BOTTOM, R, B, WALL_ELASTICITY, 'ball'),

  // Left net: top side, back, bottom side
  wall(L, GOAL_TOP, L - GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY, 'ball'),
  wall(L - GOAL_DEPTH, GOAL_TOP, L - GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),
  wall(L - GOAL_DEPTH, GOAL_BOTTOM, L, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),

  // Right net: top side, back, bottom side
  wall(R, GOAL_TOP, R + GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY, 'ball'),
  wall(R + GOAL_DEPTH, GOAL_TOP, R + GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),
  wall(R + GOAL_DEPTH, GOAL_BOTTOM, R, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),

  // Outer boundary for players
  wall(OUT_LEFT, OUT_TOP, OUT_RIGHT, OUT_TOP, 0, 'players'),
  wall(OUT_RIGHT, OUT_TOP, OUT_RIGHT, OUT_BOTTOM, 0, 'players'),
  wall(OUT_RIGHT, OUT_BOTTOM, OUT_LEFT, OUT_BOTTOM, 0, 'players'),
  wall(OUT_LEFT, OUT_BOTTOM, OUT_LEFT, OUT_TOP, 0, 'players'),
];

// Posts stop both players and the ball.
export const POSTS: readonly Post[] = [
  { pos: vec(L, GOAL_TOP), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(L, GOAL_BOTTOM), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(R, GOAL_TOP), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(R, GOAL_BOTTOM), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
];
