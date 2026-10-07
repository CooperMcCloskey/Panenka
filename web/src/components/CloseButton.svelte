<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  // Any other button attributes (onclick, disabled, class...) are passed through to the button
  let { label = "Close", ...rest }: { label?: string } & HTMLButtonAttributes = $props();
</script>

<!-- type="button" so it never submits a surrounding form; a caller can still override it -->
<button type="button" class="iconButton" aria-label={label} title={label} {...rest}>
  <!-- close from Google Material Icons (Apache License 2.0) -->
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
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
    color: var(--white);
  }
  svg{
    width: var(--icon-size, 1.5em);
    height: var(--icon-size, 1.5em);
    fill: currentColor; /* takes the button's text color */
  }
</style>
