import type { APIRoute } from 'astro';
import { checkPassword, configured, json, sameOrigin, setSession } from '../../lib/auth';

export const POST: APIRoute = async context => {
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  if (!configured()) return json({ error: '请先配置 ADMIN_PASSWORD 和 SESSION_SECRET' }, 503);
  const data = await context.request.json().catch(() => ({}));
  if (!checkPassword(String(data.password || ''))) return json({ error: '密码错误' }, 401);
  setSession(context);
  return json({ ok: true });
};
