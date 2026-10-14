// pages/games/tetris/index.js
// 霓虹俄罗斯方块 · 微信小程序原生版
// 纯逻辑见 ../../../utils/tetris.js；本页只负责 Canvas 渲染、触屏控制、下落计时与状态机。
const { TetrisGame, COLS, ROWS } = require('../../../utils/tetris.js');

const HS_KEY = 'tetris_high_score';
const CLEAR_ANIM_MS = 180; // 消行动画窗口（与 Web 版一致）

Page({
  data: {
    score: 0,
    lines: 0,
    level: 1,
    highScore: 0,
    isPlaying: false,
    isPaused: false,
    showOverlay: true,
    overlayTitle: '霓虹俄罗斯方块',
    overlaySub: '点按棋盘或下方按钮开始',
    overlayBtn: '🎮 开始游戏'
  },

  // ===== 实例私有字段（不进 data，避免无谓 setData）=====
  game: null,
  mainCanvas: null,
  mainCtx: null,
  nextCanvas: null,
  nextCtx: null,
  holdCanvas: null,
  holdCtx: null,
  dpr: 2,
  blockSize: 30,
  offsetX: 0,
  offsetY: 0,
  viewW: 300,
  viewH: 600,
  nextBlock: 18,
  nextW: 72,
  nextH: 72,
  holdBlock: 18,
  holdW: 72,
  holdH: 72,
  dropTimer: null,
  clearing: false,
  // 触摸状态
  touchStartX: 0,
  touchStartY: 0,
  lastX: 0,
  lastY: 0,
  touchStartT: 0,
  hasMoved: false,
  lastTapTime: 0,

  onLoad() {
    this.game = new TetrisGame();
    let hs = 0;
    try {
      hs = parseInt(wx.getStorageSync(HS_KEY) || '0', 10) || 0;
    } catch (e) {
      hs = 0;
    }
    this.game.highScore = hs;
    this.setData({ highScore: hs });
  },

  onReady() {
    this.setupCanvases();
  },

  onUnload() {
    this.clearDropTimer();
  },

  onHide() {
    // 切后台自动暂停，避免回来时方块已堆死
    if (this.game && this.game.isPlaying && !this.game.isGameOver && !this.game.isPaused) {
      this.togglePause();
    }
  },

  // ===== Canvas 初始化 =====
  setupCanvases() {
    const q = wx.createSelectorQuery();
    q.select('#boardCanvas').fields({ node: true, size: true });
    q.select('#nextCanvas').fields({ node: true, size: true });
    q.select('#holdCanvas').fields({ node: true, size: true });
    q.select('.board-area').boundingClientRect();
    q.exec((res) => {
      const board = res[0];
      const next = res[1];
      const hold = res[2];
      const area = res[3];
      if (!board || !board.node || !area) {
        console.warn('[俄罗斯方块] canvas 节点获取失败');
        return;
      }
      let dpr = 2;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        dpr = info.pixelRatio || 2;
      } catch (e) {
        dpr = 2;
      }
      this.dpr = dpr;

      // 主棋盘：格子尺寸同时受宽高约束，保证整盘可见（不裁切、不滚动）
      const areaW = Math.floor(area.width) || 300;
      const areaH = Math.floor(area.height) || 600;
      let block = Math.min(Math.floor(areaW / COLS), Math.floor(areaH / ROWS));
      if (block < 10) block = 10;
      const boardW = block * COLS;
      const boardH = block * ROWS;

      this.mainCanvas = board.node;
      this.mainCtx = board.node.getContext('2d');
      this.mainCanvas.width = boardW * dpr;
      this.mainCanvas.height = boardH * dpr;
      this.mainCtx.scale(dpr, dpr);
      this.blockSize = block;
      this.viewW = areaW;
      this.viewH = areaH;
      this.offsetX = Math.floor((areaW - boardW) / 2);
      this.offsetY = Math.floor((areaH - boardH) / 2);

      // 预览画布（next / hold 通用尺寸）
      if (next && next.node) {
        this.nextCanvas = next.node;
        this.nextCtx = next.node.getContext('2d');
        this.nextW = Math.floor(next.width) || 72;
        this.nextH = Math.floor(next.height) || 72;
        this.nextCanvas.width = this.nextW * dpr;
        this.nextCanvas.height = this.nextH * dpr;
        this.nextCtx.scale(dpr, dpr);
        this.nextBlock = Math.min(Math.floor(this.nextW / 4), Math.floor(this.nextH / 4));
      }
      if (hold && hold.node) {
        this.holdCanvas = hold.node;
        this.holdCtx = hold.node.getContext('2d');
        this.holdW = Math.floor(hold.width) || 72;
        this.holdH = Math.floor(hold.height) || 72;
        this.holdCanvas.width = this.holdW * dpr;
        this.holdCanvas.height = this.holdH * dpr;
        this.holdCtx.scale(dpr, dpr);
        this.holdBlock = Math.min(Math.floor(this.holdW / 4), Math.floor(this.holdH / 4));
      }

      this.drawBoard();
      this.drawPreview(this.nextCtx, this.nextBlock, this.nextW, this.nextH, null);
      this.drawPreview(this.holdCtx, this.holdBlock, this.holdW, this.holdH, null);
    });
  },

  // ===== 渲染 =====
  drawBoard() {
    const ctx = this.mainCtx;
    if (!ctx) return;
    const block = this.blockSize;
    const g = this.game;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // 背景网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + r * block);
      ctx.lineTo(this.offsetX + COLS * block, this.offsetY + r * block);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + c * block, this.offsetY);
      ctx.lineTo(this.offsetX + c * block, this.offsetY + ROWS * block);
      ctx.stroke();
    }

    // 已固定方块
    const grid = g.board.grid;
    const clearing = g.board.clearingRows || [];
    for (let r = 0; r < ROWS; r++) {
      const isClearing = clearing.indexOf(r) !== -1;
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (cell) {
          if (isClearing) {
            this.drawCell(ctx, this.offsetX + c * block, this.offsetY + r * block, block, '#ffffff', null, true);
          } else {
            this.drawCell(ctx, this.offsetX + c * block, this.offsetY + r * block, block, cell.color, cell.glow, false);
          }
        }
      }
    }

    // 幽灵投影 + 活动方块
    if (g.currentPiece && !g.isClearing) {
      const p = g.currentPiece;
      const ghostY = g.ghostY();
      if (ghostY != null) {
        for (let r = 0; r < p.shape.length; r++) {
          for (let c = 0; c < p.shape[r].length; c++) {
            if (p.shape[r][c]) {
              const dy = ghostY + r;
              const dx = p.x + c;
              if (dy >= 0) this.drawCell(ctx, this.offsetX + dx * block, this.offsetY + dy * block, block, p.color, p.glow, false, true);
            }
          }
        }
      }
      for (let r = 0; r < p.shape.length; r++) {
        for (let c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c]) {
            const dy = p.y + r;
            const dx = p.x + c;
            if (dy >= 0) this.drawCell(ctx, this.offsetX + dx * block, this.offsetY + dy * block, block, p.color, p.glow, false, false);
          }
        }
      }
    }
  },

  /** 绘制单个方块单元：实心带立体高光；isGhost 为虚线投影；isFlash 为消行高亮 */
  drawCell(ctx, px, py, size, color, glow, isFlash, isGhost) {
    if (isFlash) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(px, py, size, size);
      return;
    }
    if (isGhost) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      ctx.fillStyle = (glow || color).replace(/[\d.]+\)$/, '0.12)');
      ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
    // 上方与左侧高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px + 1, py + 1, size - 2, 3);
    ctx.fillRect(px + 1, py + 1, 3, size - 2);
    // 右侧与下方阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px + 1, py + size - 4, size - 2, 3);
    ctx.fillRect(px + size - 4, py + 1, 3, size - 2);
    ctx.restore();
  },

  /** 绘制预览（next / hold）：把方块居中放进预览区 */
  drawPreview(ctx, block, w, h, piece) {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!piece) return;
    const shape = piece.shape;
    const rows = shape.length;
    const cols = shape[0].length;
    const offX = (w - cols * block) / 2;
    const offY = (h - rows * block) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (shape[r][c]) {
          this.drawCell(ctx, offX + c * block, offY + r * block, block, piece.color, piece.glow, false, false);
        }
      }
    }
  },

  refreshHUD() {
    this.setData({
      score: this.game.score,
      lines: this.game.lines,
      level: this.game.level,
      highScore: this.game.highScore,
      isPlaying: this.game.isPlaying,
      isPaused: this.game.isPaused
    });
  },

  // ===== 游戏流程 =====
  onStart() {
    // 覆盖层按钮：未开始 / 已结束 -> 新局；暂停中 -> 继续
    if (this.game.isGameOver || !this.game.isPlaying) {
      this.startGame();
    } else if (this.game.isPaused) {
      this.resume();
    }
  },

  startGame() {
    this.game.start();
    this.clearing = false;
    this.clearDropTimer();
    this.refreshHUD();
    this.setData({ showOverlay: false });
    this.drawBoard();
    this.drawPreview(this.nextCtx, this.nextBlock, this.nextW, this.nextH, this.game.nextPiece);
    this.drawPreview(this.holdCtx, this.holdBlock, this.holdW, this.holdH, null);
    this.vibrate('medium');
    this.scheduleDrop();
  },

  togglePause() {
    if (!this.game.isPlaying || this.game.isGameOver) return;
    if (this.game.isPaused) {
      this.resume();
    } else {
      this.game.isPaused = true;
      this.clearDropTimer();
      this.setData({
        showOverlay: true,
        overlayTitle: '已暂停',
        overlaySub: '点击继续按钮恢复',
        overlayBtn: '▶ 继续'
      });
      this.vibrate('light');
    }
  },

  resume() {
    this.game.isPaused = false;
    this.setData({ showOverlay: false });
    this.refreshHUD();
    this.scheduleDrop();
  },

  onRestart() {
    this.startGame();
  },

  // ===== 下落计时 =====
  clearDropTimer() {
    if (this.dropTimer) {
      clearTimeout(this.dropTimer);
      this.dropTimer = null;
    }
  },

  scheduleDrop() {
    this.clearDropTimer();
    if (!this.game.isPlaying || this.game.isPaused || this.game.isGameOver || this.clearing) return;
    this.dropTimer = setTimeout(() => this.onDrop(), this.game.getDropInterval());
  },

  onDrop() {
    if (this.clearing || !this.game.isPlaying || this.game.isPaused || this.game.isGameOver) return;
    if (this.game.canMove(0, 1)) {
      this.game.applyMove(0, 1);
      this.drawBoard();
      this.scheduleDrop();
    } else {
      this.lockFlow();
    }
  },

  /** 锁定当前块并接管消行窗口 / 生成下一块 */
  lockFlow() {
    const res = this.game.lockPiece();
    this.refreshHUD();
    this.drawBoard();
    if (res.cleared.length > 0) {
      this.clearing = true;
      this.drawBoard(); // 高亮满行
      this.vibrate('heavy');
      setTimeout(() => {
        const r2 = this.game.commitClear();
        this.clearing = false;
        this.refreshHUD();
        this.drawBoard();
        this.drawPreview(this.nextCtx, this.nextBlock, this.nextW, this.nextH, this.game.nextPiece);
        this.drawPreview(this.holdCtx, this.holdBlock, this.holdW, this.holdH, this.game.heldPiece);
        if (r2.gameOver) this.handleGameOver();
        else this.scheduleDrop();
      }, CLEAR_ANIM_MS);
    } else {
      this.drawPreview(this.nextCtx, this.nextBlock, this.nextW, this.nextH, this.game.nextPiece);
      this.drawPreview(this.holdCtx, this.holdBlock, this.holdW, this.holdH, this.game.heldPiece);
      if (res.gameOver) this.handleGameOver();
      else this.scheduleDrop();
    }
  },

  handleGameOver() {
    this.clearDropTimer();
    // 维护并落库最高分
    if (this.game.score > this.game.highScore) this.game.highScore = this.game.score;
    try {
      wx.setStorageSync(HS_KEY, String(this.game.highScore));
    } catch (e) {}
    this.refreshHUD();
    this.setData({
      showOverlay: true,
      overlayTitle: '游戏结束',
      overlaySub: '得分 ' + this.game.score + ' · 消行 ' + this.game.lines,
      overlayBtn: '🔄 再来一局'
    });
    this.vibrate('heavy');
  },

  // ===== 输入：虚拟手柄按钮 =====
  _active() {
    return this.game && this.game.isPlaying && !this.game.isPaused && !this.game.isGameOver && !this.clearing;
  },

  onLeft() {
    if (!this._active()) return;
    if (this.game.canMove(-1, 0)) {
      this.game.applyMove(-1, 0);
      this.drawBoard();
      this.vibrate('light');
    }
  },
  onRight() {
    if (!this._active()) return;
    if (this.game.canMove(1, 0)) {
      this.game.applyMove(1, 0);
      this.drawBoard();
      this.vibrate('light');
    }
  },
  onRotate() {
    if (!this._active()) return;
    if (this.game.applyRotate(true)) {
      this.drawBoard();
      this.vibrate('light');
    }
  },
  onSoftDrop() {
    if (!this._active()) return;
    if (this.game.canMove(0, 1)) {
      this.game.applyMove(0, 1);
      this.game.addScore(1);
      this.refreshHUD();
      this.drawBoard();
      this.scheduleDrop(); // 软降后重置下落计时
      this.vibrate('light');
    } else {
      this.lockFlow();
    }
  },
  onHardDrop() {
    if (!this._active()) return;
    const rows = this.game.dropToBottom();
    if (rows > 0) this.game.addScore(rows * 2);
    this.vibrate('heavy');
    this.lockFlow();
  },
  onHold() {
    if (!this._active()) return;
    const res = this.game.hold();
    this.drawBoard();
    this.drawPreview(this.nextCtx, this.nextBlock, this.nextW, this.nextH, this.game.nextPiece);
    this.drawPreview(this.holdCtx, this.holdBlock, this.holdW, this.holdH, this.game.heldPiece);
    this.vibrate('medium');
    if (res.gameOver) this.handleGameOver();
  },

  // ===== 输入：棋盘触摸手势（滑动移动 / 下滑软降 / 点按旋转 / 双击硬降）=====
  onTouchStart(e) {
    if (!this._active()) return;
    const t = e.touches[0];
    this.touchStartX = t.x;
    this.touchStartY = t.y;
    this.lastX = t.x;
    this.lastY = t.y;
    this.touchStartT = Date.now();
    this.hasMoved = false;
  },

  onTouchMove(e) {
    if (!this._active()) return;
    const t = e.touches[0];
    const threshold = Math.max(14, this.blockSize * 0.5);

    // 水平滑动：按阈值步进消费，连续快滑不丢步
    let dx = t.x - this.lastX;
    while (Math.abs(dx) >= threshold) {
      const dir = dx > 0 ? 1 : -1;
      if (this.game.canMove(dir, 0)) {
        this.game.applyMove(dir, 0);
        this.drawBoard();
      }
      this.lastX += dir * threshold;
      dx = t.x - this.lastX;
      this.hasMoved = true;
    }

    // 垂直下滑：软降（上滑忽略，避免锚点脱轨）
    const dy = t.y - this.lastY;
    if (dy > 0 && dy >= threshold) {
      if (this.game.canMove(0, 1)) {
        this.game.applyMove(0, 1);
        this.game.addScore(1);
        this.refreshHUD();
        this.drawBoard();
      }
      this.lastY = t.y;
      this.hasMoved = true;
    }
  },

  onTouchEnd() {
    if (!this._active()) return;
    const now = Date.now();
    const duration = now - this.touchStartT;
    if (!this.hasMoved && duration < 260) {
      if (now - this.lastTapTime < 280) {
        // 双击 -> 硬降
        this.lastTapTime = 0;
        this.onHardDrop();
      } else {
        // 轻点 -> 旋转
        this.lastTapTime = now;
        this.onRotate();
      }
    }
  },

  vibrate(type) {
    if (wx.vibrateShort) {
      try {
        wx.vibrateShort({ type: type });
      } catch (e) {}
    }
  }
});
