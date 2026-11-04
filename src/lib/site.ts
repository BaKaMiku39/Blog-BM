import { config } from '../config';

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * 生成站点对外的绝对地址来源。
 * 优先使用显式配置的 PUBLIC_SITE_URL；否则按反向代理头推断，
 * 最后回退到请求自身的 origin，避免线上生成 http://localhost 之类的地址。
 */
export function siteOrigin(request: Request, url: URL): string {
  const configured = config.env.site.url;
  if (configured) return trimSlash(configured);

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || url.host;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || url.protocol.replace(':', '') || 'https';
  return `${protocol.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
}

/** 把站内路径或完整地址统一成绝对地址。 */
export function absoluteUrl(pathOrUrl: string, origin: string): string {
  try {
    return new URL(pathOrUrl, origin).href;
  } catch {
    return `${origin}/`;
  }
}
