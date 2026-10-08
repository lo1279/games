/**
 * 金光粒子系统 · Canvas 2D（路径 B）
 *
 * 为什么需要它：原版《三国志·战略版》的金光来自 3D 粒子引擎 + Shader + 加色混合 +
 * Bloom 后处理。纯 CSS 只能画"形"，画不出"能量叠加"与"光溢出"。
 *
 * 本模块用 Canvas 2D 逼近原版观感，核心是三件事CSS 做不到：
 *   ① 真加色混合 —— globalCompositeOperation = 'lighter'，
 *      粒子重叠处亮度累积（CSS 的 screen 只是近似，且在 3D 容器内会失效）；
 *   ② 廉价 Bloom —— 降到 1/4 分辨率离屏 canvas 接收全部粒子 → ctx.filter 模糊
 *      → 放大画回主canvas。视觉效果等价于"亮部向四周溢出光晕"，
 *      是真 Bloom（三级降采样）的高性价比替代；
 *   ③ 逐帧物理 —— 速度/重力/阻力/湍流噪声每帧积分，轨迹不可预设。
 *
 * 设计约束：零依赖、单一职责、无状态泄漏（关闭浮层时务必调用 stop()）。
 */

/** 单个粒子的最大存活帧数（60fps 下约 2.4 秒），超过则强制回收 */
const MAX_PARTICLE_AGE = 150;

/** Bloom 降采样倍率：4 表示用 1/16 面积的离屏 canvas 做模糊，兼顾质量与性能 */
const BLOOM_DOWNSCALE = 4;

/** Bloom 视觉模糊半径（主画布坐标系下的 px），实际下采样后再除以倍率应用 */
const BLOOM_BLUR_PX = 9;

/**
 * 二维值噪声：用于湍流扰动。
 * 不做真正的 Perlin，用「相邻整数格点的 sin 插值」已足够，
 * 因为粒子高速运动下人眼无法分辨噪声的连续性细节。
 */
function noise2(x, y, t) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // smoothstep 插值权重，避免线性插值的折角感
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n = (i, j) => Math.sin(i * 127.1 + j * 311.7 + t * 2.3) * 43758.5453;
  const v = n(ix, iy);
  const v1 = n(ix + 1, iy);
  const v2 = n(ix, iy + 1);
  const v3 = n(ix + 1, iy + 1);
  const top = v + (v1 - v) * ux;
  const bottom = v2 + (v3 - v2) * ux;
  return (top + (bottom - top) * uy) * 2 - 1; // 归一化到 [-1, 1]
}

export class GoldFX {
  constructor() {
    /** @type {HTMLCanvasElement|null} 主画布（覆盖整个抽卡浮层） */
    this.canvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = null;
    /** @type {HTMLCanvasElement|null} Bloom 用的低分辨率离屏画布（接收粒子） */
    this.bloomCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.bloomCtx = null;
    /**
     * Bloom 第二块离屏（模糊结果落点）。
     * 必须与 bloomCanvas 分开：drawImage 到自身在部分移动端内核上不可靠。
     * @type {HTMLCanvasElement|null}
     */
    this.bloomDst = null;
    /** @type {CanvasRenderingContext2D|null} */
    this.bloomDstCtx = null;

    /** @type {Array<Object>} 活跃粒子池 */
    this.particles = [];
    /** @type {number|null} requestAnimationFrame 句柄 */
    this.rafId = null;
    /** @type {number} 上一次帧时间戳（ms），用于计算真实 dt */
    this.lastTime = 0;
    /** @type {number} dpr 设备像素比，1 表示未初始化过 */
    this.dpr = 1;
    /** @type {boolean} 是否尊重系统「减弱动效」偏好 */
    this.reducedMotion = false;
    /**
     * 粒子数上限：低端机上同时几百个 lighter 混合会掉帧。
     * 超出后新粒子直接丢弃（而非无限增长导致卡死）。
     */
    this.maxParticles = 260;
  }

  /**
   * 在指定容器内挂载画布并启动。
   * @param {HTMLElement} container 覆盖层容器（通常是 .gacha-showcase-mask）
   */
  mount(container) {
    if (!container) return;
    // 重复调用时先销毁旧画布，避免叠加多层画布导致叠加混合失控
    this.unmount();

    const canvas = document.createElement('canvas');
    canvas.className = 'gold-fx-canvas';
    canvas.setAttribute('aria-hidden', 'true'); // 纯装饰层，读屏器跳过
    this.applySize(canvas, container);

    this.bloomCanvas = document.createElement('canvas');
    this.applySize(this.bloomCanvas, container, true);
    this.bloomDst = document.createElement('canvas');
    this.applySize(this.bloomDst, container, true);

    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bloomCtx = this.bloomCanvas.getContext('2d');
    this.bloomDstCtx = this.bloomDst.getContext('2d');

    // reduced-motion 下不跑动画，但保留一次静态绘制，
    // 保证「出金」依然有视觉标识（对应 CSS 层的无障碍降级策略）
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 画布像素尺寸不会随 CSS 尺寸自动变化，窗口旋转/缩放后必须手动重设，
    // 否则 canvas 会被拉伸变形。这里做 120ms 节流，避免拖拽窗口时疯狂重分配内存。
    if (!this.resizeHandler) {
      this.resizeHandler = () => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          if (!this.canvas) return; // 已卸载
          const host = this.canvas.parentElement;
          this.applySize(this.canvas, host);
          this.applySize(this.bloomCanvas, host, true);
          this.applySize(this.bloomDst, host, true);
        }, 120);
      };
      window.addEventListener('resize', this.resizeHandler);
    }

    this.lastTime = 0;
    this.start();
  }

  /**
   * 尺寸同步。挂载时与窗口 resize 时都要调用。
   * @param {boolean} isBloom true 表示这是低分辨率离屏画布
   */
  applySize(canvas, container, isBloom = false) {
    const rect = container.getBoundingClientRect();
    // 上限压到 2：高 dpr 屏上 3x 会让 fillRect 的像素填充率翻 9 倍，收益递减
    const dpr = isBloom ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    if (isBloom) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    } else {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.dpr = dpr;
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
    }
  }

  /** 启动主循环 */
  start() {
    if (this.rafId !== null) return;
    this.lastTime = 0;
    const loop = (now) => {
      // 首帧没有上一帧时间戳，用 16.7ms 兜底，避免 dt 突然变成巨大值
      const dt = this.lastTime ? Math.min(48, now - this.lastTime) : 16.7;
      this.lastTime = now;
      this.step(dt / 16.667); // 归一化为「帧」单位，便于写帧数常量
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** 销毁画布并停止循环。关闭浮层时必须调用，否则 RAF 永久占用。 */
  unmount() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.bloomCtx = null;
    this.bloomDstCtx = null;
    this.particles.length = 0;
  }

  /**
   * 推进一帧。
   * @param {number} f 帧数单位（1.0 ≈ 60fps 下的 1 帧）
   */
  step(f) {
    const ctx = this.ctx;
    if (!ctx) return;

    // 全屏清屏。lighter 混合下必须每帧清，否则亮度会累积到过曝
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const bctx = this.bloomCtx;
    if (bctx) {
      bctx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
    }

    const dpr = this.dpr;
    const particles = this.particles;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += f;
      if (p.age > p.life) {
        // 倒序删除，避免 splice 的 O(n) 搬移开销
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }

      p.turbX = noise2(p.x * 0.012, p.y * 0.012, p.seed);
      p.turbY = noise2(p.x * 0.012 + 31.7, p.y * 0.012, p.seed);

      // 物理积分：重力 + 阻力 + 湍流。加速度单位为 px/帧²
      p.vx += p.turbX * p.turbStrength;
      p.vy += (p.gravity + p.turbY * p.turbStrength) * f;
      // 空气阻力：乘性衰减，速度越小阻力影响越弱，避免粒子无限缓慢漂移
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * f;
      p.y += p.vy * f;

      // 生命周期归一化进度：0=出生，1=消亡
      const t = p.age / p.life;
      // 亮度包络：快速升起后缓慢衰减，比线性淡出更接近火花的真实观感
      const envelope = t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6);
      p.alpha = envelope;

      this.drawParticle(ctx, bctx, p, dpr, f);
    }

    if (bctx) this.compositeBloom(ctx);
  }

  /**
   * 绘制单个粒子到主画布与 Bloom 离屏画布。
   * 两者都画是因为真Bloom 的输入就是"亮度图"，直接复用主画布的绘制结果。
   */
  drawParticle(ctx, bctx, p, dpr, f) {
    const x = p.x * dpr;
    const y = p.y * dpr;
    const r = p.size * dpr;

    ctx.globalCompositeOperation = 'lighter';
    // 多层叠加模拟体积感：中心近白、主体金色、外圈暗金
    ctx.fillStyle = `rgba(255, 250, 232, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 205, 90, ${p.alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(217, 130, 20, ${p.alpha * 0.28})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    if (bctx) {
      // Bloom 源只画最亮的核心层，避免把外圈暗金也纳入模糊导致泛光发灰
      const scale = dpr / BLOOM_DOWNSCALE;
      bctx.globalCompositeOperation = 'lighter';
      bctx.fillStyle = `rgba(255, 248, 226, ${p.alpha})`;
      bctx.beginPath();
      bctx.arc(x / BLOOM_DOWNSCALE, y / BLOOM_DOWNSCALE, r * scale * 1.6, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  /**
   * Bloom 合成：把低分辨率离屏的模糊结果放大画回主画布。
   *
   * 采用双离屏 ping-pong（bloomSrc → bloomDst）而非「画布自模糊」：
   * drawImage 到自身的做法虽有规范支持，但部分移动端 WebView 内核会
   * 返回未模糊的结果或直接抛错，双缓冲是最稳的写法。
   *
   * ctx.filter 的 blur 并非所有内核都支持（尤其低版本Android WebView），
   * 故做特性检测；不支持时退化为「半透明叠加」，仍有溢出感，只是边缘更硬。
   */
  compositeBloom(ctx) {
    const src = this.bloomCtx;
    const dst = this.bloomDstCtx;
    if (!src || !dst || !this.bloomDst) return;

    // blur 半径除以降采样倍数，换算回主画布坐标系约为 9px 的视觉光晕
    let filterApplied = false;
    try {
      if (typeof dst.filter === 'string' && dst.filter !== 'none') {
        dst.filter = `blur(${BLOOM_BLUR_PX / BLOOM_DOWNSCALE}px)`;
        filterApplied = true;
      }
    } catch (e) {
      filterApplied = false;
    }

    dst.clearRect(0, 0, this.bloomDst.width, this.bloomDst.height);
    dst.globalCompositeOperation = 'source-over';
    // 放大画回主画布 —— 这是光"溢出"的关键：低分辨率模糊后放大 = 廉价的大范围光晕
    dst.drawImage(this.bloomCanvas, 0, 0);
    dst.filter = 'none';

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = filterApplied ? 0.85 : 0.42;
    ctx.drawImage(this.bloomDst, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
  }

  /**
   * 发射一次「五星揭晓」爆发。
   * @param {number} cx 爆发中心 X（视口/CSS 像素）
   * @param {number} cy 爆发中心 Y
   * @param {object} opts
   * @param {boolean} opts.isCore 是否为大核心名将（粒子更多、更亮、更久）
   */
  burst(cx, cy, { isCore = false } = {}) {
    if (!this.ctx || this.reducedMotion) return;

    const count = isCore ? 150 : 96;
    const speedMax = isCore ? 13 : 10;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      // 全圆周均布 + 随机抖动
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      // 速度服从 [0.35, 1] 的随机分布：中心密外围疏，比全均匀更自然
      const speed = speedMax * (0.35 + Math.random() * 0.65);
      const isBig = Math.random() < 0.22;
      const life = 70 + Math.random() * (isCore ? 70 : 50);

      this.particles.push({
        x: cx + Math.cos(angle) * 6,
        y: cy + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        // 大颗粒重力更小、阻力更大 → 飘得更久，模拟火星悬浮感
        gravity: isBig ? 0.012 : 0.05,
        drag: isBig ? 0.955 : 0.938,
        turbStrength: 0.02 + Math.random() * 0.05,
        size: isBig ? 2.6 + Math.random() * 2.4 : 1 + Math.random() * 1.6,
        age: 0,
        life,
        alpha: 0,
        seed: Math.random() * 100,
        turbX: 0,
        turbY: 0,
      });
    }
  }

  /**
   * 发射「核心冲击」：一圈高速外扩的低亮度余波。
   * 与 burst 的区别是无重力、寿命短、纯横向扩散，用于补足爆炸的冲击感。
   */
  shockwave(cx, cy, { isCore = false } = {}) {
    if (!this.ctx || this.reducedMotion) return;
    const count = isCore ? 46 : 30;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = (isCore ? 20 : 15) * (0.75 + Math.random() * 0.35);
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        drag: 0.9,
        turbStrength: 0.008,
        size: 1.4 + Math.random() * 1.2,
        age: 0,
        life: 34 + Math.random() * 22,
        alpha: 0,
        seed: Math.random() * 100,
        turbX: 0,
        turbY: 0,
      });
    }
  }

  /** 立即清空所有粒子（关闭浮层或重置抽卡时调用） */
  clear() {
    this.particles.length = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// 单例：整个应用共用一个粒子系统，避免多画布同时 lighter 混合
export const goldFX = new GoldFX();