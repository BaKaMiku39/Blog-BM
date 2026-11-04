import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
import { absoluteUrl, siteOrigin } from '../lib/site';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ request, url }) => {
  const posts = await getPosts();
  const origin = siteOrigin(request, url);
  const entries = [
    { loc: '/', changefreq: 'daily', priority: '1.0', lastmod: posts[0]?.publishedAt?.slice(0, 10) },
    { loc: '/articles', changefreq: 'daily', priority: '0.9', lastmod: posts[0]?.publishedAt?.slice(0, 10) },
    { loc: '/about', changefreq: 'monthly', priority: '0.5' },
    ...posts.map(post => ({
      loc: `/posts/${post.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      lastmod: (post.updatedAt || post.publishedAt || post.date).slice(0, 10),
    })),
  ];
  const body = entries.map(entry => [
    '  <url>',
    `    <loc>${escape(absoluteUrl(entry.loc, origin))}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
