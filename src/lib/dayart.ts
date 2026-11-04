// 时间名片的插画：每次页面加载随机挑一张（2026-11-04 按用户要求从「按日期轮换」改成随机）。
// 想固定一张就把数组删到只剩一条。
const ART = [
  '/images/day-card/day-01.webp',
  '/images/day-card/day-02.webp',
  '/images/day-card/day-03.webp',
  '/images/day-card/day-04.webp',
  '/images/day-card/day-05.webp',
  '/images/day-card/day-06.webp',
  '/images/day-card/day-07.webp',
  '/images/day-card/day-08.webp',
];

export function dayArtOfTheDay(): string {
  return ART[Math.floor(Math.random() * ART.length)];
}
