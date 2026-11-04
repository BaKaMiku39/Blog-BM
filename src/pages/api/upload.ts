import type { APIRoute } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isAdmin, json, sameOrigin } from '../../lib/auth';

const types: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif'
};

export const POST: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  if (!sameOrigin(context.request)) return json({ error: '请求来源无效' }, 403);
  const form = await context.request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !types[file.type]) return json({ error: '只支持 PNG、JPEG、WebP、GIF' }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: '图片不能超过 8MB' }, 400);
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${types[file.type]}`;
  const dir = path.join(process.cwd(), 'data', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
  return json({ url: `/uploads/${name}` });
};
