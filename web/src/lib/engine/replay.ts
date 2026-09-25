import { decodeAction } from './actions';
import { createState } from './state';
import { step } from './step';
import type { GameState, MatchRules } from './types';

// A match is fully determined by its rules, player count and per-tick actions.
export interface Recording {
  rules: MatchRules;
  playerCount: number;
  actions: number[][]; // [tick][player], encoded with encodeAction
}

export function replay(rec: Recording): GameState {
  let state = createState(rec.playerCount, rec.rules);
  for (const tickActions of rec.actions) state = step(state, tickActions.map(decodeAction));
  return state;
}
