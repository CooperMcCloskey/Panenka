<script lang="ts">
  import { resolve } from "$app/paths";
  import MainMenu from "../../components/MainMenu.svelte";

  let username = $state("");
  let roomCode = $state("");
</script>
<!-- TODO Return jwt token-->

<MainMenu>
  <h1>Online</h1>
  <input id="usernameInput" type="text" bind:value={username} placeholder="Username">
  <div id="options">
    <div class="option">
      <h2>Create Room</h2>
      <a href={resolve("/lobby/online") /* TODO make this actually gen a new room*/}>Create</a>
    </div>
    <div class="option">
      <h2>Join Room</h2>
      <input id="roomCodeInput" type="text" bind:value={roomCode} placeholder="Room Code">
      <a href={resolve("/lobby/online") + "/" + roomCode}>Join</a>
    </div>
  </div>
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
  .option a{
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