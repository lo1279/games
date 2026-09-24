(function () {
  'use strict';

  /* ============================================================
     1. Web Audio 音效引擎 (SoundEngine)
     ============================================================ */
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem('minesweeper_muted') === 'true';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    setMuted(muted) {
      this.muted = muted;
      localStorage.setItem('minesweeper_muted', muted ? 'true' : 'false');
    }

    isMuted() {
      return this.muted;
    }

    playClick() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    }

    playFlag() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    }

    playUnflag() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }

    playChord() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(680, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    }

    playExplode() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.7);

      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
    }

    playWin() {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const startTime = now + idx * 0.12;
        const duration = 0.35;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    }
  }

  const sounds = new SoundEngine();

  /* ============================================================
     2. 扫雷核心逻辑与算法 (MinesweeperGame)
     ============================================================ */
  const GameState = {
    READY: 'READY',
    PLAYING: 'PLAYING',
    WON: 'WON',
    LOST: 'LOST'
  };

  const CellState = {
    HIDDEN: 'HIDDEN',
    REVEALED: 'REVEALED',
    FLAGGED: 'FLAGGED',
    QUESTION: 'QUESTION'
  };

  class MinesweeperGame {
    constructor(rows = 9, cols = 9, mines = 10) {
      this.rows = rows;
      this.cols = cols;
      this.mines = mines;
      this.status = GameState.READY;
      this.grid = [];
      this.revealedCount = 0;
      this.flagCount = 0;
      this.startTime = null;
      this.endTime = null;

      this.initGrid();
    }

    initGrid() {
      this.grid = [];
      this.status = GameState.READY;
      this.revealedCount = 0;
      this.flagCount = 0;
      this.startTime = null;
      this.endTime = null;

      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          row.push({
            row: r,
            col: c,
            isMine: false,
            adjacentMines: 0,
            state: CellState.HIDDEN,
            isExploded: false,
            isFalseFlag: false
          });
        }
        this.grid.push(row);
      }
    }

    getNeighbors(r, c) {
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            neighbors.push(this.grid[nr][nc]);
          }
        }
      }
      return neighbors;
    }

    generateMines(firstClickR, firstClickC) {
      const totalCells = this.rows * this.cols;
      const safeSet = new Set();

      safeSet.add(`${firstClickR},${firstClickC}`);
      const neighbors = this.getNeighbors(firstClickR, firstClickC);
      
      if (totalCells - 9 >= this.mines) {
        neighbors.forEach(n => safeSet.add(`${n.row},${n.col}`));
      }

      const candidates = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!safeSet.has(`${r},${c}`)) {
            candidates.push({ r, c });
          }
        }
      }

      let minesPlaced = 0;
      while (minesPlaced < this.mines && candidates.length > 0) {
        const randIdx = Math.floor(Math.random() * candidates.length);
        const { r, c } = candidates.splice(randIdx, 1)[0];
        this.grid[r][c].isMine = true;
        minesPlaced++;
      }
      this.mines = minesPlaced;

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c].isMine) continue;
          const count = this.getNeighbors(r, c).filter(n => n.isMine).length;
          this.grid[r][c].adjacentMines = count;
        }
      }
    }

    reveal(r, c) {
      if (this.status !== GameState.PLAYING && this.status !== GameState.READY) {
        return { status: this.status, changedCells: [] };
      }

      const cell = this.grid[r][c];
      if (cell.state !== CellState.HIDDEN) {
        return { status: this.status, changedCells: [] };
      }

      // 首次点击初始化（仅当点击未标记格时才触发布雷与计时）
      if (this.status === GameState.READY) {
        this.generateMines(r, c);
        this.status = GameState.PLAYING;
        this.startTime = Date.now();
      }

      const changedCells = [];

      if (cell.isMine) {
        cell.isExploded = true;
        cell.state = CellState.REVEALED;
        this.status = GameState.LOST;
        this.endTime = Date.now();
        changedCells.push(cell);

        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const item = this.grid[row][col];
            if (item === cell) continue;

            if (item.isMine && item.state !== CellState.FLAGGED) {
              item.state = CellState.REVEALED;
              changedCells.push(item);
            } else if (!item.isMine && item.state === CellState.FLAGGED) {
              item.isFalseFlag = true;
              changedCells.push(item);
            }
          }
        }

        return { status: GameState.LOST, changedCells, explodedCell: cell };
      }

      const queue = [cell];
      cell.state = CellState.REVEALED;
      this.revealedCount++;
      changedCells.push(cell);

      while (queue.length > 0) {
        const current = queue.shift();
        if (current.adjacentMines === 0) {
          const neighbors = this.getNeighbors(current.row, current.col);
          for (const neighbor of neighbors) {
            if ((neighbor.state === CellState.HIDDEN || neighbor.state === CellState.QUESTION) && !neighbor.isMine) {
              neighbor.state = CellState.REVEALED;
              this.revealedCount++;
              changedCells.push(neighbor);
              if (neighbor.adjacentMines === 0) {
                queue.push(neighbor);
              }
            }
          }
        }
      }

      const totalCells = this.rows * this.cols;
      if (this.revealedCount === totalCells - this.mines) {
        this.status = GameState.WON;
        this.endTime = Date.now();

        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const item = this.grid[row][col];
            if (item.isMine && item.state !== CellState.FLAGGED) {
              item.state = CellState.FLAGGED;
              this.flagCount++;
              changedCells.push(item);
            }
          }
        }

        return { status: GameState.WON, changedCells };
      }

      return { status: GameState.PLAYING, changedCells };
    }

    toggleFlag(r, c) {
      if (this.status !== GameState.PLAYING && this.status !== GameState.READY) {
        return null;
      }

      const cell = this.grid[r][c];
      if (cell.state === CellState.REVEALED) {
        return null;
      }

      let previousState = cell.state;

      if (cell.state === CellState.HIDDEN) {
        cell.state = CellState.FLAGGED;
        this.flagCount++;
      } else if (cell.state === CellState.FLAGGED) {
        cell.state = CellState.QUESTION;
        this.flagCount--;
      } else if (cell.state === CellState.QUESTION) {
        cell.state = CellState.HIDDEN;
      }

      return {
        cell,
        previousState,
        remainingMines: this.mines - this.flagCount
      };
    }

    chord(r, c) {
      if (this.status !== GameState.PLAYING) {
        return { status: this.status, triggered: false, changedCells: [] };
      }

      const cell = this.grid[r][c];
      if (cell.state !== CellState.REVEALED || cell.adjacentMines === 0) {
        return { status: this.status, triggered: false, changedCells: [] };
      }

      const neighbors = this.getNeighbors(r, c);
      const flaggedCount = neighbors.filter(n => n.state === CellState.FLAGGED).length;

      if (flaggedCount !== cell.adjacentMines) {
        return { status: this.status, triggered: false, changedCells: [] };
      }

      const toReveal = neighbors.filter(n => n.state === CellState.HIDDEN || n.state === CellState.QUESTION);
      if (toReveal.length === 0) {
        return { status: this.status, triggered: false, changedCells: [] };
      }

      let triggeredExplosion = false;
      let explodedCell = null;
      const changedCells = [];

      for (const target of toReveal) {
        if (target.isMine) {
          triggeredExplosion = true;
          target.isExploded = true;
          explodedCell = target;
          break;
        }
      }

      if (triggeredExplosion) {
        this.status = GameState.LOST;
        this.endTime = Date.now();
        explodedCell.state = CellState.REVEALED;
        changedCells.push(explodedCell);

        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const item = this.grid[row][col];
            if (item === explodedCell) continue;

            if (item.isMine && item.state !== CellState.FLAGGED) {
              item.state = CellState.REVEALED;
              changedCells.push(item);
            } else if (!item.isMine && item.state === CellState.FLAGGED) {
              item.isFalseFlag = true;
              changedCells.push(item);
            }
          }
        }

        return { status: GameState.LOST, triggered: true, changedCells, explodedCell };
      }

      for (const target of toReveal) {
        if (target.state !== CellState.REVEALED) {
          target.state = CellState.REVEALED;
          this.revealedCount++;
          changedCells.push(target);

          if (target.adjacentMines === 0) {
            const q = [target];
            while (q.length > 0) {
              const cur = q.shift();
              const subNeighbors = this.getNeighbors(cur.row, cur.col);
              for (const sn of subNeighbors) {
                if ((sn.state === CellState.HIDDEN || sn.state === CellState.QUESTION) && !sn.isMine) {
                  sn.state = CellState.REVEALED;
                  this.revealedCount++;
                  changedCells.push(sn);
                  if (sn.adjacentMines === 0) {
                    q.push(sn);
                  }
                }
              }
            }
          }
        }
      }

      const totalCells = this.rows * this.cols;
      if (this.revealedCount === totalCells - this.mines) {
        this.status = GameState.WON;
        this.endTime = Date.now();

        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const item = this.grid[row][col];
            if (item.isMine && item.state !== CellState.FLAGGED) {
              item.state = CellState.FLAGGED;
              this.flagCount++;
              changedCells.push(item);
            }
          }
        }

        return { status: GameState.WON, triggered: true, changedCells };
      }

      return { status: GameState.PLAYING, triggered: true, changedCells };
    }

    getRemainingMines() {
      return this.mines - this.flagCount;
    }

    getElapsedTime() {
      if (!this.startTime) return 0;
      const end = this.endTime || Date.now();
      return Math.floor((end - this.startTime) / 1000);
    }
  }

  /* ============================================================
     3. UI 交互与视觉效果控制器 (MinesweeperUI)
     ============================================================ */
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
      this.mouseButtonsState = 0;
      this.longPressTimer = null;
      this.isTouchMoved = false;
      this.touchMode = 'REVEAL';

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
        btnModeReveal: document.getElementById('btn-mode-reveal'),
        btnModeFlag: document.getElementById('btn-mode-flag'),
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

    initTheme() {
      const savedTheme = localStorage.getItem('minesweeper_theme') || 'modern';
      this.setTheme(savedTheme);
    }

    setTheme(theme) {
      document.body.className = `theme-${theme}`;
      localStorage.setItem('minesweeper_theme', theme);
      this.dom.themeToggle.textContent = theme === 'classic' ? '🎨 复古风格' : '✨ 现代暗色';
    }

    initSoundState() {
      const muted = sounds.isMuted();
      this.updateSoundButton(muted);
    }

    updateSoundButton(muted) {
      this.dom.soundToggle.textContent = muted ? '🔇 静音' : '🔊 音效';
    }

    startNewGame() {
      this.stopTimer();
      this.resetTimerDisplay();

      let rows, cols, mines;
      if (this.currentDifficulty === 'custom') {
        rows = parseInt(this.dom.customRows.value) || 9;
        cols = parseInt(this.dom.customCols.value) || 9;
        mines = parseInt(this.dom.customMines.value) || 10;

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

    getCellElement(r, c) {
      return this.dom.board.children[r * this.game.cols + c];
    }

    updateCellDOM(cellData) {
      const el = this.getCellElement(cellData.row, cellData.col);
      if (!el) return;

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

    updateChangedCells(changedCells) {
      for (const cell of changedCells) {
        this.updateCellDOM(cell);
      }
    }

    startTimer() {
      if (this.timerInterval) return;
      this.timerInterval = setInterval(() => {
        const elapsed = this.game.getElapsedTime();
        this.updateTimerDisplay(elapsed);
      }, 1000);
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

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

    setSmiley(status) {
      const icons = {
        normal: '😊',
        scared: '😮',
        lost: '😵',
        won: '😎'
      };
      this.dom.smileyIcon.textContent = icons[status] || icons.normal;
    }

    handleCellClick(r, c) {
      if (this.game.status === GameState.WON || this.game.status === GameState.LOST) {
        return;
      }

      const clickedCell = this.game.grid[r][c];

      // 若当前为手机插旗模式且格子未翻开，直接执行插旗切换
      if (this.touchMode === 'FLAG' && clickedCell.state !== CellState.REVEALED) {
        this.handleCellRightClick(r, c);
        return;
      }

      // 若点击已翻开且带数字的格子，自动触发和弦展开 (Chord)
      if (clickedCell.state === CellState.REVEALED && clickedCell.adjacentMines > 0) {
        this.handleChord(r, c);
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

    setTouchMode(mode) {
      this.touchMode = mode;
      if (this.dom.btnModeReveal && this.dom.btnModeFlag) {
        if (mode === 'REVEAL') {
          this.dom.btnModeReveal.classList.add('active');
          this.dom.btnModeFlag.classList.remove('active');
        } else {
          this.dom.btnModeReveal.classList.remove('active');
          this.dom.btnModeFlag.classList.add('active');
        }
      }
    }

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

    shakeBoard() {
      const container = this.dom.boardContainer;
      container.classList.remove('shake');
      void container.offsetWidth;
      container.classList.add('shake');
    }

    saveRecord(difficulty, time) {
      if (difficulty === 'custom') return;
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
        p.vy += 0.25;
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

    bindGlobalEvents() {
      // 移动端操作模式切换
      if (this.dom.btnModeReveal && this.dom.btnModeFlag) {
        this.dom.btnModeReveal.addEventListener('click', () => {
          this.setTouchMode('REVEAL');
        });
        this.dom.btnModeFlag.addEventListener('click', () => {
          this.setTouchMode('FLAG');
        });
      }

      this.dom.difficultySelect.addEventListener('change', (e) => {
        this.currentDifficulty = e.target.value;
        if (this.currentDifficulty === 'custom') {
          this.dom.customConfig.classList.remove('hidden');
        } else {
          this.dom.customConfig.classList.add('hidden');
          this.startNewGame();
        }
      });

      this.dom.applyCustomBtn.addEventListener('click', () => {
        this.startNewGame();
      });

      this.dom.themeToggle.addEventListener('click', () => {
        const current = document.body.className.includes('theme-classic') ? 'classic' : 'modern';
        const next = current === 'classic' ? 'modern' : 'classic';
        this.setTheme(next);
      });

      this.dom.soundToggle.addEventListener('click', () => {
        const muted = !sounds.isMuted();
        sounds.setMuted(muted);
        this.updateSoundButton(muted);
      });

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

      this.dom.resetBtn.addEventListener('click', () => {
        this.hideModals();
        this.startNewGame();
      });

      const board = this.dom.board;

      board.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cellEl = e.target.closest('.cell');
        if (cellEl) {
          const r = parseInt(cellEl.dataset.row);
          const c = parseInt(cellEl.dataset.col);
          this.handleCellRightClick(r, c);
        }
      });

      board.addEventListener('mousedown', (e) => {
        if (this.game.status === GameState.PLAYING || this.game.status === GameState.READY) {
          this.setSmiley('scared');
        }

        this.mouseButtonsState = e.buttons;

        if (e.buttons === 3) {
          const cellEl = e.target.closest('.cell');
          if (cellEl) {
            const r = parseInt(cellEl.dataset.row);
            const c = parseInt(cellEl.dataset.col);
            this.handleChord(r, c);
          }
        }
      });

      window.addEventListener('mouseup', () => {
        this.mouseButtonsState = 0;
        if (this.game.status === GameState.PLAYING || this.game.status === GameState.READY) {
          this.setSmiley('normal');
        }
      });

      board.addEventListener('click', (e) => {
        const cellEl = e.target.closest('.cell');
        if (!cellEl) return;
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);
        this.handleCellClick(r, c);
      });

      board.addEventListener('dblclick', (e) => {
        const cellEl = e.target.closest('.cell');
        if (!cellEl) return;
        const r = parseInt(cellEl.dataset.row);
        const c = parseInt(cellEl.dataset.col);
        this.handleChord(r, c);
      });

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

  window.addEventListener('DOMContentLoaded', () => {
    new MinesweeperUI();
  });
})();
