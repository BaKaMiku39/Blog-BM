import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../lib/auth';
import { createCategory, getCategories } from '../../lib/posts';

export const GET: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  return json({ categories: await getCategories() });
};

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    const input = await context.request.json();
    const category = await createCategory(input?.name);
    return json({ category }, 201);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
