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
  let status = $state('Connecting');
  let playerIndex = $state(0);

  onMount(() => {
    usernames = data.room.usernames;
    const network = new NetworkSource(data.room.code, data.token, data.room.rules,
      data.room.numPlayers, message => {
        if (message.type === 'lobby') {
          usernames = message.usernames; connected = message.connected; playerIndex = message.playerIndex;
        } else if (message.type === 'snapshot') playing = true;
      }, value => status = value);
    source = network;
    network.start();
    return () => network.stop();
  });
</script>

{#if playing && source}
  <Match {source} />
  {#if status !== 'Connected'}<p class="connection" role="status">{status}</p>{/if}
{:else}
  <h1>Room {data.room.code}</h1>
  <p>Share this code. The match starts when all {data.room.numPlayers * 2} players are connected.</p>
  <p role="status">{status}</p>
  <h2>Players</h2>
  <ul>
    {#each usernames as user, i}
      <li>{user}{i === playerIndex ? ' (you)' : ''} · {i < data.room.numPlayers ? 'Blue' : 'Orange'} · {connected[i] ? 'Connected' : 'Waiting'}</li>
    {/each}
  </ul>
{/if}

<style>
  .connection { position: fixed; bottom: 0; left: 1em; z-index: 1; }
</style>
