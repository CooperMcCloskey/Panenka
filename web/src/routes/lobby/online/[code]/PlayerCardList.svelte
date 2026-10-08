<script lang="ts">
  import { MAX_TEAMSIZE } from "$lib/engine/rules";
  import type { Team } from "$lib/engine/types";
  import type { LobbyPlayer, LobbyPlayers, PlayerId } from "$lib/shared/protocol";
  import AddButton from "../../../../components/AddButton.svelte";
  import CloseButton from "../../../../components/CloseButton.svelte";
  import AddPlayerMenu from "./AddPlayerMenu.svelte";
  import NameWithTags from "./NameWithTags.svelte";
  const {
    players,
    team,
    getTags,
    canRemove,
    localPlayerCount,
    username,
    onAddPlayer,
    onRemovePlayer,
  }: {
    players: LobbyPlayers,
    team: Team,
    getTags: (id: PlayerId) => string[],
    canRemove: (id: PlayerId) => boolean,
    localPlayerCount: number,
    username: string,
    onAddPlayer: (player: LobbyPlayer) => void,
    onRemovePlayer: (id: PlayerId) => void,
  } = $props()

  let menuOpen = $state(false);
  let addCard: HTMLDivElement | undefined = $state();
  // Low in the list the menu opens upwards so it stays inside the lobby
  const openUp = $derived(Object.keys(players).length >= MAX_TEAMSIZE / 2);

  // Clicking anywhere outside the add card (which contains the menu) closes it
  function onWindowClick(event: MouseEvent) {
    if (menuOpen && !addCard?.contains(event.target as Node)) menuOpen = false;
  }
  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") menuOpen = false;
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="playerCardContainer" style={`grid-template-rows: repeat(${MAX_TEAMSIZE}, 1fr);`}>
  {#each Object.entries(players) as [playerId, player]}
    <div class="card playerCard">
      {#if canRemove(playerId)}
        <div class="deleteButtonContainer">
          <CloseButton label={`Remove ${player.username}`} onclick={() => onRemovePlayer(playerId)}></CloseButton>
        </div>
      {/if}
      <div class="circle" style={`background-color: var(--${player.team});`}></div>
      <div class="main">
        <NameWithTags name={player.username} tags={getTags(playerId)} />
      </div>
    </div>
  {/each}
  {#if Object.entries(players).length < MAX_TEAMSIZE}
    <div class="card buttonCard" class:open={menuOpen} bind:this={addCard}>
      <AddButton label={`Add a player to ${team}`} aria-haspopup="dialog" aria-expanded={menuOpen}
        style="width: 100%; height: 100%" --icon-size="3em" onclick={() => (menuOpen = !menuOpen)}></AddButton>
      {#if menuOpen}
        <AddPlayerMenu {team} {localPlayerCount} {username} {openUp}
          onAdd={(player) => { onAddPlayer(player); menuOpen = false; }} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .playerCardContainer{
    width: 100%;
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    /* grid-template-rows: in html because it depends on js */
    gap: 8px;
  }
  .card{
    position: relative;
    height: calc(100% - 16px);
    width: calc(100% - 16px);
    background-color: color-mix(in srgb, var(--black) 90%, var(--white) 10%);
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
  }
  .deleteButtonContainer{
    position: absolute;
    top: 4px;
    right: 4px;
  }
  .deleteButtonContainer:hover{
    background-color: color-mix(in srgb, var(--black) 80%, var(--white) 20%);
    border-radius: 8px;
  }
  .buttonCard:hover, .buttonCard.open{
    background-color: color-mix(in srgb, var(--black) 80%, var(--white) 20%);
  }
  .playerCard{
    display: flex;
    align-items: center;
  }
  .circle{
    height: 50%;
    aspect-ratio: 1;
    border-radius: 50%;
  }
  .main{
    flex: 1;
    min-width: 0; /* lets a long name shrink and get an ellipsis */
    padding-right: 32px; /* room for the remove button */
    font-size: 1.2em;
  }
</style>