/*
 * 本轮 7 条修改的核对脚本（沿用 home-shots 的 CDP 手法，不引依赖）。
 * 用法：node scripts/verify-polish.mjs        （默认打开发服 4321）
 * 输出：review-shots/polish-2/ ，并把关键盒模型尺寸打到控制台
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const BASE = process.env.SHOT_BASE || 'http://localhost:4321';
const OUT = path.join(ROOT, 'review-shots', 'polish-2');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9336;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'polish-shot-'));
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      const m = JSON.parse(event.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
        return;
      }
      this.listeners.get(m.method)?.forEach(fn => fn(m.params));
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
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text + ' ' + JSON.stringify(res.exceptionDetails.exception?.description || ''));
    return res.result.value;
  }
}

async function open(page, { width = 1440, height = 900, dark = false, url = BASE } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  await sleep(1000);
  // 站点开了 scroll-behavior: smooth，滚动没停就量坐标会量到动画中间态，hover 全打偏
  await page.evaluate(`document.documentElement.style.scrollBehavior = 'auto'; 'ok'`);
  if (dark) {
    await page.evaluate(`document.documentElement.dataset.theme='dark'`);
    await sleep(400);
  }
}

async function shot(page, name, clip) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!clip) {
    await fs.writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log('✓', name);
    return;
  }
  // CDP 的 clip 在滚动后的页面上不可靠（会落在文档坐标上），改成整屏抓 + 页内 canvas 裁
  const cropped = await page.evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${data}';
    await img.decode();
    const scale = img.width / window.innerWidth;
    const c = document.createElement('canvas');
    c.width = Math.round(${clip.width} * scale);
    c.height = Math.round(${clip.height} * scale);
    c.getContext('2d').drawImage(
      img,
      ${clip.x} * scale, ${clip.y} * scale, ${clip.width} * scale, ${clip.height} * scale,
      0, 0, c.width, c.height
    );
    return c.toDataURL('image/png').split(',')[1];
  })()`);
  await fs.writeFile(path.join(OUT, `${name}.png`), Buffer.from(cropped, 'base64'));
  console.log('✓', name);
}

const rectOf = selector => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
})()`;

const hoverAt = async (page, x, y) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
};

await fs.mkdir(OUT, { recursive: true });
await waitForDevtools();
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const page = new Session(target.webSocketDebuggerUrl);
await page.ready;
await page.send('Page.enable');
await page.send('Runtime.enable');

// ---- 1. 1440 首屏 ----
await open(page, { width: 1440, height: 900 });
await shot(page, '01-首屏-1440');

// ---- 2. 1440 文章区（浅色）----
await page.evaluate(`document.querySelector('#articles').scrollIntoView(); window.scrollBy(0, 300); 'ok'`);
await sleep(1200);
await shot(page, '02-文章区-1440');
console.log('盒模型：', JSON.stringify(await page.evaluate(`(() => {
  const r = s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  return {
    bgm: r('.bgm'),
    dayCard: r('.day-card'),
    dayArt: r('.day-card__art'),
    statsSidebar: !!document.querySelector('.sidebar .site-stats'),
    statsProfile: !!document.querySelector('.profile-column .site-stats'),
    welcomeTitle: document.querySelector('.profile-column .widget-title')?.textContent?.trim(),
    fortunePaper: r('.fortune__paper'),
    columns: [...document.querySelectorAll('.home-grid > *')].map(el => el.className.split(' ')[0]),
    overflowX: { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth },
  };
})()`), null, 2));

// ---- 3. 播放器特写（浮动态 + 吸附态）----
const bgmRect = await page.evaluate(rectOf('.bgm'));
if (bgmRect) await shot(page, '03-播放器-窗口右下', { x: Math.max(0, bgmRect.x - 14), y: Math.max(0, bgmRect.y - 14), width: bgmRect.width + 28, height: bgmRect.height + 28 });

await page.evaluate(`document.querySelector('[data-bgm-slot]').scrollIntoView({ block: 'center' }); 'ok'`);
await sleep(1400);
const bgmDocked = await page.evaluate(rectOf('.bgm'));
if (bgmDocked) await shot(page, '04-播放器-吸附侧栏', { x: Math.max(0, bgmDocked.x - 12), y: Math.max(0, bgmDocked.y - 12), width: bgmDocked.width + 24, height: bgmDocked.height + 24 });

// ---- 4. 时间名片：静置 + 悬停（反光扫过中）----
await page.evaluate(`window.scrollTo(0, 0); 'ok'`);
await sleep(600);
await page.evaluate(`document.querySelector('.day-card').scrollIntoView({ block: 'center' }); 'ok'`);
await sleep(800);
const dayRect = await page.evaluate(rectOf('.day-card'));
if (dayRect) {
  await shot(page, '05-时间名片-静置', { x: Math.max(0, dayRect.x - 10), y: Math.max(0, dayRect.y - 10), width: dayRect.width + 20, height: dayRect.height + 20 });
  await hoverAt(page, dayRect.x + dayRect.width / 2, dayRect.y + dayRect.height * 0.75);
  await sleep(300);
  console.log('day-card hover:', await page.evaluate(`!!document.querySelector('.day-card:hover')`), 'sheen:', await page.evaluate(`getComputedStyle(document.querySelector('.day-card__art-sheen')).opacity`));
  await shot(page, '06-时间名片-悬停反光', { x: Math.max(0, dayRect.x - 10), y: Math.max(0, dayRect.y - 10), width: dayRect.width + 20, height: dayRect.height + 20 });
  await hoverAt(page, 5, 5);
}

// ---- 5. 文章卡封面：同分类两张 + 另外两个分类（逐张滚进视野再裁封面）----
for (let i = 0; i < 4; i += 1) {
  await page.evaluate(`document.querySelectorAll('.journal-card')[${i}].scrollIntoView({ block: 'center' }); 'ok'`);
  await sleep(500);
  const r = await page.evaluate(`(() => { const el = document.querySelectorAll('.journal-card')[${i}]; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width }; })()`);
  await shot(page, `0${7 + i}-文章卡封面${i + 1}`, { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: Math.round(r.width * 9 / 16) + 12 });
}
// 悬停封面（反光扫过）
await page.evaluate(`document.querySelectorAll('.journal-card')[0].scrollIntoView({ block: 'center' }); 'ok'`);
await sleep(500);
const first = await page.evaluate(`(() => { const b = document.querySelectorAll('.journal-card')[0].getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width }; })()`);
await hoverAt(page, first.x + first.width / 2, first.y + first.width * 0.28);
await sleep(300);
console.log('card hover:', await page.evaluate(`!!document.querySelector('.journal-card:hover')`), 'sheen:', await page.evaluate(`getComputedStyle(document.querySelector('.journal-card__art-sheen')).transform`));
await shot(page, '11-文章卡-悬停反光', { x: Math.max(0, first.x - 4), y: Math.max(0, first.y - 4), width: first.width + 8, height: Math.round(first.width * 9 / 16) + 12 });
await hoverAt(page, 5, 5);

// ---- 6. 暗色 1440 ----
await open(page, { width: 1440, height: 900, dark: true });
await page.evaluate(`document.querySelector('#articles').scrollIntoView(); window.scrollBy(0, 300); 'ok'`);
await sleep(1200);
await shot(page, '12-文章区-1440-暗色');

// ---- 6.35 顶栏标识（浅色 + 暗色各一张）----
await page.evaluate(`document.documentElement.dataset.theme='light'; window.scrollTo(0, 0); 'ok'`);
await sleep(500);
const brandLight = await page.evaluate(`(() => { const b = document.querySelector('.brand').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
await shot(page, '16-顶栏标识-浅色', { x: Math.max(0, brandLight.x - 12), y: Math.max(0, brandLight.y - 10), width: brandLight.width + 32, height: brandLight.height + 22 });
await page.evaluate(`document.documentElement.dataset.theme='dark'`);
await sleep(500);
await shot(page, '17-顶栏标识-暗色', { x: Math.max(0, brandLight.x - 12), y: Math.max(0, brandLight.y - 10), width: brandLight.width + 32, height: brandLight.height + 22 });
await page.evaluate(`document.documentElement.dataset.theme='light'`);
await sleep(200);

// ---- 6.4 欢迎卡 ----
await page.evaluate(`document.querySelector('.welcome-card').scrollIntoView({ block: 'center' }); 'ok'`);
await sleep(600);
const welcomeRect = await page.evaluate(`(() => { const b = document.querySelector('.welcome-card').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
await shot(page, '15-欢迎卡', { x: Math.max(0, welcomeRect.x - 10), y: Math.max(0, welcomeRect.y - 10), width: welcomeRect.width + 20, height: welcomeRect.height + 20 });

// ---- 6.5 指定文章的真实封面（把站点搬到一台很小的服务器上）----
await open(page, { width: 1440, height: 900 });
await page.evaluate(`location.href = '/articles'`);
await sleep(1600);
const coverCard = await page.evaluate(`(() => {
  const link = document.querySelector('a[href="/posts/deploying-to-a-small-server"]');
  if (!link) return null;
  link.scrollIntoView({ block: 'center' });
  return 'ok';
})()`);
await sleep(700);
const coverRect = await page.evaluate(`(() => {
  const link = document.querySelector('a[href="/posts/deploying-to-a-small-server"]');
  const b = link.closest('.journal-card').getBoundingClientRect();
  return { x: b.x, y: b.y, width: b.width, height: b.height };
})()`);
if (coverCard && coverRect) {
  await shot(page, '14-指定封面-服务器文章', { x: Math.max(0, coverRect.x - 4), y: Math.max(0, coverRect.y - 4), width: coverRect.width + 8, height: coverRect.height + 8 });
}

// ---- 7. 移动端 ----
await open(page, { width: 390, height: 844 });
await page.evaluate(`document.querySelector('#articles').scrollIntoView(); window.scrollBy(0, 240); 'ok'`);
await sleep(1000);
await shot(page, '13-文章区-390');

chrome.kill();
console.log('输出目录：', OUT);
