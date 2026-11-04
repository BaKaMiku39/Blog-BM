import type { APIRoute } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
export const GET: APIRoute = async ({ params }) => {
  const name = params.name || '';
  if (!/^\d+-[a-f0-9]{12}\.(png|jpg|webp|gif)$/.test(name)) return new Response(null, { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), 'data', 'uploads', name));
    return new Response(bytes, { headers: { 'Content-Type': types[name.split('.').pop() || ''], 'Cache-Control': 'public, max-age=86400' } });
  } catch { return new Response(null, { status: 404 }); }
};
