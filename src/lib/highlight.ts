const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 先转义再包裹 <mark>，避免搜索词被当成 HTML 注入。
 * 返回的字符串可直接用于 set:html。
 */
export function highlightText(text: string, term: string): string {
  const safe = escapeHtml(text);
  const needle = term.trim();
  if (!needle) return safe;
  const pattern = new RegExp(escapeRegExp(escapeHtml(needle)), 'gi');
  return safe.replace(pattern, match => `<mark class="search-hit">${match}</mark>`);
}
