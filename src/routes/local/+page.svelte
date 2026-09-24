<script lang="ts">
  import { resolve } from "$app/paths";
  import MainMenu from "../../components/MainMenu.svelte";

</script>

<!-- Later this menu will be where you can choose to play against AI -->
<MainMenu>
  <h1>Local Game</h1>
  <div id="playerList">
    <div class="playerCard">
      <div class="playerColorIndicator blue"></div>
      <h2>Player 1</h2>
      <p>W, A, S, D, Space</p>
    </div>
    <div class="playerCard">
      <div class="playerColorIndicator orange"></div>
      <h2>Player 2</h2>
      <p>O, K, L, ;, Enter</p>
    </div>
  </div>
  <a href={resolve("/lobby/local")}>Start Game</a>
    
</MainMenu>

<style>
  #playerList{
    display: flex;
    justify-content: space-evenly;
    width: 75%;
  }
  .playerCard{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .playerColorIndicator{
    width: min(4vh, 4vw);
    aspect-ratio: 1;
    border-radius: 50%;
  }
  .playerCard > p{
    margin-top: 0;
  }
  .blue{ background-color: var(--blue); }
  .orange{ background-color: var(--orange); }
</style>