export const SITE_NAME = 'Panenka';

export const PUBLIC_PAGES = {
  '/': {
    title: 'Panenka — Free Multiplayer Football Game',
    description: 'Play Panenka, a free football game in your browser. Challenge friends in online multiplayer rooms or share a keyboard for local two-player matches.',
  },
  '/local': {
    title: 'Local Two-Player Football — Panenka',
    description: 'Play local two-player football on one keyboard. Customise your controls and choose a timed match or a goal target in Panenka.',
  },
  '/online': {
    title: 'Play Football Online with Friends — Panenka',
    description: 'Create a Panenka multiplayer room or join friends with a room code. Pick your team and play free football together in your browser.',
  },
} as const;

// A deployment can pin its canonical domain with PUBLIC_SITE_URL. Otherwise use
// the request origin, so previews and local development never invent a domain.
export function siteOrigin(url: URL, configured?: string): string {
  if (configured) {
    const site = new URL(configured);
    if (!['http:', 'https:'].includes(site.protocol)) throw new Error('PUBLIC_SITE_URL must be an HTTP(S) URL');
    return site.origin;
  }
  return url.origin;
}

export function pageMetadata(routeId: string | null) {
  if (routeId && Object.hasOwn(PUBLIC_PAGES, routeId)) {
    return { ...PUBLIC_PAGES[routeId as keyof typeof PUBLIC_PAGES], index: true };
  }
  return {
    title: routeId === '/lobby/local' ? 'Local Football Match — Panenka' : 'Multiplayer Lobby — Panenka',
    description: 'Top down football lobby',
    index: false,
  };
}
