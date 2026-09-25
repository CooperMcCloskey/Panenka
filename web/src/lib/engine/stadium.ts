import {
  CENTER_Y, GOAL_DEPTH, GOAL_WIDTH, NET_ELASTICITY, PITCH_BOTTOM, PITCH_LEFT, PITCH_RIGHT, PITCH_TOP, PLAYER_RADIUS,
  WALL_ELASTICITY, WORLD_HEIGHT, WORLD_WIDTH,
} from './constants';
import { Vec2, vec } from './vec';

// Static geometry. Collisions run through these arrays in order, so the order is part of the physics.

export interface Wall {
  a: Vec2;
  b: Vec2;
  elasticity: number;
}

export const GOAL_TOP = CENTER_Y - GOAL_WIDTH / 2;
export const GOAL_BOTTOM = CENTER_Y + GOAL_WIDTH / 2;

const wall = (ax: number, ay: number, bx: number, by: number, elasticity: number): Wall => ({
  a: vec(ax, ay),
  b: vec(bx, by),
  elasticity,
});

const L = PITCH_LEFT, R = PITCH_RIGHT, T = PITCH_TOP, B = PITCH_BOTTOM;

// Stop the ball: touchlines, goal lines beside each mouth, then the nets.
export const BALL_WALLS: readonly Wall[] = [
  wall(L, T, R, T, WALL_ELASTICITY),
  wall(L, B, R, B, WALL_ELASTICITY),
  wall(L, T, L, GOAL_TOP, WALL_ELASTICITY),
  wall(L, GOAL_BOTTOM, L, B, WALL_ELASTICITY),
  wall(R, T, R, GOAL_TOP, WALL_ELASTICITY),
  wall(R, GOAL_BOTTOM, R, B, WALL_ELASTICITY),
  wall(L, GOAL_TOP, L - GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY),
  wall(L - GOAL_DEPTH, GOAL_TOP, L - GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY),
  wall(L - GOAL_DEPTH, GOAL_BOTTOM, L, GOAL_BOTTOM, NET_ELASTICITY),
  wall(R, GOAL_TOP, R + GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY),
  wall(R + GOAL_DEPTH, GOAL_TOP, R + GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY),
  wall(R + GOAL_DEPTH, GOAL_BOTTOM, R, GOAL_BOTTOM, NET_ELASTICITY),
];

// Stop players: one player radius outside the world, so player centers stay within it.
const OUT_L = -PLAYER_RADIUS, OUT_R = WORLD_WIDTH + PLAYER_RADIUS;
const OUT_T = -PLAYER_RADIUS, OUT_B = WORLD_HEIGHT + PLAYER_RADIUS;

export const PLAYER_WALLS: readonly Wall[] = [
  wall(OUT_L, OUT_T, OUT_R, OUT_T, 0),
  wall(OUT_R, OUT_T, OUT_R, OUT_B, 0),
  wall(OUT_R, OUT_B, OUT_L, OUT_B, 0),
  wall(OUT_L, OUT_B, OUT_L, OUT_T, 0),
];

// Stop everything.
export const POSTS: readonly Vec2[] = [vec(L, GOAL_TOP), vec(L, GOAL_BOTTOM), vec(R, GOAL_TOP), vec(R, GOAL_BOTTOM)];
