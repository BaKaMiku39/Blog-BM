import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/auth';
import { getLinks } from '../../../lib/links';

/** 导出全部友链（含隐藏项与检测结果），给备份、迁移和本地编辑用。 */
export const GET: APIRoute = async context => {
  if (!isAdmin(context)) return json({ error: '请先登录' }, 401);
  try {
    const links = await getLinks(true);
    const body = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), links }, null, 2);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="links-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};
