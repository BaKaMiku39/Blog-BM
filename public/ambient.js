// 运动与透明度基于 樱花特效演示.html 调校：整体放慢，并加入淡入淡出 + 呼吸式明暗。
(async () => {
  const canvas = document.querySelector('.ambient-canvas');
  const context = canvas?.getContext('2d', { alpha: true });
  if (!context) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const config = {
    num: 21,
    sizeMin: 0.5, sizeMax: 1.1,
    opMin: 0.3,
    // 花瓣是高饱和实心色块（覆盖约 70%），雪花是淡青细线（覆盖 15-20%）。
    // 同一个上限会让 44px 的实心花瓣压住正文，而压太低又会让浅色底上的雪花直接消失，
    // 所以按种类分开：花瓣 0.62，雪花维持 0.9。
    opMaxPetal: 0.62, opMaxSnow: 0.9,
    // 约为参考参数的三分之一速度，飘落更慢
    vxMin: -0.55, vxMax: -0.38,
    vyMin: 0.45, vyMax: 0.75,
    rot: 0.01,
    // 生命周期（帧）与淡入 / 淡出占比
    lifeMin: 1400, lifeMax: 2600,
    fadeIn: 0.1, fadeOut: 0.28,
    twinkleMin: 0.12, twinkleMax: 0.3,
  };
  const images = Array.from({ length: 24 }, (_, index) => {
    const image = new Image();
    image.src = `/particles/${index < 12 ? 'petal' : 'snow'}-${String(index % 12 + 1).padStart(2, '0')}.png`;
    return image;
  });
  await Promise.all(images.map(image => image.decode().catch(() => {})));
  const available = images.filter(image => image.naturalWidth);
  if (!available.length) return;

  let width = innerWidth, height = innerHeight;
  let particles = [], animation = 0;
  const random = (min, max) => min + Math.random() * (max - min);
  // 深夜模式：23 点后粒子减半，夜里安静一点（粒子只在页面加载时定数）
  const nightHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const isNight = nightHour >= 23 || nightHour < 5;
  const particleCount = isNight ? Math.ceil(config.num / 2) : config.num;

  class Particle {
    constructor(index) {
      // Keep the current mix of petals and snow without altering motion randomness.
      // isSnow 必须在 reset() 之前定下来：reset 里要用它决定透明度上限，
      // 放后面会让第一代雪花拿到花瓣的上限，页面打开时先暗一截再跳亮。
      this.isSnow = index % 3 === 2;
      this.image = images[(index % 3 === 2 ? 12 : 0) + index % 12];
      if (!this.image.naturalWidth) this.image = available[0];
      this.reset(true);
    }

    reset(seed) {
      this.x = seed ? Math.random() * width : (Math.random() > 0.4 ? Math.random() * width : width);
      this.y = seed ? Math.random() * height : 0;
      this.s = random(config.sizeMin, config.sizeMax);
      this.r = Math.random() * 6;
      this.baseA = random(config.opMin, this.isSnow ? config.opMaxSnow : config.opMaxPetal);
      this.a = 0;
      this.life = random(config.lifeMin, config.lifeMax);
      this.age = seed ? Math.random() * this.life : 0;
      this.phase = Math.random() * Math.PI * 2;
      this.twinkle = random(config.twinkleMin, config.twinkleMax);
      this.vx = random(config.vxMin, config.vxMax);
      this.vy = random(config.vyMin, config.vyMax);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.r += config.rot;
      this.age += 1;
      // 出生淡入、消失前淡出，中间叠一层缓慢的呼吸
      const progress = Math.min(this.age / this.life, 1);
      const fadeIn = Math.min(progress / config.fadeIn, 1);
      const fadeOut = Math.min((1 - progress) / config.fadeOut, 1);
      const breathe = 1 - this.twinkle * (0.5 - 0.5 * Math.sin(this.phase + this.age * 0.011));
      this.a = this.baseA * fadeIn * fadeOut * breathe;
      if (this.x > width || this.x < 0 || this.y > height || this.y < 0 || this.age >= this.life) {
        this.reset(false);
      }
    }

    draw() {
      context.save();
      context.translate(this.x, this.y);
      context.rotate(this.r);
      context.globalAlpha = Math.max(this.a, 0);
      // The reference rotates artwork around its top-left corner, not its center.
      context.drawImage(this.image, 0, 0, 40 * this.s, 40 * this.s);
      context.restore();
    }
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop() {
    context.clearRect(0, 0, width, height);
    for (const particle of particles) { particle.update(); particle.draw(); }
    animation = requestAnimationFrame(loop);
  }

  function syncMotion() {
    cancelAnimationFrame(animation);
    context.clearRect(0, 0, width, height);
    if (!motion.matches && !document.hidden) loop();
  }
  resize();
  particles = Array.from({ length: particleCount }, (_, index) => new Particle(index));
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', syncMotion);
  motion.addEventListener('change', syncMotion);
  syncMotion();
})();
