/**
 * utils/tank-battle.js
 * 经典坦克大战 · 微信小程序原生版（纯逻辑，无 wx / DOM 依赖）
 *
 * 移植自根目录 tank-battle/js/（config/levels/map/tank/bullet/enemy/player/game）。
 * 设计原则：逻辑与渲染分离——本模块只负责模拟与“在 624x624 逻辑坐标系内”的绘制；
 * 页面层负责 Canvas 节点、触屏手柄、实时 tick 循环与震动反馈。
 *
 * 为控制移植范围，v1 不含道具系统（STAR/炸弹/钟/铲/盔/命）与冰面加速；
 * 保留核心：地图（砖/钢/水/草/基地）、玩家 3 命 + 4 级火力、4 类敌车 AI、
 * 子弹互撞抵消、护盾碾压、胜负与关卡推进。
 */
(function (global) {
  'use strict';

  // ===== 全局常量 =====
  const TILE = 24;
  const COLS = 26;
  const ROWS = 26;
  const CANVAS_W = TILE * COLS; // 624
  const CANVAS_H = TILE * ROWS; // 624

  const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
  const DIR_OFFSET = [
    { x: 0, y: -1 }, // UP
    { x: 1, y: 0 },  // RIGHT
    { x: 0, y: 1 },  // DOWN
    { x: -1, y: 0 }  // LEFT
  ];

  const T = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    GRASS: 4,
    ICE: 5,
    EAGLE: 9,
    EAGLE_DEAD: 10
  };

  const TANK_TYPES = {
    PLAYER: { speed: 2.2, bulletSpeed: 5.5, maxBullets: 1, color: '#e6c300', trackColor: '#7a6700' },
    BASIC: { name: '普通装甲车', hp: 1, speed: 1.5, bulletSpeed: 4.0, score: 100, color: '#c0c0c0', trackColor: '#505050' },
    FAST: { name: '轻型极速车', hp: 1, speed: 2.8, bulletSpeed: 4.5, score: 200, color: '#5ca3e6', trackColor: '#2b5a8c' },
    POWER: { name: '强击火炮车', hp: 1, speed: 1.8, bulletSpeed: 6.8, score: 300, color: '#38b000', trackColor: '#1d5e00' },
    ARMOR: { name: '重型装甲车', hp: 4, speed: 1.4, bulletSpeed: 4.5, score: 400, colors: ['#38b000', '#e6a100', '#d90429', '#e6c300'] }
  };

  const TOTAL_ENEMIES_PER_LEVEL = 20;
  const MAX_ACTIVE_ENEMIES = 4;
  const PLAYER_INITIAL_LIVES = 3;
  const SPAWN_SHIELD = 4; // 复活/出场护盾秒数

  // ===== 关卡地图（与根版一致）=====
  const LEVELS = [
    {
      name: '第 1 关: 新兵防线',
      enemies: [0, 0, 0, '*0', 1, 0, 1, '*1', 2, 0, 1, 2, '*2', 0, 1, 3, '*3', 0, 1, 3],
      layout: [
        '..........................',
        '..........................',
        '..BB....BB....BB....BB....',
        '..BB....BB....BB....BB....',
        '..BB....BB....BB....BB....',
        '..BB....BB....BB....BB....',
        '..BB....BB..SSSS..BB....BB',
        '..BB....BB..SSSS..BB....BB',
        '..BB....BB........BB....BB',
        '........BB........BB......',
        '........BB........BB......',
        'BB........................',
        'SS........................',
        '..........................',
        'BB........................',
        '........BB..BBBB..BB......',
        '........BB..BBBB..BB......',
        '..BB....BB..BBBB..BB....BB',
        '..BB....BB........BB....BB',
        '..BB....BB........BB....BB',
        '..BB....BB..BBBB..BB....BB',
        '..BB....BB..BBBB..BB....BB',
        '............BBBB..........',
        '...........BBBB...........',
        '...........B..B...........',
        '...........B..B...........'
      ]
    },
    {
      name: '第 2 关: 迷雾沼泽',
      enemies: [1, 0, '*1', 1, 2, 0, '*2', 3, 1, 2, '*3', 3, 1, 0, 2, 3, '*2', 3, 3, 3],
      layout: [
        '..........................',
        '..GG....GG........GG....GG',
        '..GG....GG..BBBB..GG....GG',
        '..BB....BB..BBBB..BB....BB',
        '..BB....BB..WWWW..BB....BB',
        '..WW....WW..WWWW..WW....WW',
        '..WW....WW........WW....WW',
        '........SS..BBBB..SS......',
        '........SS..BBBB..SS......',
        '..GG........GGGG........GG',
        '..GG..BBBB..GGGG..BBBB..GG',
        '..BB..BBBB..BBBB..BBBB..BB',
        '..BB..SSSS..BBBB..SSSS..BB',
        '..........................',
        '..BB..SSSS..BBBB..SSSS..BB',
        '..BB..BBBB..BBBB..BBBB..BB',
        '..GG..BBBB..GGGG..BBBB..GG',
        '..GG........GGGG........GG',
        '........WW..BBBB..WW......',
        '........WW..BBBB..WW......',
        '..BB....WW..WWWW..WW....BB',
        '..BB....BB..WWWW..BB....BB',
        '..GG....BB..BBBB..BB....GG',
        '...........BBBB...........',
        '...........B..B...........',
        '...........B..B...........'
      ]
    },
    {
      name: '第 3 关: 钢铁堡垒',
      enemies: [2, 2, '*2', 1, 3, 3, '*3', 2, 3, 1, '*3', 3, 2, 2, 3, 3, '*3', 3, 3, 3],
      layout: [
        '..........................',
        '..SS....BB..SSSS..BB....SS',
        '..SS....BB..SSSS..BB....SS',
        '..BB....SS..BBBB..SS....BB',
        '..BB....SS..BBBB..SS....BB',
        '........SS........SS......',
        '........SS........SS......',
        '..SSSS..BB..WWWW..BB..SSSS',
        '..SSSS..BB..WWWW..BB..SSSS',
        '......BB....WWWW....BB....',
        '......BB............BB....',
        'SS....BB..SSSSSSSS..BB....',
        'SS....BB..SSSSSSSS..BB....',
        '..........................',
        'SS....BB..SSSSSSSS..BB....',
        'SS....BB..SSSSSSSS..BB....',
        '......BB............BB....',
        '......BB....WWWW....BB....',
        '..SSSS..BB..WWWW..BB..SSSS',
        '..SSSS..BB..WWWW..BB..SSSS',
        '........SS........SS......',
        '........SS........SS......',
        '..BB....SS..BBBB..SS....BB',
        '...........BBBB...........',
        '...........B..B...........',
        '...........B..B...........'
      ]
    },
    {
      name: '第 4 关: 冰雪前线',
      enemies: [1, 1, '*1', 1, 1, 2, '*2', 3, 1, 3, '*3', 1, 3, 2, 3, 1, '*3', 3, 3, 3],
      layout: [
        '..........................',
        '..II....II..IIII..II....II',
        '..II....II..IIII..II....II',
        '..BB....II..BBBB..II....BB',
        '..BB....II..BBBB..II....BB',
        '..II....WW..IIII..WW....II',
        '..II....WW..IIII..WW....II',
        '..BB....WW..SSSS..WW....BB',
        '..BB....WW..SSSS..WW....BB',
        '......II....GGGG....II....',
        '......II....GGGG....II....',
        'WW....II..BB....BB..II....',
        'WW....II..BB....BB..II....',
        '..........................',
        'WW....II..BB....BB..II....',
        'WW....II..BB....BB..II....',
        '......II....GGGG....II....',
        '......II....GGGG....II....',
        '..BB....WW..SSSS..WW....BB',
        '..BB....WW..SSSS..WW....BB',
        '..II....WW..IIII..WW....II',
        '..II....WW..IIII..WW....II',
        '..BB....II..BBBB..II....BB',
        '...........BBBB...........',
        '...........B..B...........',
        '...........B..B...........'
      ]
    }
  ];

  // ===== 地图管理 =====
  class MapManager {
    constructor() {
      this.cols = COLS;
      this.rows = ROWS;
      this.tileSize = TILE;
      this.grid = [];
      this.eagleAlive = true;
      this.eaglePos = { x: 12, y: 24, w: 2, h: 2 };
      this.waterFrame = 0;
      for (let r = 0; r < ROWS; r++) {
        this.grid[r] = new Array(COLS).fill(T.EMPTY);
      }
    }

    loadLevel(levelIndex) {
      const lv = LEVELS[levelIndex % LEVELS.length];
      this.eagleAlive = true;
      this.waterFrame = 0;
      for (let r = 0; r < ROWS; r++) {
        this.grid[r] = [];
        const rowStr = lv.layout[r] || '..........................';
        for (let c = 0; c < COLS; c++) {
          const ch = rowStr[c] || '.';
          let type = T.EMPTY;
          if (ch === 'B') type = T.BRICK;
          else if (ch === 'S') type = T.STEEL;
          else if (ch === 'W') type = T.WATER;
          else if (ch === 'G') type = T.GRASS;
          else if (ch === 'I') type = T.ICE;
          else if (ch === 'E') type = T.EAGLE;
          this.grid[r][c] = type;
        }
      }
      // 强制基地 2x2
      this.grid[24][12] = T.EAGLE;
      this.grid[24][13] = T.EAGLE;
      this.grid[25][12] = T.EAGLE;
      this.grid[25][13] = T.EAGLE;
    }

    update(dt) {
      this.waterFrame = (this.waterFrame + dt * 2.5) % 2;
    }

    /** 矩形是否与实心障碍（砖/钢/水/基地/边界）碰撞 */
    isObstacle(x, y, w, h) {
      if (x < 0 || y < 0 || x + w > CANVAS_W || y + h > CANVAS_H) return true;
      const minCol = Math.max(0, Math.floor(x / TILE));
      const maxCol = Math.min(COLS - 1, Math.floor((x + w - 0.01) / TILE));
      const minRow = Math.max(0, Math.floor(y / TILE));
      const maxRow = Math.min(ROWS - 1, Math.floor((y + h - 0.01) / TILE));
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const type = this.grid[r][c];
          if (type === T.STEEL || type === T.WATER || type === T.EAGLE || type === T.EAGLE_DEAD) return true;
          if (type === T.BRICK) return true; // v1：整块砖即障碍
        }
      }
      return false;
    }

    /** 子弹击中瓦片：砖整块碎、钢挡（可破则碎）、基地被毁 */
    hitTestBullet(bullet) {
      const bx = bullet.x, by = bullet.y, bw = bullet.width, bh = bullet.height;
      const minCol = Math.max(0, Math.floor(bx / TILE));
      const maxCol = Math.min(COLS - 1, Math.floor((bx + bw) / TILE));
      const minRow = Math.max(0, Math.floor(by / TILE));
      const maxRow = Math.min(ROWS - 1, Math.floor((by + bh) / TILE));
      let hit = false;
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const type = this.grid[r][c];
          if (type === T.BRICK) {
            this.grid[r][c] = T.EMPTY;
            hit = true;
          } else if (type === T.STEEL) {
            if (bullet.canBreakSteel) this.grid[r][c] = T.EMPTY;
            hit = true;
          } else if (type === T.EAGLE) {
            // 仅敌方子弹可摧毁基地；玩家误伤自家基地只被挡下（移动端防暴毙）
            if (bullet.ownerType !== 'PLAYER') this.destroyEagle();
            hit = true;
          }
        }
      }
      return hit;
    }

    destroyEagle() {
      if (!this.eagleAlive) return;
      this.eagleAlive = false;
      this.grid[24][12] = T.EAGLE_DEAD;
      this.grid[24][13] = T.EAGLE_DEAD;
      this.grid[25][12] = T.EAGLE_DEAD;
      this.grid[25][13] = T.EAGLE_DEAD;
    }

    // ===== 渲染 =====
    renderBase(ctx) {
      const s = TILE;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const type = this.grid[r][c];
          const x = c * s, y = r * s;
          if (type === T.BRICK) this._brick(ctx, x, y);
          else if (type === T.STEEL) this._steel(ctx, x, y);
          else if (type === T.WATER) this._water(ctx, x, y);
        }
      }
      this._eagle(ctx);
    }

    renderTop(ctx) {
      const s = TILE;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.grid[r][c] === T.GRASS) this._grass(ctx, c * s, r * s);
        }
      }
    }

    _brick(ctx, x, y) {
      const s = TILE;
      ctx.fillStyle = '#b84418';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#3a1608';
      ctx.fillRect(x, y + s - 2, s, 2);
      ctx.fillRect(x + s - 2, y, 2, s);
      ctx.fillStyle = '#e87343';
      ctx.fillRect(x, y, s - 2, 2);
      ctx.fillRect(x, y, 2, s - 2);
    }
    _steel(ctx, x, y) {
      const s = TILE;
      ctx.fillStyle = '#dcdde1';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#718093';
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = '#f5f6fa';
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
      ctx.fillStyle = '#2f3640';
      ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
    }
    _water(ctx, x, y) {
      const s = TILE;
      ctx.fillStyle = '#1e3799';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#4a69bd';
      const off = Math.floor(this.waterFrame) * 4;
      ctx.fillRect(x, y + 4 + off, s, 3);
      ctx.fillRect(x, y + 14 - off, s, 3);
    }
    _grass(ctx, x, y) {
      const s = TILE;
      ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#2e7d32';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + i * 6 + 2, y + 3, 3, 6);
        ctx.fillRect(x + i * 6, y + 13, 3, 6);
      }
    }
    _eagle(ctx) {
      const x = 12 * TILE, y = 24 * TILE, size = TILE * 2;
      if (this.eagleAlive) {
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + 24, y + 16, 10, 0, Math.PI * 2);
        ctx.moveTo(x + 6, y + 40);
        ctx.lineTo(x + 24, y + 20);
        ctx.lineTo(x + 42, y + 40);
        ctx.lineTo(x + 24, y + 32);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 22, y + 14, 4, 4);
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
      } else {
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x + 8, y + 12, 14, 10);
        ctx.fillRect(x + 24, y + 20, 16, 12);
        ctx.fillRect(x + 12, y + 30, 24, 8);
        ctx.fillStyle = '#d2dae2';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✕', x + 24, y + 32);
      }
    }
  }

  // ===== 坦克基类 =====
  class Tank {
    constructor(x, y, dir, mapManager) {
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.mapManager = mapManager;
      this.width = 38;
      this.height = 38;
      this.speed = 2.0;
      this.hp = 1;
      this.maxHp = 1;
      this.destroyed = false;
      this.trackStep = 0;
      this.isMoving = false;
      this.bulletSpeed = 5.0;
      this.maxBullets = 1;
      this.activeBullets = 0;
      this.shootCooldown = 0;
      this.bulletPower = 1;
      this.canBreakSteel = false;
      this.collidedTank = null;
      this.primaryColor = '#e6c300';
      this.trackColor = '#6b5c00';
    }

    move(dir, dt, otherTanks) {
      this.dir = dir;
      this.isMoving = true;
      const offset = DIR_OFFSET[dir];
      const step = this.speed * 60 * dt;
      let nextX = this.x + offset.x * step;
      let nextY = this.y + offset.y * step;
      // 拐角对齐（半瓦片=12）
      const gridSize = 12;
      if (dir === DIR.UP || dir === DIR.DOWN) {
        const rem = this.x % gridSize;
        let alignX = this.x;
        if (rem > 0 && rem < 5) alignX -= rem;
        else if (rem >= 7) alignX += gridSize - rem;
        if (!this.mapManager.isObstacle(alignX, nextY, this.width, this.height)) nextX = alignX;
      } else {
        const rem = this.y % gridSize;
        let alignY = this.y;
        if (rem > 0 && rem < 5) alignY -= rem;
        else if (rem >= 7) alignY += gridSize - rem;
        if (!this.mapManager.isObstacle(nextX, alignY, this.width, this.height)) nextY = alignY;
      }
      if (this.mapManager.isObstacle(nextX, nextY, this.width, this.height)) {
        this.collidedTank = null;
        return false;
      }
      this.collidedTank = null;
      if (otherTanks && otherTanks.length) {
        for (const t of otherTanks) {
          if (t !== this && !t.destroyed && !t.spawning) {
            if (nextX < t.x + t.width && nextX + this.width > t.x && nextY < t.y + t.height && nextY + this.height > t.y) {
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

    createBullet(ownerType) {
      if (this.destroyed || this.shootCooldown > 0 || this.activeBullets >= this.maxBullets) return null;
      let bx = this.x + this.width / 2;
      let by = this.y + this.height / 2;
      const off = this.width / 2 + 3;
      if (this.dir === DIR.UP) by -= off;
      else if (this.dir === DIR.RIGHT) bx += off;
      else if (this.dir === DIR.DOWN) by += off;
      else if (this.dir === DIR.LEFT) bx -= off;
      this.activeBullets++;
      this.shootCooldown = 0.15;
      return new Bullet(bx, by, this.dir, this.bulletSpeed, ownerType, this.bulletPower, this.canBreakSteel, this);
    }

    takeDamage(amount) {
      if (this.destroyed) return false;
      this.hp -= amount;
      if (this.hp <= 0) {
        this.hp = 0;
        this.destroyed = true;
        return true;
      }
      return false;
    }

    update(dt) {
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
    }

    renderBaseTank(ctx, bodyColor, trackColor, barrelLength) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const w = this.width, h = this.height;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((this.dir * 90 * Math.PI) / 180);
      const halfW = w / 2, halfH = h / 2;
      const trackW = 7;
      ctx.fillStyle = trackColor;
      ctx.fillRect(-halfW, -halfH, trackW, h);
      ctx.fillRect(halfW - trackW, -halfH, trackW, h);
      ctx.fillStyle = '#1e272e';
      const trackAnim = Math.floor(this.trackStep) * 3;
      for (let y = -halfH + (trackAnim % 6); y < halfH; y += 6) {
        ctx.fillRect(-halfW, y, trackW, 2);
        ctx.fillRect(halfW - trackW, y, trackW, 2);
      }
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-halfW + trackW + 1, -halfH + 3, w - trackW * 2 - 2, h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-halfW + trackW + 1, -halfH + 3, 2, h - 6);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = trackColor;
      ctx.fillRect(-2.5, -halfH - barrelLength + 12, 5, barrelLength);
      ctx.fillRect(-3.5, -halfH - barrelLength + 12, 7, 3);
      ctx.restore();
    }
  }

  // ===== 玩家坦克 =====
  class PlayerTank extends Tank {
    constructor(x, y, mapManager) {
      super(x, y, DIR.UP, mapManager);
      this.lives = PLAYER_INITIAL_LIVES;
      this.score = 0;
      this.level = 1;
      this.shieldTimer = SPAWN_SHIELD;
      this.shieldAnim = 0;
      this.spawnX = x;
      this.spawnY = y;
      this.applyLevelStats();
    }

    applyLevelStats() {
      switch (this.level) {
        case 1: this.speed = 2.2; this.bulletSpeed = 5.5; this.maxBullets = 1; this.bulletPower = 1; this.canBreakSteel = false; this.primaryColor = '#e6c300'; this.trackColor = '#7a6700'; break;
        case 2: this.speed = 2.4; this.bulletSpeed = 7.5; this.maxBullets = 1; this.bulletPower = 1; this.canBreakSteel = false; this.primaryColor = '#f39c12'; this.trackColor = '#a05c00'; break;
        case 3: this.speed = 2.6; this.bulletSpeed = 8.0; this.maxBullets = 2; this.bulletPower = 1; this.canBreakSteel = false; this.primaryColor = '#e74c3c'; this.trackColor = '#8c1d10'; break;
        case 4: this.speed = 2.8; this.bulletSpeed = 8.5; this.maxBullets = 2; this.bulletPower = 2; this.canBreakSteel = true; this.primaryColor = '#9b59b6'; this.trackColor = '#5b2c6f'; break;
      }
    }

    upgrade() {
      if (this.level < 4) {
        this.level++;
        this.applyLevelStats();
      }
    }
    activateShield(d) {
      this.shieldTimer = Math.max(this.shieldTimer, d);
    }
    respawn() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.dir = DIR.UP;
      this.level = 1;
      this.applyLevelStats();
      this.hp = 1;
      this.destroyed = false;
      this.shieldTimer = SPAWN_SHIELD;
      this.activeBullets = 0;
    }
    resetForNextStage() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.dir = DIR.UP;
      this.applyLevelStats();
      this.hp = 1;
      this.destroyed = false;
      this.shieldTimer = SPAWN_SHIELD;
      this.activeBullets = 0;
    }
    takeDamage(amount) {
      if (this.shieldTimer > 0) return false;
      const died = super.takeDamage(amount);
      if (died) this.lives--;
      return died;
    }
    updateShield(dt) {
      if (this.shieldTimer > 0) {
        this.shieldTimer -= dt;
        this.shieldAnim += dt * 15;
      }
    }
    render(ctx) {
      if (this.destroyed) return;
      const barrel = 14 + this.level * 2;
      this.renderBaseTank(ctx, this.primaryColor, this.trackColor, barrel);
      if (this.shieldTimer > 0) {
        const cx = this.x + this.width / 2, cy = this.y + this.height / 2, radius = this.width / 2 + 6;
        ctx.save();
        ctx.strokeStyle = Math.floor(this.shieldAnim) % 2 === 0 ? '#00d2d3' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#54a0ff';
        const ang = this.shieldAnim * 0.4;
        for (let i = 0; i < 4; i++) {
          const px = cx + Math.cos(ang + i * Math.PI / 2) * radius;
          const py = cy + Math.sin(ang + i * Math.PI / 2) * radius;
          ctx.fillRect(px - 2, py - 2, 4, 4);
        }
        ctx.restore();
      }
    }
  }

  // ===== 敌方坦克 =====
  class EnemyTank extends Tank {
    constructor(x, y, typeKey, isBonus, mapManager) {
      super(x, y, DIR.DOWN, mapManager);
      this.typeKey = typeKey;
      this.isBonusTank = isBonus;
      this.bonusBlink = 0;
      this.changeDirTimer = Math.random() * 2.0 + 1.0;
      this.shootTimer = Math.random() * 1.5 + 0.8;
      this.spawning = true;
      this.spawnTimer = 0.8;
      this.initType(typeKey);
    }
    initType(typeKey) {
      let conf;
      if (typeKey === 0 || typeKey === 'BASIC') conf = TANK_TYPES.BASIC;
      else if (typeKey === 1 || typeKey === 'FAST') conf = TANK_TYPES.FAST;
      else if (typeKey === 2 || typeKey === 'POWER') conf = TANK_TYPES.POWER;
      else conf = TANK_TYPES.ARMOR;
      this.hp = conf.hp;
      this.maxHp = conf.hp;
      this.speed = conf.speed;
      this.bulletSpeed = conf.bulletSpeed;
      this.scoreValue = conf.score;
      this.primaryColor = conf.color || '#c0c0c0';
      this.trackColor = conf.trackColor || '#505050';
      this.armorColors = conf.colors || null;
    }
    takeDamage(amount) {
      return super.takeDamage(amount);
    }
    updateAI(dt, player, eaglePos, bullets, otherTanks) {
      super.update(dt);
      if (this.destroyed) return;
      if (this.spawning) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) this.spawning = false;
        return;
      }
      if (this.isBonusTank) this.bonusBlink += dt * 10;
      this.changeDirTimer -= dt;
      const moved = this.move(this.dir, dt, otherTanks);
      if (!moved || this.changeDirTimer <= 0) {
        this.dir = this.chooseSmart(eaglePos, player);
        this.changeDirTimer = Math.random() * 2.5 + 1.0;
        if (!moved && Math.random() < 0.6) this.shootTimer = Math.min(this.shootTimer, 0.15);
      }
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        const b = this.createBullet('ENEMY');
        if (b) {
          bullets.push(b);
          if (this.vibrate) this.vibrate('light');
        }
        this.shootTimer = Math.random() * 1.5 + 0.6;
      }
    }
    chooseSmart(eaglePos, player) {
      const r = Math.random();
      if (r < 0.40 && this.y < eaglePos.y * TILE - 20) return DIR.DOWN;
      if (r < 0.65 && player && !player.destroyed) {
        const dx = player.x - this.x, dy = player.y - this.y;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIR.RIGHT : DIR.LEFT;
        return dy > 0 ? DIR.DOWN : DIR.UP;
      }
      const dirs = [DIR.UP, DIR.RIGHT, DIR.DOWN, DIR.LEFT];
      return dirs[Math.floor(Math.random() * 4)];
    }
    render(ctx) {
      if (this.destroyed) return;
      if (this.spawning) {
        const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
        const star = Math.sin(this.spawnTimer * 20) * 8 + 12;
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 2, cy - star, 4, star * 2);
        ctx.fillRect(cx - star, cy - 2, star * 2, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, cy - star * 0.7, 2, star * 1.4);
        ctx.fillRect(cx - star * 0.7, cy - 1, star * 1.4, 2);
        ctx.restore();
        return;
      }
      let color = this.primaryColor, trackC = this.trackColor;
      if (this.armorColors) {
        const idx = Math.max(0, Math.min(this.armorColors.length - 1, this.hp - 1));
        color = this.armorColors[idx];
      }
      if (this.isBonusTank && Math.floor(this.bonusBlink) % 2 === 0) {
        color = '#ff3838';
        trackC = '#ffffff';
      }
      this.renderBaseTank(ctx, color, trackC, 15);
    }
  }

  // ===== 子弹 =====
  class Bullet {
    constructor(x, y, dir, speed, ownerType, power, canBreakSteel, ownerTank) {
      this.dir = dir;
      this.speed = speed;
      this.ownerType = ownerType;
      this.power = power || 1;
      this.canBreakSteel = !!canBreakSteel;
      this.ownerTank = ownerTank;
      this.destroyed = false;
      this.size = 6;
      this.width = this.size;
      this.height = this.size;
      this.x = x - this.size / 2;
      this.y = y - this.size / 2;
    }
    update(dt) {
      if (this.destroyed) return;
      const off = DIR_OFFSET[this.dir];
      const step = this.speed * 60 * dt;
      this.x += off.x * step;
      this.y += off.y * step;
      if (this.x < 0 || this.y < 0 || this.x + this.width > CANVAS_W || this.y + this.height > CANVAS_H) {
        this.destroyed = true;
      }
    }
    collidesWith(e) {
      return this.x < e.x + e.width && this.x + this.width > e.x && this.y < e.y + e.height && this.y + this.height > e.y;
    }
    render(ctx) {
      if (this.destroyed) return;
      ctx.fillStyle = this.ownerType === 'PLAYER' ? '#ffeaa7' : '#ff7675';
      ctx.beginPath();
      ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== 爆炸特效 =====
  class Explosion {
    constructor(x, y, big) {
      this.x = x;
      this.y = y;
      this.big = big;
      this.life = big ? 0.5 : 0.3;
      this.maxLife = this.life;
      this.finished = false;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.finished = true;
    }
    render(ctx) {
      const p = 1 - this.life / this.maxLife;
      const r = (this.big ? 28 : 14) * p;
      if (r <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#feca57';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ===== 主游戏引擎 =====
  class TankBattleGame {
    constructor(opts) {
      this.opts = opts || {};
      this.vibrate = typeof this.opts.vibrate === 'function' ? this.opts.vibrate : function () {};
      this.STATE = { TITLE: 0, STAGE_START: 1, PLAYING: 2, PAUSED: 3, VICTORY: 4, GAME_OVER: 5 };
      this.state = this.STATE.TITLE;
      this.mapManager = new MapManager();
      this.player = null;
      this.enemies = [];
      this.bullets = [];
      this.explosions = [];
      this.currentLevelIndex = 0;
      this.enemyQueue = [];
      this.spawnPoints = [
        { x: 0, y: 0 },
        { x: 12 * TILE, y: 0 },
        { x: 24 * TILE, y: 0 }
      ];
      this.nextSpawnIndex = 0;
      this.spawnTimer = 0;
      this.victoryTimer = 0;
      this.gameOverTimer = 0;
      this.playerRespawnTimer = 0;
      this.inputDir = -1; // 当前按住方向（-1 无）
    }

    start() {
      this.currentLevelIndex = 0;
      this.player = new PlayerTank(8 * TILE, 24 * TILE, this.mapManager);
      this.loadStage(0);
    }

    loadStage(levelIndex) {
      this.currentLevelIndex = levelIndex;
      this.mapManager.loadLevel(levelIndex);
      this.bullets = [];
      this.explosions = [];
      this.enemies = [];
      const lv = LEVELS[levelIndex % LEVELS.length];
      this.enemyQueue = lv.enemies.slice();
      this.spawnTimer = 0.5;
      this.nextSpawnIndex = 0;
      if (this.player) this.player.resetForNextStage();
      this.state = this.STATE.PLAYING;
    }

    fire() {
      if (this.state !== this.STATE.PLAYING || !this.player || this.player.destroyed) return;
      const b = this.player.createBullet('PLAYER');
      if (b) {
        this.bullets.push(b);
        this.vibrate('light');
      }
    }

    togglePause() {
      if (this.state === this.STATE.PLAYING) this.state = this.STATE.PAUSED;
      else if (this.state === this.STATE.PAUSED) this.state = this.STATE.PLAYING;
    }

    setMoveDir(dir) {
      this.inputDir = dir;
    }

    getRemainingEnemies() {
      return this.enemyQueue.length + this.enemies.length;
    }

    update(dt) {
      if (this.state === this.STATE.PLAYING) this.updatePlaying(dt);
      else if (this.state === this.STATE.VICTORY) {
        this.victoryTimer -= dt;
        this._updateExplosions(dt);
        if (this.victoryTimer <= 0) this.loadStage(this.currentLevelIndex + 1);
      } else if (this.state === this.STATE.GAME_OVER) {
        this.gameOverTimer += dt;
        this._updateExplosions(dt);
      }
    }

    updatePlaying(dt) {
      this.mapManager.update(dt);

      // 玩家
      if (this.player) {
        if (this.player.destroyed) {
          if (this.player.lives > 0) {
            this.playerRespawnTimer -= dt;
            if (this.playerRespawnTimer <= 0) this.player.respawn();
          }
        } else {
          this.player.updateShield(dt);
          this.player.update(dt);
          if (this.inputDir >= 0) this.player.move(this.inputDir, dt, this._allTanks());
        }
      }

      // 刷怪
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < MAX_ACTIVE_ENEMIES && this.enemyQueue.length > 0) {
        this.spawnEnemy();
        this.spawnTimer = 2.5;
      }

      // 敌车 AI
      const all = this._allTanks();
      for (const e of this.enemies) {
        e.updateAI(dt, this.player, this.mapManager.eaglePos, this.bullets, all);
      }

      // 玩家碾压（护盾）
      if (this.player && !this.player.destroyed && this.player.collidedTank) {
        const t = this.player.collidedTank;
        if (!t.destroyed && !t.spawning) {
          if (this.player.shieldTimer > 0) {
            t.destroyed = true;
            this.player.score += t.scoreValue || 100;
            this.explosions.push(new Explosion(t.x + t.width / 2, t.y + t.height / 2, true));
            this.vibrate('heavy');
          } else {
            t.shootTimer = Math.min(t.shootTimer, 0.2);
          }
        }
      }

      this._updateBullets(dt);
      this._updateExplosions(dt);
      this._checkConditions();
    }

    _allTanks() {
      const arr = [];
      if (this.player && !this.player.destroyed) arr.push(this.player);
      for (const e of this.enemies) arr.push(e);
      return arr;
    }

    _updateExplosions(dt) {
      for (const exp of this.explosions) exp.update(dt);
      this.explosions = this.explosions.filter((e) => !e.finished);
    }

    spawnEnemy() {
      const raw = this.enemyQueue.shift();
      let isBonus = false, typeVal = raw;
      if (typeof raw === 'string' && raw.charAt(0) === '*') {
        isBonus = true;
        typeVal = parseInt(raw.substring(1), 10);
      }
      const pt = this.spawnPoints[this.nextSpawnIndex];
      this.nextSpawnIndex = (this.nextSpawnIndex + 1) % this.spawnPoints.length;
      const canSpawn = !this.enemies.some((e) => Math.abs(e.x - pt.x) < 30 && Math.abs(e.y - pt.y) < 30);
      if (canSpawn) {
        this.enemies.push(new EnemyTank(pt.x, pt.y, typeVal, isBonus, this.mapManager));
      } else {
        this.enemyQueue.unshift(raw);
      }
    }

    _updateBullets(dt) {
      for (const b of this.bullets) b.update(dt);
      for (const b of this.bullets) {
        if (!b.destroyed && this.mapManager.hitTestBullet(b)) {
          b.destroyed = true;
          this.explosions.push(new Explosion(b.x, b.y, false));
        }
      }
      // 子弹互撞
      for (let i = 0; i < this.bullets.length; i++) {
        for (let j = i + 1; j < this.bullets.length; j++) {
          const b1 = this.bullets[i], b2 = this.bullets[j];
          if (!b1.destroyed && !b2.destroyed && b1.ownerType !== b2.ownerType && b1.collidesWith(b2)) {
            b1.destroyed = true;
            b2.destroyed = true;
            this.explosions.push(new Explosion((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, false));
          }
        }
      }
      // 玩家子弹击敌
      for (const b of this.bullets) {
        if (b.destroyed || b.ownerType !== 'PLAYER') continue;
        for (const e of this.enemies) {
          if (!e.destroyed && !e.spawning && b.collidesWith(e)) {
            b.destroyed = true;
            const killed = e.takeDamage(b.power);
            if (killed) {
              this.player.score += e.scoreValue || 100;
              this.explosions.push(new Explosion(e.x + e.width / 2, e.y + e.height / 2, true));
              this.vibrate('heavy');
            } else {
              this.explosions.push(new Explosion(b.x, b.y, false));
            }
            break;
          }
        }
      }
      // 敌子弹击玩家
      for (const b of this.bullets) {
        if (b.destroyed || b.ownerType !== 'ENEMY') continue;
        if (this.player && !this.player.destroyed && b.collidesWith(this.player)) {
          b.destroyed = true;
          const killed = this.player.takeDamage(1);
          if (killed) {
            this.explosions.push(new Explosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, true));
            this.vibrate('heavy');
            if (this.player.lives > 0) this.playerRespawnTimer = 1.0;
          } else {
            this.explosions.push(new Explosion(b.x, b.y, false));
          }
        }
      }
      // 回收炮弹配额
      for (const b of this.bullets) {
        if (b.destroyed) {
          if (b.ownerTank) b.ownerTank.activeBullets = Math.max(0, b.ownerTank.activeBullets - 1);
          else if (b.ownerType === 'PLAYER' && this.player) this.player.activeBullets = Math.max(0, this.player.activeBullets - 1);
        }
      }
      this.bullets = this.bullets.filter((b) => !b.destroyed);
      this.enemies = this.enemies.filter((e) => !e.destroyed);
    }

    _checkConditions() {
      if (!this.mapManager.eagleAlive) {
        this.triggerGameOver();
        return;
      }
      if (this.player && this.player.lives <= 0 && this.player.destroyed) {
        this.triggerGameOver();
        return;
      }
      if (this.enemyQueue.length === 0 && this.enemies.length === 0) {
        this.state = this.STATE.VICTORY;
        this.victoryTimer = 2.5;
      }
    }

    triggerGameOver() {
      if (this.state === this.STATE.GAME_OVER) return;
      this.state = this.STATE.GAME_OVER;
      this.gameOverTimer = 0;
      this.vibrate('heavy');
    }

    render(ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      this.mapManager.renderBase(ctx);
      if (this.player) this.player.render(ctx);
      for (const e of this.enemies) e.render(ctx);
      for (const b of this.bullets) b.render(ctx);
      for (const exp of this.explosions) exp.render(ctx);
      this.mapManager.renderTop(ctx);
    }
  }

  const api = { TankBattleGame, DIR, T, COLS, ROWS, TILE, CANVAS_W, CANVAS_H, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TankBattleGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
