import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type LinkHealth = 'unknown' | 'ok' | 'error';

export type FriendLink = {
  id: string;
  name: string;
  url: string;
  avatar: string;
  /** 悬停预览用的站点头图；留空则前台不弹预览 */
  preview: string;
  description: string;
  group: string;
  tags: string[];
  active: boolean;
  nofollow: boolean;
  order: number;
  health: LinkHealth;
  checkedAt: string;
  createdAt: string;
  updatedAt: string;
};

const linksPath = path.join(process.cwd(), 'data', 'links.json');
const validId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{3,63}$/;
const validAvatar = /^(?:\/(?:uploads|images)\/[^\s]*|https:\/\/[^\s]+)$/;

let linkWrites: Promise<unknown> = Promise.resolve();

/** 头像与站点头图共用一套白名单：站内 /uploads|/images，站外必须 HTTPS（防混合内容）。 */
function normalizeImage(value: unknown): string {
  const url = String(value || '').trim();
  return validAvatar.test(url) ? url : '';
}

function normalizeUrl(value: unknown): string {
  const url = String(value || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('链接地址需以 http:// 或 https:// 开头');
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('协议无效');
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof Error && error.message === '协议无效') throw error;
    throw new Error('链接地址格式无效');
  }
}

function normalizeText(value: unknown, max: number): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

/** 标签：数组或逗号分隔的字符串都收，去重后最多 6 个，每个 12 字。 */
function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，、]/);
  const tags = raw
    .map(item => normalizeText(item, 12))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 6);
}

function normalizeOrder(value: unknown, fallback: number): number {
  const order = Number(value);
  return Number.isFinite(order) ? Math.round(Math.min(Math.max(order, -9999), 9999)) : fallback;
}

function normalizeHealth(value: unknown): LinkHealth {
  return value === 'ok' || value === 'error' ? value : 'unknown';
}

function normalizeIso(value: unknown): string {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function normalizeLink(value: unknown): FriendLink | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const id = String(data.id || '');
  const name = normalizeText(data.name, 40);
  if (!validId.test(id) || !name) return null;
  try {
    return {
      id,
      name,
      url: normalizeUrl(data.url),
      avatar: normalizeImage(data.avatar),
      preview: normalizeImage(data.preview),
      description: normalizeText(data.description, 160),
      group: normalizeText(data.group, 24) || '朋友',
      tags: normalizeTags(data.tags),
      active: data.active !== false,
      nofollow: data.nofollow === true,
      order: normalizeOrder(data.order, 1000),
      health: normalizeHealth(data.health),
      checkedAt: normalizeIso(data.checkedAt),
      createdAt: normalizeIso(data.createdAt) || new Date().toISOString(),
      updatedAt: normalizeIso(data.updatedAt) || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

async function readLinks(): Promise<FriendLink[]> {
  await fs.mkdir(path.dirname(linksPath), { recursive: true });
  let source: string;
  try {
    source = await fs.readFile(linksPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await fs.writeFile(linksPath, '[]\n', { flag: 'wx' }).catch(() => {});
    source = '[]';
  }
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error('友链数据文件格式无效'); }
  if (!Array.isArray(parsed)) throw new Error('友链数据文件格式无效');
  const links = parsed.map(normalizeLink).filter((link): link is FriendLink => Boolean(link));
  return links.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

async function writeLinks(links: FriendLink[]): Promise<void> {
  const temporary = `${linksPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(links, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(temporary, linksPath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function mutateLinks(operation: (links: FriendLink[]) => Promise<unknown>): Promise<unknown> {
  const next = linkWrites.then(async () => {
    const links = await readLinks();
    return operation(links);
  });
  linkWrites = next.catch(() => {});
  return next;
}

function validIds(value: unknown): string[] {
  const ids = Array.isArray(value) ? value.map(String) : [];
  return [...new Set(ids.filter(id => validId.test(id)))].slice(0, 200);
}

function requireIds(value: unknown): string[] {
  const ids = validIds(value);
  if (!ids.length) throw new Error('请选择要操作的友链');
  return ids;
}

export async function getLinks(includeHidden = false): Promise<FriendLink[]> {
  const links = await readLinks();
  return includeHidden ? links : links.filter(link => link.active);
}

export function getPublicLinks(): Promise<FriendLink[]> {
  return getLinks(false);
}

export function saveLink(input: unknown): Promise<FriendLink> {
  if (!input || typeof input !== 'object') throw new Error('友链内容无效');
  const data = input as Record<string, unknown>;
  let created: FriendLink | null = null;

  return mutateLinks(async links => {
    const id = typeof data.id === 'string' && validId.test(data.id) ? data.id : `link-${crypto.randomBytes(5).toString('hex')}`;
    const existing = links.find(link => link.id === id);
    const name = normalizeText(data.name, 40);
    const url = normalizeUrl(data.url);
    if (!name) throw new Error('站点名称不能为空');
    if (!url) throw new Error('链接地址不能为空');
    if (links.some(link => link.id !== id && link.url === url)) throw new Error('该链接地址已存在');

    const now = new Date().toISOString();
    const maxOrder = links.reduce((max, link) => Math.max(max, link.order), 0);
    created = {
      id,
      name,
      url,
      avatar: normalizeImage(data.avatar),
      preview: normalizeImage(data.preview),
      description: normalizeText(data.description, 160),
      group: normalizeText(data.group, 24) || '朋友',
      tags: normalizeTags(data.tags),
      active: data.active !== false,
      nofollow: data.nofollow === true,
      order: normalizeOrder(data.order, existing?.order ?? maxOrder + 10),
      health: existing?.url === url ? existing?.health || 'unknown' : 'unknown',
      checkedAt: existing?.url === url ? existing?.checkedAt || '' : '',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    const index = links.findIndex(link => link.id === id);
    if (index >= 0) links[index] = created;
    else links.push(created);
    links.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    await writeLinks(links);
    return created;
  }).then(() => {
    if (!created) throw new Error('友链保存失败');
    return created;
  });
}

export function deleteLinks(ids: unknown): Promise<number> {
  const targets = new Set(requireIds(ids));
  return mutateLinks(async links => {
    const remaining = links.filter(link => !targets.has(link.id));
    if (remaining.length === links.length) throw new Error('没有找到要删除的友链');
    await writeLinks(remaining);
    return links.length - remaining.length;
  }).then(count => Number(count));
}

/**
 * 导入友链。
 * - merge：按 URL 合并，同址更新展示字段、其余追加；
 * - replace：整表替换（导入文件就是新的全部数据）。
 */
export async function importLinks(payload: unknown, mode: unknown): Promise<{ added: number; updated: number; total: number }> {
  const rows = Array.isArray(payload) ? payload : (payload as { links?: unknown })?.links;
  if (!Array.isArray(rows)) throw new Error('导入内容需要是友链数组');
  if (rows.length > 500) throw new Error('一次最多导入 500 条友链');
  const replace = mode === 'replace';

  return mutateLinks(async links => {
    const now = new Date().toISOString();
    const next: FriendLink[] = replace ? [] : [...links];
    const byUrl = new Map(next.map(link => [link.url, link]));
    const usedIds = new Set(next.map(link => link.id));
    let added = 0;
    let updated = 0;

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const data = row as Record<string, unknown>;
      const name = normalizeText(data.name, 40);
      if (!name) continue;
      let url: string;
      try { url = normalizeUrl(data.url); } catch { continue; }

      const avatar = normalizeImage(data.avatar);
      const preview = normalizeImage(data.preview);
      const description = normalizeText(data.description, 160);
      const group = normalizeText(data.group, 24) || '朋友';
      const tags = normalizeTags(data.tags);
      const active = data.active !== false;
      const nofollow = data.nofollow === true;
      const existing = byUrl.get(url);

      if (existing) {
        Object.assign(existing, {
          name, avatar, preview, description, group, tags, active, nofollow,
          order: normalizeOrder(data.order, existing.order),
          updatedAt: now
        });
        updated += 1;
        continue;
      }

      let id = typeof data.id === 'string' && validId.test(data.id) ? data.id : '';
      if (!id || usedIds.has(id)) id = `link-${crypto.randomBytes(5).toString('hex')}`;
      usedIds.add(id);

      const link: FriendLink = {
        id, name, url, avatar, preview, description, group, tags, active, nofollow,
        order: normalizeOrder(data.order, (next.length + 1) * 10),
        health: normalizeHealth(data.health),
        checkedAt: normalizeIso(data.checkedAt),
        createdAt: normalizeIso(data.createdAt) || now,
        updatedAt: now
      };
      next.push(link);
      byUrl.set(url, link);
      added += 1;
    }

    if (!added && !updated && !replace) return { added, updated, total: links.length };
    next.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    await writeLinks(next);
    return { added, updated, total: next.length };
  }).then(result => result as { added: number; updated: number; total: number });
}

export function setLinksActive(ids: unknown, active: boolean): Promise<number> {
  const targets = new Set(requireIds(ids));
  return mutateLinks(async links => {
    const now = new Date().toISOString();
    let changed = 0;
    links.forEach(link => {
      if (!targets.has(link.id)) return;
      if (link.active !== active) changed += 1;
      link.active = active;
      link.updatedAt = now;
    });
    if (!changed) return 0;
    await writeLinks(links);
    return changed;
  }).then(count => Number(count));
}

export function setLinksGroup(ids: unknown, group: unknown): Promise<number> {
  const targets = new Set(requireIds(ids));
  const next = normalizeText(group, 24);
  if (!next) throw new Error('请输入分组名称');
  return mutateLinks(async links => {
    const now = new Date().toISOString();
    let changed = 0;
    links.forEach(link => {
      if (!targets.has(link.id) || link.group === next) return;
      link.group = next;
      link.updatedAt = now;
      changed += 1;
    });
    if (!changed) return 0;
    await writeLinks(links);
    return changed;
  }).then(count => Number(count));
}

export function reorderLinks(orderedIds: unknown): Promise<void> {
  const ids = requireIds(orderedIds);
  return mutateLinks(async links => {
    if (ids.length !== links.length || new Set(ids).size !== links.length) {
      throw new Error('排序需要提交完整的友链列表');
    }
    const byId = new Map(links.map(link => [link.id, link]));
    if (ids.some(id => !byId.has(id))) throw new Error('友链排序包含不存在的记录');
    ids.forEach((id, index) => {
      const link = byId.get(id)!;
      link.order = (index + 1) * 10;
      link.updatedAt = new Date().toISOString();
    });
    await writeLinks([...byId.values()]);
  }).then(() => undefined);
}

async function probeLink(url: string): Promise<{ ok: boolean; status: number }> {
  const headers = { 'User-Agent': 'BaKaMiku-LinkCheck/1.0 (+https://www.bakamiku.com)' };
  const timeout = AbortSignal.timeout(5000);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: timeout, headers });
    if (![405, 501].includes(response.status)) return { ok: response.ok, status: response.status };
  } catch { /* 继续用最小 GET 请求兜底 */ }

  try {
    const response = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000), headers: { ...headers, Range: 'bytes=0-0' }
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function checkLinks(ids: unknown): Promise<{ checked: number }> {
  const targets = requireIds(ids);
  return mutateLinks(async links => {
    const selected = links.filter(link => targets.includes(link.id));
    if (!selected.length) throw new Error('没有找到要检测的友链');
    const now = new Date().toISOString();
    let cursor = 0;
    const worker = async () => {
      while (cursor < selected.length) {
        const link = selected[cursor++];
        const result = await probeLink(link.url);
        link.health = result.ok ? 'ok' : 'error';
        link.checkedAt = now;
        link.updatedAt = now;
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, selected.length) }, worker));
    await writeLinks(links);
    return { checked: selected.length };
  }).then(result => result as { checked: number });
}
