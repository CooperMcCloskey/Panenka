<script lang="ts">
  import { DEFAULT_PLAYER1_CONTROLS, DEFAULT_PLAYER2_CONTROLS } from "$lib/engine/constants";
  import { KeyboardController } from "$lib/engine/controllers/KeyboardController";
    import { LocalSource } from "$lib/engine/stateSource/LocalSource";
  import Match from "../../../components/Match.svelte";
  const controllers = [new KeyboardController(DEFAULT_PLAYER1_CONTROLS), new KeyboardController(DEFAULT_PLAYER2_CONTROLS)] //TODO: make controls customizeable?
  const source = new LocalSource(controllers);
</script>
<Match {source}></Match>