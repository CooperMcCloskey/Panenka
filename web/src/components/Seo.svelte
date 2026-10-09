<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { env } from '$env/dynamic/public';
  import { pageMetadata, SITE_NAME, siteOrigin } from '$lib/seo';

  const metadata = $derived(pageMetadata(page.route.id));
  const index = $derived(metadata.index && page.status < 400);
  const origin = $derived(siteOrigin(page.url, env.PUBLIC_SITE_URL));
  const canonical = $derived(new URL(`${base}${page.route.id === '/' ? '/' : page.route.id}`, origin).href);
  const structuredData = $derived(JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: SITE_NAME,
    description: metadata.description,
    url: canonical,
    genre: 'Sports',
    gamePlatform: 'Web browser',
    playMode: 'https://schema.org/MultiPlayer',
    inLanguage: 'en',
    isAccessibleForFree: true,
  }).replace(/</g, '\\u003c'));
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name="description" content={metadata.description} />
  <meta name="robots" content={index ? 'index, follow' : 'noindex, follow'} />
  <meta name="theme-color" content="#14202B" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_GB" />
  <meta property="og:title" content={metadata.title} />
  <meta property="og:description" content={metadata.description} />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={metadata.title} />
  <meta name="twitter:description" content={metadata.description} />
  {#if index}
    <link rel="canonical" href={canonical} />
    <meta property="og:url" content={canonical} />
  {/if}
  {#if index && page.route.id === '/'}
    {@html `<script type="application/ld+json">${structuredData}</script>`}
  {/if}
</svelte:head>
