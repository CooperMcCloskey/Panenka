<script lang="ts">
  import {
    clampInt, DEFAULT_GOAL_TARGET, DEFAULT_MINUTES, MAX_GOAL_TARGET, MAX_MINUTES,
  } from "$lib/engine/rules";
  import type { MatchRules } from "$lib/engine/types";

  const {
    rules,
    editable,
    onChange,
  }: {
    rules: MatchRules,
    editable: boolean, 
    onChange: (rules: MatchRules) => void,
  } = $props();

  let minutes = $state(DEFAULT_MINUTES);
  let goals = $state(DEFAULT_GOAL_TARGET);
  const serverMinutes = $derived(rules.kind === "time" ? rules.minutes : null);
  const serverGoals = $derived(rules.kind === "goals" ? rules.target : null);
  $effect.pre(() => { if (serverMinutes !== null) minutes = serverMinutes; });
  $effect.pre(() => { if (serverGoals !== null) goals = serverGoals; });

  function limitTyped(el: HTMLInputElement, max: number): number {
    if (el.value === "") return NaN;
    const n = clampInt(Number(el.value), 1, max, 1);
    if (el.value !== String(n)) el.value = String(n);
    return n;
  }

  // The radios only show the room's rules: a click asks the server, and the selection
  // moves when the change comes back, so it never shows a mode the server didn't accept
  function choose(event: MouseEvent, next: MatchRules) {
    event.preventDefault();
    if (next.kind !== rules.kind) onChange(next);
  }
</script>

<fieldset class="rules" disabled={!editable}>
  <label class:inactive={rules.kind !== "time"}>
    <input type="radio" name="matchMode" aria-label="Timed game" checked={rules.kind === "time"}
      onclick={(e) => choose(e, { kind: "time", minutes: minutes || DEFAULT_MINUTES })} />
    <input type="number" min="1" max={MAX_MINUTES} value={minutes} disabled={rules.kind !== "time"} aria-label="Minutes"
      oninput={(e) => (minutes = limitTyped(e.currentTarget, MAX_MINUTES))}
      onchange={() => onChange({ kind: "time", minutes: (minutes ||= DEFAULT_MINUTES) })} />
    minute game
  </label>
  <label class:inactive={rules.kind !== "goals"}>
    <input type="radio" name="matchMode" aria-label="First to a number of goals" checked={rules.kind === "goals"}
      onclick={(e) => choose(e, { kind: "goals", target: goals || DEFAULT_GOAL_TARGET })} />
    First to
    <input type="number" min="1" max={MAX_GOAL_TARGET} value={goals} disabled={rules.kind !== "goals"} aria-label="Goals"
      oninput={(e) => (goals = limitTyped(e.currentTarget, MAX_GOAL_TARGET))}
      onchange={() => onChange({ kind: "goals", target: (goals ||= DEFAULT_GOAL_TARGET) })} />
    goals
  </label>
</fieldset>

<style>
  .rules{
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
    font-size: 0.9em;
  }
  label{
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap; /* the narrow column would otherwise split "First to" */
  }
  input[type="radio"]{
    margin: 0;
    cursor: pointer;
  }
  .inactive{
    opacity: 0.4;
  }
  input[type="number"]{
    width: 2.5em;
    padding: 4px 2px;
  }
  .rules:disabled input{
    cursor: not-allowed;
  }
</style>
