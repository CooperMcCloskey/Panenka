import type { GameEvent, GameState } from "../types";

export interface StateSource{
  start(): void;
  stop(): void;
  update(dtMs: number): void; 
  currentState(): GameState;
  onEvent?(cb: (e: GameEvent) => void): void;
}