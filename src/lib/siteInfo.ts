import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config, env } from '../config';

/**
 * 「本站资料」——换友链时给对方抄的那一份。
 *
 * 存在 `data/site-info.json`，后台 `/admin?m=site` 编辑；
 * 文件不存在或字段为空时回落到站点配置，所以删掉这个文件也不会把页面弄空。
 */
export type SiteProfile = {
  name: string;
  url: string;
  avatar: string;
  preview: string;
  description: string;
  tags: string[];
  updatedAt: string;
};

const profilePath = path.join(process.cwd(), 'data', 'site-info.json');
const imagePattern = /^(?:\/(?:uploads|images)\/[^\s]*|https:\/\/[^\s]+)$/;

let profileWrites: Promise<unknown> = Promise.resolve();

function normalizeText(value: unknown, max: number): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、]/);
  return [...new Set(raw.map(item => normalizeText(item, 12)).filter(Boolean))].slice(0, 6);
}

function normalizeImage(value: unknown, fallback: string): string {
  const url = String(value || '').trim();
  if (!url) return fallback;
  return imagePattern.test(url) ? url : fallback;
}

function normalizeUrl(value: unknown, fallback: string): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

/** 默认值 = 站点配置，保证没进过后台时卡片也是完整的。 */
export function defaultProfile(): SiteProfile {
  return {
    name: config.site.name,
    url: normalizeUrl(env.site.url, ''),
    avatar: config.site.author.avatar,
    preview: '/images/hero-spring.webp',
    description: config.site.description,
    tags: [],
    updatedAt: ''
  };
}

export async function getSiteProfile(): Promise<SiteProfile> {
  const fallback = defaultProfile();
  let source: string;
  try {
    source = await fs.readFile(profilePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return fallback;
  }
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(source) as Record<string, unknown>; }
  catch { return fallback; }
  if (!parsed || typeof parsed !== 'object') return fallback;

  return {
    name: normalizeText(parsed.name, 40) || fallback.name,
    url: normalizeUrl(parsed.url, fallback.url),
    avatar: normalizeImage(parsed.avatar, fallback.avatar),
    preview: normalizeImage(parsed.preview, fallback.preview),
    description: normalizeText(parsed.description, 160) || fallback.description,
    tags: normalizeTags(parsed.tags),
    updatedAt: String(parsed.updatedAt || '')
  };
}

export function saveSiteProfile(input: unknown): Promise<SiteProfile> {
  if (!input || typeof input !== 'object') throw new Error('资料内容无效');
  const data = input as Record<string, unknown>;
  const fallback = defaultProfile();
  const name = normalizeText(data.name, 40);
  if (!name) return Promise.reject(new Error('站点名称不能为空'));

  const profile: SiteProfile = {
    name,
    url: normalizeUrl(data.url, fallback.url),
    avatar: normalizeImage(data.avatar, fallback.avatar),
    preview: normalizeImage(data.preview, fallback.preview),
    description: normalizeText(data.description, 160),
    tags: normalizeTags(data.tags),
    updatedAt: new Date().toISOString()
  };

  const next = profileWrites.then(async () => {
    await fs.mkdir(path.dirname(profilePath), { recursive: true });
    const temporary = `${profilePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(profile, null, 2) + '\n', { flag: 'wx' });
      await fs.rename(temporary, profilePath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return profile;
  });
  profileWrites = next.catch(() => {});
  return next;
}
