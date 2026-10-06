<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  // Any other button attributes (onclick, disabled, class...) are passed through to the button
  let { label = "Add", ...rest }: { label?: string } & HTMLButtonAttributes = $props();
</script>

<!-- type="button" so it never submits a surrounding form; a caller can still override it -->
<button type="button" class="iconButton" aria-label={label} title={label} {...rest}>
  <!-- add from Google Material Icons (Apache License 2.0) -->
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
</button>

<style>
  .iconButton{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: none;
    color: color-mix(in srgb, var(--black) 40%, var(--white) 60%); /* gray */
  }
  .iconButton:hover{
    background: none; /* overrides the global button hover fill */
    color: var(--white);
  }
  svg{
    width: 1.5em;
    height: 1.5em;
    fill: currentColor; /* takes the button's text color */
  }
</style>
