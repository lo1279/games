// pages/games/super-mario/index.js
/**
 * 🍄 超级马里奥兄弟 - 小程序原生 Canvas 2D 移植版
 * 包含 NES 256x240 等比缩放渲染、物理重力惯性、板栗仔互动、顶金币与双侧虚拟按键
 */

const NES_WIDTH = 256;
const NES_HEIGHT = 240;
const TILE_SIZE = 16;

Page({
  data: {
    score: 0,
    scoreStr: '000000',
    coins: '00',
    worldStr: '1-1',
    timeLeft: 400,
    gameState: 'playing' // playing, gameover, win
  },

  onReady() {
    this.initCanvasAndGame();
  },

  onUnload() {
    this.stopLoop();
  },

  onHide() {
    this.keys = {};
  },

  initCanvasAndGame() {
    const query = wx.createSelectorQuery();
    query.select('#marioCanvas')
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
        this.viewWidth = width;
        this.viewHeight = height;

        // 计算 NES 视口在实际 Canvas 上的缩放比例
        this.scale = Math.min(width / NES_WIDTH, height / NES_HEIGHT);
        this.offsetX = (width - NES_WIDTH * this.scale) / 2;
        this.offsetY = (height - NES_HEIGHT * this.scale) / 2;

        this.keys = { left: false, right: false, down: false, b: false, a: false };
        this.resetGame();
        this.startLoop();
      });
  },

  resetGame() {
    // 玩家马里奥物理状态
    this.mario = {
      x: 32,
      y: 180,
      vx: 0,
      vy: 0,
      w: 14,
      h: 16,
      grounded: true,
      facingRight: true
    };

    this.cameraX = 0;
    this.coinsCount = 0;
    this.gameScore = 0;
    this.timer = 400;
    this.timerTick = 0;

    // 地形与瓦片（极简 World 1-1：地面、问号方块、砖块、旗杆）
    this.blocks = [
      { x: 16 * 8, y: 144, type: 'question', hit: false },
      { x: 16 * 10, y: 144, type: 'brick' },
      { x: 16 * 11, y: 144, type: 'question', hit: false },
      { x: 16 * 12, y: 144, type: 'brick' },
      { x: 16 * 13, y: 144, type: 'question', hit: false },
      { x: 16 * 14, y: 144, type: 'brick' },
      // 水管
      { x: 16 * 18, y: 176, w: 32, h: 32, type: 'pipe' },
      { x: 16 * 24, y: 160, w: 32, h: 48, type: 'pipe' },
      // 终点旗杆
      { x: 16 * 40, y: 48, w: 4, h: 160, type: 'flag' }
    ];

    // 板栗仔敌人
    this.enemies = [
      { x: 16 * 12, y: 192, vx: -0.6, alive: true },
      { x: 16 * 22, y: 192, vx: -0.6, alive: true },
      { x: 16 * 32, y: 192, vx: -0.6, alive: true }
    ];

    this.particles = [];

    this.setData({
      score: 0,
      scoreStr: '000000',
      coins: '00',
      worldStr: '1-1',
      timeLeft: 400,
      gameState: 'playing'
    });
  },

  // ===== 主循环 =====
  startLoop() {
    this.stopLoop();
    const loop = () => {
      if (this.data.gameState === 'playing') {
        this.update();
        this.render();
      }
      this.animId = this.canvas.requestAnimationFrame(loop);
    };
    this.animId = this.canvas.requestAnimationFrame(loop);
  },

  stopLoop() {
    if (this.animId && this.canvas) {
      this.canvas.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  // ===== 物理与逻辑更新 =====
  update() {
    const m = this.mario;
    const k = this.keys;

    // 倒计时
    this.timerTick++;
    if (this.timerTick >= 60) {
      this.timerTick = 0;
      this.timer = Math.max(0, this.timer - 1);
      this.setData({ timeLeft: this.timer });
      if (this.timer <= 0) {
        this.gameOver();
      }
    }

    // 1. 水平移动与摩擦力
    const accel = k.b ? 0.22 : 0.14;
    const maxSpeed = k.b ? 2.8 : 1.8;

    if (k.left) {
      m.vx = Math.max(-maxSpeed, m.vx - accel);
      m.facingRight = false;
    } else if (k.right) {
      m.vx = Math.min(maxSpeed, m.vx + accel);
      m.facingRight = true;
    } else {
      m.vx *= 0.82;
      if (Math.abs(m.vx) < 0.05) m.vx = 0;
    }

    m.x += m.vx;
    if (m.x < this.cameraX) m.x = this.cameraX;

    // 2. 镜头跟随
    if (m.x - this.cameraX > NES_WIDTH * 0.45) {
      this.cameraX = m.x - NES_WIDTH * 0.45;
    }

    // 3. 垂直重力与跳跃
    if (k.a && m.grounded) {
      m.vy = -5.4;
      m.grounded = false;
      try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    }

    m.vy += 0.26; // 重力
    m.y += m.vy;

    // 地面碰撞 (Y = 192 为标准地面)
    if (m.y >= 192) {
      m.y = 192;
      m.vy = 0;
      m.grounded = true;
    }

    // 4. 碰撞瓦片检测 (问号箱/水管)
    this.blocks.forEach(b => {
      if (b.type === 'pipe') {
        // 水管阻挡
        if (m.x + m.w > b.x && m.x < b.x + b.w && m.y + m.h > b.y && m.y < b.y + b.h) {
          if (m.vy > 0 && m.y + m.h - m.vy <= b.y + 4) {
            m.y = b.y - m.h;
            m.vy = 0;
            m.grounded = true;
          } else if (m.vx > 0) {
            m.x = b.x - m.w;
            m.vx = 0;
          } else if (m.vx < 0) {
            m.x = b.x + b.w;
            m.vx = 0;
          }
        }
      } else if (b.type === 'question' || b.type === 'brick') {
        // 顶方块 (从下向上顶)
        if (m.x + m.w > b.x && m.x < b.x + 16 && m.y <= b.y + 16 && m.y - m.vy >= b.y + 12) {
          m.vy = 1.5;
          if (b.type === 'question' && !b.hit) {
            b.hit = true;
            this.addCoin(b.x + 4, b.y - 12);
          }
        }
      } else if (b.type === 'flag') {
        // 触碰终点旗杆通关
        if (m.x + m.w >= b.x) {
          this.gameWin();
        }
      }
    });

    // 5. 敌人更新与踩踏检测
    this.enemies.forEach(e => {
      if (!e.alive) return;
      e.x += e.vx;

      // 玩家踩板栗仔
      if (m.x + m.w > e.x && m.x < e.x + 16 && m.y + m.h >= e.y && m.y + m.h <= e.y + 10 && m.vy > 0) {
        e.alive = false;
        m.vy = -3.8; // 踩中弹跳
        this.addScore(100);
        try { wx.vibrateShort({ type: 'medium' }); } catch (err) {}
      } else if (m.x + m.w > e.x + 2 && m.x < e.x + 14 && m.y + m.h > e.y + 4 && m.y < e.y + 14) {
        // 撞到板栗仔身亡
        this.gameOver();
      }
    });

    // 粒子动画衰减
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  addCoin(x, y) {
    this.coinsCount++;
    this.addScore(200);
    this.setData({ coins: String(this.coinsCount).padStart(2, '0') });
    this.particles.push({ x, y, vy: -2.5, life: 25, char: '🪙' });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
  },

  addScore(val) {
    this.gameScore += val;
    this.setData({
      score: this.gameScore,
      scoreStr: String(this.gameScore).padStart(6, '0')
    });
  },

  // ===== 渲染管线 =====
  render() {
    const ctx = this.ctx;
    const w = this.viewWidth;
    const h = this.viewHeight;
    const s = this.scale;
    const ox = this.offsetX;
    const oy = this.offsetY;

    // 1. 清屏 (天蓝天空背景)
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    // 2. 绘制地面 (双层褐色/绿色像素地面)
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(0, 208, NES_WIDTH, 32);
    ctx.fillStyle = '#00a800';
    ctx.fillRect(0, 208, NES_WIDTH, 4);

    // 3. 绘制关卡瓦片
    const camX = this.cameraX;
    this.blocks.forEach(b => {
      const screenX = b.x - camX;
      if (screenX < -32 || screenX > NES_WIDTH + 32) return;

      if (b.type === 'pipe') {
        // 绿色水管
        ctx.fillStyle = '#00a800';
        ctx.fillRect(screenX, b.y, b.w, b.h);
        ctx.fillStyle = '#00e800';
        ctx.fillRect(screenX + 2, b.y, 4, b.h);
      } else if (b.type === 'question') {
        // 问号方块 (金色/撞碎后变灰)
        ctx.fillStyle = b.hit ? '#887000' : '#fc9838';
        ctx.fillRect(screenX, b.y, 16, 16);
        ctx.fillStyle = '#000000';
        ctx.font = '10px monospace';
        ctx.fillText(b.hit ? '•' : '?', screenX + 5, b.y + 12);
      } else if (b.type === 'brick') {
        // 棕色砖块
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(screenX, b.y, 16, 16);
      } else if (b.type === 'flag') {
        // 终点旗杆
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(screenX, b.y, b.w, b.h);
        ctx.fillStyle = '#00a800';
        ctx.fillRect(screenX - 12, b.y + 10, 12, 10);
      }
    });

    // 4. 绘制板栗仔
    this.enemies.forEach(e => {
      if (!e.alive) return;
      const ex = e.x - camX;
      ctx.fillStyle = '#e45c10';
      ctx.fillRect(ex, e.y, 16, 16);
      // 白眼球
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex + 3, e.y + 4, 3, 5);
      ctx.fillRect(ex + 10, e.y + 4, 3, 5);
    });

    // 5. 绘制玩家马里奥 (红帽背带裤)
    const m = this.mario;
    const mx = m.x - camX;
    // 红色工装上衣
    ctx.fillStyle = '#b81800';
    ctx.fillRect(mx + 2, m.y + 4, 10, 8);
    // 蓝色工装裤
    ctx.fillStyle = '#0000cc';
    ctx.fillRect(mx + 3, m.y + 10, 8, 6);
    // 脸部与帽子
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(mx + 3, m.y, 8, 6);
    ctx.fillStyle = '#b81800';
    ctx.fillRect(mx + 1, m.y, 12, 3);

    // 6. 浮动粒子 (金币)
    this.particles.forEach(p => {
      ctx.fillStyle = '#fcd800';
      ctx.font = '12px monospace';
      ctx.fillText(p.char, p.x - camX, p.y);
    });

    ctx.restore();
  },

  // ===== 虚拟按键事件 =====
  btnLeftDown() { this.keys.left = true; },
  btnLeftUp() { this.keys.left = false; },
  btnRightDown() { this.keys.right = true; },
  btnRightUp() { this.keys.right = false; },
  btnDownDown() { this.keys.down = true; },
  btnDownUp() { this.keys.down = false; },
  btnBDown() { this.keys.b = true; },
  btnBUp() { this.keys.b = false; },
  btnADown() { this.keys.a = true; },
  btnAUp() { this.keys.a = false; },

  gameOver() {
    this.setData({ gameState: 'gameover' });
    try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
  },

  gameWin() {
    this.setData({ gameState: 'win' });
    try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
  },

  restartGame() {
    this.resetGame();
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: '/pages/index/index' });
      }
    });
  }
});
