export interface RigidBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
}

export interface GameState {
  tick: number;
  ball: RigidBody;
  players: RigidBody[];
  score: { red: number; blue: number };
}

export interface Action {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  kick: boolean;
}

export type GameEvent =
  | { type: 'goal'; team: 'red' | 'blue' }
  | { type: 'end' };

export interface Controller {
  getAction(state: GameState, playerIndex: number): Action;
  attach?(): void;
  detach?(): void;
}
