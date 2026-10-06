<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  import { NetworkSource } from '$lib/client/network-source';
  import Match from '../../../../components/Match.svelte';
  import type { LobbyState } from '$lib/shared/protocol';

  let { params, data }: PageProps = $props();
  let source = $state.raw<NetworkSource>();

  let playing = $state(false);
  let controlledPlayerIds = $state<string[]>([]);
  let status: string = $state('Connecting');

  let codeCopied = $state(false);

  async function copyCode(){
    await navigator.clipboard.writeText(params.code);
    codeCopied = true;
    setTimeout(()=>codeCopied = false, 500);
  }

  onMount(() => {
    const network = new NetworkSource(
      params.code,
      data.client.token, 
      data.lobbyState,
      message => {
        if (message.type === 'lobby') ({start: playing, lobbyState: data.lobbyState, controlledPlayerIds} = message); 
        else if (message.type === 'snapshot') playing = true;
      }, 
      value => status = value
    );

    source = network;
    network.start();
    return () => network.stop();
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
        <h2 class="cardHeading">
          <div class="circle" style="background-color: var(--blue);">
          </div>Blue</h2>
      </div>
      <div class="menuCard" id="orangeTeamContainer">
        <div id="cardHeading"></div>
        <h2 class="cardHeading">
          <div class="circle" style="background-color: var(--orange);">
          </div>Orange</h2>
      </div>
      <div class="menuCard" id="spectatorContainer">
        <h2>Spectators</h2>
        {#each Object.entries(data.lobbyState.spectators) as [spectatorId, spectatorUsername]}
          <p>{spectatorUsername}{spectatorId === data.clientId ? " (you)" : ""}</p>
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
  }
  #body{
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr;
    grid-template-rows: 3fr 3fr 1fr;
    gap: var(--border-width)
  }
  #blueTeamContainer{ grid-area: 1/1/4/2; }
  #orangeTeamContainer{ grid-area: 1/2/4/3; }
  #spectatorContainer{ grid-area: 1/3/2/4; }
  #startButton{ grid-area: 3/3/4/4; }

  .cardHeading{
    display: flex;
    align-items: center;
    gap: 0.4em;
  }
  .circle{
    display: inline-block;
    height: 1lh;
    aspect-ratio: 1;
    border-radius: 50%;
  }


  #roomName{
    margin: 8px;
  }
  .connection { 
    position: fixed; 
    top: 50%;
    left: 50%;
    color: var(--black);
    z-index: 1; 
  }
</style>
