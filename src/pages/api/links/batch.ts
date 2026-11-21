import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../../lib/auth';
import { deleteLinks, setLinksActive, setLinksGroup } from '../../../lib/links';

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    const input = await context.request.json();
    const action = String(input?.action || '');
    if (action === 'show') return json({ count: await setLinksActive(input.ids, true) });
    if (action === 'hide') return json({ count: await setLinksActive(input.ids, false) });
    if (action === 'delete') return json({ count: await deleteLinks(input.ids) });
    if (action === 'group') return json({ count: await setLinksGroup(input.ids, input.group) });
    return json({ error: '批量操作无效' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
