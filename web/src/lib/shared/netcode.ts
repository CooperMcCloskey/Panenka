import type { GameState, World } from '$lib/engine/types';
import type { ClientAction } from './protocol';

export type SequencedInput = { sequence: number; actions: ClientAction };

// Client presentation settings and bounds on input/snapshot history.
export const NETCODE_SETTINGS = {
  prediction: true,
  // Absorbs uneven packet arrivals, trades some display latency for smoother movement
  interpolationDelayMs: 80,
  correctionHalfLifeMs: 60,
  snapDistance: 0.2, // world units; larger errors snap instead of sliding
  maxPredictionMs: 250,
  maxSnapshots: 64,
  maxPendingInputs: 120,
  maxQueuedInputs: 8,
} as const;

export type NetcodeSettings = { [K in keyof typeof NETCODE_SETTINGS]: boolean extends typeof NETCODE_SETTINGS[K]
  ? boolean : typeof NETCODE_SETTINGS[K] extends boolean ? boolean : number };

export function worldWasReset(previous: GameState, next: GameState): boolean {
  return next.match.tick < previous.match.tick
    || next.match.teamSizes.blue !== previous.match.teamSizes.blue
    || next.match.teamSizes.orange !== previous.match.teamSizes.orange
    || (next.match.phase.kind === 'countdown'
      && (previous.match.phase.kind !== 'countdown'
        || next.match.phase.ticksLeft > previous.match.phase.ticksLeft));
}

// Drawing only: never pass an interpolated world back into the simulation.
export function interpolateWorld(a: World, b: World, t: number): World {
  return {
    ball: { ...b.ball, pos: a.ball.pos.lerp(b.ball.pos, t) },
    players: b.players.map((p, i) => ({ ...p, pos: a.players[i].pos.lerp(p.pos, t) })),
  };
}
