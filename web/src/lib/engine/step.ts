import { BALL_DAMPING } from './constants';
import { applyKicks } from './physics/kick';
import { applyInput, move } from './physics/movement';
import { checkWinner, GOAL_PAUSE_TICKS, goalScoredBy, KICKOFF_COUNTDOWN_TICKS } from './rules';
import { kickoffBall, kickoffPlayer } from './state';
import type { Action, GameState } from './types';

export function step(state: GameState, actions: Action[]): GameState {
  const tick = state.tick + 1;
  const { phase } = state;

  // After the final whistle players can keep moving, but nothing else counts.
  if (state.winner) return { ...state, tick, ...simulate(state, actions) };

  if (phase.kind === 'countdown') {
    const ticksLeft = phase.ticksLeft - 1;
    return { ...state, tick, phase: ticksLeft > 0 ? { kind: 'countdown', ticksLeft } : { kind: 'play' } };
  }

  const { players, ball } = simulate(state, actions);

  if (phase.kind === 'goal') {
    const ticksLeft = phase.ticksLeft - 1;
    if (ticksLeft > 0) return { ...state, tick, players, ball, phase: { ...phase, ticksLeft } };
    return {
      ...state,
      tick,
      players: players.map((_, i) => kickoffPlayer(i)),
      ball: kickoffBall(),
      phase: { kind: 'countdown', ticksLeft: KICKOFF_COUNTDOWN_TICKS },
    };
  }

  const scorer = goalScoredBy(ball);
  const next: GameState = {
    ...state,
    tick,
    clock: state.clock + 1,
    players,
    ball,
    score: scorer ? { ...state.score, [scorer]: state.score[scorer] + 1 } : state.score,
    phase: scorer ? { kind: 'goal', scorer, ticksLeft: GOAL_PAUSE_TICKS } : phase,
  };
  return { ...next, winner: checkWinner(next) };
}

function simulate(state: GameState, actions: Action[]) {
  const players = state.players.map((p, i) => applyInput(p, actions[i]));
  const ball = { ...state.ball, vel: state.ball.vel.scale(BALL_DAMPING) };
  applyKicks(players, ball);
  move(players, ball);
  return { players, ball };
}
