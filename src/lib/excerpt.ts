import { marked, type Token, type Tokens } from 'marked';

function tokenText(token: Token): string {
  if (['code', 'html', 'image', 'def', 'hr'].includes(token.type)) return '';
  if (token.type === 'list') return (token as Tokens.List).items.map(item => item.tokens.map(tokenText).join(' ')).join(' ');
  if (token.type === 'table') {
    const table = token as Tokens.Table;
    return [...table.header, ...table.rows.flat()].map(cell => cell.tokens.map(tokenText).join('')).join(' ');
  }
  if ('tokens' in token && token.tokens) return token.tokens.map(tokenText).join('');
  return 'text' in token ? token.text : '';
}

export function getExcerpt(body: string): string {
  const text = marked.lexer(body)
    .filter(token => !['heading', 'code', 'html', 'image', 'def', 'hr'].includes(token.type))
    .map(tokenText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = Array.from(text);
  const limit = 120;
  if (characters.length <= limit) return text;

  const shortened = characters.slice(0, limit).join('');
  const sentenceEnd = [...shortened.matchAll(/[。！？!?](?:[”’"')\]]*)?(?=\s|$)|\.(?:[”’"')\]]*)?(?=\s|$)/gu)].at(-1);
  if (sentenceEnd && sentenceEnd.index! >= limit * 0.45) {
    return shortened.slice(0, sentenceEnd.index! + sentenceEnd[0].length).trim();
  }

  const wordBreak = shortened.lastIndexOf(' ');
  const excerpt = (wordBreak > limit * 0.6 ? shortened.slice(0, wordBreak) : shortened).trimEnd();
  return `${excerpt}…`;
}

export function getWordCount(body: string): number {
  return (marked.lexer(body).map(tokenText).join('').match(/[\p{L}\p{N}]/gu) || []).length;
}

export function getReadingTime(body: string): number {
  const text = marked.lexer(body).map(tokenText).join('');
  const eastAsianCharacters = (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || []).length;
  const latinWords = (text.match(/[\p{Script=Latin}\p{N}]+(?:['’-][\p{Script=Latin}\p{N}]+)*/gu) || []).length;
  return Math.max(1, Math.ceil(eastAsianCharacters / 400 + latinWords / 200));
}
