import type { APIRoute } from 'astro';
import { clearSession, json, sameOrigin } from '../../lib/auth';

export const POST: APIRoute = context => {
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  clearSession(context);
  return json({ ok: true });
};
