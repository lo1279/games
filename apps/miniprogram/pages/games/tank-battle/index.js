// pages/games/tank-battle/index.js
// 经典坦克大战 · 微信小程序原生版
// 纯逻辑见 ../../../utils/tank-battle.js；本页负责 Canvas 渲染、触屏方向盘、实时 tick 循环与状态机。
const { TankBattleGame, DIR, CANVAS_W, CANVAS_H } = require('../../../utils/tank-battle.js');

const HS_KEY = 'tank_battle_high_score';
const TICK_MS = 33; // ≈30fps
const DT = 0.033;

Page({
  data: {
    score: 0,
    lives: 3,
    stage: 1,
    enemiesLeft: 0,
    showOverlay: true,
    overlayTitle: '经典坦克大战',
    overlaySub: '守护老鹰基地，消灭全部敌军',
    overlayBtn: '🎮 开始战斗',
    isPaused: false
  },

  // 私有字段
  game: null,
  mainCanvas: null,
  mainCtx: null,
  dpr: 2,
  boardScale: 1,
  boardOffX: 0,
  boardOffY: 0,
  areaW: 300,
  areaH: 300,
  timer: null,
  started: false,
  pressedDirs: [],
  _hud: null,

  onLoad() {
    this.game = new TankBattleGame({ vibrate: (t) => this.vibrate(t) });
    let hs = 0;
    try {
      hs = parseInt(wx.getStorageSync(HS_KEY) || '0', 10) || 0;
    } catch (e) {
      hs = 0;
    }
    this.game.highScore = hs;
  },

  onReady() {
    this.setupCanvas();
  },

  onUnload() {
    this.stopTimer();
  },

  onHide() {
    if (this.game && this.game.state === this.game.STATE.PLAYING) {
      this.game.togglePause();
    }
  },

  // ===== Canvas 初始化 =====
  setupCanvas() {
    const q = wx.createSelectorQuery();
    q.select('#boardCanvas').fields({ node: true, size: true });
    q.select('.board-area').boundingClientRect();
    q.exec((res) => {
      const board = res[0];
      const area = res[1];
      if (!board || !board.node || !area) {
        console.warn('[坦克大战] canvas 节点获取失败');
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
      this.areaW = Math.floor(area.width) || 300;
      this.areaH = Math.floor(area.height) || 300;
      this.mainCanvas = board.node;
      this.mainCtx = board.node.getContext('2d');
      this.mainCanvas.width = this.areaW * dpr;
      this.mainCanvas.height = this.areaH * dpr;
      this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.mainCtx.scale(dpr, dpr); // 之后均以 css px 绘制
      this.boardScale = Math.min(this.areaW, this.areaH) / CANVAS_W;
      this.boardOffX = (this.areaW - CANVAS_W * this.boardScale) / 2;
      this.boardOffY = (this.areaH - CANVAS_H * this.boardScale) / 2;
      this.startTimer();
    });
  },

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  },
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // ===== 实时循环 =====
  tick() {
    if (!this.game || !this.mainCtx) return;
    if (this.game.state === this.game.STATE.PLAYING) {
      // 同步当前按住方向
      const dir = this.pressedDirs.length ? this.dirToCode(this.pressedDirs[this.pressedDirs.length - 1]) : -1;
      this.game.setMoveDir(dir);
      this.game.update(DT);
    } else if (this.game.state === this.game.STATE.VICTORY || this.game.state === this.game.STATE.GAME_OVER) {
      this.game.update(DT);
    }
    this.render();
    this.syncHUD();
  },

  dirToCode(name) {
    if (name === 'up') return DIR.UP;
    if (name === 'down') return DIR.DOWN;
    if (name === 'left') return DIR.LEFT;
    if (name === 'right') return DIR.RIGHT;
    return -1;
  },

  render() {
    const ctx = this.mainCtx;
    ctx.clearRect(0, 0, this.areaW, this.areaH);
    ctx.save();
    ctx.translate(this.boardOffX, this.boardOffY);
    ctx.scale(this.boardScale, this.boardScale);
    this.game.render(ctx);
    ctx.restore();
  },

  // HUD 仅在变化时 setData，避免每帧刷新
  syncHUD() {
    const g = this.game;
    let title = '', sub = '', btn = '', show = true;
    const st = g.state;
    if (st === g.STATE.TITLE) {
      title = '经典坦克大战';
      sub = '守护老鹰基地，消灭全部敌军';
      btn = '🎮 开始战斗';
    } else if (st === g.STATE.PLAYING) {
      show = false;
    } else if (st === g.STATE.PAUSED) {
      title = '已暂停';
      sub = '点击继续按钮恢复战斗';
      btn = '▶ 继续';
    } else if (st === g.STATE.VICTORY) {
      title = '关卡通过！';
      sub = '正在进入下一防区…';
      btn = '▶ 继续';
    } else if (st === g.STATE.GAME_OVER) {
      title = '游戏结束';
      sub = '得分 ' + (g.player ? g.player.score : 0) + ' · 最高 ' + (g.highScore || 0);
      btn = '🔄 再来一局';
    }
    const score = g.player ? g.player.score : 0;
    const lives = g.player ? Math.max(0, g.player.lives) : 0;
    const stage = g.currentLevelIndex + 1;
    const enemiesLeft = g.getRemainingEnemies();
    const next = { score, lives, stage, enemiesLeft, showOverlay: show, overlayTitle: title, overlaySub: sub, overlayBtn: btn, isPaused: st === g.STATE.PAUSED };
    if (!this._hud) {
      this._hud = next;
      this.setData(next);
      return;
    }
    let changed = false;
    for (const k in next) {
      if (next[k] !== this._hud[k]) {
        changed = true;
        break;
      }
    }
    if (changed) {
      this._hud = next;
      this.setData(next);
    }
  },

  // ===== 流程 =====
  onStart() {
    const st = this.game.state;
    if (st === this.game.STATE.TITLE || st === this.game.STATE.GAME_OVER) {
      this.startGame();
    } else if (st === this.game.STATE.PAUSED) {
      this.game.togglePause();
    } else if (st === this.game.STATE.VICTORY) {
      this.game.loadStage(this.game.currentLevelIndex + 1);
    }
  },

  startGame() {
    this.game.start();
    this.started = true;
    this.pressedDirs = [];
    this.vibrate('medium');
  },

  onPause() {
    if (this.game.state === this.game.STATE.PLAYING || this.game.state === this.game.STATE.PAUSED) {
      this.game.togglePause();
    }
  },

  onRestart() {
    this.startGame();
  },

  // ===== 输入：方向盘（按住移动，松开停）=====
  onDirStart(e) {
    if (this.game.state !== this.game.STATE.PLAYING) return;
    const d = e.currentTarget.dataset.dir;
    if (this.pressedDirs.indexOf(d) === -1) this.pressedDirs.push(d);
  },
  onDirEnd(e) {
    const d = e.currentTarget.dataset.dir;
    const i = this.pressedDirs.indexOf(d);
    if (i !== -1) this.pressedDirs.splice(i, 1);
  },

  // ===== 输入：开火 =====
  onFire() {
    if (this.game.state !== this.game.STATE.PLAYING) return;
    this.game.fire();
  },

  vibrate(type) {
    if (wx.vibrateShort) {
      try {
        wx.vibrateShort({ type: type });
      } catch (e) {}
    }
  }
});
