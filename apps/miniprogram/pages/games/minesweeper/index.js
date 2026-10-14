// pages/games/minesweeper/index.js
// 迁移自 minesweeper/miniprogram，引用路径上移到工程根 utils/
const { MinesweeperGame, GameState, CellState } = require('../../../utils/minesweeper.js');
// cloud 可能为 null（未执行「构建 npm」时自动降级），所有云端调用都要先判空
const { cloud, isCloudAvailable } = require('../../../utils/cloud.js');

const DIFF_OPTIONS = [
  { rows: 9, cols: 9, mines: 10, label: '初级 (9×9, 10雷)', shortLabel: '初级 9×9' },
  { rows: 16, cols: 16, mines: 40, label: '中级 (16×16, 40雷)', shortLabel: '中级 16×16' },
  // 高级采用竖向布局：16 列 × 30 行。
  // 竖屏手机上「上下滑动」比「左右滑动」更符合单手操作习惯，
  // 且 16 列 × 24px = 384px，宽度可完整显示，只有纵向需要滚动。
  { rows: 30, cols: 16, mines: 99, label: '高级 (16×30, 99雷)', shortLabel: '高级 16×30' }
];

/** 难度 id ↔ 本地存储键，云端与本地共用同一套键名 */
const DIFF_KEYS = ['beginner', 'intermediate', 'expert'];
const localKey = (id) => `ms_best_${id}`;

/**
 * 主题：与 Web 版（web-hall/minesweeper）保持一致的双主题
 *  modern  = 现代暗色（默认）
 *  classic = Win98 复古拟物
 * 选择结果存本地，下次进入沿用。
 */
const THEME_KEY = 'ms_theme';
const THEMES = {
  modern: { label: '✨ 现代暗色', icon: '✨' },
  classic: { label: '🎨 复古风格', icon: '🎨' }
};

/** rpx → px 的换算比例（750rpx 对应屏幕宽度），用于把 WXSS 的 rpx 尺寸换算成 px */
function winWidthRatio() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return (info.windowWidth || 375) / 750;
  } catch (e) {
    return 375 / 750;
  }
}

Page({
  data: {
    diffOptions: DIFF_OPTIONS,
    diffIndex: 0,
    rows: 9,
    cols: 9,
    cellSize: 36,
    grid: [],
    formattedMines: '010',
    formattedTime: '000',
    gameTime: 0,
    smileyIcon: '😊',
    touchMode: 'REVEAL', // 'REVEAL' (挖掘) 或 'FLAG' (插旗)
    // ===== Canvas 棋盘 =====
    // canvas 可视区尺寸（固定，不随内容撑开，因此不会把底部模式栏顶出屏幕）
    canvasW: 0,
    canvasH: 0,
    cellSize: 24,
    // 可视区能容纳的行数（由 canvasH / cellSize 推出）
    visibleRows: 9,
    // 拖动偏移：以「行」为单位，取值 0 ~ maxOffsetRow
    offsetRow: 0,
    maxOffsetRow: 0,
    canPan: false,
    soundMuted: false,
    // 主题
    theme: 'modern',
    themeLabel: THEMES.modern.label,
    themeIcon: THEMES.modern.icon,
    showModal: false,
    modalType: '',
    records: {
      beginner: '',
      intermediate: '',
      expert: ''
    }
  },

  // ===== 实例私有字段（不进 data，避免无谓的 setData）=====
  game: null,
  timerInterval: null,
  canvas: null,
  ctx: null,
  touchMoved: false,
  longPressFired: false,
  longPressTimer: null,
  lastTouch: null,
  touchStartY: 0,
  touchStartOffset: 0,

  onLoad() {
    this.loadSoundSetting();
    this.loadTheme();
    this.loadRecords();
  },

  /**
   * canvas 节点必须等布局完成才能取到，因此新开局放在 onReady 而非 onLoad。
   */
  onReady() {
    this.startNewGame();
  },

  onUnload() {
    this.stopTimer();
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  },

  /** 读取已保存的主题，无记录时用 modern */
  loadTheme() {
    const saved = wx.getStorageSync(THEME_KEY);
    const theme = THEMES[saved] ? saved : 'modern';
    this.applyTheme(theme);
  },

  /** 应用主题到页面数据（class 由 WXML 根节点绑定），并重绘 canvas 棋盘 */
  applyTheme(theme) {
    const conf = THEMES[theme] || THEMES.modern;
    this.setData({
      theme,
      themeLabel: conf.label,
      themeIcon: conf.icon
    }, () => {
      // canvas 配色不走 class，需在数据更新后重绘（onLoad 阶段 ctx 尚未就绪会自动跳过）
      if (this.ctx) this.drawBoard();
    });
  },

  /** 切换现代 / 复古主题 */
  toggleTheme() {
    const next = this.data.theme === 'classic' ? 'modern' : 'classic';
    this.applyTheme(next);
    try {
      wx.setStorageSync(THEME_KEY, next);
    } catch (e) {
      console.warn('[扫雷] 主题保存失败', e);
    }
    this.vibrate('light');
  },

  // 震动反馈工具
  vibrate(type = 'light') {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: type });
    }
  },

  vibrateLong() {
    if (wx.vibrateLong) {
      wx.vibrateLong();
    }
  },

  loadSoundSetting() {
    const muted = wx.getStorageSync('minesweeper_muted') === true;
    this.setData({ soundMuted: muted });
  },

  toggleSound() {
    const next = !this.data.soundMuted;
    this.setData({ soundMuted: next });
    wx.setStorageSync('minesweeper_muted', next);
    this.vibrate('light');
  },

  // 难度切换
  onDifficultyChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ diffIndex: idx });
    this.startNewGame();
    this.vibrate('medium');
  },

  // 开始新局
  startNewGame() {
    this.stopTimer();
    const config = this.data.diffOptions[this.data.diffIndex];
    this.game = new MinesweeperGame(config.rows, config.cols, config.mines);

    // 重置拖动状态
    this.touchMoved = false;
    this.touchStartY = 0;
    this.touchStartOffset = 0;

    this.setData({
      rows: config.rows,
      cols: config.cols,
      offsetRow: 0,
      formattedMines: this.formatDigits(config.mines),
      formattedTime: '000',
      gameTime: 0,
      smileyIcon: '😊',
      showModal: false
    });

    this.setupCanvas();
  },

  /**
   * 初始化 Canvas 棋盘。
   *
   * ⚠️ 关键：canvas 的尺寸**不能由自身决定**。
   *    若在 WXML 内联 style 写 width:{{canvasW}}px，而 canvasW 又来自
   *    读取 canvas 自身尺寸，就会形成循环依赖 —— 初始值为 0，
   *    canvas 永远是 0×0，格子完全不可见（此坑已踩过一次）。
   *
   *    正确做法：canvas 尺寸完全交给 CSS（width/height:100% 撑满 .board-container），
   *    JS 只测量 **父容器 .board-container** 得到可视区尺寸，
   *    再把 canvas.width/height 设为「该尺寸 × pixelRatio」用于高清绘制。
   */
  setupCanvas() {
    const query = wx.createSelectorQuery();

    // 第1 步：取 canvas 节点（只取 node，不取 size —— size 此时无意义）
    query.select('#boardCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) {
          console.warn('[扫雷] canvas 节点获取失败');
          return;
        }
        this.canvas = info.node;
        this.ctx = info.node.getContext('2d');

        // 第 2 步：量父容器可视区尺寸（真正的尺寸来源）
        wx.createSelectorQuery()
          .select('.board-container')
          .boundingClientRect((rect) => {
            const area = rect && rect.width ? rect : info;
            const areaW = Math.floor(area.width) || 320;
            const areaH = Math.floor(area.height) || 320;
            this.initCanvasSurface(areaW, areaH);
          })
          .exec();
      });
  },

  /** 按可视区尺寸初始化画布并完成首次绘制 */
  initCanvasSurface(areaW, areaH) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    // 以 dpr 放大，保证高清清晰
    let dpr = 2;
    try {
      const winInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      dpr = winInfo.pixelRatio || 2;
    } catch (e) {
      dpr = 2;
    }
    canvas.width = areaW * dpr;
    canvas.height = areaH * dpr;
    ctx.scale(dpr, dpr);

    const config = this.data.diffOptions[this.data.diffIndex];
    const cell = this.calcCellSize(config.cols, areaW);
    // 由可视高度算能显示多少行，以及最多能拖动多少行
    const visibleRows = Math.max(1, Math.floor(areaH / cell));
    const maxOffsetRow = Math.max(0, config.rows - visibleRows);

    this.setData({
      canvasW: areaW,
      canvasH: areaH,
      cellSize: cell,
      visibleRows: Math.min(visibleRows, config.rows),
      maxOffsetRow: maxOffsetRow,
      canPan: maxOffsetRow > 0
    }, () => this.drawBoard());
  },

  /**
   * 依据列数与可视区宽度计算格子尺寸 —— 这是「屏幕适应」的核心。
   *策略：让棋盘宽度尽量贴合屏幕宽度（不浪费横向空间），
   *   同时保证格子处于可点区间 [MIN_CELL, IDEAL_CELL]：
   *   - 列数少（9 列）：格子放大到上限 40px，视觉舒适
   *   - 列数多（16 列）：按屏宽均分，同时不低于 24px 保证不误触
   */
  calcCellSize(cols, viewW) {
    const MIN_CELL = 24;      // 绝对下限，低于此值会误触
    const IDEAL_CELL = 42;    // 视觉上限，避免格子过大显得稀疏
    const FRAME = 8;          // 棋盘外框占位

    // 按屏宽均分
    const byWidth = Math.floor((viewW - FRAME) / cols);
    const cell = Math.max(MIN_CELL, Math.min(IDEAL_CELL, byWidth));

    // 若因下限约束导致棋盘超宽，调用方仍可拖动查看
    return cell;
  },

  /**
   * 绘制棋盘。只绘制可视区内的行（视口裁剪），性能好且不会画到界外。
   */
  drawBoard() {
    const ctx = this.ctx;
    if (!ctx || !this.game) return;

    const cell = this.data.cellSize;
    const offset = this.data.offsetRow;
    const visibleRows = this.data.visibleRows;
    const rows = this.game.rows;
    const cols = this.game.cols;
    const classic = this.data.theme === 'classic';
    const viewW = this.data.canvasW;
    const viewH = this.data.canvasH;

    ctx.clearRect(0, 0, viewW, viewH);

    const endRow = Math.min(rows, offset + visibleRows);
    // 本次实际绘制的行数（末行不足时更少）
    const drawRows = endRow - offset;
    const boardW = cols * cell;
    const boardH = drawRows * cell;

    // 水平居中：棋盘宽度可能小于容器（如初级 9×9 在大屏上）
    const originX = Math.max(0, Math.floor((viewW - boardW) / 2));
    const originY = 0;

    // 棋盘外框（描边 + 内阴影，贴近经典扫雷的「凹陷面板」观感）
    ctx.fillStyle = classic ? '#a8a8a8' : 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(originX - 4, originY, boardW + 8, boardH + 8);

    const NUM_COLORS = classic
      ? ['#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080']
      : ['#38bdf8', '#4ade80', '#f87171', '#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#94a3b8'];

    for (let r = offset; r < endRow; r++) {
      for (let c = 0; c < cols; c++) {
        const item = this.game.grid[r][c];
        const x = originX + c * cell;
        const y = originY + (r - offset) * cell;

        // 格子填充
        let fill;
        if (item.state === CellState.REVEALED) {
          if (item.isMine) fill = item.isExploded ? '#dc2626' : classic ? '#c0c0c0' : '#450a0a';
          else fill = classic ? '#c0c0c0' : '#0f172a';
        } else {
          fill = classic ? '#c0c0c0' : '#1e293b';
        }
        if (item.isFalseFlag && item.state !== CellState.REVEALED) {
          fill = classic ? '#c0c0c0' : '#475569';
        }
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cell, cell);

        // 边框：复古用 Win98 立体边，现代用细分隔线
        ctx.lineWidth = 1;
        if (classic) {
          if (item.state !== CellState.REVEALED) {
            // 凸起
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x + 0.5, y + cell - 0.5);
            ctx.lineTo(x + 0.5, y + 0.5);
            ctx.lineTo(x + cell - 0.5, y + 0.5);
            ctx.stroke();
            ctx.strokeStyle = '#808080';
            ctx.beginPath();
            ctx.moveTo(x + cell - 0.5, y + 0.5);
            ctx.lineTo(x + cell - 0.5, y + cell - 0.5);
            ctx.lineTo(x + 0.5, y + cell - 0.5);
            ctx.stroke();
          } else {
            ctx.strokeStyle = '#808080';
            ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.10)';
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }

        // 内容：旗帜 / 问号 / 雷 / 数字
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.floor(cell * 0.6);

        if (item.state === CellState.FLAGGED) {
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = classic ? '#000000' : '#f87171';
          ctx.fillText('🚩', x + cell / 2, y + cell / 2 + 1);
        } else if (item.state === CellState.QUESTION) {
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = classic ? '#000000' : '#fbbf24';
          ctx.fillText('❓', x + cell / 2, y + cell / 2 + 1);
        } else if (item.state === CellState.REVEALED && item.isMine) {
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText('💣', x + cell / 2, y + cell / 2 + 1);
        } else if (item.state === CellState.REVEALED && item.adjacentMines > 0) {
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = NUM_COLORS[item.adjacentMines - 1];
          ctx.fillText(String(item.adjacentMines), x + cell / 2, y + cell / 2 + 1);
        } else if (item.isFalseFlag) {
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = classic ? '#000000' : '#e2e8f0';
          ctx.fillText('❌', x + cell / 2, y + cell / 2 + 1);
        }
      }
    }

    // 底部边界线：明确提示棋盘到此为止（解决「不知道下面还有没有格子」）
    if (endRow >= rows) {
      const boardBottom = originY + drawRows * cell;
      ctx.strokeStyle = classic ? '#808080' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(originX, boardBottom - 1);
      ctx.lineTo(originX + boardW, boardBottom - 1);
      ctx.stroke();
    }
  },

  /** 触摸开始：记录起点，用于区分点击、拖动与长按 */
  onTouchStart(e) {
    const t = e.touches[0];
    this.touchStartY = t.clientY;
    this.touchStartOffset = this.data.offsetRow;
    this.touchMoved = false;
    this.longPressFired = false;
    // 记录起始触点，长按 300ms 到达时若未移动，即在起始格触发
    this.lastTouch = { x: t.x, y: t.y };
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.vibrate('medium');
      const cell = this.data.cellSize;
      const p = this.lastTouch;
      if (!p) return;
      const col = Math.floor(p.x / cell);
      const row = this.data.offsetRow + Math.floor(p.y / cell);
      if (col < 0 || col >= this.game.cols || row < 0 || row >= this.game.rows) return;
      if (this.game.grid[row][col].state !== CellState.REVEALED) {
        this.toggleFlag(row, col);
      }
    }, 300);
  },

  /** 触摸移动：按纵向位移换算行偏移，实时重绘 */
  onTouchMove(e) {
    // 记录最新触点，供长按判定使用
    const t = e.touches[0];
    this.lastTouch = { x: t.x, y: t.y };

    if (this.data.maxOffsetRow <= 0) return;

    const dy = this.touchStartY - t.clientY;    // 向上拖为正
    const cell = this.data.cellSize;

    // 移动超过半个格子才算拖动，避免误判为点击
    if (Math.abs(dy) > cell / 2) {
      this.touchMoved = true;
      // 一旦进入拖动，取消长按
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }

    const rowDelta = Math.round(dy / cell);
    let next = this.touchStartOffset + rowDelta;
    next = Math.max(0, Math.min(this.data.maxOffsetRow, next));

    if (next !== this.data.offsetRow) {
      this.setData({ offsetRow: next }, () => this.drawBoard());
    }
  },

  /**
   * 触摸结束：若发生拖动则忽略；若已触发长按也不重复处理；否则视为点击。
   */
  onTouchEnd(e) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.touchMoved || this.longPressFired) {
      this.touchMoved = false;
      this.longPressFired = false;
      return;
    }

    const t = e.changedTouches ? e.changedTouches[0] : null;
    if (!t) return;

    // 触摸点是相对 canvas 的坐标（x / y 已由基础库换算好，无需再减 clientX）
    const cell = this.data.cellSize;
    const x = t.x;
    const y = t.y;

    const col = Math.floor(x / cell);
    const row = this.data.offsetRow + Math.floor(y / cell);

    if (col < 0 || col >= this.game.cols || row < 0 || row >= this.game.rows) {
      return;
    }

    if (this.data.touchMode === 'FLAG') {
      if (this.game.grid[row][col].state !== CellState.REVEALED) {
        this.toggleFlag(row, col);
      }
      return;
    }

    const cellItem = this.game.grid[row][col];
    if (cellItem.state === CellState.REVEALED && cellItem.adjacentMines > 0) {
      this.handleChord(row, col);
      return;
    }
    this.revealCell(row, col);
  },

  /** 回到棋盘顶部 */
  scrollBoardToStart() {
    if (this.data.offsetRow === 0) return;
    this.setData({ offsetRow: 0 }, () => this.drawBoard());
  },

  /** 获取屏幕尺寸，兼容新旧基础库 */
  getWindowSize() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      return {
        width: info.windowWidth || 375,
        height: info.windowHeight || 667
      };
    } catch (e) {
      return { width: 375, height: 667 };
    }
  },

  // 格式化 3 位数码管
  formatDigits(val) {
    const clamped = Math.max(-99, Math.min(999, val));
    if (clamped < 0) {
      return '-' + Math.abs(clamped).toString().padStart(2, '0');
    }
    return clamped.toString().padStart(3, '0');
  },

  /**
   * 设置操作模式（挖掘 ⛏️ / 插旗 🚩）。
   * 与 PC 网页版一致：底部「挖掘模式 / 插旗模式」两个按钮，
   * 点击直接设定当前模式（PC 网页版 mobile-mode-bar 行为）。
   * 另保留「长按格子直接插旗」，插旗更顺手（PC 网页版同样支持长按）。
   * @param {Object} e 事件对象，从 data-mode 读取 'REVEAL' | 'FLAG'
   */
  setTouchMode(e) {
    const mode = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.mode
      : null;
    if (mode !== 'REVEAL' && mode !== 'FLAG') return;
    if (this.data.touchMode === mode) return;
    this.setData({ touchMode: mode });
    this.vibrate('light');
  },

  // 注：原 onCellTap / onCellLongPress 已删除。
  // 改为 canvas 后格子不再由 WXML 节点承载，点击与长按统一在
  // onTouchEnd / onTouchStart 的长按计时中处理，无需 dataset 传行列。

  // 翻开格子逻辑
  revealCell(r, c) {
    const wasReady = this.game.status === GameState.READY;
    const res = this.game.reveal(r, c);

    if (wasReady && this.game.status === GameState.PLAYING) {
      this.startTimer();
    }

    this.drawBoard();

    if (res.status === GameState.LOST) {
      this.handleGameOver(false);
    } else if (res.status === GameState.WON) {
      this.handleGameOver(true);
    } else if (res.changedCells.length > 0) {
      this.vibrate('light');
    }
  },

  // 标记/取消标记旗帜
  toggleFlag(r, c) {
    const res = this.game.toggleFlag(r, c);
    if (!res) return;

    this.drawBoard();
    this.setData({
      formattedMines: this.formatDigits(res.remainingMines)
    });

    if (res.status === GameState.WON) {
      this.handleGameOver(true);
      return;
    }

    this.vibrate('light');
  },

  // 和弦快捷展开
  handleChord(r, c) {
    const res = this.game.chord(r, c);
    if (res.triggered && res.changedCells.length > 0) {
      this.drawBoard();
      if (res.status === GameState.LOST) {
        this.handleGameOver(false);
      } else if (res.status === GameState.WON) {
        this.handleGameOver(true);
      } else {
        this.vibrate('medium');
      }
    }
  },

  // 胜负处理
  handleGameOver(won) {
    this.stopTimer();
    const elapsed = this.game.getElapsedTime();

    if (won) {
      this.setData({
        smileyIcon: '😎',
        formattedMines: '000',
        gameTime: elapsed,
        showModal: true,
        modalType: 'WIN'
      });
      this.vibrateLong();
      this.saveRecord(elapsed);
    } else {
      this.setData({
        smileyIcon: '😵'
      });
      this.vibrateLong();
    }
  },

  // 计时器
  startTimer() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      const elapsed = this.game.getElapsedTime();
      this.setData({
        formattedTime: this.formatDigits(elapsed)
      });
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  // 重置当前局
  resetGame() {
    this.vibrate('light');
    this.startNewGame();
  },

  // ===== 记录榜单存储 =====
  // 数据策略：本地 wx.setStorageSync 作为即时缓存（离线也能读），
  // 云端 minesweeper_records 为准（换手机/重装不丢）。
  // 写入顺序= 先本地立刻响应，再异步同步云端，失败不影响玩家。

  /** 把云端返回的三档成绩写入本地缓存并刷新界面 */
  applyRecordsFromCloud(rows) {
    const next = { beginner: '', intermediate: '', expert: '' };
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (r && DIFF_KEYS.includes(r.difficulty) && typeof r.best_ms === 'number') {
        next[r.difficulty] = String(r.best_ms);
        wx.setStorageSync(localKey(r.difficulty), String(r.best_ms));
      }
    });
    this.setData({ records: next });
  },

  /** 从云端拉取三档最佳成绩；云端不可用或失败时静默保留本地缓存 */
  async fetchRecordsFromCloud() {
    if (!isCloudAvailable) return;
    try {
      const { data, error } = await cloud.database
        .from('minesweeper_records')
        .select('difficulty, best_ms');
      if (error) {
        // 42501= 未登录或无权限；42P01= 表不存在。两种都不该中断游戏，静默降级到本地缓存。
        console.warn('[扫雷] 云端成绩读取失败，已使用本地记录', error.code || '', error.message);
        return;
      }
      this.applyRecordsFromCloud(data);
    } catch (e) {
      console.warn('[扫雷] 云端成绩读取异常，已使用本地记录', e && e.message);
    }
  },

  /**
   * 上传成绩到云端（upsert 同一用户同一难度只保留一行最优成绩）。
   * @param {string} difficulty beginner/intermediate/expert
   * @param {number} bestMs 该难度历史最优毫秒数
   */
  async syncRecordToCloud(difficulty, bestMs) {
    if (!isCloudAvailable) return false;
    try {
      const { error } = await cloud.database
        .from('minesweeper_records')
        .upsert({ difficulty, best_ms: bestMs }, { onConflict: 'owner_id,difficulty' });
      if (error) {
        console.warn('[扫雷] 成绩同步云端失败，本地已保留', error.code || '', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[扫雷] 成绩同步云端异常，本地已保留', e && e.message);
      return false;
    }
  },

  /** 记录一次通关成绩；仅当刷新纪录时才落库 */
  saveRecord(time) {
    const key = DIFF_KEYS[this.data.diffIndex];
    if (!key) return;

    const storageKey = localKey(key);
    const best = wx.getStorageSync(storageKey);

    if (!best || time < parseInt(best, 10)) {
      // 先写本地 + 立刻刷新界面，保证玩家马上看到成绩
      wx.setStorageSync(storageKey, time.toString());
      this.loadRecords();
      // 再异步同步云端；不影响本次结算流程
      this.syncRecordToCloud(key, time);
    }
  },

  loadRecords() {
    this.setData({
      records: {
        beginner: wx.getStorageSync(localKey('beginner')) || '',
        intermediate: wx.getStorageSync(localKey('intermediate')) || '',
        expert: wx.getStorageSync(localKey('expert')) || ''
      }
    });
    // 界面已用本地缓存渲染完成，再静默拉取云端覆盖（弱网/无网时保持本地值）
    this.fetchRecordsFromCloud();
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定要清除所有难度历史最佳成绩吗？',
      success: (res) => {
        if (!res.confirm) return;

        DIFF_KEYS.forEach((k) => wx.removeStorageSync(localKey(k)));
        this.loadRecords();
        this.vibrate('light');

        // 云端同步清空；云端不可用或失败时本地已清空，不阻塞玩家
        if (!isCloudAvailable) return;
        cloud.database
          .from('minesweeper_records')
          .delete()
          .neq('difficulty', '')
          .select()
          .then(({ error }) => {
            if (error) console.warn('[扫雷] 云端记录清空失败', error.code || '', error.message);
          })
          .catch((e) => console.warn('[扫雷] 云端记录清空异常', e && e.message));
      }
    });
  },

  showRecordsModal() {
    this.loadRecords();
    this.setData({
      showModal: true,
      modalType: 'RECORDS'
    });
    this.vibrate('light');
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  onWinPlayAgain() {
    this.setData({ showModal: false });
    this.startNewGame();
  }
});
