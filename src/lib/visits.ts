// 访问统计：自建计数，不用第三方脚本。
// 数据落在本站 data/visits.json（发版不碰 data/，重启最多丢 30 秒的计数）。
// 隐私：不存 IP 原文，只存 sha256(ip+ua+盐) 的前 16 位，用于去重。
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config';

const file = path.join(process.cwd(), 'data', 'visits.json');
const zone = config.env.runtime.timezone;
const SALT = config.env.auth.sessionSecret || 'bakamiku-visits';

type State = {
  date: string;
  todayPv: number;
  todayUv: Set<string>;
  totalPv: number;
  totalUv: Set<string>;
};

let state: State | null = null;
let dirty = false;

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date());

function roll(s: State) {
  const day = today();
  if (s.date !== day) {
    s.date = day;
    s.todayPv = 0;
    s.todayUv.clear();
    dirty = true;
  }
}

function load(): State {
  if (state) return state;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    state = {
      date: String(raw.date || today()),
      todayPv: Number(raw.todayPv) || 0,
      todayUv: new Set(Array.isArray(raw.todayUv) ? raw.todayUv : []),
      totalPv: Number(raw.totalPv) || 0,
      totalUv: new Set(Array.isArray(raw.totalUv) ? raw.totalUv : []),
    };
  } catch {
    state = { date: today(), todayPv: 0, todayUv: new Set(), totalPv: 0, totalUv: new Set() };
  }
  roll(state);
  return state;
}

function save() {
  if (!state || !dirty) return;
  dirty = false;
  const data = {
    date: state.date,
    todayPv: state.todayPv,
    todayUv: [...state.todayUv].slice(-5000),
    totalPv: state.totalPv,
    totalUv: [...state.totalUv].slice(-20000),
  };
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  } catch {}
}

// 跨日翻牌 + 定时落盘；退出时也补一次
setInterval(save, 30_000).unref();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { save(); process.exit(0); });
}

export function recordVisit(ip = '', ua = '') {
  // 爬虫不记；后台页面在调用处过滤
  if (/bot|crawler|spider|slurp|preview/i.test(ua)) return;
  const s = load();
  roll(s);
  const hash = createHash('sha256').update(`${ip}|${ua}|${SALT}`).digest('hex').slice(0, 16);
  s.todayPv += 1;
  s.totalPv += 1;
  s.todayUv.add(hash);
  s.totalUv.add(hash);
  dirty = true;
}

export function visitStats() {
  const s = load();
  roll(s);
  const fmt = (n: number) => n.toLocaleString('zh-CN');
  // 建站日：上线当天算第 1 天，改这里即可
  const SITE_BIRTH = '2026-10-22T00:00:00+08:00';
  const runningDays = Math.max(1, Math.floor((Date.now() - Date.parse(SITE_BIRTH)) / 86_400_000) + 1);
  return {
    todayVisitors: fmt(s.todayUv.size),
    todayViews: fmt(s.todayPv),
    totalVisitors: fmt(s.totalUv.size),
    totalViews: fmt(s.totalPv),
    runningDays: fmt(runningDays),
  };
}
