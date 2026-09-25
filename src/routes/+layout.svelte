<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg'; //TODO: replace

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

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
