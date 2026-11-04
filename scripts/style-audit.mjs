/*
 * 前台样式回归探针：记录一组关键元素的计算样式，用于对比 CSS 改动前后是否影响前台。
 * 用法：node scripts/style-audit.mjs <输出文件名>
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = 'http://localhost:4400';
const PORT = 9336;
const OUT = process.argv[2] || 'styles.json';

const targets = [
  { page: '/', name: 'home' },
  { page: '/articles', name: 'articles' },
  { page: '/about', name: 'about' },
];

const files = await fs.readdir(path.join(ROOT, 'data', 'posts')).catch(() => []);
const slug = files.find(file => file.endsWith('.md'))?.replace(/\.md$/, '');
if (slug) targets.push({ page: `/posts/${slug}`, name: 'post' });

const SELECTORS = [
  'body', '.site-header', '.brand', '.brand-mark', '.main-nav a', '.header-search', '.header-search input',
  '.theme-toggle', '.hero', '.hero h1', '.hero p', '.primary-button', '.section-heading h2',
  '.featured-post', '.post-card', '.cover-placeholder', '.card-copy h3', '.card-meta', '.read-link',
  '.profile-panel', '.side-section', '.side-section li a', '.side-section li b', '.tag-list a',
  '.site-footer', '.footer-inner', '.footer-inner strong', '.back-to-top', '.skip-link',
  '.filter-bar', '.filter-bar a', '.filter-bar a.active', '.listing-grid', '.page-intro h1',
  '.empty-state', '.article-header h1', '.article-meta', '.prose', '.prose h2', '.prose a',
  '.prose pre', '.prose code', '.prose blockquote', '.prose img', '.article-footer',
  '.about-page h1', '.about-links', '.reading-progress', '.article-cover',
];

const PROPS = [
  'color', 'background-color', 'background-image', 'border-top-color', 'border-top-width',
  'border-radius', 'padding-top', 'padding-left', 'margin-top', 'margin-bottom',
  'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing',
  'display', 'position', 'grid-template-columns', 'gap', 'width', 'height',
  'box-shadow', 'text-align', 'opacity', 'overflow', 'flex-direction', 'z-index',
];

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'style-audit-'));
spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {}
  await sleep(250);
}

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(new Error(message.error.message)) : resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id; pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

async function dump(page, width, dark) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await send('Page.navigate', { url: BASE + page });
  await sleep(900);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('theme','${dark ? 'dark' : 'light'}')` });
  await send('Page.reload', {});
  await sleep(900);
  const expression = `(() => {
    const out = {};
    for (const selector of ${JSON.stringify(SELECTORS)}) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const style = getComputedStyle(node);
      const record = {};
      for (const prop of ${JSON.stringify(PROPS)}) record[prop] = style.getPropertyValue(prop);
      out[selector] = record;
    }
    return out;
  })()`;
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
}

const snapshot = {};
for (const { page, name } of targets) {
  for (const [width, dark] of [[1440, false], [390, false], [1440, true]]) {
    snapshot[`${name}@${width}${dark ? '-dark' : ''}`] = await dump(page, width, dark);
    process.stdout.write('.');
  }
}
console.log('');
await fs.writeFile(path.join(ROOT, '.admin-backup', OUT), JSON.stringify(snapshot, null, 2));
console.log('saved', OUT, 'scopes:', Object.keys(snapshot).length);
await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(0);
