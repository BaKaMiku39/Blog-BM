/* 临时：截页脚备案行，验证居中与链接样式 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4400';
const OUT = path.join(process.cwd(), 'review-shots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9339;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'footer-shot-'));
spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=2', '--proxy-server=direct://', '--proxy-bypass-list=*', 'about:blank'], { stdio: 'ignore' });

for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {}
  await sleep(250);
}

class S {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.p = new Map();
    this.ready = new Promise(r => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) {
        const { resolve, reject } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.p.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const page = new S(t.webSocketDebuggerUrl);
await page.ready;
await page.send('Page.enable'); await page.send('Runtime.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
await page.send('Page.navigate', { url: `${BASE}/` });
await sleep(3000);
await page.send('Runtime.evaluate', { expression: `window.scrollTo(0, document.body.scrollHeight)` });
await sleep(800);

const r = await page.send('Runtime.evaluate', {
  expression: `(() => { const f = document.querySelector('.site-footer'); const b = f.getBoundingClientRect();
    return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; })()`, returnByValue: true,
});
const v = r.result.value;
const { data } = await page.send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { x: v.x, y: v.y, width: v.w, height: v.h, scale: 2 },
});
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'footer-legal.png'), Buffer.from(data, 'base64'));
console.log('✓ review-shots/footer-legal.png', Math.round(v.w), Math.round(v.h));
process.exit(0);
