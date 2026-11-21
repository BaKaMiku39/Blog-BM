// 临时脚本：按滚动位置截图
// 用法: node .tmp-shot.mjs <url> <out> <width> <height> <scrollY> <dark|light>
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const [, , url, out, w, h, sy, theme] = process.argv;
const width = Number(w || 1440);
const height = Number(h || 900);
const scrollY = Number(sy || 0);
const port = 9343;

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-proxy-server',
  `--remote-debugging-port=${port}`, '--user-data-dir=' + process.cwd() + '/review-shots/.chrome-shot',
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise(resolve => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme || 'light' }] });
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
await send('Page.navigate', { url });
await sleep(2800);
if (scrollY) {
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollY})` });
  await sleep(1200);
}
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
await fs.writeFile(out, Buffer.from(shot.result.data, 'base64'));
console.log('shot ->', out, `${width}x${height} y=${scrollY}`);

const probe = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const pick = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.top + window.scrollY), h: Math.round(r.height), w: Math.round(r.width) }; };
    return { hero: pick('.hero'), articles: pick('.post-list, .home-posts, main .posts, main section'), docH: document.body.scrollHeight };
  })()`
});
console.log(JSON.stringify(probe.result?.result?.value));

ws.close();
chrome.kill();
process.exit(0);
