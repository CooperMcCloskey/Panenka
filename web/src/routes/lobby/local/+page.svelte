<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { loadControls } from "$lib/client/bindings";
  import { KeyboardController } from "$lib/client/controllers";
  import { LocalSource } from "$lib/shared/sources";
  import { rulesFromParams } from "$lib/engine/rules";
  import Match from "../../../components/Match.svelte";

  const controllers = loadControls().map((c) => new KeyboardController(c));
  const source = new LocalSource(controllers, rulesFromParams(page.url.searchParams));
</script>

<Match {source} onEnd={() => goto(resolve("/local"))} />
