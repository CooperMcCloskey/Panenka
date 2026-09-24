import type { Action } from "@sveltejs/kit";
import type { GameState } from "../types";

export interface Controller{
  getAction(state: GameState, playerIndex: number): Action; 
  attach?(): void;
  detach?(): void; 
}