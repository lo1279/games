// pages/games/minesweeper/index.js
// 迁移自 minesweeper/miniprogram，引用路径上移到工程根 utils/
const { MinesweeperGame, GameState, CellState } = require('../../../utils/minesweeper.js');
const { cloud } = require('../../../utils/cloud.js');

const DIFF_OPTIONS = [
  { rows: 9, cols: 9, mines: 10, label: '初级 (9×9, 10雷)', shortLabel: '初级 9×9' },
  { rows: 16, cols: 16, mines: 40, label: '中级 (16×16, 40雷)', shortLabel: '中级 16×16' },
  { rows: 16, cols: 30, mines: 99, label: '高级 (30×16, 99雷)', shortLabel: '高级 30×16' }
];

/** 难度 id ↔ 本地存储键，云端与本地共用同一套键名 */
const DIFF_KEYS = ['beginner', 'intermediate', 'expert'];
const localKey = (id) => `ms_best_${id}`;

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
    scaleValue: 1.0,
    boardX: 0,
    boardY: 0,
    soundMuted: false,
    showModal: false,
    modalType: '',
    records: {
      beginner: '',
      intermediate: '',
      expert: ''
    }
  },

  game: null,
  timerInterval: null,

  onLoad() {
    this.loadSoundSetting();
    this.loadRecords();
    this.startNewGame();
  },

  onUnload() {
    this.stopTimer();
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

    // 针对手机屏幕宽度自适应计算基础格子尺寸
    const sys = wx.getSystemInfoSync();
    let baseCellSize = 36;
    if (config.cols === 9) {
      baseCellSize = Math.floor((sys.windowWidth - 40) / 9);
      baseCellSize = Math.max(34, Math.min(44, baseCellSize));
    } else if (config.cols === 16) {
      baseCellSize = Math.floor((sys.windowWidth - 40) / 14);
      baseCellSize = Math.max(26, Math.min(32, baseCellSize));
    } else {
      baseCellSize = 28;
    }

    this.setData({
      rows: config.rows,
      cols: config.cols,
      cellSize: baseCellSize,
      formattedMines: this.formatDigits(config.mines),
      formattedTime: '000',
      gameTime: 0,
      smileyIcon: '😊',
      scaleValue: 1.0,
      boardX: 0,
      boardY: 0,
      showModal: false
    });

    this.syncGrid();
  },

  // 重置棋盘到居中位置
  resetBoardPosition() {
    this.setData({
      scaleValue: 1.0,
      boardX: 0,
      boardY: 0
    });
    this.vibrate('light');
  },

  // 将核心算法中的 grid 同步到页面视图数据
  syncGrid() {
    if (!this.game) return;
    const viewGrid = [];

    for (let r = 0; r < this.game.rows; r++) {
      const row = [];
      for (let c = 0; c < this.game.cols; c++) {
        const item = this.game.grid[r][c];
        let classNames = 'cell ';

        if (item.state === CellState.HIDDEN) {
          classNames += 'cell-hidden';
        } else if (item.state === CellState.FLAGGED) {
          classNames += 'cell-hidden cell-flagged';
        } else if (item.state === CellState.QUESTION) {
          classNames += 'cell-hidden cell-question';
        } else if (item.state === CellState.REVEALED) {
          classNames += 'cell-revealed';
          if (item.isMine) {
            classNames += ' cell-mine';
            if (item.isExploded) {
              classNames += ' cell-exploded';
            }
          }
        }

        if (item.isFalseFlag) {
          classNames += ' cell-false-flag';
        }

        row.push({
          row: r,
          col: c,
          state: item.state,
          isMine: item.isMine,
          adjacentMines: item.adjacentMines,
          isExploded: item.isExploded,
          isFalseFlag: item.isFalseFlag,
          classNames: classNames
        });
      }
      viewGrid.push(row);
    }

    this.setData({ grid: viewGrid });
  },

  // 格式化 3 位数码管
  formatDigits(val) {
    const clamped = Math.max(-99, Math.min(999, val));
    if (clamped < 0) {
      return '-' + Math.abs(clamped).toString().padStart(2, '0');
    }
    return clamped.toString().padStart(3, '0');
  },

  // 切换操作模式 (挖掘 ⛏️ / 插旗 🚩)
  switchTouchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.touchMode !== mode) {
      this.setData({ touchMode: mode });
      this.vibrate('light');
    }
  },

  // 单击格子响应
  onCellTap(e) {
    if (!this.game || this.game.status === GameState.WON || this.game.status === GameState.LOST) {
      return;
    }

    const r = e.currentTarget.dataset.row;
    const c = e.currentTarget.dataset.col;
    const cell = this.game.grid[r][c];

    // 如果处于【插旗模式】
    if (this.data.touchMode === 'FLAG') {
      if (cell.state !== CellState.REVEALED) {
        this.toggleFlag(r, c);
      }
      return;
    }

    // 处于【挖掘模式】：
    // 1. 若点击已翻开且具有数字的格子，触发和弦展开 (Chord)
    if (cell.state === CellState.REVEALED && cell.adjacentMines > 0) {
      this.handleChord(r, c);
      return;
    }

    // 2. 正常翻开未知格子
    this.revealCell(r, c);
  },

  // 长按格子响应（无论在何种模式下，长按均快捷切换旗帜/问号）
  onCellLongPress(e) {
    if (!this.game || this.game.status === GameState.WON || this.game.status === GameState.LOST) {
      return;
    }

    const r = e.currentTarget.dataset.row;
    const c = e.currentTarget.dataset.col;
    const cell = this.game.grid[r][c];

    if (cell.state !== CellState.REVEALED) {
      this.toggleFlag(r, c);
      this.vibrate('medium');
    }
  },

  // 翻开格子逻辑
  revealCell(r, c) {
    const wasReady = this.game.status === GameState.READY;
    const res = this.game.reveal(r, c);

    if (wasReady && this.game.status === GameState.PLAYING) {
      this.startTimer();
    }

    this.syncGrid();

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

    this.syncGrid();
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
      this.syncGrid();
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

  /** 从云端拉取三档最佳成绩；失败时静默保留本地缓存 */
  async fetchRecordsFromCloud() {
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

        // 云端同步清空；失败时本地已清空，不阻塞玩家
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
