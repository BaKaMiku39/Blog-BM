import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../lib/auth';
import { renderMarkdown } from '../../lib/posts';

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  const data = await context.request.json().catch(() => ({}));
  return json({ html: renderMarkdown(String(data.body || '').slice(0, 200000)) });
};
