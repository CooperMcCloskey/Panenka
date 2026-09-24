import type { Action, GameState } from './types';

export function createState(playerCount: number): GameState {
  return {
    tick: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, mass: 1 },
    players: Array.from({ length: playerCount }, (_, i) => ({ x: i % 2 === 0 ? 0.1 : 0.9, y: 0, vx: 0, vy: 0, mass: 1 })),
    score: { red: 0, blue: 0 },
  };
}


export function step(state: GameState, actions: Action[]): GameState {
  // TODO: implement
  return { ...state, tick: state.tick + 1 };
}
