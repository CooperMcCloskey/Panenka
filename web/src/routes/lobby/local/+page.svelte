<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { loadControls } from "$lib/client/bindings";
  import { KeyboardController } from "$lib/shared/controller";
  import { LocalSource } from "$lib/shared/sources";
  import { rulesFromParams } from "$lib/engine/rules";
  import Match from "../../../components/Match.svelte";
  import { onMount } from "svelte";

  const [blue, orange] = loadControls().map((c) => new KeyboardController(c));
  const source = new LocalSource({ blue: [blue], orange: [orange] }, rulesFromParams(page.url.searchParams));

  onMount(()=>{
    source.start();
    return ()=>source.stop();
  })
  
</script>

<Match {source} onEnd={() => goto(resolve("/local"))} />
