import type { Vec2 } from './vec';

export interface RigidBody {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  elasticity: number;
  mass: number;
}

export interface Player extends RigidBody {
  kicking: boolean; // kick is held, unused this press and off cooldown: fires as soon as the ball is in reach (white outline)
  kickUsed: boolean; // a kick already fired during the current press; cleared when kick is released
  kickCooldown: number; // ticks left before this player can kick again; 0 = ready
}

export interface GameState {
  tick: number;
  ball: RigidBody;
  players: Player[];
  score: { orange: number; blue: number };
}

export interface Action {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  kick: boolean;
}

export type GameEvent =
  | { type: 'goal'; team: 'orange' | 'blue' }
  | { type: 'end' };

export interface Controller {
  getAction(state: GameState, playerIndex: number): Action;
  attach?(): void;
  detach?(): void;
}
