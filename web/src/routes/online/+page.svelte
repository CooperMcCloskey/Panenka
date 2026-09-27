<script lang="ts">
  import { DEFAULT_MINUTES } from "$lib/engine/rules";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
  import MainMenu from "../../components/MainMenu.svelte";

  let username = $state("");
  let roomCode = $state("");
</script>
<!-- TODO Return jwt token-->

<MainMenu>
  <h1>Online</h1>
  <!-- TODO pass the username aswell and send it straight to the rooms file -->
  <input id="usernameInput" type="text" bind:value={username} placeholder="Username">
  <div id="options">
  <!-- Added forms to implement form actions -->
    <form class="option" method="POST" action="?/createRoom">
      <h2>Create Room</h2>
      <input type="hidden" name="username" value={username}>
      <input type="hidden" name="numPlayers" value="1">
      <input type="hidden" name="kind" value="time">
      <input type="hidden" name="minutes" value={DEFAULT_MINUTES}>
      <button type="submit">Create</button>
    </form>
    <form class="option" method="POST" action="?/joinRoom">
      <h2>Join Room</h2>
      <input type="hidden" name="username" value={username}>
      <input name="roomCode" required id="roomCodeInput" type="text" bind:value={roomCode} placeholder="Room Code">
      <button type="submit">Join</button>
    </form>
  </div>
  {#if form?.message}
    <p role="alert">{form.message}</p>
  {/if}
</MainMenu>

<style>
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