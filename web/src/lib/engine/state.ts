import { CENTER_X, CENTER_Y, KICKOFF_SPACING, PITCH_LEFT, PITCH_WIDTH } from './constants';
import { KICKOFF_COUNTDOWN_TICKS } from './rules';
import type { GameState, MatchRules, World } from './types';
import { vec } from './vec';

export function createState(playerCount: number, rules: MatchRules): GameState {
  return {
    world: kickoffWorld(playerCount),
    match: {
      tick: 0,
      clock: 0,
      phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS },
      score: { orange: 0, blue: 0 },
      rules,
      winner: null,
    },
  };
}

// Even indices are blue (left), odd are orange (right). Teammates line up vertically, centered.
export function kickoffWorld(playerCount: number): World {
  return {
    ball: { pos: vec(CENTER_X, CENTER_Y), vel: vec() },
    players: Array.from({ length: playerCount }, (_, i) => {
      const team = i % 2;
      const teamSize = Math.ceil((playerCount - team) / 2);
      const offset = (Math.floor(i / 2) - (teamSize - 1) / 2) * KICKOFF_SPACING;
      return {
        pos: vec(PITCH_LEFT + (team ? 0.9 : 0.1) * PITCH_WIDTH, CENTER_Y + offset),
        vel: vec(),
        kickHeld: false,
        kickUsed: false,
        kickCooldown: 0,
      };
    }),
  };
}
