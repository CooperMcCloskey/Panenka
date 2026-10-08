<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { PageProps } from './$types';
  import { NetworkSource } from '$lib/client/network-source';
  import Match from '../../../../components/Match.svelte';
  import BackButton from '../../../../components/BackButton.svelte';
  import type { ClientId, LobbyPlayer, PlayerId, PublicClient } from '$lib/shared/protocol';
  import PlayerCardList from './PlayerCardList.svelte';
  import NameWithTags from './NameWithTags.svelte';
  import RulesMenu from './RulesMenu.svelte';
  import ControlsEditor from './ControlsEditor.svelte';

  let { params, data }: PageProps = $props();

  // Start from the load data and get replaced by each lobby message. Mutating `data` itself
  // doesn't re-render: it's a plain object, not $state
  let lobbyState = $derived(data.lobbyState);
  let controlledPlayers = $derived(data.controlledPlayers);

  const players = $derived(lobbyState.players);
  const bluePlayers = $derived(Object.fromEntries(Object.entries(players).filter(([_, p])=>p.team === "blue")));
  const orangePlayers = $derived(Object.fromEntries(Object.entries(players).filter(([_, p])=>p.team === "orange")));
  const spectators: [ClientId, PublicClient][] = $derived(
    Object.entries(lobbyState.clients)
      .filter(([_, client])=>(client.controlledPlayers.length === 0))
  )
  // How many players this client already controls, which decides what the add menu offers
  const localPlayerCount = $derived(controlledPlayers.length);
  // Only the admin can start the match, change the rules and remove other clients' players.
  // The server checks all of these; this just keeps the UI from offering them
  const isAdmin = $derived(data.clientId === lobbyState.adminId);

  const source = untrack(() => new NetworkSource(
    params.code,
    data.token,
    data.lobbyState,
    message => {
      if (message.type === 'lobby') {
        lobbyState = message.lobbyState;
        controlledPlayers = message.controlledPlayerIds;
      }
      // else if (message.type === 'snapshot') playing = true; TODO
    },
    value => status = value
  ));
  onMount(() => {
    source.start();
    return () => source.stop();
  });

  let status: string = $state('Connecting');

  let codeCopied = $state(false);
  async function copyCode(){
    await navigator.clipboard.writeText(params.code);
    codeCopied = true;
    setTimeout(()=>codeCopied = false, 500);
  }

  // Labels shown next to a spectator's or player's name
  function getTags(id: ClientId | PlayerId): string[] {
    const isClientId = Object.keys(lobbyState.clients).includes(id)
    // For a player, the ID of the client that controls it
    const clientId = isClientId ? id : Object.keys(lobbyState.clients).find((cid)=>lobbyState.clients[cid].controlledPlayers.includes(id))
    const tags: string[] = [];
    if (clientId === data.clientId) tags.push("you");
    if (clientId === lobbyState.adminId) tags.push("admin");
    return tags;
  }
  const canRemove = (playerId: PlayerId) => isAdmin || controlledPlayers.includes(playerId);

</script>

{#if lobbyState.started && source}
  <!-- No onEnd: the server sends everyone back to the lobby GAME_END_DELAY after the final whistle -->
  <Match {source} />
  {#if isAdmin}
    <div class="endMatch"><BackButton label="End game" onclick={() => source.endMatch()} /></div>
  {/if}
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
        <PlayerCardList players={bluePlayers} team="blue" {getTags} {canRemove} {localPlayerCount} username={data.username}
          onAddPlayer={(player: LobbyPlayer) => source.addPlayer(player)} onRemovePlayer={(id) => source.deletePlayer(id)}></PlayerCardList>
      </div>
      <div class="menuCard" id="orangeTeamContainer">
        <h2 class="cardHeading">Orange</h2>
        <PlayerCardList players={orangePlayers} team="orange" {getTags} {canRemove} {localPlayerCount} username={data.username}
          onAddPlayer={(player: LobbyPlayer) => source.addPlayer(player)} onRemovePlayer={(id) => source.deletePlayer(id)}></PlayerCardList>
      </div>
      <div class="menuCard" id="spectatorContainer">
        <h2 class="cardHeading">Spectators</h2>
        {#each spectators as [spectatorId, spectator]}
          <NameWithTags name={spectator.username} tags={getTags(spectatorId)} />
        {/each}
      </div>
      <div class="menuCard" id="rulesContainer">
        <h2 class="cardHeading">Rules</h2>
        <RulesMenu rules={lobbyState.rules} editable={isAdmin} onChange={(rules) => source.setRules(rules)} />
      </div>
      <div class="menuCard" id="controlsContainer">
        <h2 class="cardHeading">Controls</h2>
        <ControlsEditor playerCount={localPlayerCount} onChange={() => source.reloadControls()} />
      </div>
      <button id="startButton" disabled={!isAdmin} title={isAdmin ? undefined : "Only the admin can start the game"}
        onclick={() => source?.startMatch()}>Start game</button>
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
    /* right column: spectators take what's left; rules and controls fit their content */
    grid-template-rows: minmax(0, 3fr) auto auto minmax(3em, 1fr);
    gap: 8px
  }
  #blueTeamContainer{ grid-area: 1/1/5/2; }
  #orangeTeamContainer{ grid-area: 1/2/5/3; }
  #spectatorContainer{ grid-area: 1/3/2/4; min-height: 0; overflow: hidden auto; }
  #rulesContainer{ grid-area: 2/3/3/4; }
  #controlsContainer{ grid-area: 3/3/4/4; }
  #startButton{ grid-area: 4/3/5/4; }
  #startButton:disabled{
    opacity: 0.4;
    cursor: not-allowed;
    background-color: color-mix(in srgb, var(--black) 90%, var(--white) 10%); /* no hover highlight */
  }
  
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
  /* Sits in the left of the score bar, above the match */
  .endMatch{
    position: fixed;
    top: 0;
    left: 16px;
    height: 12vh; /* the height of the match header */
    display: flex;
    align-items: center;
    font-size: 1.5em;
    z-index: 1;
  }
  .connection { 
    position: fixed; 
    top: 50%;
    left: 50%;
    color: var(--black);
    z-index: 1; 
  }
</style>
