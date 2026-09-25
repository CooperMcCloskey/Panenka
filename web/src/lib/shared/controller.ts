import type { Action, GameState } from '$lib/engine/types';

// Chooses one player's action each tick: keyboard, network input, or an AI policy.
export interface Controller {
  getAction(state: GameState, playerIndex: number): Action;
  attach?(): void;
  detach?(): void;
}
