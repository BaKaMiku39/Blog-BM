import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../../lib/auth';
import { deletePost } from '../../../lib/posts';

export const DELETE: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    await deletePost(context.params.slug || '');
    return json({ ok: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
