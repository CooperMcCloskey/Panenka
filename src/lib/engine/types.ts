import type { Vec2 } from './vec';

export interface RigidBody {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  elasticity: number;
  mass: number;
}

export interface Player extends RigidBody {
  kicking: boolean; // will kick as soon as the ball is in reach (held, unused this press, off cooldown)
  kickUsed: boolean; // already kicked during the current press
  kickCooldown: number; // ticks until the next kick is allowed
}

export type Team = 'blue' | 'orange'; // blue defends the left goal

export type MatchRules =
  | { kind: 'time'; minutes: number }
  | { kind: 'goals'; target: number };

// Match flow for the browser game only; agents act only during play, so a training
// port should drop phase, clock and winner.
export type Phase =
  | { kind: 'play' }
  | { kind: 'goal'; scorer: Team; ticksLeft: number } // physics runs, no further goals count
  | { kind: 'countdown'; ticksLeft: number }; // everyone frozen at kickoff

export interface GameState {
  tick: number;
  clock: number; // ticks of play only; drives the match timer
  phase: Phase;
  ball: RigidBody;
  players: Player[];
  score: Record<Team, number>;
  rules: MatchRules;
  winner: Team | 'draw' | null;
}

export interface Action {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  kick: boolean;
}
