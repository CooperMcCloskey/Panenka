import {
  BALL_ELASTICITY, BALL_MASS, BALL_RADIUS, CENTER_X, CENTER_Y, PITCH_LEFT, PITCH_WIDTH, PLAYER_ELASTICITY, PLAYER_MASS,
  PLAYER_RADIUS,
} from './constants';
import type { GameState } from './types';
import { vec } from './vec';

// Kickoff state: ball on the center spot, even-index players (blue) on the left, odd (orange) on the right.
export function createState(playerCount: number): GameState {
  return {
    tick: 0,
    ball: { pos: vec(CENTER_X, CENTER_Y), vel: vec(), radius: BALL_RADIUS, elasticity: BALL_ELASTICITY, mass: BALL_MASS },
    players: Array.from({ length: playerCount }, (_, i) => ({
      pos: vec(PITCH_LEFT + (i % 2 === 0 ? 0.1 : 0.9) * PITCH_WIDTH, CENTER_Y),
      vel: vec(),
      radius: PLAYER_RADIUS,
      elasticity: PLAYER_ELASTICITY,
      mass: PLAYER_MASS,
      kicking: false,
      kickUsed: false,
      kickCooldown: 0,
    })),
    score: { orange: 0, blue: 0 },
  };
}
