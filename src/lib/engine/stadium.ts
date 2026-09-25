import {
  CENTER_Y, GOAL_DEPTH, GOAL_WIDTH, NET_ELASTICITY, PITCH_BOTTOM, PITCH_LEFT, PITCH_RIGHT, PITCH_TOP, PLAYER_RADIUS,
  POST_ELASTICITY, POST_RADIUS, WALL_ELASTICITY, WORLD_HEIGHT, WORLD_WIDTH,
} from './constants';
import { Vec2, vec } from './vec';

export interface Wall {
  a: Vec2;
  b: Vec2;
  elasticity: number;
  stops: 'ball' | 'players';
}

export interface Post {
  pos: Vec2;
  radius: number;
  elasticity: number;
}

export const GOAL_TOP = CENTER_Y - GOAL_WIDTH / 2;
export const GOAL_BOTTOM = CENTER_Y + GOAL_WIDTH / 2;

const wall = (ax: number, ay: number, bx: number, by: number, elasticity: number, stops: Wall['stops']): Wall => ({
  a: vec(ax, ay),
  b: vec(bx, by),
  elasticity,
  stops,
});

const L = PITCH_LEFT, R = PITCH_RIGHT, T = PITCH_TOP, B = PITCH_BOTTOM;

// One player radius outside the world, so player centers stay within it.
const OUT_L = -PLAYER_RADIUS, OUT_R = WORLD_WIDTH + PLAYER_RADIUS;
const OUT_T = -PLAYER_RADIUS, OUT_B = WORLD_HEIGHT + PLAYER_RADIUS;

export const WALLS: readonly Wall[] = [
  // Touchlines
  wall(L, T, R, T, WALL_ELASTICITY, 'ball'),
  wall(L, B, R, B, WALL_ELASTICITY, 'ball'),

  // Goal lines beside each goal mouth
  wall(L, T, L, GOAL_TOP, WALL_ELASTICITY, 'ball'),
  wall(L, GOAL_BOTTOM, L, B, WALL_ELASTICITY, 'ball'),
  wall(R, T, R, GOAL_TOP, WALL_ELASTICITY, 'ball'),
  wall(R, GOAL_BOTTOM, R, B, WALL_ELASTICITY, 'ball'),

  // Nets
  wall(L, GOAL_TOP, L - GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY, 'ball'),
  wall(L - GOAL_DEPTH, GOAL_TOP, L - GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),
  wall(L - GOAL_DEPTH, GOAL_BOTTOM, L, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),
  wall(R, GOAL_TOP, R + GOAL_DEPTH, GOAL_TOP, NET_ELASTICITY, 'ball'),
  wall(R + GOAL_DEPTH, GOAL_TOP, R + GOAL_DEPTH, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),
  wall(R + GOAL_DEPTH, GOAL_BOTTOM, R, GOAL_BOTTOM, NET_ELASTICITY, 'ball'),

  // Player boundary
  wall(OUT_L, OUT_T, OUT_R, OUT_T, 0, 'players'),
  wall(OUT_R, OUT_T, OUT_R, OUT_B, 0, 'players'),
  wall(OUT_R, OUT_B, OUT_L, OUT_B, 0, 'players'),
  wall(OUT_L, OUT_B, OUT_L, OUT_T, 0, 'players'),
];

export const POSTS: readonly Post[] = [
  { pos: vec(L, GOAL_TOP), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(L, GOAL_BOTTOM), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(R, GOAL_TOP), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
  { pos: vec(R, GOAL_BOTTOM), radius: POST_RADIUS, elasticity: POST_ELASTICITY },
];
