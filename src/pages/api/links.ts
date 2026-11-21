import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../lib/auth';
import { getLinks, saveLink } from '../../lib/links';

export const GET: APIRoute = async context => {
  try {
    return json({ links: await getLinks(isAdmin(context)) });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    const link = await saveLink(await context.request.json());
    return json({ link }, 201);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
