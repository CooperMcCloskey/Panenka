<script lang="ts">
  import { resolve } from "$app/paths";
  import MainMenu from "../components/MainMenu.svelte";
</script>

<MainMenu>
  <h1>Panenka</h1>
  <a href={resolve("/local")}>Local</a>
  <a href={resolve("/online")}>Online</a>
</MainMenu>
