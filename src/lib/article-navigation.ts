import type { Post } from './posts';

// Posts are supplied in the same newest-first order as the article list.
export function getArticleNavigation(post: Post, posts: Post[]) {
  const published = posts.filter(item => !item.draft);
  const index = published.findIndex(item => item.slug === post.slug);
  if (index === -1) return { previous: null, next: null, related: [] as Post[] };

  const previous = published[index - 1] ?? null;
  const next = published[index + 1] ?? null;
  const tags = new Set(post.tags);
  const related = published
    .map((item, order) => ({
      post: item,
      order,
      sharedTags: item.tags.filter(tag => tags.has(tag)).length,
      sameCategory: item.category === post.category
    }))
    .filter(item => item.post.slug !== post.slug && (item.sameCategory || item.sharedTags > 0))
    .sort((a, b) =>
      Number(b.sameCategory) - Number(a.sameCategory) ||
      b.sharedTags - a.sharedTags || a.order - b.order)
    .slice(0, 3)
    .map(item => item.post);

  return { previous, next, related };
}
