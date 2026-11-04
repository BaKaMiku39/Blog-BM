/*
 * 首页改动的截图核对脚本（和 admin-shots.mjs 同一套 CDP 手法，不引额外依赖）。
 * 用法：node scripts/home-shots.mjs        （默认打开发服 4321）
 *      SHOT_BASE=http://localhost:4400 node scripts/home-shots.mjs
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = process.env.SHOT_BASE || 'http://localhost:4321';
const OUT = path.join(ROOT, 'review-shots', 'home-polish');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'home-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools 没起来');
}

class Session {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise(resolve => this.ws.addEventListener('open', resolve));
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }
      this.listeners.get(message.method)?.forEach(fn => fn(message.params));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  once(method) {
    return new Promise(resolve => {
      const handler = params => {
        this.listeners.set(method, this.listeners.get(method).filter(fn => fn !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

async function shoot(page, { name, width, height, url = BASE, dark = false, action }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  await sleep(900);
  if (dark) {
    await page.send('Runtime.evaluate', { expression: `document.documentElement.dataset.theme='dark'` });
    await sleep(300);
  }
  if (action) {
    await page.send('Runtime.evaluate', { expression: action, awaitPromise: true });
    await sleep(900);
  }
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('✓', name);
}

await fs.mkdir(OUT, { recursive: true });
await waitForDevtools();

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const page = new Session(target.webSocketDebuggerUrl);
await page.ready;
await page.send('Page.enable');
await page.send('Runtime.enable');

const scrollToArticles = `(() => { const el = document.querySelector('#articles'); el && el.scrollIntoView(); window.scrollBy(0, 260); return 'ok'; })()`;
const hoverCard = `(() => { const c = document.querySelectorAll('.journal-card')[1]; c && c.classList.add('is-shot-hover'); return 'ok'; })()`;

await shoot(page, { name: '01-首页-1440-顶部', width: 1440, height: 900 });
await shoot(page, { name: '02-首页-1440-文章区', width: 1440, height: 900, action: scrollToArticles });
await shoot(page, { name: '03-首页-1440-文章区-暗色', width: 1440, height: 900, dark: true, action: scrollToArticles });
await shoot(page, { name: '04-首页-1280-文章区', width: 1280, height: 900, action: scrollToArticles });
await shoot(page, { name: '05-首页-1024-文章区', width: 1024, height: 900, action: scrollToArticles });
await shoot(page, { name: '06-首页-390-顶部', width: 390, height: 844 });
await shoot(page, { name: '07-首页-390-文章区', width: 390, height: 844, action: scrollToArticles });

chrome.kill();
console.log('输出目录：', OUT);
