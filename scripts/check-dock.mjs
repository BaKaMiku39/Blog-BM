/* 检查「槽位露出来之后播放器有没有归位」 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9341;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dock-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable'); await send('Runtime.enable');
for (const [w, h, off] of [[1280, 800, 95], [1440, 900, 95], [1280, 800, 40], [1024, 720, 95]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4321' });
  await sleep(2200);
  await ev(`document.documentElement.style.scrollBehavior='auto'`);
  // 把槽位顶端滚到「视口底 - 70」，模拟用户截图里那个位置
  await ev(`(() => { const s = document.querySelector('[data-bgm-slot]'); window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - (window.innerHeight - ${off})); return 'ok'; })()`);
  await sleep(900);
  const r = await ev(`(() => {
    const slot = document.querySelector('[data-bgm-slot]').getBoundingClientRect();
    const bgm = document.querySelector('.bgm');
    return {
      vh: window.innerHeight,
      slotTop: Math.round(slot.top),
      docked: bgm.classList.contains('is-docked'),
      bgmH: bgm.offsetHeight,
      bgmTop: Math.round(bgm.getBoundingClientRect().top),
    };
  })()`);
  console.log(`${w}x${h} 槽位差 ${off}px`, JSON.stringify(r));
}
chrome.kill();
