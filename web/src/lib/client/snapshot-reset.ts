import type { GameState } from '$lib/engine/types';

export function snapshotWasReset(previous: GameState, next: GameState): boolean {
  return previous.world.players.length !== next.world.players.length
    || previous.match.teamSizes.blue !== next.match.teamSizes.blue
    || previous.match.teamSizes.orange !== next.match.teamSizes.orange
    || (next.match.phase.kind === 'countdown'
      && (previous.match.phase.kind !== 'countdown'
        || next.match.phase.ticksLeft > previous.match.phase.ticksLeft));
}
