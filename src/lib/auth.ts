import crypto from 'node:crypto';
import type { APIContext } from 'astro';
import { adminReady, config } from '../config';

const cookieName = config.env.auth.cookieName;
const lifetime = 60 * 60 * 24 * 7;

function secret() { return config.env.auth.sessionSecret; }
function signature(value: string) { return crypto.createHmac('sha256', secret()).update(value).digest('hex'); }

export function configured(): boolean {
  return adminReady;
}

export function isAdmin(context: APIContext): boolean {
  if (!configured()) return false;
  const token = context.cookies.get(cookieName)?.value || '';
  const [expires, mac] = token.split('.');
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  const expected = signature(expires);
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

export function checkPassword(password: string): boolean {
  if (!configured()) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(config.env.auth.adminPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function setSession(context: APIContext): void {
  const expires = String(Date.now() + lifetime * 1000);
  context.cookies.set(cookieName, `${expires}.${signature(expires)}`, {
    httpOnly: true, sameSite: 'strict', secure: context.url.protocol === 'https:', path: '/', maxAge: lifetime
  });
}

export function clearSession(context: APIContext): void {
  context.cookies.delete(cookieName, { path: '/' });
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  // request.url 在 standalone 模式下是后端内部地址（http://localhost:4321），
  // 不能用它比对；按对外地址判断，反代头由 nginx 覆盖，外部伪造无效。
  const allowed = new Set<string>();
  const site = config.env.site.url;
  if (site) {
    try { allowed.add(new URL(site).origin); } catch { /* 配置非法则忽略 */ }
  }
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
  const proto = (request.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  if (host) {
    allowed.add(`${proto}://${host}`);
    // 本地开发：没有反代，浏览器 Origin 是 http://localhost:4400 或 http://127.0.0.1:4400，
    // 而上面按 https 拼出来的地址对不上，登录会一直 403。只对回环地址补齐两种协议；
    // 生产仍以 PUBLIC_SITE_URL + 反代头为准。
    try {
      const hostUrl = new URL(`${proto}://${host}`);
      if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostUrl.hostname)) {
        allowed.add(`http://${host}`);
        allowed.add(`https://${host}`);
      }
    } catch { /* Host 头异常就跳过 */ }
  }

  // 再兜一层：request.url 自己指向回环地址时也认它
  try {
    const self = new URL(request.url);
    if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(self.hostname)) allowed.add(self.origin);
  } catch { /* URL 异常就跳过 */ }

  return allowed.has(origin);
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
