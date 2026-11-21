import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../../lib/auth';
import { importLinks } from '../../../lib/links';

/**
 * 导入友链。
 * body: { mode: 'merge' | 'replace', links: FriendLink[] }
 * 也接受直接把数组当 body。
 */
export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    const body = await context.request.json();
    const result = await importLinks(Array.isArray(body) ? body : body?.links, Array.isArray(body) ? 'merge' : body?.mode);
    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
