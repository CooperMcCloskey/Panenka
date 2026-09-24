<script lang="ts">
  import MainMenu from "../components/MainMenu.svelte";
</script>

<MainMenu>
  <h1>Panenka</h1>
  <a href="./local">Local</a>
  <a href="./online">Online</a>
</MainMenu>

<style>
  h1{
    font-size: 3em;
  }
  a{
    border: 2px solid var(--white);
    color: var(--white);
    border-radius: 4px;
    margin: 4px;
    width: 40%;
    padding: var(--font-size);
  }
</style>