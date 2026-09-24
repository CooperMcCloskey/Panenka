<script lang="ts">
  import { onMount } from 'svelte';
  import type { StateSource } from '$lib/engine/stateSource/StateSource';
  import { fitCanvas, loadColors, render } from '$lib/render';

  let { source }: { source: StateSource } = $props();

  let wrapper: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    loadColors(canvas);
    let scale = 1; // CSS pixels per world unit

    const observer = new ResizeObserver(([entry]) => {
      scale = fitCanvas(canvas, entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(wrapper);

    let last = performance.now();
    let raf: number;

    function frame(now: number) {
      source.update(now - last);
      last = now;
      render(ctx, source.currentState(), scale);
      raf = requestAnimationFrame(frame);
    }

    source.start();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      source.stop();
    };
  });
</script>

<div id="canvasWrapper" bind:this={wrapper}>
  <canvas id="matchCanvas" bind:this={canvas}></canvas>
</div>

<style>
  #canvasWrapper{
    position: absolute;
    inset: 0;
    padding: 10vh 5%; /* canvas fits within the middle 90% of the width and 80% of the height */
    display: grid;
    place-items: center;
    background: var(--green1);
  }
  #matchCanvas{
    pointer-events: none; /* right-click shows the page menu, not the image one (input is keyboard-only) */
  }
</style>
