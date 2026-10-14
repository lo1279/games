/**
 * 坦克大战 - 爆炸动画与粒子特效系统
 */
class Particle {
  constructor(x, y, color, speed, angle, life) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.maxLife = life;
    this.life = life;
    this.size = Math.random() * 3 + 2;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.life -= dt;
    this.size = Math.max(0.5, this.size * 0.96);
  }

  render(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

class Explosion {
  /**
   * @param {number} x 中心坐标
   * @param {number} y 中心坐标
   * @param {boolean} isBig 是否为大爆炸 (坦克阵亡/基地被毁)
   */
  constructor(x, y, isBig = false) {
    this.x = x;
    this.y = y;
    this.isBig = isBig;
    this.timer = 0;
    this.duration = isBig ? 0.45 : 0.2; // 持续时间
    this.radius = isBig ? 28 : 10;
    this.particles = [];
    this.finished = false;

    // 产生飞溅碎片粒子
    const particleCount = isBig ? 18 : 6;
    const colors = ['#ff4d4d', '#ff9f1a', '#ffd32a', '#ffffff', '#575fcf'];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1.0;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const life = (Math.random() * 0.25 + 0.2) * (isBig ? 1.4 : 0.8);
      this.particles.push(new Particle(x, y, color, speed, angle, life));
    }
  }

  update(dt) {
    this.timer += dt;
    for (const p of this.particles) {
      p.update(dt);
    }
    if (this.timer >= this.duration && this.particles.every(p => p.life <= 0)) {
      this.finished = true;
    }
  }

  render(ctx) {
    // 1. 绘制核心爆燃光球 (经典阶梯扩散同心圆与星芒)
    const progress = this.timer / this.duration;
    if (progress < 1.0) {
      const currentRadius = this.radius * Math.sin(progress * Math.PI);

      ctx.save();
      // 外层火焰
      ctx.fillStyle = '#ff3838';
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // 中层橙红
      ctx.fillStyle = '#ff9f1a';
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // 内层白热核
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. 渲染碎屑粒子
    for (const p of this.particles) {
      p.render(ctx);
    }
  }
}
