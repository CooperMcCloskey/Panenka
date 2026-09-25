<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { StateSource } from '$lib/client/match';
  import { fitCanvas, render } from '$lib/render';
  import MatchHeader from './MatchHeader.svelte';

  // onEnd is called END_DELAY_MS after the match has a winner.
  let { source, onEnd }: { source: StateSource; onEnd?: () => void } = $props();
  const END_DELAY_MS = 3000;

  let canvasArea: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let game = $state.raw(untrack(() => source.currentState()));
  const over = $derived(game.winner !== null); // a boolean, so the effect below runs once, not every frame

  $effect(() => {
    if (!over || !onEnd) return;
    const timer = setTimeout(onEnd, END_DELAY_MS);
    return () => clearTimeout(timer);
  });

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let scale = 1;

    const observer = new ResizeObserver(([entry]) => {
      scale = fitCanvas(canvas, entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvasArea);

    let last = performance.now();
    let raf: number;

    function frame(now: number) {
      source.update(now - last);
      last = now;
      game = source.currentState();
      render(ctx, game, scale);
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

<div id="matchWrapper">
  <div id="headerArea">
    <MatchHeader {game} />
  </div>
  <div id="canvasArea" bind:this={canvasArea}>
    <canvas id="matchCanvas" bind:this={canvas}></canvas>
  </div>
</div>

<style>
  #matchWrapper{
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--green1);
  }
  #headerArea{
    flex: 0 0 12vh;
  }
  #canvasArea{
    flex: 1;
    min-height: 0; /* lets the area shrink, so the ResizeObserver sees the real space */
    padding: 0 5% 5vh;
    display: grid;
    place-items: center;
  }
  #matchCanvas{
    pointer-events: none; /* right-click shows the page menu instead of the image menu */
  }
</style>
