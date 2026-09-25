import { physicsStep } from './physics';
import { checkWinner, GOAL_PAUSE_TICKS, goalScoredBy, KICKOFF_COUNTDOWN_TICKS } from './rules';
import { kickoffWorld } from './state';
import type { Action, GameState, Match } from './types';

// One tick of the full game: physics plus match flow (goals, pauses, countdown, winner).
export function step(state: GameState, actions: Action[]): GameState {
  const { world, match } = state;
  const { phase } = match;
  const tick = match.tick + 1;

  // After the final whistle players can keep moving, but nothing else counts.
  if (match.winner) return { world: physicsStep(world, actions), match: { ...match, tick } };

  if (phase.kind === 'countdown') {
    const ticksLeft = phase.ticksLeft - 1;
    return { world, match: { ...match, tick, phase: ticksLeft > 0 ? { kind: 'countdown', ticksLeft } : { kind: 'play' } } };
  }

  const next = physicsStep(world, actions);

  if (phase.kind === 'goal') {
    const ticksLeft = phase.ticksLeft - 1;
    if (ticksLeft > 0) return { world: next, match: { ...match, tick, phase: { ...phase, ticksLeft } } };
    return {
      world: kickoffWorld(match.teams),
      match: { ...match, tick, phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS } },
    };
  }

  const scorer = goalScoredBy(next.ball);
  const played: Match = {
    ...match,
    tick,
    clock: match.clock + 1,
    score: scorer ? { ...match.score, [scorer]: match.score[scorer] + 1 } : match.score,
    phase: scorer ? { kind: 'goal', scorer, ticksLeft: GOAL_PAUSE_TICKS } : phase,
  };
  return { world: next, match: { ...played, winner: checkWinner(played) } };
}
