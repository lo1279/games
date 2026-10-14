/**
 * 坦克大战 - 坦克基类
 */
class Tank {
  constructor(x, y, dir, mapManager) {
    this.x = x;
    this.y = y;
    this.dir = dir; // CONFIG.DIR
    this.mapManager = mapManager;

    // 坦克碰撞箱规格 (经典2x2瓦片区域微缩一点，避免狭缝卡死)
    this.width = 38;
    this.height = 38;

    this.speed = 2.0;
    this.hp = 1;
    this.maxHp = 1;
    this.destroyed = false;

    // 履带与动画
    this.trackStep = 0;
    this.isMoving = false;

    // 射击状态
    this.bulletSpeed = 5.0;
    this.maxBullets = 1;
    this.activeBullets = 0;
    this.shootCooldown = 0;
    this.bulletPower = 1;
    this.canBreakSteel = false;

    // 碰撞状态追踪
    this.collidedTank = null;

    // 外观颜色
    this.primaryColor = '#e6c300';
    this.trackColor = '#6b5c00';
  }

  /**
   * 尝试朝指定方向移动
   * @param {number} dir 方向
   * @param {number} dt 帧时间
   * @param {Array<Tank>} otherTanks 其它存活坦克
   */
  move(dir, dt, otherTanks = []) {
    this.dir = dir;
    this.isMoving = true;

    const offset = CONFIG.DIR_OFFSET[dir];
    const step = this.speed * 60 * dt;
    let nextX = this.x + offset.x * step;
    let nextY = this.y + offset.y * step;

    // 安全网格通道微对齐 (Corner Alignment)
    const gridSize = 12;
    if (dir === CONFIG.DIR.UP || dir === CONFIG.DIR.DOWN) {
      const rem = this.x % gridSize;
      let alignX = this.x;
      if (rem > 0 && rem < 5) {
        alignX -= rem;
      } else if (rem >= 7) {
        alignX += (gridSize - rem);
      }
      if (!this.mapManager.isObstacle(alignX, nextY, this.width, this.height)) {
        nextX = alignX;
      }
    } else {
      const rem = this.y % gridSize;
      let alignY = this.y;
      if (rem > 0 && rem < 5) {
        alignY -= rem;
      } else if (rem >= 7) {
        alignY += (gridSize - rem);
      }
      if (!this.mapManager.isObstacle(nextX, alignY, this.width, this.height)) {
        nextY = alignY;
      }
    }

    // 1. 地图障碍物碰撞检查
    if (this.mapManager.isObstacle(nextX, nextY, this.width, this.height)) {
      this.collidedTank = null;
      return false;
    }

    // 2. 其它活着的坦克实体阻挡检查 (捕获撞击目标)
    this.collidedTank = null;
    if (otherTanks && otherTanks.length > 0) {
      for (const t of otherTanks) {
        if (t !== this && !t.destroyed && !t.spawning) {
          if (
            nextX < t.x + t.width &&
            nextX + this.width > t.x &&
            nextY < t.y + t.height &&
            nextY + this.height > t.y
          ) {
            this.collidedTank = t;
            return false;
          }
        }
      }
    }

    this.x = nextX;
    this.y = nextY;
    this.trackStep = (this.trackStep + dt * 10) % 2;
    return true;
  }

  /**
   * 生成子弹
   */
  createBullet(ownerType) {
    if (this.destroyed) return null;
    if (this.shootCooldown > 0) return null;
    if (this.activeBullets >= this.maxBullets) return null;

    let bx = this.x + this.width / 2;
    let by = this.y + this.height / 2;
    const offsetDist = this.width / 2 + 3;

    if (this.dir === CONFIG.DIR.UP) {
      by -= offsetDist;
    } else if (this.dir === CONFIG.DIR.RIGHT) {
      bx += offsetDist;
    } else if (this.dir === CONFIG.DIR.DOWN) {
      by += offsetDist;
    } else if (this.dir === CONFIG.DIR.LEFT) {
      bx -= offsetDist;
    }

    this.activeBullets++;
    this.shootCooldown = 0.15; // 射击后摇

    return new Bullet(
      bx,
      by,
      this.dir,
      this.bulletSpeed,
      ownerType,
      this.bulletPower,
      this.canBreakSteel,
      this // 关键: 传递发射者实例
    );
  }

  takeDamage(amount = 1) {
    if (this.destroyed) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.destroyed = true;
      return true; // 彻底击毁
    }
    return false; // 仅掉血
  }

  update(dt) {
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }
  }

  /**
   * 绘制通用坦克骨架与炮塔
   */
  renderBaseTank(ctx, bodyColor, trackColor, barrelLength = 16) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(cx, cy);
    // 根据朝向旋转画布
    // 0:UP(0), 1:RIGHT(90), 2:DOWN(180), 3:LEFT(270)
    ctx.rotate((this.dir * 90 * Math.PI) / 180);

    const halfW = w / 2;
    const halfH = h / 2;

    // 1. 左右履带
    const trackWidth = 7;
    ctx.fillStyle = trackColor;
    ctx.fillRect(-halfW, -halfH, trackWidth, h);
    ctx.fillRect(halfW - trackWidth, -halfH, trackWidth, h);

    // 履带动态齿轮纹理
    ctx.fillStyle = '#1e272e';
    const trackAnim = Math.floor(this.trackStep) * 3;
    for (let y = -halfH + (trackAnim % 6); y < halfH; y += 6) {
      ctx.fillRect(-halfW, y, trackWidth, 2);
      ctx.fillRect(halfW - trackWidth, y, trackWidth, 2);
    }

    // 2. 坦克主装甲车身
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-halfW + trackWidth + 1, -halfH + 3, w - (trackWidth * 2) - 2, h - 6);

    // 装甲高光与阴影边缘
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-halfW + trackWidth + 1, -halfH + 3, 2, h - 6);

    // 3. 炮塔圆盘
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. 炮管 (朝向上方 0 度)
    ctx.fillStyle = trackColor;
    ctx.fillRect(-2.5, -halfH - barrelLength + 12, 5, barrelLength);
    // 炮口制退器
    ctx.fillRect(-3.5, -halfH - barrelLength + 12, 7, 3);

    ctx.restore();
  }
}
