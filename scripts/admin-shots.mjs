/*
 * 后台改版的截图核对脚本。
 * 用系统 Chrome 的 CDP 直接截图，不引额外依赖。
 * 用法：node scripts/admin-shots.mjs
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = process.env.SHOT_BASE || 'http://localhost:4400';
const OUT = path.join(ROOT, 'review-shots', 'admin-redesign-v2');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

const envText = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));

const cookieName = env.ADMIN_COOKIE_NAME || 'bakamiku_admin';
const expires = String(Date.now() + 7 * 24 * 3600 * 1000);
const mac = crypto.createHmac('sha256', env.SESSION_SECRET).update(expires).digest('hex');
const cookieValue = `${expires}.${mac}`;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'adm-shot-'));
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

async function shoot(page, { name, width, height, dark = false, action }) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 768,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
  });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: `${BASE}/admin` });
  await loaded;
  await sleep(1100);
  if (action) {
    await page.send('Runtime.evaluate', { expression: action, awaitPromise: true });
    await sleep(700);
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
await page.send('Network.enable');
await page.send('Network.setCookie', {
  name: cookieName, value: cookieValue, url: BASE, path: '/', httpOnly: true, sameSite: 'Strict',
});

const pickPublished = `(() => {
  const items = [...document.querySelectorAll('.adm-item')];
  const target = items.find(item => /已发布/.test(item.textContent));
  if (!target) return 'no published post';
  target.click();
  return 'clicked';
})()`;

await shoot(page, { name: '01-编辑器-草稿-1440', width: 1440, height: 900 });
await shoot(page, { name: '02-编辑器-已发布-1440', width: 1440, height: 900, action: pickPublished });
await shoot(page, {
  name: '03-预览-1440', width: 1440, height: 900,
  action: `${pickPublished}; setTimeout(() => document.querySelector('.adm-tab[data-view="preview"]').click(), 300)`,
});
await shoot(page, { name: '04-暗色-1440', width: 1440, height: 900, dark: true, action: pickPublished });
await shoot(page, { name: '05-暗色-空态-1440', width: 1440, height: 900, dark: true });
await shoot(page, { name: '06-1280', width: 1280, height: 800, action: pickPublished });
await shoot(page, { name: '07-1024', width: 1024, height: 800, action: pickPublished });
await shoot(page, { name: '08-768', width: 768, height: 900, action: pickPublished });
await shoot(page, { name: '09-手机-写作-390', width: 390, height: 844, action: pickPublished });
await shoot(page, {
  name: '10-手机-列表-390', width: 390, height: 844,
  action: `document.querySelector('[data-view="list"]:not(.adm-tab)')?.click()`,
});
await shoot(page, {
  name: '11-保存中-1440', width: 1440, height: 900,
  action: `(() => { document.getElementById('shell').classList.add('is-busy'); document.getElementById('save-status').textContent='正在保存…'; document.getElementById('save-status').dataset.state='busy'; const b=document.getElementById('save-post'); b.dataset.busy='true'; b.innerHTML='<span class="adm-spin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></span>保存中…'; })()`,
});

await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
chrome.kill();
console.log('done');
process.exit(0);
