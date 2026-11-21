// V1.0.1 起访客统计改由 Umami 浏览器打点（/stats/script.js）提供，
// 自建 visits.json 计数停用：纯 HTTP 扫描器不执行 JS，不再被算成访客。
// 原中间件逻辑（只统计渲染后的 200 HTML 页面）保留在下方注释里，需要回滚时恢复即可。
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => next());

/*
// ── 旧版自建计数逻辑（V1.0.0）──
import { recordVisit } from './lib/visits';
import { config } from './config';

const SKIP = /^\/(admin|api|_astro|_server-islands|images|uploads|meting|particles)(\/|$)/i;

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!config.env.features.visits) return response;
  if (context.request.method !== 'GET') return response;
  if (response.status !== 200) return response;
  if (SKIP.test(context.url.pathname)) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
  const ua = context.request.headers.get('user-agent') || '';
  const forwarded = context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  let ip = forwarded || '';
  if (!ip) {
    try { ip = context.clientAddress || ''; } catch { ip = ''; }
  }
  recordVisit(ip, ua);
  return response;
});
*/
