import { base } from '$app/paths';
import { env } from '$env/dynamic/public';
import { siteOrigin } from '$lib/seo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => new Response(
  `User-agent: *\nAllow: /\nDisallow: ${base}/ws\nSitemap: ${new URL(`${base}/sitemap.xml`, siteOrigin(url, env.PUBLIC_SITE_URL)).href}\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } },
);
