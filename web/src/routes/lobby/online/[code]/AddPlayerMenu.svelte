<script lang="ts">
  import { onMount } from "svelte";
  import type { Team } from "$lib/engine/types";
  import type { LobbyPlayer } from "$lib/shared/protocol";
  import { isValidUsername, MAX_LOCAL_PLAYERS, MAX_USERNAME_LENGTH } from "$lib/shared/limits";

  const {
    team,
    localPlayerCount,
    username,
    openUp,
    onAdd,
  }: {
    team: Team,
    localPlayerCount: number,
    username: string, 
    openUp: boolean,
    onAdd: (player: LobbyPlayer) => void,
  } = $props();

  let player2Name = $state("");
  let menu: HTMLDivElement;

  // Focus the first option so the menu can be used straight from the keyboard
  onMount(() => menu.querySelector<HTMLElement>("button, input")?.focus());

  function addPlayer2(event: SubmitEvent) {
    event.preventDefault();
    if (isValidUsername(player2Name)) onAdd({ username: player2Name.trim(), team });
  }
</script>

<div class="menu" class:openUp bind:this={menu} role="dialog" aria-label={`Add a player to ${team}`}>
  <section>
    <h4>Players</h4>
    {#if localPlayerCount === 0}
      <button type="button" class="option" onclick={() => onAdd({ username, team })}>
        Player 1 <span class="detail">{username}</span>
      </button>
    {:else if localPlayerCount < MAX_LOCAL_PLAYERS}
      <form class="option" onsubmit={addPlayer2}>
        <input type="text" bind:value={player2Name} aria-label="Player 2 username" placeholder="Player 2 username"
          required maxlength={MAX_USERNAME_LENGTH} pattern=".*\S.*" autocomplete="off">
        <button type="submit">Add</button>
      </form>
    {:else}
      <p class="detail">Both keyboard players added</p>
    {/if}
  </section>
  <!-- Bots will be their own <section> here -->
</div>

<style>
  .menu{
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    background-color: var(--black);
    border: 2px solid color-mix(in srgb, var(--black) 60%, var(--white) 40%);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  }
  .menu.openUp{
    top: auto;
    bottom: calc(100% + 4px);
  }
  section{
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h4{
    margin: 0;
    font-size: 0.8em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--black) 40%, var(--white) 60%); /* gray */
  }
  .option{
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  button.option{
    text-align: left;
    padding: 8px;
  }
  form.option input{
    flex: 1;
    min-width: 0;
    text-align: left;
  }
  .detail{
    margin: 0;
    color: color-mix(in srgb, var(--black) 40%, var(--white) 60%); /* gray */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
