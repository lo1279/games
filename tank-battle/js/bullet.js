/**
 * 坦克大战 - 炮弹实体类
 */
class Bullet {
  /**
   * @param {number} x 发射起点
   * @param {number} y 发射起点
   * @param {number} dir 方向 CONFIG.DIR
   * @param {number} speed 飞行速度
   * @param {string} ownerType 'PLAYER' | 'ENEMY'
   * @param {number} power 破坏威力 (1:普通, 2:终极重炮)
   * @param {boolean} canBreakSteel 是否可击穿铁墙
   * @param {Tank} ownerTank 发射该子弹的坦克实例引用
   */
  constructor(x, y, dir, speed, ownerType, power = 1, canBreakSteel = false, ownerTank = null) {
    this.dir = dir;
    this.speed = speed;
    this.ownerType = ownerType;
    this.power = power;
    this.canBreakSteel = canBreakSteel;
    this.ownerTank = ownerTank;
    this.destroyed = false;

    // 经典小炮弹尺寸 (6x6)
    this.size = 6;
    this.width = this.size;
    this.height = this.size;

    // 偏移居中调整
    this.x = x - this.size / 2;
    this.y = y - this.size / 2;
  }

  update(dt) {
    if (this.destroyed) return;

    const offset = CONFIG.DIR_OFFSET[this.dir];
    const step = this.speed * 60 * dt;
    this.x += offset.x * step;
    this.y += offset.y * step;

    // 越界检测 (打在战场边界)
    if (
      this.x < 0 ||
      this.y < 0 ||
      this.x + this.width > CONFIG.CANVAS_WIDTH ||
      this.y + this.height > CONFIG.CANVAS_HEIGHT
    ) {
      this.destroyed = true;
      soundEngine.playHitSteel();
    }
  }

  /**
   * 判定与另一个实体的 AABB 碰撞
   */
  collidesWith(entity) {
    return (
      this.x < entity.x + entity.width &&
      this.x + this.width > entity.x &&
      this.y < entity.y + entity.height &&
      this.y + this.height > entity.y
    );
  }

  render(ctx) {
    if (this.destroyed) return;

    ctx.save();
    // 子弹外圈红光
    ctx.fillStyle = this.ownerType === 'PLAYER' ? '#ffeaa7' : '#ff7675';
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 内核白炽高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
