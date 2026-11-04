// 把 assets/day-art/ 里的原图切成时间名片用的小图：16:9 居中裁切 → 1120×630 webp
// 用法：node scripts/build-day-art.mjs
// 如果原图顶部带了 Wallpaper Engine 的 FPS/CPU 监控条，用 DAY_ART_CROP=54 再跑一次
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = path.resolve('assets/day-art');
const OUT = path.resolve('public/images/day-card');
const W = 1120;
const H = 630;
const CROP_TOP = Number(process.env.DAY_ART_CROP || 0);

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();

let i = 0;
for (const file of files) {
  i += 1;
  const input = path.join(SRC, file);
  const meta = await sharp(input).metadata();
  const top = Math.min(CROP_TOP, (meta.height ?? 0) - H);
  const out = path.join(OUT, `day-${String(i).padStart(2, '0')}.webp`);
  await sharp(input)
    .extract({ left: 0, top, width: meta.width, height: meta.height - top })
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 5 })
    .toFile(out);
  console.log(`${file} ${meta.width}x${meta.height} -top${top} -> ${path.relative(process.cwd(), out)}`);
}
console.log(`共 ${i} 张`);
