<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import Seo from '../components/Seo.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={`${base}/panenka.svg`} />
</svelte:head>

<Seo />

<div class="background">
  {@render children()}
</div>

<style>
  .background{
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, var(--green0) 0 10%, var(--green1) 10% 20%);
  }
</style>
