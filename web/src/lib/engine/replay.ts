import { decodeAction } from './actions';
import { createState } from './state';
import { step } from './step';
import type { GameState, MatchRules, TeamSizes } from './types';

// A match is fully determined by its rules, team sizes and per-tick actions.
export interface Recording {
  rules: MatchRules;
  teamSizes: TeamSizes;
  actions: number[][]; // [tick][player], encoded with encodeAction
}

export function replay(rec: Recording): GameState {
  let state = createState(rec.teamSizes, rec.rules);
  for (const tickActions of rec.actions) state = step(state, tickActions.map(decodeAction));
  return state;
}
