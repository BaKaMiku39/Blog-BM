// 时间名片的唯一数据源：服务端首屏和浏览器每分钟刷新都走这里，避免两套逻辑算出不同的字。
const zone = 'Asia/Shanghai';

// 半天一套话，别在下午三点说「别熬太晚」
const tails = {
  morning: ['今天也慢慢来', '先喝口水吧', '不着急，一件一件来'],
  noon: ['继续加油！', '记得吃点什么', '慢慢来，比较快'],
  evening: ['今天也辛苦了', '记得吃晚饭', '早点休息'],
  night: ['别熬太晚', '该睡了', '明天再说'],
};

export type Clock = {
  time: string;
  weekday: string;
  date: string;
  hour: number;
  greeting: string;
  line: string;
};

function greetingOf(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 8) return '早上好';
  if (hour < 11) return '上午好';
  if (hour < 13) return '中午好';
  if (hour < 17) return '下午好';
  if (hour < 19) return '傍晚好';
  if (hour < 23) return '晚上好';
  return '夜深了';
}

function pickTail(hour: number, seed: number): string {
  const period = hour < 5 || hour >= 23 ? 'night'
    : hour < 11 ? 'morning'
      : hour < 17 ? 'noon'
        : 'evening';
  const list = tails[period];
  return list[seed % list.length];
}

export function readClock(now: Date = new Date()): Clock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const hour = Number(pick('hour'));
  const month = pick('month');
  const day = pick('day');
  // 每天固定一句，同一天刷新不会跳来跳去
  const seed = Number(month) * 31 + Number(day);

  return {
    time: `${pick('hour')}:${pick('minute')}`,
    weekday: pick('weekday').toUpperCase(),
    date: `${month}/${day}`,
    hour,
    greeting: greetingOf(hour),
    line: pickTail(hour, seed),
  };
}
