import { json } from '../../lib/auth';
import { getPosts } from '../../lib/posts';
import type { APIRoute } from 'astro';

// 抽签时用：随机给出一篇已发布文章，不返回正文
export const GET: APIRoute = async () => {
  const posts = (await getPosts()).filter(post => !post.draft);
  if (!posts.length) return json({ post: null });
  const post = posts[Math.floor(Math.random() * posts.length)];
  return json({
    post: {
      title: post.title,
      slug: post.slug,
      category: post.category,
      date: post.date,
    },
  });
};
