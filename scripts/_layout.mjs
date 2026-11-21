/* 临时：测量各页面栏高与截图。用法 node scripts/_layout.mjs <tag> [width] */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = process.env.SHOT_BASE || 'http://localhost:4321';
const TAG = process.argv[2] || 'before';
const WIDTHS = (process.argv[3] || '1440').split(',').map(Number);
const OUT = path.join(ROOT, 'review-shots', 'layout');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9350;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-shot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
class Session {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise(r => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
await fs.mkdir(OUT, { recursive: true });
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const page = new Session(target.webSocketDebuggerUrl);
await page.ready;
await page.send('Page.enable');
await page.send('Runtime.enable');

const PAGES = [
  { name: 'home', url: '/' },
  { name: 'articles', url: '/articles/' },
  { name: 'post', url: '/posts/v1-0-0-open-source/' },
  { name: 'about', url: '/about/' },
  { name: 'links', url: '/links/' },
];

for (const width of WIDTHS) {
  const height = width < 768 ? 844 : 900;
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  for (const p of PAGES) {
    await page.send('Page.navigate', { url: BASE + p.url });
    await sleep(1200);
    const res = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const pick = (sel) => [...document.querySelectorAll(sel)].map(el => {
          const r = el.getBoundingClientRect();
          return { sel, cls: el.className, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top + scrollY) };
        });
        return JSON.stringify({ scrollW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, boxes: [...pick('.home-grid > *'), ...pick('.article-layout > *'), ...pick('.reader-aside > *'), ...pick('.reader-author > *'), ...pick('.home-grid > .sidebar > *'), ...pick('.home-grid > .profile-column > *')] }, null, 0);
      })()`,
    });
    console.log(`--- ${p.name} @${width} ---\n${res.result.value}`);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(OUT, `${TAG}-${p.name}-${width}.png`), Buffer.from(data, 'base64'));
  }
}
chrome.kill();
