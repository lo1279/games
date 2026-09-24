// pages/index/index.js
const { MinesweeperGame, GameState, CellState } = require('../../utils/minesweeper.js');

const DIFF_OPTIONS = [
  { rows: 9, cols: 9, mines: 10, label: '初级 (9×9, 10雷)', shortLabel: '初级 9×9' },
  { rows: 16, cols: 16, mines: 40, label: '中级 (16×16, 40雷)', shortLabel: '中级 16×16' },
  { rows: 16, cols: 30, mines: 99, label: '高级 (30×16, 99雷)', shortLabel: '高级 30×16' }
];

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

  // 记录榜单存储
  saveRecord(time) {
    const diffKeys = ['beginner', 'intermediate', 'expert'];
    const key = diffKeys[this.data.diffIndex];
    if (!key) return;

    const storageKey = `ms_best_${key}`;
    const best = wx.getStorageSync(storageKey);

    if (!best || time < parseInt(best, 10)) {
      wx.setStorageSync(storageKey, time.toString());
      this.loadRecords();
    }
  },

  loadRecords() {
    this.setData({
      records: {
        beginner: wx.getStorageSync('ms_best_beginner') || '',
        intermediate: wx.getStorageSync('ms_best_intermediate') || '',
        expert: wx.getStorageSync('ms_best_expert') || ''
      }
    });
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定要清除所有难度历史最佳成绩吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('ms_best_beginner');
          wx.removeStorageSync('ms_best_intermediate');
          wx.removeStorageSync('ms_best_expert');
          this.loadRecords();
          this.vibrate('light');
        }
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
