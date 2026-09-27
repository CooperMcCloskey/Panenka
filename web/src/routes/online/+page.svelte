<script lang="ts">
  import {
    clampInt, DEFAULT_GOAL_TARGET, DEFAULT_MINUTES, MAX_GOAL_TARGET, MAX_MINUTES,
  } from "$lib/engine/rules";
  import type { MatchRules } from "$lib/engine/types";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
  import MainMenu from "../../components/MainMenu.svelte";

  let username = $state("");
  let roomCode = $state("");
  let creating = $state(false);
  let mode = $state<MatchRules["kind"]>("time");
  let minutes = $state(DEFAULT_MINUTES);
  let goals = $state(DEFAULT_GOAL_TARGET);

  function limitTyped(el: HTMLInputElement, max: number): number {
    if (el.value === "") return NaN;
    const n = clampInt(Number(el.value), 1, max, 1);
    if (el.value !== String(n)) el.value = String(n);
    return n;
  }
</script>
<!-- TODO Return jwt token-->

<MainMenu>
  <h1>Online</h1>
  <input id="usernameInput" name="username" type="text" bind:value={username}
    form={creating ? "createRoomForm" : "joinRoomForm"}
    required maxlength="20" pattern=".*\S.*"
    title="Enter 1–20 characters, including at least one non-whitespace character."
    aria-label="Username" placeholder="Username">
  {#if creating}
    <form id="createRoomForm" class="option" method="POST" action="?/createRoom">
      <h2>Create Room</h2>
      <input type="hidden" name="numPlayers" value="1">
      <fieldset id="matchRules">
        <legend>Match</legend>
        <label>
          <input type="radio" name="kind" value="time" bind:group={mode} />
          <input type="number" name="minutes" min="1" max={MAX_MINUTES}
            value={minutes} disabled={mode !== "time"}
            oninput={(e) => (minutes = limitTyped(e.currentTarget, MAX_MINUTES))}
            onchange={() => (minutes ||= DEFAULT_MINUTES)} />
          minute game
        </label>
        <label>
          <input type="radio" name="kind" value="goals" bind:group={mode} />
          First to
          <input type="number" name="target" min="1" max={MAX_GOAL_TARGET}
            value={goals} disabled={mode !== "goals"}
            oninput={(e) => (goals = limitTyped(e.currentTarget, MAX_GOAL_TARGET))}
            onchange={() => (goals ||= DEFAULT_GOAL_TARGET)} />
          goals
        </label>
      </fieldset>
      <button type="submit">Create Room</button>
      <button type="button" onclick={() => (creating = false)}>Back</button>
    </form>
  {:else}
  <div id="options">
    <div class="option">
      <h2>Create Room</h2>
      <button type="button" onclick={() => (creating = true)}>Create</button>
    </div>
    <form id="joinRoomForm" class="option" method="POST" action="?/joinRoom">
      <h2>Join Room</h2>
      <input name="roomCode" required id="roomCodeInput" type="text" bind:value={roomCode} placeholder="Room Code">
      <button type="submit">Join</button>
    </form>
  </div>
  {/if}
  {#if form?.message}
    <p role="alert">{form.message}</p>
  {/if}
</MainMenu>

<style>
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
  }
  #matchRules input:disabled{
    opacity: 0.4;
  }

  #options{
    display: flex;
    width: 90%;
    margin-bottom: var(--font-size);
  }
  .option{
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0 var(--font-size);
  }
  .option h2{
    margin: 0 0 8px;
    text-align: center;
  }
  .option button{
    border: var(--border-width) solid var(--white);
    padding: var(--font-size);
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    flex-grow: 1; /* fills the column, so Create spans the space Join's input takes */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  input[type="text"]{
    box-sizing: border-box;
    padding: 0.6em;
  }
  #usernameInput{
    width: 45%;
    margin-bottom: calc(2 * var(--font-size));
  }
  #roomCodeInput{
    width: 100%;
  }
</style>