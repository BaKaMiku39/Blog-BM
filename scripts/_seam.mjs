/* 临时脚本：截取首页 hero 与内容区接缝。用法 node scripts/_seam.mjs [tag] */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = process.env.SHOT_BASE || 'http://localhost:4321';
const TAG = process.argv[2] || 'before';
const OUT = path.join(ROOT, 'review-shots', 'seam');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9336;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'seam-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try { const res = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (res.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools 没起来');
}
class Session {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.listeners = new Map();
    this.ready = new Promise(r => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result); return;
      }
      this.listeners.get(m.method)?.forEach(fn => fn(m.params));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  once(method) { return new Promise(resolve => { const h = p => { this.listeners.set(method, this.listeners.get(method).filter(f => f !== h)); resolve(p); }; this.on(method, h); }); }
}

async function shoot(page, { name, width, height, dark = false, scroll = 0 }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: BASE });
  await loaded;
  await sleep(1000);
  if (dark) { await page.send('Runtime.evaluate', { expression: `document.documentElement.dataset.theme='dark'` }); await sleep(300); }
  if (scroll) { await page.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scroll})` }); await sleep(800); }
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(OUT, `${TAG}-${name}.png`), Buffer.from(data, 'base64'));
  console.log('✓', `${TAG}-${name}`);
}

await fs.mkdir(OUT, { recursive: true });
await waitForDevtools();
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const page = new Session(target.webSocketDebuggerUrl);
await page.ready;
await page.send('Page.enable');
await page.send('Runtime.enable');

const SCROLL = Number(process.env.SCROLL || 420);
await shoot(page, { name: '1440-seam', width: 1440, height: 900, scroll: SCROLL });
await shoot(page, { name: '1440-seam-dark', width: 1440, height: 900, dark: true, scroll: SCROLL });
await shoot(page, { name: '390-seam', width: 390, height: 844, scroll: SCROLL });
await shoot(page, { name: '1280-seam', width: 1280, height: 800, scroll: SCROLL });

chrome.kill();
