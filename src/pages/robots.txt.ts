import type { APIRoute } from 'astro';
import { siteOrigin } from '../lib/site';

export const GET: APIRoute = ({ request, url }) => {
  const origin = siteOrigin(request, url);
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /preview/',
    'Disallow: /healthz',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
};
