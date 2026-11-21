// 白底贴图 → 透明贴图
// 思路：缩小到 1/3 去掉 JPEG 噪点 → 按彩度/明度认角色 → 填内部空洞 → 放大 → 外扩白边
import sharp from 'sharp';
import fs from 'node:fs/promises';

const SRC = 'data/stickers-src/miku-chibi.jpg';
const OUT = 'public/stickers/miku-chibi.webp';
const BORDER = 14;


// 取单通道灰度：PNG 可能是 1/3/4 通道，统一按步长取第一个通道
async function grayChannel(pngBuffer, sigma) {
  let pipe = sharp(pngBuffer).toColourspace('b-w');
  if (sigma) pipe = pipe.blur(sigma);
  const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return data;
  const out = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return out;
}

const full = sharp(SRC).ensureAlpha();
const meta = await full.metadata();
const W = meta.width, H = meta.height;
const N = W * H;

// 1) 小图算掩膜（抗噪）
const SW = Math.round(W / 3), SH = Math.round(H / 3);
const small = await sharp(SRC).resize(SW, SH).blur(1).ensureAlpha().raw().toBuffer();
const SN = SW * SH;
const isFigure = (i) => {
  const r = small[i], g = small[i + 1], b = small[i + 2];
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return sat > 34 || lum < 158;
};
const mask = new Uint8Array(SN);
for (let i = 0; i < SN; i++) mask[i] = isFigure(i * 4) ? 1 : 0;

// 2) 填洞：从边缘泛洪「非角色」，没淹到的空白即被角色包住的内部
const outside = new Uint8Array(SN);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  const idx = y * SW + x;
  if (outside[idx] || mask[idx]) return;
  outside[idx] = 1;
  stack.push(idx);
};
for (let x = 0; x < SW; x++) { push(x, 0); push(x, SH - 1); }
for (let y = 0; y < SH; y++) { push(0, y); push(SW - 1, y); }
while (stack.length) {
  const idx = stack.pop();
  const x = idx % SW, y = (idx - x) / SW;
  push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
}
let filled = 0;
for (let i = 0; i < SN; i++) if (!outside[i] && !mask[i]) { mask[i] = 1; filled++; }
console.log('holes filled', filled, 'of', SN);

// 3) 掩膜放大回原尺寸（最近邻，边缘稍后靠模糊柔化）
const maskBuf = Buffer.alloc(SN);
for (let i = 0; i < SN; i++) maskBuf[i] = mask[i] ? 255 : 0;
const maskPng = await sharp(maskBuf, { raw: { width: SW, height: SH, channels: 1 } })
  .resize(W, H, { kernel: 'nearest' })
  .png().toBuffer();
const maskRaw = await grayChannel(maskPng, 1);
const alpha = Buffer.alloc(N);
for (let i = 0; i < N; i++) alpha[i] = maskRaw[i] > 128 ? 255 : 0;

// 4) 外扩得到白边：模糊 + 低阈值
const blurred = await grayChannel(maskPng, BORDER / 2);
const halo = Buffer.alloc(N);
for (let i = 0; i < N; i++) {
  const a = blurred[i];
  halo[i] = a > 92 ? 255 : a > 16 ? Math.min(255, (a - 16) * 3.6) : 0;
}

// 5) 合成为 RGBA
const { data } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < N; i++) {
  const o = i * 4;
  const inside = alpha[i];
  const edge = halo[i];
  const a = Math.max(inside, edge);
  if (!a) continue;
  if (inside) {
    out[o] = data[o]; out[o + 1] = data[o + 1]; out[o + 2] = data[o + 2];
  } else {
    out[o] = 255; out[o + 1] = 255; out[o + 2] = 255;
  }
  out[o + 3] = a;
}

await fs.mkdir('public/stickers', { recursive: true });
const result = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .trim({ threshold: 1 })
  .resize({ width: 720, withoutEnlargement: true })
  .webp({ quality: 92, alphaQuality: 95 })
  .toFile(OUT);

console.log(OUT, result.width + 'x' + result.height, Math.round(result.size / 1024) + 'KB');
