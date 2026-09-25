import type { Vec2 } from './vec';

export type Team = 'blue' | 'orange'; // blue defends the left goal

// Players per team. Players are listed blue team first, then orange.
export type Teams = Record<Team, number>;

// Radius, mass and elasticity are constants per body type (see constants.ts), not state.
export interface Body {
  pos: Vec2;
  vel: Vec2;
}

export interface Player extends Body {
  kickHeld: boolean;
  kickUsed: boolean; // already kicked during the current press
  kickCooldown: number; // ticks until the next kick is allowed
}

// Everything physics needs; this is the state a training port keeps.
export interface World {
  ball: Body;
  players: Player[];
}

export interface Action {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  kick: boolean;
}

export type MatchRules =
  | { kind: 'time'; minutes: number }
  | { kind: 'goals'; target: number };

// Match flow for the browser game only; agents act only during play.
export type Phase =
  | { kind: 'play' }
  | { kind: 'goal'; scorer: Team; ticksLeft: number } // physics runs, no further goals count
  | { kind: 'countdown'; ticksLeft: number }; // everyone frozen at kickoff

export interface Match {
  tick: number;
  clock: number; // ticks of play only; drives the match timer
  phase: Phase;
  score: Record<Team, number>;
  rules: MatchRules;
  teams: Teams;
  winner: Team | 'draw' | null;
}

export interface GameState {
  world: World;
  match: Match;
}
