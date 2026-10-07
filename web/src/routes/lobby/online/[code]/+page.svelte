<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';
  import { NetworkSource } from '$lib/client/network-source';
  import Match from '../../../../components/Match.svelte';
  import type { LobbyPlayer } from '$lib/shared/protocol';
  import PlayerCardList from './PlayerCardList.svelte';

  let { params, data }: PageProps = $props();

  function deletePlayer(playerId: string){
    source
  }

  const spectators = $derived(data.lobbyState.spectators);
  // const players = $derived(data.lobbyState.players); // hardcoded values for now
  const players: Record<string, LobbyPlayer> = $state({
    a: {username: "Player 1", team: "blue"},
    b: {username: "Player 2", team: "blue"},
    c: {username: "Player 3", team: "blue"},

    d: {username: "Player 4", team: "orange"},
    e: {username: "Player 5", team: "orange"},
  })
  const bluePlayers = $derived(Object.fromEntries(Object.entries(players).filter(([_, p])=>p.team === "blue")));
  const orangePlayers = $derived(Object.fromEntries(Object.entries(players).filter(([_, p])=>p.team === "orange")));

  const source = untrack(() => new NetworkSource(
    params.code,
    data.client.token, 
    data.lobbyState,
    message => {
      if (message.type === 'lobby') ({started: playing, lobbyState: data.lobbyState, controlledPlayerIds: data.client.playerIDs} = message); 
      else if (message.type === 'snapshot') playing = true;
    }, 
    value => status = value
  ));

  let playing = $state(false);
  let status: string = $state('Connecting');

  let codeCopied = $state(false);
  async function copyCode(){
    await navigator.clipboard.writeText(params.code);
    codeCopied = true;
    setTimeout(()=>codeCopied = false, 500);
  }

  onMount(() => {
    source.start();
    return () => source.stop();
  });
</script>

{#if playing && source}
  <Match {source} onEnd={()=>playing = false} />
  {#if status !== 'Connected'}<h2 class="connection" role="status">{status}</h2>{/if}
{:else}
  <main>
    <div id="header">
      <h1 id="roomName">Room <button onclick={copyCode}>{codeCopied ? "Copied" : params.code}</button></h1>
      <p role="status">{status}</p>
    </div>
    <div id="body">
      <div class="menuCard" id="blueTeamContainer">
        <h2 class="cardHeading">Blue</h2>
        <PlayerCardList controlledPlayers={data.client.playerIDs} players={bluePlayers}></PlayerCardList>
      </div>
      <div class="menuCard" id="orangeTeamContainer">
        <h2 class="cardHeading">Orange</h2>
        <PlayerCardList controlledPlayers={data.client.playerIDs} players={orangePlayers}></PlayerCardList>
      </div>
      <div class="menuCard" id="spectatorContainer">
        <h2 class="cardHeading">Spectators</h2>
        {#each Object.entries(spectators) as [spectatorId, spectatorUsername]}
          <span>{spectatorUsername}{spectatorId === data.clientId ? " (you)" : ""}</span>
        {/each}
      </div>
      <button id="startButton" onclick={() => source?.startMatch()}>Start game</button>
    </div>
  </main>
{/if}

<style>
  main  {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70vw;
    height: 70vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background-color: var(--black);
    color: var(--white);
    padding: 2.5vw;
  }
  #header{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--white);
    font-size: 1.5em;
  }
  #body{
    flex: 1;
    position: relative;
    min-height: 0;
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr;
    grid-template-rows: 3fr 3fr 1fr;
    gap: 8px
  }
  #blueTeamContainer{ grid-area: 1/1/4/2; }
  #orangeTeamContainer{ grid-area: 1/2/4/3; }
  #spectatorContainer{ grid-area: 1/3/2/4; }
  #startButton{ grid-area: 3/3/4/4; }
  
  .cardHeading{
    margin: 8px 0px;
    font-size: 2em;
  }
  .menuCard{
    display: flex;
    flex-direction: column;
  }

  #roomName{
    margin: 8px 0px;
  }
  .connection { 
    position: fixed; 
    top: 50%;
    left: 50%;
    color: var(--black);
    z-index: 1; 
  }
</style>
