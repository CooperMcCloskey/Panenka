import { CENTER_X, CENTER_Y, KICKOFF_SPACING, PITCH_LEFT, PITCH_WIDTH } from './constants';
import { KICKOFF_COUNTDOWN_TICKS } from './rules';
import type { GameState, MatchRules, Player, Team, Teams, World } from './types';
import { vec } from './vec';

export function createState(teams: Teams, rules: MatchRules): GameState {
  return {
    world: kickoffWorld(teams),
    match: {
      tick: 0,
      clock: 0,
      phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS },
      score: { orange: 0, blue: 0 },
      rules,
      teams,
      winner: null,
    },
  };
}

export const teamOf = (teams: Teams, playerIndex: number): Team => (playerIndex < teams.blue ? 'blue' : 'orange');

// Blue players first, then orange. Each team lines up vertically, centered.
export function kickoffWorld(teams: Teams): World {
  const line = (team: Team): Player[] =>
    Array.from({ length: teams[team] }, (_, k) => ({
      pos: vec(
        PITCH_LEFT + (team === 'blue' ? 0.1 : 0.9) * PITCH_WIDTH,
        CENTER_Y + (k - (teams[team] - 1) / 2) * KICKOFF_SPACING,
      ),
      vel: vec(),
      kickHeld: false,
      kickUsed: false,
      kickCooldown: 0,
    }));
  return { ball: { pos: vec(CENTER_X, CENTER_Y), vel: vec() }, players: [...line('blue'), ...line('orange')] };
}
