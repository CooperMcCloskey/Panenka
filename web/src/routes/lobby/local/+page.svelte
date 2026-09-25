<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { KeyboardController, loadControls } from "$lib/client/keyboard";
  import { LocalSource } from "$lib/client/match";
  import { rulesFromParams } from "$lib/engine/rules";
  import Match from "../../../components/Match.svelte";

  const controllers = loadControls().map((c) => new KeyboardController(c));
  const source = new LocalSource(controllers, rulesFromParams(page.url.searchParams));
</script>

<Match {source} onEnd={() => goto(resolve("/local"))} />
