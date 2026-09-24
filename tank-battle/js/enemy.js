/**
 * 坦克大战 - 敌方坦克与 AI 行为控制
 */
class EnemyTank extends Tank {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string|number} typeKey 坦克类型标识
   * @param {boolean} isBonusTank 是否为闪烁道具奖励坦克
   * @param {MapManager} mapManager
   */
  constructor(x, y, typeKey, isBonusTank, mapManager) {
    super(x, y, CONFIG.DIR.DOWN, mapManager);

    this.typeKey = typeKey;
    this.isBonusTank = isBonusTank;
    this.bonusBlink = 0;

    // AI 决策计时器
    this.changeDirTimer = Math.random() * 2.0 + 1.0;
    this.shootTimer = Math.random() * 1.5 + 0.8;

    // 出生动画闪烁阶段 (经典FC生成时的光芒星星)
    this.spawning = true;
    this.spawnTimer = 0.8; // 0.8秒生成光芒

    this.initTypeAttributes();
  }

  initTypeAttributes() {
    let conf;
    if (this.typeKey === 0 || this.typeKey === 'BASIC') {
      conf = CONFIG.TANK_TYPES.BASIC;
    } else if (this.typeKey === 1 || this.typeKey === 'FAST') {
      conf = CONFIG.TANK_TYPES.FAST;
    } else if (this.typeKey === 2 || this.typeKey === 'POWER') {
      conf = CONFIG.TANK_TYPES.POWER;
    } else {
      conf = CONFIG.TANK_TYPES.ARMOR;
    }

    this.hp = conf.hp;
    this.maxHp = conf.hp;
    this.speed = conf.speed;
    this.bulletSpeed = conf.bulletSpeed;
    this.scoreValue = conf.score;
    this.primaryColor = conf.color || '#c0c0c0';
    this.trackColor = conf.trackColor || '#505050';
    this.armorColors = conf.colors || null;
  }

  takeDamage(amount = 1) {
    const died = super.takeDamage(amount);
    soundEngine.playHitBrick();
    return died;
  }

  /**
   * AI 更新
   */
  updateAI(dt, isFrozen, player, eaglePos, bullets, otherTanks = []) {
    super.update(dt);

    if (this.destroyed) return;

    // 出生动画过渡
    if (this.spawning) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawning = false;
      }
      return;
    }

    // 拾取了定时钟道具，敌军全部定格
    if (isFrozen) {
      this.isMoving = false;
      return;
    }

    // 闪烁道具坦克光效
    if (this.isBonusTank) {
      this.bonusBlink += dt * 10;
    }

    // 1. 移动与转向逻辑
    this.changeDirTimer -= dt;
    let moved = this.move(this.dir, dt, otherTanks);

    // 如果撞墙或者时间到，重新选择方向
    if (!moved || this.changeDirTimer <= 0) {
      this.dir = this.chooseSmartDirection(eaglePos, player);
      this.changeDirTimer = Math.random() * 2.5 + 1.0;
      // 遇到阻挡或相撞时，积极开炮轰击阻挡物/玩家
      if (!moved && Math.random() < 0.6) {
        this.shootTimer = Math.min(this.shootTimer, 0.15);
      }
    }

    // 2. 开炮逻辑
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      const b = this.createBullet('ENEMY');
      if (b) {
        bullets.push(b);
        soundEngine.playShoot();
      }
      this.shootTimer = Math.random() * 1.5 + 0.6;
    }
  }

  /**
   * 启发式方向选择：有更高概率偏向朝下（进攻玩家基地老鹰或玩家）
   */
  chooseSmartDirection(eaglePos, player) {
    const r = Math.random();

    // 40% 的概率尝试向下进攻（直捣老鹰基地）
    if (r < 0.40 && this.y < eaglePos.y * CONFIG.TILE_SIZE - 20) {
      return CONFIG.DIR.DOWN;
    }

    // 25% 偏向接近玩家
    if (r < 0.65 && player && !player.destroyed) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? CONFIG.DIR.RIGHT : CONFIG.DIR.LEFT;
      } else {
        return dy > 0 ? CONFIG.DIR.DOWN : CONFIG.DIR.UP;
      }
    }

    // 其余随机方向
    const dirs = [CONFIG.DIR.UP, CONFIG.DIR.RIGHT, CONFIG.DIR.DOWN, CONFIG.DIR.LEFT];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  render(ctx) {
    if (this.destroyed) return;

    // 出生阶段绘制十字闪耀星
    if (this.spawning) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const starScale = Math.sin(this.spawnTimer * 20) * 8 + 12;

      ctx.save();
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(cx - 2, cy - starScale, 4, starScale * 2);
      ctx.fillRect(cx - starScale, cy - 2, starScale * 2, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, cy - starScale * 0.7, 2, starScale * 1.4);
      ctx.fillRect(cx - starScale * 0.7, cy - 1, starScale * 1.4, 2);
      ctx.restore();
      return;
    }

    // 确定当前坦克外观色彩
    let currentColor = this.primaryColor;
    let trackC = this.trackColor;

    // 重装装甲车随血量换色
    if (this.armorColors) {
      const idx = Math.max(0, Math.min(this.armorColors.length - 1, this.hp - 1));
      currentColor = this.armorColors[idx];
    }

    // 道具奖励车红白交替高频闪烁
    if (this.isBonusTank && Math.floor(this.bonusBlink) % 2 === 0) {
      currentColor = '#ff3838';
      trackC = '#ffffff';
    }

    this.renderBaseTank(ctx, currentColor, trackC, 15);
  }
}
