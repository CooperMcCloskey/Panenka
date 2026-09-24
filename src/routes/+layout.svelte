<script lang="ts">
  import '$lib/styling/global.css'
	import '$lib/styling/variables.css'
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
    top: 0;
    left: 0;
    margin: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      90deg,
      #2E7D4F 0 10%,
      #358A58 10% 20%
    );
  }
</style>
