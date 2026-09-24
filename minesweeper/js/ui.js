/**
 * 扫雷 UI 交互控制、动画动效与事件响应控制器
 */

import { MinesweeperGame, GameState, CellState } from './minesweeper.js';
import { sounds } from './audio.js';

// 难度配置预设
const PRESETS = {
  beginner: { rows: 9, cols: 9, mines: 10, label: '初级 (9×9)' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: '中级 (16×16)' },
  expert: { rows: 16, cols: 30, mines: 99, label: '高级 (30×16)' },
  custom: { rows: 12, cols: 12, mines: 20, label: '自定义' }
};

class MinesweeperUI {
  constructor() {
    this.currentDifficulty = 'beginner';
    this.game = null;
    this.timerInterval = null;
    this.mouseButtonsState = 0; // 记录鼠标同时按下的键位（左右键双击检测）
    this.longPressTimer = null;
    this.isTouchMoved = false;

    // DOM 元素缓存
    this.dom = {
      app: document.getElementById('app'),
      difficultySelect: document.getElementById('difficulty-select'),
      customConfig: document.getElementById('custom-config'),
      customRows: document.getElementById('custom-rows'),
      customCols: document.getElementById('custom-cols'),
      customMines: document.getElementById('custom-mines'),
      applyCustomBtn: document.getElementById('apply-custom-btn'),
      themeToggle: document.getElementById('theme-toggle'),
      soundToggle: document.getElementById('sound-toggle'),
      recordsBtn: document.getElementById('records-btn'),
      resetBtn: document.getElementById('reset-btn'),
      smileyIcon: document.getElementById('smiley-icon'),
      mineDigits: document.getElementById('mine-digits'),
      timerDigits: document.getElementById('timer-digits'),
      board: document.getElementById('board'),
      boardContainer: document.getElementById('board-container'),
      modalOverlay: document.getElementById('modal-overlay'),
      recordsModal: document.getElementById('records-modal'),
      recordsList: document.getElementById('records-list'),
      closeModalBtn: document.getElementById('close-modal-btn'),
      clearRecordsBtn: document.getElementById('clear-records-btn'),
      winBanner: document.getElementById('win-banner'),
      winTimeText: document.getElementById('win-time-text'),
      winCloseBtn: document.getElementById('win-close-btn'),
      particleCanvas: document.getElementById('particle-canvas')
    };

    this.particles = [];
    this.canvasCtx = this.dom.particleCanvas.getContext('2d');
    this.isCanvasActive = false;

    this.init();
  }

  init() {
    this.initTheme();
    this.initSoundState();
    this.bindGlobalEvents();
    this.initWindowResize();
    this.startNewGame();
  }

  // 初始化主题（支持记忆）
  initTheme() {
    const savedTheme = localStorage.getItem('minesweeper_theme') || 'modern';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('minesweeper_theme', theme);
    this.dom.themeToggle.textContent = theme === 'classic' ? '🎨 复古风格' : '✨ 现代暗色';
  }

  // 初始化声音按钮状态
  initSoundState() {
    const muted = sounds.isMuted();
    this.updateSoundButton(muted);
  }

  updateSoundButton(muted) {
    this.dom.soundToggle.textContent = muted ? '🔇 静音' : '🔊 音效';
  }

  // 开始新一局游戏
  startNewGame() {
    this.stopTimer();
    this.resetTimerDisplay();

    let rows, cols, mines;
    if (this.currentDifficulty === 'custom') {
      rows = parseInt(this.dom.customRows.value) || 9;
      cols = parseInt(this.dom.customCols.value) || 9;
      mines = parseInt(this.dom.customMines.value) || 10;

      // 边界限制
      rows = Math.max(8, Math.min(30, rows));
      cols = Math.max(8, Math.min(40, cols));
      mines = Math.max(1, Math.min(Math.floor(rows * cols * 0.85), mines));

      this.dom.customRows.value = rows;
      this.dom.customCols.value = cols;
      this.dom.customMines.value = mines;
    } else {
      const preset = PRESETS[this.currentDifficulty];
      rows = preset.rows;
      cols = preset.cols;
      mines = preset.mines;
    }

    this.game = new MinesweeperGame(rows, cols, mines);
    this.setSmiley('normal');
    this.updateMineDisplay(this.game.getRemainingMines());
    this.renderBoard();
  }

  // 渲染并构建网格 DOM
  renderBoard() {
    const board = this.dom.board;
    board.innerHTML = '';
    board.style.gridTemplateRows = `repeat(${this.game.rows}, 1fr)`;
    board.style.gridTemplateColumns = `repeat(${this.game.cols}, 1fr)`;

    const frag = document.createDocumentFragment();

    for (let r = 0; r < this.game.rows; r++) {
      for (let c = 0; c < this.game.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell cell-hidden';
        cell.dataset.row = r;
        cell.dataset.col = c;
        frag.appendChild(cell);
      }
    }

    board.appendChild(frag);
  }

  // 获取特定格子的 DOM 元素
  getCellElement(r, c) {
    return this.dom.board.children[r * this.game.cols + c];
  }

  // 刷新单个格子的视觉样式
  updateCellDOM(cellData) {
    const el = this.getCellElement(cellData.row, cellData.col);
    if (!el) return;

    // 清除所有动态类名
    el.className = 'cell';
    el.textContent = '';

    if (cellData.state === CellState.HIDDEN) {
      el.classList.add('cell-hidden');
    } else if (cellData.state === CellState.FLAGGED) {
      el.classList.add('cell-flagged');
      el.textContent = '🚩';
    } else if (cellData.state === CellState.QUESTION) {
      el.classList.add('cell-question');
      el.textContent = '❓';
    } else if (cellData.state === CellState.REVEALED) {
      el.classList.add('cell-revealed');

      if (cellData.isMine) {
        el.classList.add('cell-mine');
        el.textContent = '💣';
        if (cellData.isExploded) {
          el.classList.add('cell-exploded');
        }
      } else {
        const count = cellData.adjacentMines;
        if (count > 0) {
          el.classList.add(`cell-num-${count}`);
          el.textContent = count;
        } else {
          el.classList.add('cell-zero');
        }
      }
    }

    if (cellData.isFalseFlag) {
      el.classList.add('cell-false-flag');
      el.textContent = '❌';
    }
  }

  // 批量更新改变的格子
  updateChangedCells(changedCells) {
    for (const cell of changedCells) {
      this.updateCellDOM(cell);
    }
  }

  // 启动计时器
  startTimer() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      const elapsed = this.game.getElapsedTime();
      this.updateTimerDisplay(elapsed);
    }, 1000);
  }

  // 停止计时器
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // 刷新七段数码管 (LED) 显示
  updateDigits(container, value) {
    const clamped = Math.max(-99, Math.min(999, value));
    let str = clamped.toString();
    if (clamped < 0) {
      str = '-' + Math.abs(clamped).toString().padStart(2, '0');
    } else {
      str = str.padStart(3, '0');
    }

    container.textContent = str;
  }

  updateMineDisplay(remaining) {
    this.updateDigits(this.dom.mineDigits, remaining);
  }

  updateTimerDisplay(seconds) {
    this.updateDigits(this.dom.timerDigits, seconds);
  }

  resetTimerDisplay() {
    this.updateDigits(this.dom.timerDigits, 0);
  }

  // 切换表情状态
  setSmiley(status) {
    const icons = {
      normal: '😊',
      scared: '😮',
      lost: '😵',
      won: '😎'
    };
    this.dom.smileyIcon.textContent = icons[status] || icons.normal;
  }

  // 处理翻开格子点击
  handleCellClick(r, c) {
    if (this.game.status === GameState.WON || this.game.status === GameState.LOST) {
      return;
    }

    const wasReady = this.game.status === GameState.READY;
    const res = this.game.reveal(r, c);

    if (wasReady && this.game.status === GameState.PLAYING) {
      this.startTimer();
    }

    if (res.changedCells.length > 0) {
      this.updateChangedCells(res.changedCells);
    }

    if (res.status === GameState.LOST) {
      this.handleGameOver(false);
    } else if (res.status === GameState.WON) {
      this.handleGameOver(true);
    } else if (res.changedCells.length > 0) {
      sounds.playClick();
    }
  }

  // 处理右键插旗
  handleCellRightClick(r, c) {
    if (this.game.status === GameState.WON || this.game.status === GameState.LOST) {
      return;
    }

    const res = this.game.toggleFlag(r, c);
    if (!res) return;

    this.updateCellDOM(res.cell);
    this.updateMineDisplay(res.remainingMines);

    if (res.cell.state === CellState.FLAGGED) {
      sounds.playFlag();
      if (navigator.vibrate) navigator.vibrate(30);
    } else {
      sounds.playUnflag();
    }
  }

  // 处理双击和弦 (Chord)
  handleChord(r, c) {
    if (this.game.status !== GameState.PLAYING) return;

    const res = this.game.chord(r, c);
    if (res.triggered && res.changedCells.length > 0) {
      this.updateChangedCells(res.changedCells);
      if (res.status === GameState.LOST) {
        this.handleGameOver(false);
      } else if (res.status === GameState.WON) {
        this.handleGameOver(true);
      } else {
        sounds.playChord();
      }
    }
  }

  // 胜负结算
  handleGameOver(won) {
    this.stopTimer();
    const elapsed = this.game.getElapsedTime();
    this.updateTimerDisplay(elapsed);

    if (won) {
      this.setSmiley('won');
      sounds.playWin();
      this.updateMineDisplay(0);
      this.saveRecord(this.currentDifficulty, elapsed);
      this.showWinModal(elapsed);
      this.launchConfetti();
    } else {
      this.setSmiley('lost');
      sounds.playExplode();
      this.shakeBoard();
    }
  }

  // 棋盘震动效果
  shakeBoard() {
    const container = this.dom.boardContainer;
    container.classList.remove('shake');
    void container.offsetWidth; // 触发 reflow
    container.classList.add('shake');
  }

  // 记录保存与查看
  saveRecord(difficulty, time) {
    if (difficulty === 'custom') return; // 自定义难度不记录榜单
    const key = `minesweeper_record_${difficulty}`;
    const best = localStorage.getItem(key);
    if (!best || time < parseInt(best)) {
      localStorage.setItem(key, time.toString());
    }
  }

  getRecords() {
    return {
      beginner: localStorage.getItem('minesweeper_record_beginner'),
      intermediate: localStorage.getItem('minesweeper_record_intermediate'),
      expert: localStorage.getItem('minesweeper_record_expert')
    };
  }

  showRecordsModal() {
    const records = this.getRecords();
    const list = this.dom.recordsList;
    list.innerHTML = `
      <div class="record-item">
        <span class="record-diff">初级 (9×9, 10雷)</span>
        <span class="record-time">${records.beginner ? records.beginner + ' 秒' : '暂无记录'}</span>
      </div>
      <div class="record-item">
        <span class="record-diff">中级 (16×16, 40雷)</span>
        <span class="record-time">${records.intermediate ? records.intermediate + ' 秒' : '暂无记录'}</span>
      </div>
      <div class="record-item">
        <span class="record-diff">高级 (30×16, 99雷)</span>
        <span class="record-time">${records.expert ? records.expert + ' 秒' : '暂无记录'}</span>
      </div>
    `;

    this.dom.modalOverlay.classList.remove('hidden');
    this.dom.recordsModal.classList.remove('hidden');
  }

  hideModals() {
    this.dom.modalOverlay.classList.add('hidden');
    this.dom.recordsModal.classList.add('hidden');
    this.dom.winBanner.classList.add('hidden');
  }

  showWinModal(time) {
    this.dom.winTimeText.textContent = `恭喜通关！耗时：${time} 秒`;
    this.dom.modalOverlay.classList.remove('hidden');
    this.dom.winBanner.classList.remove('hidden');
  }

  // 粒子动画 (胜利礼花)
  initWindowResize() {
    const resizeCanvas = () => {
      this.dom.particleCanvas.width = window.innerWidth;
      this.dom.particleCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  launchConfetti() {
    this.particles = [];
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    if (!this.isCanvasActive) {
      this.isCanvasActive = true;
      this.animateParticles();
    }
  }

  animateParticles() {
    if (!this.isCanvasActive) return;

    this.canvasCtx.clearRect(0, 0, this.dom.particleCanvas.width, this.dom.particleCanvas.height);
    let alive = 0;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // 重力
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.008;

      if (p.opacity > 0) {
        alive++;
        this.canvasCtx.save();
        this.canvasCtx.translate(p.x, p.y);
        this.canvasCtx.rotate((p.rotation * Math.PI) / 180);
        this.canvasCtx.fillStyle = p.color;
        this.canvasCtx.globalAlpha = Math.max(0, p.opacity);
        this.canvasCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.canvasCtx.restore();
      }
    }

    if (alive > 0) {
      requestAnimationFrame(() => this.animateParticles());
    } else {
      this.isCanvasActive = false;
      this.canvasCtx.clearRect(0, 0, this.dom.particleCanvas.width, this.dom.particleCanvas.height);
    }
  }

  // 绑定各类交互事件
  bindGlobalEvents() {
    // 难度切换
    this.dom.difficultySelect.addEventListener('change', (e) => {
      this.currentDifficulty = e.target.value;
      if (this.currentDifficulty === 'custom') {
        this.dom.customConfig.classList.remove('hidden');
      } else {
        this.dom.customConfig.classList.add('hidden');
        this.startNewGame();
      }
    });

    // 应用自定义
    this.dom.applyCustomBtn.addEventListener('click', () => {
      this.startNewGame();
    });

    // 主题切换
    this.dom.themeToggle.addEventListener('click', () => {
      const current = document.body.className.includes('theme-classic') ? 'classic' : 'modern';
      const next = current === 'classic' ? 'modern' : 'classic';
      this.setTheme(next);
    });

    // 音效切换
    this.dom.soundToggle.addEventListener('click', () => {
      const muted = !sounds.isMuted();
      sounds.setMuted(muted);
      this.updateSoundButton(muted);
    });

    // 战绩榜与弹窗
    this.dom.recordsBtn.addEventListener('click', () => {
      this.showRecordsModal();
    });

    this.dom.closeModalBtn.addEventListener('click', () => {
      this.hideModals();
    });

    this.dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.dom.modalOverlay) {
        this.hideModals();
      }
    });

    this.dom.winCloseBtn.addEventListener('click', () => {
      this.hideModals();
      this.startNewGame();
    });

    this.dom.clearRecordsBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有难度历史最佳记录吗？')) {
        localStorage.removeItem('minesweeper_record_beginner');
        localStorage.removeItem('minesweeper_record_intermediate');
        localStorage.removeItem('minesweeper_record_expert');
        this.showRecordsModal();
      }
    });

    // 重置按钮
    this.dom.resetBtn.addEventListener('click', () => {
      this.hideModals();
      this.startNewGame();
    });

    // 棋盘鼠标事件代理
    const board = this.dom.board;

    // 禁用默认右键菜单
    board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cellEl = e.target.closest('.cell');
      if (cellEl) {
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);
        this.handleCellRightClick(r, c);
      }
    });

    // 鼠标按下：表情紧张
    board.addEventListener('mousedown', (e) => {
      if (this.game.status === GameState.PLAYING || this.game.status === GameState.READY) {
        this.setSmiley('scared');
      }

      this.mouseButtonsState = e.buttons;

      // 左右键同时按下检测（buttons === 3 表示左右键均被按下）
      if (e.buttons === 3) {
        const cellEl = e.target.closest('.cell');
        if (cellEl) {
          const r = parseInt(cellEl.dataset.row);
          const c = parseInt(cellEl.dataset.col);
          this.handleChord(r, c);
        }
      }
    });

    // 鼠标释放：表情恢复
    window.addEventListener('mouseup', () => {
      this.mouseButtonsState = 0;
      if (this.game.status === GameState.PLAYING || this.game.status === GameState.READY) {
        this.setSmiley('normal');
      }
    });

    // 左键点击
    board.addEventListener('click', (e) => {
      const cellEl = e.target.closest('.cell');
      if (!cellEl) return;
      const r = parseInt(cellEl.dataset.row);
      const c = parseInt(cellEl.dataset.col);
      this.handleCellClick(r, c);
    });

    // 双击触发和弦
    board.addEventListener('dblclick', (e) => {
      const cellEl = e.target.closest('.cell');
      if (!cellEl) return;
      const r = parseInt(cellEl.dataset.row);
      const c = parseInt(cellEl.dataset.col);
      this.handleChord(r, c);
    });

    // 鼠标中键 (滚轮按下) 触发和弦
    board.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        const cellEl = e.target.closest('.cell');
        if (!cellEl) return;
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);
        this.handleChord(r, c);
      }
    });

    // 移动端长按插旗支持
    board.addEventListener('touchstart', (e) => {
      this.isTouchMoved = false;
      const cellEl = e.target.closest('.cell');
      if (!cellEl) return;

      const r = parseInt(cellEl.dataset.row);
      const c = parseInt(cellEl.dataset.col);

      this.longPressTimer = setTimeout(() => {
        if (!this.isTouchMoved) {
          this.handleCellRightClick(r, c);
        }
      }, 350);
    }, { passive: true });

    board.addEventListener('touchmove', () => {
      this.isTouchMoved = true;
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });

    board.addEventListener('touchend', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }, { passive: true });
  }
}

// 页面加载完成后实例化启动
window.addEventListener('DOMContentLoaded', () => {
  new MinesweeperUI();
});
