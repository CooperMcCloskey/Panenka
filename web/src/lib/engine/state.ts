import {
  BALL_ELASTICITY, BALL_MASS, BALL_RADIUS, CENTER_X, CENTER_Y, PITCH_LEFT, PITCH_WIDTH, PLAYER_ELASTICITY, PLAYER_MASS,
  PLAYER_RADIUS,
} from './constants';
import { KICKOFF_COUNTDOWN_TICKS } from './rules';
import type { GameState, MatchRules, Player, RigidBody } from './types';
import { vec } from './vec';

export function createState(playerCount: number, rules: MatchRules): GameState {
  return {
    tick: 0,
    clock: 0,
    phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS },
    ball: kickoffBall(),
    players: Array.from({ length: playerCount }, (_, i) => kickoffPlayer(i)),
    score: { orange: 0, blue: 0 },
    rules,
    winner: null,
  };
}

export function kickoffBall(): RigidBody {
  return { pos: vec(CENTER_X, CENTER_Y), vel: vec(), radius: BALL_RADIUS, elasticity: BALL_ELASTICITY, mass: BALL_MASS };
}

// Even indices are blue (left), odd are orange (right).
export function kickoffPlayer(i: number): Player {
  return {
    pos: vec(PITCH_LEFT + (i % 2 === 0 ? 0.1 : 0.9) * PITCH_WIDTH, CENTER_Y),
    vel: vec(),
    radius: PLAYER_RADIUS,
    elasticity: PLAYER_ELASTICITY,
    mass: PLAYER_MASS,
    kicking: false,
    kickUsed: false,
    kickCooldown: 0,
  };
}
