import type { RigidBody, GameState } from './types';

function lerpBody<T extends RigidBody>(a: T, b: T, t: number): T {
  return { ...b, pos: a.pos.lerp(b.pos, t) };
}

export function interpolateState(prev: GameState, next: GameState, alpha: number): GameState {
  return {
    ...next,
    ball: lerpBody(prev.ball, next.ball, alpha),
    players: next.players.map((p, i) => (prev.players[i] ? lerpBody(prev.players[i], p, alpha) : p)),
  };
}
