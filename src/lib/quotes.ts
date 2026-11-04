// 今日一句：本地句库，按日期轮换（和 clock.ts 的晚安语同一个思路），不接 API。
export type Quote = { text: string; from: string };

const QUOTES: Quote[] = [
  { text: '千里之行，始于足下。', from: '《道德经》' },
  { text: '知人者智，自知者明。', from: '《道德经》' },
  { text: '上善若水，水善利万物而不争。', from: '《道德经》' },
  { text: '天行健，君子以自强不息。', from: '《周易》' },
  { text: '学而时习之，不亦说乎？', from: '《论语》' },
  { text: '三人行，必有我师焉。', from: '《论语》' },
  { text: '士不可以不弘毅，任重而道远。', from: '《论语》' },
  { text: '穷则独善其身，达则兼济天下。', from: '《孟子》' },
  { text: '路漫漫其修远兮，吾将上下而求索。', from: '《离骚》' },
  { text: '亦余心之所善兮，虽九死其犹未悔。', from: '《离骚》' },
  { text: '尺有所短，寸有所长。', from: '《楚辞·卜居》' },
  { text: '非淡泊无以明志，非宁静无以致远。', from: '《诫子书》' },
  { text: '采菊东篱下，悠然见南山。', from: '陶渊明《饮酒》' },
  { text: '海内存知己，天涯若比邻。', from: '王勃《送杜少府》' },
  { text: '长风破浪会有时，直挂云帆济沧海。', from: '李白《行路难》' },
  { text: '天生我材必有用，千金散尽还复来。', from: '李白《将进酒》' },
  { text: '会当凌绝顶，一览众山小。', from: '杜甫《望岳》' },
  { text: '山重水复疑无路，柳暗花明又一村。', from: '陆游《游山西村》' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', from: '陆游《冬夜读书》' },
  { text: '沉舟侧畔千帆过，病树前头万木春。', from: '刘禹锡' },
  { text: '谁怕？一蓑烟雨任平生。', from: '苏轼《定风波》' },
  { text: '人间有味是清欢。', from: '苏轼《浣溪沙》' },
  { text: '但愿人长久，千里共婵娟。', from: '苏轼《水调歌头》' },
  { text: '人生如逆旅，我亦是行人。', from: '苏轼《临江仙》' },
  { text: '众里寻他千百度，蓦然回首，那人却在灯火阑珊处。', from: '辛弃疾《青玉案》' },
  { text: '春眠不觉晓，处处闻啼鸟。', from: '孟浩然《春晓》' },
  { text: '千磨万击还坚劲，任尔东西南北风。', from: '郑燮《竹石》' },
  { text: '落红不是无情物，化作春泥更护花。', from: '龚自珍' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', from: '《警世贤文》' },
  { text: '读书百遍，而义自见。', from: '《三国志》注引' },
  { text: '少壮不努力，老大徒伤悲。', from: '《长歌行》' },
  { text: '明日复明日，明日何其多。', from: '《明日歌》' },
  { text: '岁月不居，时节如流。', from: '孔融《论盛孝章书》' },
  { text: '精诚所至，金石为开。', from: '《后汉书》' },
  { text: '亡羊而补牢，未为迟也。', from: '《战国策》' },
  { text: '近朱者赤，近墨者黑。', from: '《太子少傅箴》' },
];

const zone = 'Asia/Shanghai';

export function quoteOfTheDay(now: Date = new Date()): Quote {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, month: '2-digit', day: '2-digit' }).formatToParts(now);
  const pick = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  const seed = pick('month') * 31 + pick('day');
  return QUOTES[seed % QUOTES.length];
}
