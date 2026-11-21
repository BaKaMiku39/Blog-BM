import type { APIRoute } from 'astro';
import { isAdmin, json, sameOrigin } from '../../lib/auth';
import { getSiteProfile, saveSiteProfile } from '../../lib/siteInfo';

/** 站点资料：公开可读（友链页要用），只有登录后能改。 */
export const GET: APIRoute = async () => {
  try {
    return json({ profile: await getSiteProfile() });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  try {
    return json({ profile: await saveSiteProfile(await context.request.json()) });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
