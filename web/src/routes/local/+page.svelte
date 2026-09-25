<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import {
    CONTROL_ACTIONS, defaultControls, keyLabel, loadControls, rebind, saveControls,
    type ControlAction, type PlayerControls,
  } from "$lib/client/bindings";
  import {
    clampInt, DEFAULT_GOAL_TARGET, DEFAULT_MINUTES, MAX_GOAL_TARGET, MAX_MINUTES, rulesToParams,
  } from "$lib/engine/rules";
  import type { MatchRules } from "$lib/engine/types";
  import MainMenu from "../../components/MainMenu.svelte";

  let mode = $state<MatchRules["kind"]>("time");
  let minutes = $state(DEFAULT_MINUTES);
  let goals = $state(DEFAULT_GOAL_TARGET);

  // Keeps the typed value within [1, max] on every keystroke. An empty field is NaN
  // while typing and falls back to the default (`|| DEFAULT`) once left.
  function limitTyped(el: HTMLInputElement, max: number): number {
    if (el.value === "") return NaN;
    const n = clampInt(Number(el.value), 1, max, 1);
    if (el.value !== String(n)) el.value = String(n);
    return n;
  }

  const rules: MatchRules = $derived(
    mode === "goals"
      ? { kind: "goals", target: goals || DEFAULT_GOAL_TARGET }
      : { kind: "time", minutes: minutes || DEFAULT_MINUTES },
  );
  const startHref = $derived(`${resolve("/lobby/local")}?${rulesToParams(rules)}`);

  // Click a key, then press the new one; Escape cancels.
  let controls = $state<PlayerControls>(defaultControls());
  let listening = $state<{ player: 0 | 1; action: ControlAction } | null>(null);
  onMount(() => (controls = loadControls())); // localStorage isn't available during server render

  const ACTION_LABELS: Record<ControlAction, string> = { up: "↑", left: "←", down: "↓", right: "→", kick: "Kick" };

  function onKeydown(e: KeyboardEvent) {
    if (!listening) return;
    e.preventDefault(); // Space, arrows and Tab would otherwise scroll or move focus
    if (e.code !== "Escape") {
      controls = rebind(controls, listening.player, listening.action, e.code);
      saveControls(controls);
    }
    listening = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Later this menu will be where you can choose to play against AI -->
<MainMenu>
  <h1>Local Game</h1>
  <div id="playerList">
    {#each [0, 1] as const as player}
      <div class="playerCard">
        <div class="playerColorIndicator {player === 0 ? 'blue' : 'orange'}"></div>
        <h2>Player {player + 1}</h2>
        <div class="bindings">
          {#each CONTROL_ACTIONS as action}
            {@const active = listening?.player === player && listening?.action === action}
            <label class="binding">
              <span>{ACTION_LABELS[action]}</span>
              <button type="button" class="input key" class:listening={active}
                onclick={() => (listening = active ? null : { player, action })}>
                {active ? "?" : keyLabel(controls[player][action])}
              </button>
            </label>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <fieldset id="matchRules">
    <legend>Match</legend>
    <label>
      <input type="radio" name="mode" value="time" bind:group={mode} />
      <input class="input" type="number" min="1" max={MAX_MINUTES} value={minutes} disabled={mode !== "time"}
        oninput={(e) => (minutes = limitTyped(e.currentTarget, MAX_MINUTES))}
        onchange={() => (minutes ||= DEFAULT_MINUTES)} />
      minute game
    </label>
    <label>
      <input type="radio" name="mode" value="goals" bind:group={mode} />
      First to
      <input class="input" type="number" min="1" max={MAX_GOAL_TARGET} value={goals} disabled={mode !== "goals"}
        oninput={(e) => (goals = limitTyped(e.currentTarget, MAX_GOAL_TARGET))}
        onchange={() => (goals ||= DEFAULT_GOAL_TARGET)} />
      goals
    </label>
  </fieldset>

  <a href={startHref}>Start Game</a>
</MainMenu>

<style>
  #playerList{
    display: flex;
    justify-content: space-evenly;
    width: 75%;
  }
  .playerCard{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .playerColorIndicator{
    width: min(4vh, 4vw);
    aspect-ratio: 1;
    border-radius: 50%;
  }
  .blue{ background-color: var(--blue); }
  .orange{ background-color: var(--orange); }

  .bindings{
    display: flex;
    gap: 4px;
  }
  .binding{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 0.8em;
  }
  .key{
    min-width: 2.5em;
    cursor: pointer;
  }
  .key.listening{
    background-color: color-mix(in srgb, var(--black) 70%, var(--white) 30%);
  }

  #matchRules{
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: var(--font-size) 0;
    border: var(--border-width) solid var(--white);
    border-radius: 4px;
  }
  #matchRules label{
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #matchRules input[type="number"]{
    width: 3em;
    text-align: center;
  }
  #matchRules input:disabled{
    opacity: 0.4;
  }

  .input{
    background-color: color-mix(in srgb, var(--black) 90%, var(--white) 10%);
    color: var(--white);
    border: none;
    border-radius: 4px;
    padding: 4px 6px;
    font: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .input::-webkit-outer-spin-button,
  .input::-webkit-inner-spin-button{
    -webkit-appearance: none;
    margin: 0;
  }
</style>
