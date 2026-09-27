<script lang="ts">
  const { children } = $props();
</script>

<main>
  {@render children()}
</main>

<style>
  main{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: absolute;
    min-width: 45vw;
    min-height: 45vh;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--black);
    color: var(--white);

    :global(h1){
      font-size: 3em;
    }
    :global(a){
      border: var(--border-width) solid var(--white);
      color: var(--white);
      border-radius: 4px;
      margin: 4px;
      width: 40%;
      padding: var(--font-size);
    }
    :global(a:hover){
      background-color: color-mix(in srgb, var(--black) 80%, var(--white) 20%);
    }
    :global(a:focus-visible){
      outline: 2px solid var(--white);
      outline-offset: 2px;
    }
  }
</style>