import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../lib/auth';
import { getPosts, savePost } from '../../lib/posts';

export const GET: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  return json({ posts: await getPosts(true) });
};

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    const post = await savePost(await context.request.json());
    return json({ post });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
