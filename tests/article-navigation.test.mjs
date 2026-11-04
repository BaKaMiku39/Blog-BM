import assert from 'node:assert/strict';
import test from 'node:test';
import { getArticleNavigation } from '../src/lib/article-navigation.ts';

function post(slug, category, tags = [], draft = false) {
  return { slug, category, tags, draft };
}

test('neighbors follow newest-first order, skip drafts and stop at either end', () => {
  const posts = [post('new', 'anime'), post('draft', 'anime', [], true), post('middle', 'tech'), post('old', 'projects')];
  assert.equal(getArticleNavigation(posts[0], posts).previous, null);
  assert.equal(getArticleNavigation(posts[0], posts).next?.slug, 'middle');
  assert.equal(getArticleNavigation(posts[2], posts).previous?.slug, 'new');
  assert.equal(getArticleNavigation(posts[3], posts).next, null);
  assert.deepEqual(getArticleNavigation(posts[1], posts), { previous: null, next: null, related: [] });
});

test('related posts prefer category then shared tags and keep publication order for ties', () => {
  const posts = [
    post('current', 'anime', ['spring', 'daily']),
    post('tag-only', 'life', ['spring', 'daily']),
    post('category-and-tag', 'anime', ['spring']),
    post('category-only', 'anime'),
    post('another-category', 'anime'),
    post('unrelated', 'projects', ['tools']),
    post('draft', 'anime', ['spring'], true)
  ];
  assert.deepEqual(getArticleNavigation(posts[0], posts).related.map(item => item.slug),
    ['category-and-tag', 'category-only', 'another-category']);
  assert.deepEqual(getArticleNavigation(posts[0], [posts[0], posts[1], posts[5]]).related.map(item => item.slug), ['tag-only']);
});

test('one or missing post has no navigation or recommendations', () => {
  const only = post('only', 'anime');
  assert.deepEqual(getArticleNavigation(only, [only]), { previous: null, next: null, related: [] });
  assert.deepEqual(getArticleNavigation(only, []), { previous: null, next: null, related: [] });
});
