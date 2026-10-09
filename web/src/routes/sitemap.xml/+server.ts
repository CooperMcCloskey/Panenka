import { base } from '$app/paths';
import { env } from '$env/dynamic/public';
import { PUBLIC_PAGES, siteOrigin } from '$lib/seo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const origin = siteOrigin(url, env.PUBLIC_SITE_URL);
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const entries = Object.keys(PUBLIC_PAGES).map(path =>
    `<url><loc>${escape(new URL(`${base}${path}`, origin).href)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
