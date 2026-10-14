// pages/games/thunder-fighter/index.js
/**
 * 🚀 雷霆战机 (Thunder Fighter) 小程序原生移植版
 * 采用 Canvas 2D 渲染管线、粒子系统、敌机弹幕与单指触屏跟踪操控
 */
const STORAGE_KEY_HIGH = 'thunder_fighter_highscore';

Page({
  data: {
    score: 0,
    highScore: 0,
    hpPercent: 100,
    gameState: 'playing', // playing, gameover
    isPaused: false,
    bombCount: 2,
    bombReady: true
  },

  onLoad() {
    const highScore = wx.getStorageSync(STORAGE_KEY_HIGH) || 0;
    this.setData({ highScore });
  },

  onReady() {
    this.initGameCanvas();
  },

  onUnload() {
    this.stopGameLoop();
  },

  onHide() {
    this.pauseGame();
  },

  // ===== 画布与游戏主逻辑初始化 =====
  initGameCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;
        this.width = width;
        this.height = height;

        this.loadAssetsAndStart();
      });
  },

  loadAssetsAndStart() {
    // 预载常用图片
    this.images = {};
    const imgList = {
      player: './images/player.png',
      player_rage: './images/player_rage.png',
      wingman: './images/wingman.png',
      scout: './images/enemy_scout.png',
      gunship: './images/enemy_gunship.png',
      cruiser: './images/enemy_cruiser.png',
      boss: './images/boss.png'
    };

    let loadedCount = 0;
    const totalCount = Object.keys(imgList).length;

    Object.keys(imgList).forEach((key) => {
      const img = this.canvas.createImage();
      img.onload = () => {
        loadedCount++;
        if (loadedCount >= totalCount) {
          this.resetGameData();
          this.startGameLoop();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalCount) {
          this.resetGameData();
          this.startGameLoop();
        }
      };
      img.src = imgList[key];
      this.images[key] = img;
    });
  },

  resetGameData() {
    const w = this.width;
    const h = this.height;

    // 玩家战机
    this.player = {
      x: w / 2,
      y: h - 120,
      width: 44,
      height: 44,
      hp: 100,
      maxHp: 100,
      isRage: false,
      rageTime: 0,
      shootInterval: 8,
      shootTimer: 0,
      bulletLevel: 1
    };

    this.bullets = [];       // 玩家子弹
    this.enemyBullets = [];  // 敌机子弹
    this.enemies = [];       // 敌机列表
    this.particles = [];     // 粒子特效
    this.stars = [];         // 星空背景
    this.items = [];         // 掉落道具

    // 初始化星空背景
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 1 + Math.random() * 3,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    this.spawnTimer = 0;
    this.gameScore = 0;
    this.bombCount = 2;

    this.setData({
      score: 0,
      hpPercent: 100,
      gameState: 'playing',
      isPaused: false,
      bombCount: 2,
      bombReady: true
    });
  },

  // ===== 主循环 =====
  startGameLoop() {
    this.stopGameLoop();
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!this.data.isPaused && this.data.gameState === 'playing') {
        this.update(dt);
        this.render();
      }

      this.animId = this.canvas.requestAnimationFrame(loop);
    };

    this.animId = this.canvas.requestAnimationFrame(loop);
  },

  stopGameLoop() {
    if (this.animId && this.canvas) {
      this.canvas.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  // ===== 物理与逻辑更新 =====
  update(dt) {
    const w = this.width;
    const h = this.height;

    // 1. 星空卷轴
    this.stars.forEach(s => {
      s.y += s.speed;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * w;
      }
    });

    // 2. 玩家战机射击
    this.player.shootTimer++;
    if (this.player.shootTimer >= (this.player.isRage ? 4 : this.player.shootInterval)) {
      this.player.shootTimer = 0;
      this.firePlayerBullet();
    }

    if (this.player.isRage) {
      this.player.rageTime -= dt;
      if (this.player.rageTime <= 0) {
        this.player.isRage = false;
      }
    }

    // 3. 玩家子弹更新
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= b.vy;
      b.x += b.vx || 0;
      if (b.y < -20 || b.x < -20 || b.x > w + 20) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. 敌机生成与更新
    this.spawnTimer++;
    if (this.spawnTimer > 45) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy;
      e.x += Math.sin(e.y * 0.05) * (e.vx || 0);

      // 敌机开火
      e.shootTimer = (e.shootTimer || 0) + 1;
      if (e.shootTimer > e.shootInterval) {
        e.shootTimer = 0;
        this.fireEnemyBullet(e);
      }

      // 出界清理
      if (e.y > h + 40) {
        this.enemies.splice(i, 1);
        continue;
      }

      // 敌机与玩家子弹碰撞检测
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (Math.abs(b.x - e.x) < (e.width / 2 + 6) && Math.abs(b.y - e.y) < (e.height / 2 + 6)) {
          e.hp -= b.dmg;
          this.createSpark(b.x, b.y, '#00f0ff');
          this.bullets.splice(j, 1);

          if (e.hp <= 0) {
            this.destroyEnemy(e, i);
            break;
          }
        }
      }
    }

    // 5. 敌机子弹更新
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx;
      eb.y += eb.vy;
      if (eb.y > h + 20 || eb.x < -20 || eb.x > w + 20) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // 命中玩家
      if (Math.abs(eb.x - this.player.x) < 14 && Math.abs(eb.y - this.player.y) < 14) {
        this.enemyBullets.splice(i, 1);
        this.damagePlayer(15);
      }
    }

    // 6. 掉落道具与玩家拾取
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.y += 1.5;
      if (it.y > h + 20) {
        this.items.splice(i, 1);
        continue;
      }
      if (Math.abs(it.x - this.player.x) < 28 && Math.abs(it.y - this.player.y) < 28) {
        this.collectItem(it);
        this.items.splice(i, 1);
      }
    }

    // 7. 粒子衰减更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  },

  firePlayerBullet() {
    const p = this.player;
    const isRage = p.isRage;
    const lvl = p.bulletLevel;

    if (lvl === 1 && !isRage) {
      this.bullets.push({ x: p.x, y: p.y - 20, vy: 14, dmg: 10 });
    } else if (lvl === 2 || (lvl === 1 && isRage)) {
      this.bullets.push({ x: p.x - 12, y: p.y - 15, vy: 14, dmg: 10 });
      this.bullets.push({ x: p.x + 12, y: p.y - 15, vy: 14, dmg: 10 });
    } else {
      this.bullets.push({ x: p.x, y: p.y - 24, vy: 15, dmg: 15 });
      this.bullets.push({ x: p.x - 16, y: p.y - 15, vy: 14, vx: -1.5, dmg: 10 });
      this.bullets.push({ x: p.x + 16, y: p.y - 15, vy: 14, vx: 1.5, dmg: 10 });
    }
  },

  spawnEnemy() {
    const w = this.width;
    const r = Math.random();
    let type = 'scout';
    let hp = 20;
    let width = 36;
    let height = 36;
    let vy = 2.5;

    if (r > 0.75) {
      type = 'gunship';
      hp = 45;
      width = 44;
      height = 44;
      vy = 1.8;
    } else if (r > 0.92) {
      type = 'cruiser';
      hp = 100;
      width = 56;
      height = 56;
      vy = 1.2;
    }

    this.enemies.push({
      x: 30 + Math.random() * (w - 60),
      y: -40,
      type,
      hp,
      maxHp: hp,
      width,
      height,
      vy,
      vx: (Math.random() - 0.5) * 2,
      shootInterval: type === 'cruiser' ? 60 : (type === 'gunship' ? 90 : 130),
      shootTimer: Math.floor(Math.random() * 30)
    });
  },

  fireEnemyBullet(e) {
    const px = this.player.x;
    const py = this.player.y;
    const angle = Math.atan2(py - e.y, px - e.x);
    const speed = 4;

    this.enemyBullets.push({
      x: e.x,
      y: e.y + e.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    });
  },

  destroyEnemy(e, index) {
    this.enemies.splice(index, 1);
    this.createExplosion(e.x, e.y, e.type === 'cruiser' ? 24 : 14);

    // 得分
    const addScore = e.type === 'cruiser' ? 300 : (e.type === 'gunship' ? 150 : 50);
    this.gameScore += addScore;
    this.setData({ score: this.gameScore });

    // 掉落概率
    if (Math.random() < 0.25) {
      this.items.push({
        x: e.x,
        y: e.y,
        type: Math.random() > 0.4 ? 'power' : 'heal'
      });
    }

    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
  },

  collectItem(it) {
    if (it.type === 'power') {
      this.player.bulletLevel = Math.min(3, this.player.bulletLevel + 1);
      this.createSpark(this.player.x, this.player.y, '#ffaa00');
    } else {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      this.updateHpDisplay();
      this.createSpark(this.player.x, this.player.y, '#00ff88');
    }
  },

  damagePlayer(dmg) {
    this.player.hp -= dmg;
    this.updateHpDisplay();
    this.createSpark(this.player.x, this.player.y, '#ff0055');
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}

    if (this.player.hp <= 0) {
      this.gameOver();
    }
  },

  updateHpDisplay() {
    const pct = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
    this.setData({ hpPercent: Math.round(pct) });
  },

  createExplosion(x, y, count) {
    const colors = ['#ff4400', '#ffaa00', '#ffff00', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.03 + Math.random() * 0.03
      });
    }
  },

  createSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: 2,
        color: color,
        alpha: 1,
        decay: 0.06
      });
    }
  },

  // ===== 渲染管线 =====
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. 星空
    ctx.fillStyle = '#ffffff';
    this.stars.forEach(s => {
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.globalAlpha = 1.0;

    // 2. 玩家子弹
    ctx.fillStyle = this.player.isRage ? '#ff0055' : '#00f0ff';
    this.bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. 敌机绘制
    this.enemies.forEach(e => {
      const img = this.images[e.type];
      if (img && img.width) {
        ctx.drawImage(img, e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
      } else {
        ctx.fillStyle = '#ff3366';
        ctx.fillRect(e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
      }
    });

    // 4. 敌机子弹
    ctx.fillStyle = '#ffaa00';
    this.enemyBullets.forEach(eb => {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. 掉落物
    this.items.forEach(it => {
      ctx.fillStyle = it.type === 'power' ? '#ffaa00' : '#00ff88';
      ctx.beginPath();
      ctx.arc(it.x, it.y, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. 粒子
    this.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 7. 玩家战机
    const p = this.player;
    const pImg = p.isRage ? this.images.player_rage : this.images.player;
    if (pImg && pImg.width) {
      ctx.drawImage(pImg, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    } else {
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 20);
      ctx.lineTo(p.x - 18, p.y + 18);
      ctx.lineTo(p.x + 18, p.y + 18);
      ctx.closePath();
      ctx.fill();
    }
  },

  // ===== 触控事件 (手指拖拽移动) =====
  onTouchStart(e) {
    if (this.data.isPaused || this.data.gameState !== 'playing') return;
    const touch = e.touches[0];
    this.touchStartX = touch.x;
    this.touchStartY = touch.y;
    this.playerStartX = this.player.x;
    this.playerStartY = this.player.y;
  },

  onTouchMove(e) {
    if (this.data.isPaused || this.data.gameState !== 'playing') return;
    const touch = e.touches[0];
    const dx = touch.x - this.touchStartX;
    const dy = touch.y - this.touchStartY;

    this.player.x = Math.max(24, Math.min(this.width - 24, this.playerStartX + dx));
    this.player.y = Math.max(40, Math.min(this.height - 40, this.playerStartY + dy));
  },

  onTouchEnd() {
    // 释放触控
  },

  // ===== 技能与大招 =====
  triggerBomb() {
    if (this.data.bombCount <= 0 || !this.data.bombReady || this.data.gameState !== 'playing') return;

    this.setData({
      bombCount: this.data.bombCount - 1,
      bombReady: this.data.bombCount - 1 > 0
    });

    // 开启 5 秒暴走过载
    this.player.isRage = true;
    this.player.rageTime = 5;

    // 清屏全场敌机子弹并对敌机造成全屏伤害
    this.enemyBullets = [];
    this.enemies.forEach((e, idx) => {
      e.hp -= 80;
      if (e.hp <= 0) {
        this.destroyEnemy(e, idx);
      }
    });

    this.createExplosion(this.width / 2, this.height / 2, 40);
    try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
  },

  // ===== 游戏状态流转 =====
  togglePause() {
    const isPaused = !this.data.isPaused;
    this.setData({ isPaused });
  },

  pauseGame() {
    this.setData({ isPaused: true });
  },

  gameOver() {
    this.setData({ gameState: 'gameover' });
    const highScore = Math.max(this.data.highScore, this.gameScore);
    if (highScore > this.data.highScore) {
      wx.setStorageSync(STORAGE_KEY_HIGH, highScore);
      this.setData({ highScore });
    }
  },

  restartGame() {
    this.resetGameData();
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: '/pages/index/index' });
      }
    });
  }
});
