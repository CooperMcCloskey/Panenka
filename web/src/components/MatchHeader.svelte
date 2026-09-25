<script lang="ts">
  import { TICK_RATE } from '$lib/engine/constants';
  import { ticksRemaining } from '$lib/engine/rules';
  import type { GameState } from '$lib/engine/types';

  let { game }: { game: GameState } = $props();

  const { score, phase, rules, winner } = $derived(game.match);
  const goalScorer = $derived(phase.kind === 'goal' ? phase.scorer : null);
  const countdown = $derived(phase.kind === 'countdown' ? Math.ceil(phase.ticksLeft / TICK_RATE) : null);
  const goalTarget = $derived(rules.kind === 'goals' ? rules.target : null);
  const clock = $derived.by(() => {
    const ticks = ticksRemaining(game.match);
    if (ticks === null) return null;
    const seconds = Math.ceil(ticks / TICK_RATE);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
</script>

<header>
  <span class="blue">{score.blue}</span>
  <span>
    {#if winner}
      {winner === 'draw' ? 'Draw' : `${winner[0].toUpperCase()}${winner.slice(1)} wins`}
    {:else if goalScorer}
      <span class={goalScorer}>Goal!</span>
    {:else if countdown !== null}
      {countdown}
    {:else if clock !== null}
      {clock}
    {:else}
      {goalTarget}
    {/if}
  </span>
  <span class="orange">{score.orange}</span>
</header>

<style>
  header{
    background-color: var(--black);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2em;
    height: 100%;
    color: var(--white);
    font-size: 3em;
  }
  .blue{ color: var(--blue); }
  .orange{ color: var(--orange); }
</style>
