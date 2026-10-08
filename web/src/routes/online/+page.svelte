<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { clampInt } from "$lib/engine/rules";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
  import MainMenu from "../../components/MainMenu.svelte";
    import BackButton from "../../components/BackButton.svelte";

  let username = $state("");
  let roomCode = $state("");
  let joining = $state(false);

  //TODO: why is this not being used?
  function limitTyped(el: HTMLInputElement, max: number): number {
    if (el.value === "") return NaN;
    const n = clampInt(Number(el.value), 1, max, 1);
    if (el.value !== String(n)) el.value = String(n);
    return n;
  }
</script>

<MainMenu>
  <h1>Online</h1>
  <input id="usernameInput" name="username" type="text" bind:value={username}
    form={joining ? "joinRoomForm" : "createRoomForm"}
    required maxlength="20" pattern=".*\S.*"
    title="Enter 1–20 characters, including at least one non-whitespace character."
    aria-label="Username" placeholder="Username"
    autocomplete="off"
  >
  <!-- Back from joining goes to the Join / Create options, otherwise to the main menu -->
  <div class="backButton">
    <BackButton label={joining ? "Back" : "Back to main menu"}
      onclick={() => (joining ? (joining = false) : goto(resolve("/")))} />
  </div>
  {#if joining}
    <form id="joinRoomForm" method="POST" action="?/joinRoom">
      <input name="roomCode" required id="roomCodeInput" type="text" bind:value={roomCode} placeholder="Room Code">
      <button id="joinButton" type="submit">Join</button>
    </form>
  {:else}
    <div id="options">
      <div class="option">
        <button type="button" onclick={() => (joining = true)}>Join</button>
      </div>
      <form id="createRoomForm" class="option" method="POST" action="?/createRoom">
        <button type="submit">Create Room</button>
      </form>
    </div>
  {/if}
  {#if form?.message}
    <p role="alert">{form.message}</p>
  {/if}
</MainMenu>

<style>
  #options{
    display: flex;
    gap: 20px;
    flex-direction: column;
    width: 50%;
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
  button{
    border: var(--border-width) solid var(--white);
    padding: var(--font-size);
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .backButton{
    position: absolute;
    top: var(--border-width);
    left: var(--border-width);
  }
  input[type="text"]{
    box-sizing: border-box;
    padding: 0.4em;
  }
  #usernameInput{
    width: 45%;
    margin-bottom: calc(2 * var(--font-size));
  }
  #roomCodeInput{
    width: 100%;
    margin-bottom: 16px;
  }
</style>
