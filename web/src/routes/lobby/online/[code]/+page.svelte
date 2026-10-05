<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';
  import { NetworkSource } from '$lib/client/network-source';
  import Match from '../../../../components/Match.svelte';

  let { data }: PageProps = $props();
  let source = $state.raw<NetworkSource>();
  let usernames = $state<string[]>([]);
  let connected = $state<boolean[]>([]);
  let playing = $state(false);
  let status: string = $state('Connecting');
  let playerIndex = $state(0);
  let active = $state(false);
  const canStart = $derived(status === "Connected" && !active
    && connected.length === data.room.numPlayers * 2 && connected.every(Boolean));

  function returnToLobby() {
    playing = false;
  }

  onMount(() => {
    usernames = data.room.usernames;
    const network = new NetworkSource(data.room.code, data.token, data.room.rules,
      data.room.numPlayers, message => {
        if (message.type === 'lobby') {
          usernames = message.usernames; connected = message.connected; playerIndex = message.playerIndex;
          active = message.active;
          if (!active) returnToLobby();
        } else if (message.type === 'snapshot') playing = true;
      }, value => status = value);
    source = network;
    network.start();
    return () => network.stop();
  });
</script>

{#if playing && source}
  <Match {source} onEnd={returnToLobby} manageSource={false} />
  {#if status !== 'Connected'}<h2 class="connection" role="status">{status}</h2>{/if}
{:else}
  <h1>Room {data.room.code}</h1>
  <p>Share this code. Once all {data.room.numPlayers * 2} players are connected, anyone can start a game.</p>
  <p role="status">{status}</p>
  <button disabled={!canStart} onclick={() => source?.startMatch()}>Start game</button>
  <h2>Players</h2>
  <ul>
    {#each usernames as user, i}
      <li>{user}{i === playerIndex ? ' (you)' : ''} · {i < data.room.numPlayers ? 'Blue' : 'Orange'} · {connected[i] ? 'Connected' : 'Waiting'}</li>
    {/each}
  </ul>
{/if}

<style>
  .connection { 
    position: fixed; 
    top: 50%;
    left: 50%;
    color: var(--black);
    z-index: 1; 
  }
</style>
