// 时间名片的「节气 · 农历」：全部本地计算，不接任何 API。
// 农历交给 ICU 内置中文历（浏览器和 Node 的 full-icu 都支持），节气用太阳视黄经低精度算法（Meeus）。
const zone = 'Asia/Shanghai';

const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

// 黄经每 15° 一个节气，从春分 0° 起排
const TERMS = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
];

export function lunarLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    timeZone: zone,
    month: 'long',
    day: 'numeric',
  }).formatToParts(now);
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const month = pick('month');
  const rawDay = pick('day');
  const day = Number(rawDay);
  // ICU 新版直接给汉字日（廿五），旧版给数字，两种都接住
  const dayLabel = Number.isFinite(day) && day >= 1 ? LUNAR_DAYS[day - 1] ?? rawDay : rawDay;
  return `${month}${dayLabel}`;
}

// 太阳视黄经（Meeus 低精度，误差约 0.01°≈15 分钟，做展示够用）
function sunLongitude(jd: number): number {
  const T = (jd - 2_451_545) / 36_525;
  const rad = Math.PI / 180;
  const L0 = 280.46646 + 36_000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35_999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  return (((L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) % 360) + 360) % 360;
}

const jdOf = (date: Date) => date.getTime() / 86_400_000 + 2_440_587.5;

// 当前所处节气：黄经落在 [k·15°, (k+1)·15°) 就还在第 k 个节气里
export function solarTermLabel(now: Date = new Date()): string {
  return TERMS[Math.floor(sunLongitude(jdOf(now)) / 15) % 24];
}

export function almanacLabel(now: Date = new Date()): string {
  return `${solarTermLabel(now)} · ${lunarLabel(now)}`;
}
