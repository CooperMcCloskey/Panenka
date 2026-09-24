import { BALL_DAMPING } from './constants';
import { applyKicks } from './physics/kick';
import { applyInput, move } from './physics/movement';
import type { Action, GameState } from './types';

export function step(state: GameState, actions: Action[]): GameState {
  const players = state.players.map((p, i) => applyInput(p, actions[i]));
  const ball = { ...state.ball, vel: state.ball.vel.scale(BALL_DAMPING) };

  applyKicks(players, ball);
  move(players, ball);

  return { ...state, players, ball, tick: state.tick + 1 };
}
