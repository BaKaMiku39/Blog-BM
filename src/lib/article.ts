import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export type ArticleHeading = { id: string; depth: number; label: string };

const escapeText = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const markdown = new Marked({
  renderer: {
    paragraph({ tokens }) {
      const image = tokens.length === 1 && tokens[0].type === 'image' ? tokens[0] : null;
      if (!image) return false;
      const caption = image.title || image.text;
      return `<figure>${this.parser.parseInline(tokens)}${caption ? `<figcaption>${escapeText(caption)}</figcaption>` : ''}</figure>\n`;
    }
  }
});

export function renderArticle(body: string): { html: string; headings: ArticleHeading[] } {
  const headings: ArticleHeading[] = [];
  const byId = new Map<string, ArticleHeading>();
  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  // Read headings from the sanitized HTML so inline formatting and raw HTML work alike.
  const html = sanitizeHtml(markdown.parse(body, { async: false }) as string, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'figure', 'figcaption'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      ...Object.fromEntries([1, 2, 3, 4, 5, 6].map(depth => [`h${depth}`, ['id']])),
      img: ['src', 'alt', 'title'], code: ['class']
    },
    transformTags: Object.fromEntries(headingTags.map(tag => [tag, (tagName: string) => {
      const heading = { id: `article-section-${headings.length + 1}`, depth: Number(tagName[1]), label: '' };
      headings.push(heading);
      byId.set(heading.id, heading);
      return { tagName, attribs: { id: heading.id } };
    }])),
    exclusiveFilter: frame => {
      const heading = byId.get(frame.attribs.id);
      if (heading) heading.label = frame.text.trim() || '未命名章节';
      return false;
    },
    allowedSchemes: ['http', 'https', 'mailto']
  });
  return { html, headings };
}
