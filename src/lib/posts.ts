import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import { renderArticle } from './article';

const defaultCategories = ['技术笔记', '项目', '动漫', '碎碎念'];
export type Category = string;
export function resolveCategory(value: unknown): Category | undefined {
  if (value === '项目作品') return '项目';
  if (value === '动漫游戏') return '动漫';
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
export type Post = {
  slug: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  date: string;
  publishedAt: string;
  updatedAt?: string;
  cover: string;
  badge: string;
  draft: boolean;
  body: string;
};

const dataDir = path.join(process.cwd(), 'data', 'posts');
const categoriesPath = path.join(process.cwd(), 'data', 'categories.json');
const validSlug = /^[a-z0-9][a-z0-9-]{0,79}$/;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
let categoryWrites: Promise<unknown> = Promise.resolve();

function normalizeTags(input: unknown): string[] {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  return [...new Set(values.flatMap(value => String(value).split(/[,，]/))
    .map(tag => tag.trim().slice(0, 24)).filter(Boolean))].slice(0, 12);
}

export async function getCategories(): Promise<string[]> {
  let saved: unknown = [];
  try { saved = JSON.parse(await fs.readFile(categoriesPath, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!Array.isArray(saved) || saved.some(value => typeof value !== 'string')) throw new Error('大类配置格式无效');
  const used = (await getPosts(true)).map(post => post.category);
  return [...new Set([...defaultCategories, ...saved, ...used]
    .map(resolveCategory).filter((value): value is string => Boolean(value)))];
}

export function createCategory(input: unknown): Promise<string> {
  const operation = categoryWrites.then(async () => {
    if (typeof input !== 'string' || !input.trim()) throw new Error('请输入大类名称');
    if (input.trim().length > 24 || /[,，\r\n]/.test(input)) throw new Error('大类名称最多 24 字，不能包含逗号或换行');
    const category = resolveCategory(input)!;
    const categories = await getCategories();
    if (categories.includes(category)) throw new Error('该大类已存在');
    const temporary = `${categoriesPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify([...categories, category], null, 2) + '\n', { flag: 'wx' });
      await fs.rename(temporary, categoriesPath);
    } finally { await fs.rm(temporary, { force: true }); }
    return category;
  });
  categoryWrites = operation.catch(() => {});
  return operation;
}

function normalize(slug: string, data: Record<string, unknown>, body: string): Post {
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date || '').slice(0, 10);
  const published = data.draft !== true;
  const timestamp = data.publishedAt instanceof Date ? data.publishedAt.toISOString() : String(data.publishedAt || '');
  const publishedAt = published && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString()
    : published && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00+08:00`).toISOString() : '';
  return {
    slug,
    title: String(data.title || ''),
    description: String(data.description || ''),
    category: resolveCategory(data.category) || '技术笔记',
    tags: normalizeTags(data.tags),
    date,
    publishedAt,
    updatedAt: Number.isFinite(Date.parse(String(data.updatedAt || ''))) ? new Date(String(data.updatedAt)).toISOString() : '',
    cover: String(data.cover || ''),
    badge: String(data.badge || '').slice(0, 24),
    draft: data.draft === true,
    body
  };
}

export async function getPosts(includeDrafts = false): Promise<Post[]> {
  await fs.mkdir(dataDir, { recursive: true });
  const files = await fs.readdir(dataDir);
  const posts = await Promise.all(files.filter(file => file.endsWith('.md')).map(async file => {
    const source = await fs.readFile(path.join(dataDir, file), 'utf8');
    const parsed = matter(source);
    return normalize(file.slice(0, -3), parsed.data, parsed.content.trim());
  }));
  return posts.filter(post => includeDrafts || !post.draft).sort((a, b) =>
    (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date) || a.slug.localeCompare(b.slug));
}

export async function getPost(slug: string, includeDrafts = false): Promise<Post | null> {
  if (!validSlug.test(slug)) return null;
  try {
    const parsed = matter(await fs.readFile(path.join(dataDir, `${slug}.md`), 'utf8'));
    const post = normalize(slug, parsed.data, parsed.content.trim());
    return post.draft && !includeDrafts ? null : post;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function savePost(input: unknown): Promise<Post> {
  if (!input || typeof input !== 'object') throw new Error('文章内容无效');
  const data = input as Record<string, unknown>;
  const slug = typeof data.slug === 'string' && validSlug.test(data.slug)
    ? data.slug : `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const title = String(data.title || '').trim().slice(0, 120);
  const body = String(data.body || '').trim();
  if (!title || !body) throw new Error('标题和正文不能为空');
  const category = resolveCategory(data.category) || '技术笔记';
  if (!(await getCategories()).includes(category)) throw new Error('请先创建这个大类');
  const tags = normalizeTags(data.tags);
  const action = data.action ?? (data.draft === false ? 'publish' : 'save');
  if (action !== 'save' && action !== 'publish') throw new Error('文章操作无效');
  const rawDate = String(data.date || '').trim();
  if (rawDate && !isValidDate(rawDate)) throw new Error('日期格式应为 YYYY-MM-DD');
  const existing = await getPost(slug, true);
  const draft = action === 'publish' ? false : existing?.draft ?? true;
  const publishedAt = draft ? '' : existing && !existing.draft ? existing.publishedAt : new Date().toISOString();
  const post: Post = {
    slug, title, body, category, tags,
    description: String(data.description || '').trim().slice(0, 240),
    date: rawDate || new Date().toISOString().slice(0, 10),
    cover: /^\/(uploads|images)\/[^\s]*$/.test(String(data.cover)) ? String(data.cover) : '',
    badge: String(data.badge || '').trim().slice(0, 24),
    draft,
    publishedAt
  };
  const contentFields = ['title', 'description', 'body', 'category', 'tags', 'date', 'cover', 'badge'] as const;
  const contentChanged = existing && contentFields.some(field => JSON.stringify(existing[field]) !== JSON.stringify(post[field]));
  post.updatedAt = existing && !existing.draft && contentChanged ? new Date().toISOString() : existing?.updatedAt || '';
  await fs.mkdir(dataDir, { recursive: true });
  const source = matter.stringify(`${body}\n`, {
    title: post.title, description: post.description, category: post.category,
    tags: post.tags, date: post.date, cover: post.cover, badge: post.badge,
    draft: post.draft, publishedAt: post.publishedAt, updatedAt: post.updatedAt
  });
  const target = path.join(dataDir, `${slug}.md`);
  const temporary = `${target}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temporary, source, { flag: 'wx' });
  await fs.rename(temporary, target);
  return post;
}

export async function deletePost(slug: string): Promise<void> {
  if (!validSlug.test(slug)) throw new Error('文章 ID 无效');
  await fs.unlink(path.join(dataDir, `${slug}.md`));
}

export function renderMarkdown(body: string): string {
  return renderArticle(body).html;
}
