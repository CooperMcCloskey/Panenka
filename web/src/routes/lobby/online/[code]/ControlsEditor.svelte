<script lang="ts">
  import { onMount } from "svelte";
  import {
    CONTROL_ACTIONS, defaultControls, keyLabel, loadControls, rebind, saveControls,
    type ControlAction, type PlayerControls,
  } from "$lib/client/bindings";

  const {
    playerCount,
    onChange,
  }: {
    playerCount: number, // keyboard players this client controls; player 2's keys show once there are two
    onChange: () => void,
  } = $props();

  const ACTION_LABELS: Record<ControlAction, string> = { up: "↑", left: "←", down: "↓", right: "→", kick: "Kick" };
  const players = $derived(playerCount >= 2 ? [0, 1] as const : [0] as const);

  // Click a key, then press the new one; Escape cancels (same as the local menu)
  let controls = $state<PlayerControls>(defaultControls());
  let listening = $state<{ player: 0 | 1; action: ControlAction } | null>(null);
  onMount(() => (controls = loadControls())); // localStorage isn't available during server render

  function onKeydown(e: KeyboardEvent) {
    if (!listening) return;
    e.preventDefault(); // Space, arrows and Tab would otherwise scroll or move focus
    if (e.code !== "Escape") {
      controls = rebind(controls, listening.player, listening.action, e.code);
      saveControls(controls);
      onChange();
    }
    listening = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="controls">
  <span></span>
  {#each CONTROL_ACTIONS as action}
    <span class="actionLabel">{ACTION_LABELS[action]}</span>
  {/each}
  {#each players as player}
    <span class="playerLabel">P{player + 1}</span>
    {#each CONTROL_ACTIONS as action}
      {@const active = listening?.player === player && listening?.action === action}
      <button type="button" class="key" class:listening={active}
        aria-label={`Player ${player + 1} ${action}: ${keyLabel(controls[player][action])}`}
        onclick={() => (listening = active ? null : { player, action })}>
        {active ? "?" : keyLabel(controls[player][action])}
      </button>
    {/each}
  {/each}
</div>

<style>
  .controls{
    display: grid;
    grid-template-columns: auto repeat(4, minmax(0, 1fr)) minmax(0, 2fr);
    align-items: center;
    gap: 3px;
    font-size: 0.75em;
  }
  .actionLabel, .playerLabel{
    text-align: center;
    color: color-mix(in srgb, var(--black) 40%, var(--white) 60%); /* gray */
  }
  .key{
    min-width: 0;
    padding: 4px 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .key.listening{
    background-color: var(--white);
    color: var(--black);
  }
</style>
