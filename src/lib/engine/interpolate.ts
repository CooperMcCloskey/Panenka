import type { RigidBody, GameState } from './types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpBody(a: RigidBody, b: RigidBody, t: number): RigidBody {
  return { ...b, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function interpolateState(prev: GameState, next: GameState, alpha: number): GameState {
  return {
    ...next,
    ball: lerpBody(prev.ball, next.ball, alpha),
    players: next.players.map((p, i) => (prev.players[i] ? lerpBody(prev.players[i], p, alpha) : p)),
  };
}
