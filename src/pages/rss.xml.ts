import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
import { getExcerpt } from '../lib/excerpt';
import { absoluteUrl, siteOrigin } from '../lib/site';
import { config } from '../config';

const escape = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ request, url }) => {
  const origin = siteOrigin(request, url);
  const posts = (await getPosts()).slice(0, 20);
  const latest = posts[0];
  const lastBuild = (latest?.updatedAt || latest?.publishedAt || new Date().toISOString());

  const items = posts.map(post => {
    const link = absoluteUrl(`/posts/${post.slug}`, origin);
    const description = post.description.trim() || getExcerpt(post.body);
    return [
      '    <item>',
      `      <title>${escape(post.title)}</title>`,
      `      <link>${escape(link)}</link>`,
      `      <guid isPermaLink="true">${escape(link)}</guid>`,
      `      <description>${escape(description)}</description>`,
      ...[...new Set([post.category, ...post.tags])].map(name => `      <category>${escape(name)}</category>`),
      `      <pubDate>${new Date(post.publishedAt || `${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(config.site.name)}</title>
    <link>${escape(origin)}</link>
    <description>${escape(config.site.description)}</description>
    <language>${config.site.locale}</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
    <atom:link href="${escape(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' } });
};
