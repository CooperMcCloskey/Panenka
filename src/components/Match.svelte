<script lang="ts">
  import { onMount } from 'svelte';
  import type { StateSource } from '$lib/engine/stateSource/StateSource';
  import type { GameState } from '$lib/engine/types';

  let { source }: { source: StateSource } = $props();

  let canvas: HTMLCanvasElement;

  function render(ctx: CanvasRenderingContext2D, state: GameState) {
    //TODO: implement
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let last = performance.now();
    let raf: number;

    function frame(now: number) {
      source.update(now - last);
      last = now;
      render(ctx, source.currentState());
      raf = requestAnimationFrame(frame);
    }

    source.start();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      source.stop();
    };
  });
</script>

<!-- TODO: relative size -->
<canvas bind:this={canvas} width={1200} height={600}></canvas>
