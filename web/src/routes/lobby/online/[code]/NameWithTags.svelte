<script lang="ts">
  const { name, tags }: { name: string, tags: string[] } = $props();

  const capitalize = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1);
</script>

<span class="nameWithTags">
  <span class="name" title={name}>{name}</span>
  {#if tags.length}
    <span class="tags">{tags.map(capitalize).join(" · ")}</span>
  {/if}
</span>

<style>
  .nameWithTags{
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name, .tags{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tags{
    font-size: 0.7em;
    color: color-mix(in srgb, var(--black) 40%, var(--white) 60%); /* gray */
  }
</style>
