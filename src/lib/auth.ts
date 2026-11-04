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
  return !origin || origin === new URL(request.url).origin;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
