// 首页彩蛋：连点 logo 五次 → 从 logo 位置炸出一把花瓣。
// 只在首页生效；点 logo 本来就不需要跳转，所以顺手接管成「回到顶部」。
const sprites = Array.from({ length: 12 }, (_, index) => `/particles/petal-${String(index + 1).padStart(2, '0')}.png`);

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  s: number;
  life: number;
  age: number;
  img: HTMLImageElement;
};

async function burst(anchor: HTMLElement) {
  const box = anchor.getBoundingClientRect();
  const originX = box.left + box.width / 2;
  const originY = box.top + Math.min(box.height / 2, 22);

  const loaded = await Promise.all(sprites.map(src => new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  })));
  const ready = loaded.filter((image): image is HTMLImageElement => Boolean(image));
  if (!ready.length) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '70',
  });
  document.body.append(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext('2d');
  if (!context) {
    canvas.remove();
    return;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const petals: Petal[] = Array.from({ length: 20 }, (_, index) => {
    // logo 贴着视口上沿，往上炸一半会飞出屏幕；改成向下半圆散开，像从 logo 里洒出来
    const angle = (0.12 + Math.random() * 0.76) * Math.PI;
    const speed = 2.6 + Math.random() * 4;
    const spread = 2 + Math.random() * 12;
    return {
      x: originX + Math.cos(angle) * spread,
      y: originY + Math.sin(angle) * spread,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.22,
      s: 0.45 + Math.random() * 0.55,
      life: 76 + Math.random() * 38,
      age: 0,
      img: ready[index % ready.length],
    };
  });

  const step = () => {
    context.clearRect(0, 0, width, height);
    let alive = false;
    for (const petal of petals) {
      petal.age += 1;
      if (petal.age > petal.life) continue;
      alive = true;
      petal.vy += 0.095;
      petal.vx *= 0.988;
      petal.x += petal.vx;
      petal.y += petal.vy;
      petal.r += petal.vr;
      context.save();
      context.globalAlpha = Math.min(petal.age / 5, 1) * Math.min((petal.life - petal.age) / 24, 1);
      context.translate(petal.x, petal.y);
      context.rotate(petal.r);
      const size = 40 * petal.s;
      context.drawImage(petal.img, -size / 2, -size / 2, size, size);
      context.restore();
    }
    if (!alive) {
      canvas.remove();
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function initCelebrate() {
  const brand = document.querySelector<HTMLAnchorElement>('.brand');
  if (!brand || !document.body.classList.contains('home-page')) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hits: number[] = [];

  brand.addEventListener('click', event => {
    // 留出新标签页 / 新窗口的原生行为
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });

    const now = performance.now();
    hits = hits.filter(time => now - time < 2000);
    hits.push(now);
    if (hits.length < 5) return;
    hits = [];
    if (!reduce.matches) void burst(brand);
  });
}
