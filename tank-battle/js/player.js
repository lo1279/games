/**
 * 坦克大战 - 玩家坦克实体
 */
class PlayerTank extends Tank {
  constructor(x, y, mapManager) {
    super(x, y, CONFIG.DIR.UP, mapManager);

    this.lives = CONFIG.PLAYER_INITIAL_LIVES;
    this.score = 0;
    this.level = 1; // 1 ~ 4 阶升级

    // 无敌金钟罩护盾计时器
    this.shieldTimer = CONFIG.DURATION.PLAYER_SPAWN_SHIELD;
    this.shieldAnim = 0;

    // 出生坐标记忆
    this.spawnX = x;
    this.spawnY = y;

    this.applyLevelStats();
  }

  /**
   * 应用等级属性配置
   */
  applyLevelStats() {
    switch (this.level) {
      case 1:
        this.speed = 2.2;
        this.bulletSpeed = 5.5;
        this.maxBullets = 1;
        this.bulletPower = 1;
        this.canBreakSteel = false;
        this.primaryColor = '#e6c300';
        this.trackColor = '#7a6700';
        break;
      case 2:
        this.speed = 2.4;
        this.bulletSpeed = 7.5; // 极速弹
        this.maxBullets = 1;
        this.bulletPower = 1;
        this.canBreakSteel = false;
        this.primaryColor = '#f39c12';
        this.trackColor = '#a05c00';
        break;
      case 3:
        this.speed = 2.6;
        this.bulletSpeed = 8.0;
        this.maxBullets = 2; // 双连发
        this.bulletPower = 1;
        this.canBreakSteel = false;
        this.primaryColor = '#e74c3c';
        this.trackColor = '#8c1d10';
        break;
      case 4:
        this.speed = 2.8;
        this.bulletSpeed = 8.5;
        this.maxBullets = 2;
        this.bulletPower = 2; // 强化炮
        this.canBreakSteel = true; // 可碎铁
        this.primaryColor = '#9b59b6';
        this.trackColor = '#5b2c6f';
        break;
    }
  }

  /**
   * 捡到星星升级
   */
  upgrade() {
    if (this.level < 4) {
      this.level++;
      this.applyLevelStats();
    }
  }

  /**
   * 激活无敌护盾
   */
  activateShield(duration) {
    this.shieldTimer = Math.max(this.shieldTimer, duration);
  }

  /**
   * 重生复活
   */
  respawn() {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.dir = CONFIG.DIR.UP;
    this.level = 1;
    this.applyLevelStats();
    this.hp = 1;
    this.destroyed = false;
    this.shieldTimer = CONFIG.DURATION.PLAYER_SPAWN_SHIELD;
    this.activeBullets = 0;
  }

  takeDamage(amount = 1) {
    // 护盾生效中无敌
    if (this.shieldTimer > 0) {
      return false;
    }

    const died = super.takeDamage(amount);
    if (died) {
      this.lives--;
      soundEngine.playExplosion();
    }
    return died;
  }

  update(dt, inputKeys, otherTanks = []) {
    super.update(dt);

    if (this.destroyed) return;

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      this.shieldAnim += dt * 15;
    }

    // 按键输入控制
    let moved = false;
    if (inputKeys['ArrowUp'] || inputKeys['KeyW']) {
      this.move(CONFIG.DIR.UP, dt, otherTanks);
      moved = true;
    } else if (inputKeys['ArrowDown'] || inputKeys['KeyS']) {
      this.move(CONFIG.DIR.DOWN, dt, otherTanks);
      moved = true;
    } else if (inputKeys['ArrowLeft'] || inputKeys['KeyA']) {
      this.move(CONFIG.DIR.LEFT, dt, otherTanks);
      moved = true;
    } else if (inputKeys['ArrowRight'] || inputKeys['KeyD']) {
      this.move(CONFIG.DIR.RIGHT, dt, otherTanks);
      moved = true;
    }

    if (!moved) {
      this.isMoving = false;
    }
  }

  render(ctx) {
    if (this.destroyed) return;

    // 绘制主坦克车身与炮管
    const barrelLen = 14 + (this.level * 2);
    this.renderBaseTank(ctx, this.primaryColor, this.trackColor, barrelLen);

    // 绘制无敌金钟罩光环
    if (this.shieldTimer > 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const radius = this.width / 2 + 6;

      ctx.save();
      ctx.strokeStyle = Math.floor(this.shieldAnim) % 2 === 0 ? '#00d2d3' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 旋转能量点
      ctx.fillStyle = '#54a0ff';
      const angle = this.shieldAnim * 0.4;
      for (let i = 0; i < 4; i++) {
        const px = cx + Math.cos(angle + (i * Math.PI / 2)) * radius;
        const py = cy + Math.sin(angle + (i * Math.PI / 2)) * radius;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      ctx.restore();
    }
  }
}
