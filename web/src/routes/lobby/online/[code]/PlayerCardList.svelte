<script lang="ts">
  import { MAX_TEAMSIZE } from "$lib/engine/rules";
  import type { LobbyPlayers } from "$lib/shared/protocol";
  import AddButton from "../../../../components/AddButton.svelte";
  import CloseButton from "../../../../components/CloseButton.svelte";
  const { controlledPlayers, players }: {controlledPlayers: string[], players: LobbyPlayers} = $props()
</script>

<div class="playerCardContainer" style={`grid-template-rows: repeat(${MAX_TEAMSIZE}, 1fr);`}>
  {#each Object.entries(players) as [playerId, player]}
    <div class="card playerCard">
      <div class="deleteButtonContainer"><CloseButton></CloseButton></div>
      <div class="circle" style={`background-color: var(--${player.team});`}></div>
      <div class="main">
        <h3>{player.username}{controlledPlayers.includes(playerId) ? " (you)" : ""}</h3>
      </div>
    </div>
  {/each}
  {#if Object.entries(players).length < MAX_TEAMSIZE}
    <div class="card buttonCard">
      <AddButton style="width: 100%; height: 100%" --icon-size="3em"></AddButton>
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
  .buttonCard:hover{
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
    height: 100%;
    flex: 1;
  }
</style>