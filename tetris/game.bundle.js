/**
 * 俄罗斯方块（Tetris）独立运行整合包
 * 支持 file:// 协议直接双击打开，无需本地 HTTP 服务器
 */

(function () {
    'use strict';

    // ==========================================
    // 1. 常量与配置 (Constants)
    // ==========================================
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 32;

    const PREVIEW_SIZE = 4;
    const PREVIEW_BLOCK_SIZE = 24;

    const SPEED_CURVE = [
        800, 715, 630, 550, 470, 390, 310, 240, 180, 130,
        100, 80, 60, 50, 40, 30, 25, 20, 18, 15
    ];

    const LINE_POINTS = [0, 100, 300, 500, 800];
    const SOFT_DROP_POINTS = 1;
    const HARD_DROP_POINTS = 2;

    const TETROMINOES = {
        I: {
            id: 'I',
            color: '#00f0f0',
            glow: 'rgba(0, 240, 240, 0.65)',
            shapes: [
                [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
                [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
                [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
                [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]
            ]
        },
        J: {
            id: 'J',
            color: '#0055ff',
            glow: 'rgba(0, 85, 255, 0.65)',
            shapes: [
                [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
                [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
                [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
                [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
            ]
        },
        L: {
            id: 'L',
            color: '#ffaa00',
            glow: 'rgba(255, 170, 0, 0.65)',
            shapes: [
                [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
                [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
                [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
                [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
            ]
        },
        O: {
            id: 'O',
            color: '#ffea00',
            glow: 'rgba(255, 234, 0, 0.65)',
            shapes: [
                [[1, 1], [1, 1]],
                [[1, 1], [1, 1]],
                [[1, 1], [1, 1]],
                [[1, 1], [1, 1]]
            ]
        },
        S: {
            id: 'S',
            color: '#00ff66',
            glow: 'rgba(0, 255, 102, 0.65)',
            shapes: [
                [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
                [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
                [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
                [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
            ]
        },
        T: {
            id: 'T',
            color: '#bb00ff',
            glow: 'rgba(187, 0, 255, 0.65)',
            shapes: [
                [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
                [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
                [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
                [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
            ]
        },
        Z: {
            id: 'Z',
            color: '#ff2255',
            glow: 'rgba(255, 34, 85, 0.65)',
            shapes: [
                [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
                [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
                [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
                [[0, 1, 0], [1, 1, 0], [1, 0, 0]]
            ]
        }
    };

    const WALL_KICKS_JLSZT = {
        '0->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '1->0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '1->2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '2->1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '2->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '3->2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '3->0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '0->3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
    };

    const WALL_KICKS_I = {
        '0->1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '1->0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '1->2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        '2->1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '2->3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '3->2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '3->0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '0->3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
    };

    // ==========================================
    // 2. 音效引擎 (Web Audio API)
    // ==========================================
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.muted = false;
            this.initialized = false;
        }

        init() {
            if (!this.initialized) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                    this.initialized = true;
                }
            } else if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        toggleMute() {
            this.muted = !this.muted;
            return this.muted;
        }

        playTone(freq, type = 'square', duration = 0.08, gainVal = 0.1) {
            if (this.muted || !this.ctx) return;
            this.init();
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {}
        }

        playMove() {
            this.playTone(320, 'sine', 0.04, 0.05);
        }

        playRotate() {
            if (this.muted || !this.ctx) return;
            this.init();
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.07);
                gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.07);
            } catch (e) {}
        }

        playDrop() {
            if (this.muted || !this.ctx) return;
            this.init();
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(180, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.12);
            } catch (e) {}
        }

        playClear(lines) {
            if (this.muted || !this.ctx) return;
            this.init();
            const notes = lines === 4 
                ? [523.25, 659.25, 783.99, 1046.50]
                : [440, 554.37, 659.25].slice(0, lines + 1);

            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, lines === 4 ? 'square' : 'triangle', 0.12, 0.12);
                }, idx * 60);
            });
        }

        playLevelUp() {
            if (this.muted || !this.ctx) return;
            this.init();
            const notes = [440, 554.37, 659.25, 880];
            notes.forEach((freq, idx) => {
                setTimeout(() => {
                    this.playTone(freq, 'sine', 0.15, 0.15);
                }, idx * 80);
            });
        }

        playGameOver() {
            if (this.muted || !this.ctx) return;
            this.init();
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(350, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.6);
                gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.6);
            } catch (e) {}
        }

        playHold() {
            this.playTone(587.33, 'triangle', 0.08, 0.08);
        }
    }

    const sound = new SoundEngine();

    // ==========================================
    // 3. 方块类与随机袋 (Piece & Bag)
    // ==========================================
    class Piece {
        constructor(type) {
            this.type = type;
            this.config = TETROMINOES[type];
            this.rotation = 0;
            this.shape = this.config.shapes[0];
            this.color = this.config.color;
            this.glow = this.config.glow;

            this.x = Math.floor((COLS - this.shape[0].length) / 2);
            this.y = this.type === 'I' ? -1 : 0;
        }

        getShape(rotIndex = this.rotation) {
            return this.config.shapes[rotIndex % 4];
        }

        rotate(board, clockwise = true) {
            const nextRotation = clockwise 
                ? (this.rotation + 1) % 4 
                : (this.rotation + 3) % 4;

            const nextShape = this.getShape(nextRotation);
            const kickKey = `${this.rotation}->${nextRotation}`;
            const kickTable = this.type === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSZT;
            const kicks = kickTable[kickKey] || [[0, 0]];

            for (const [ox, oy] of kicks) {
                const targetX = this.x + ox;
                const targetY = this.y - oy;

                if (board.isValidMove(targetX, targetY, nextShape)) {
                    this.x = targetX;
                    this.y = targetY;
                    this.rotation = nextRotation;
                    this.shape = nextShape;
                    return true;
                }
            }
            return false;
        }

        move(dx, dy, board) {
            if (board.isValidMove(this.x + dx, this.y + dy, this.shape)) {
                this.x += dx;
                this.y += dy;
                return true;
            }
            return false;
        }

        getGhostY(board) {
            let ghostY = this.y;
            while (board.isValidMove(this.x, ghostY + 1, this.shape)) {
                ghostY++;
            }
            return ghostY;
        }
    }

    class BagRandomizer {
        constructor() {
            this.bag = [];
        }

        next() {
            if (this.bag.length === 0) {
                this.bag = Object.keys(TETROMINOES);
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
            }
            const type = this.bag.pop();
            return new Piece(type);
        }
    }

    // ==========================================
    // 4. 网格面板与渲染 (Board)
    // ==========================================
    class Board {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.grid = this.createEmptyGrid();
            this.particles = [];
            this.clearingRows = [];

            this.canvas.width = COLS * BLOCK_SIZE;
            this.canvas.height = ROWS * BLOCK_SIZE;
        }

        createEmptyGrid() {
            return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        }

        reset() {
            this.grid = this.createEmptyGrid();
            this.particles = [];
            this.clearingRows = [];
        }

        isValidMove(x, y, shape) {
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        const boardX = x + c;
                        const boardY = y + r;

                        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                            return false;
                        }
                        if (boardY >= 0 && this.grid[boardY][boardX] !== 0) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        lockPiece(piece) {
            for (let r = 0; r < piece.shape.length; r++) {
                for (let c = 0; c < piece.shape[r].length; c++) {
                    if (piece.shape[r][c]) {
                        const boardY = piece.y + r;
                        const boardX = piece.x + c;
                        if (boardY >= 0) {
                            this.grid[boardY][boardX] = {
                                color: piece.color,
                                glow: piece.glow
                            };
                        }
                    }
                }
            }
        }

        getCompletedRows() {
            const fullRows = [];
            for (let r = 0; r < ROWS; r++) {
                if (this.grid[r].every(cell => cell !== 0)) {
                    fullRows.push(r);
                }
            }
            return fullRows;
        }

        spawnClearParticles(rowIndices) {
            for (const row of rowIndices) {
                for (let c = 0; c < COLS; c++) {
                    const cell = this.grid[row][c];
                    const color = cell ? cell.color : '#ffffff';
                    const px = c * BLOCK_SIZE + BLOCK_SIZE / 2;
                    const py = row * BLOCK_SIZE + BLOCK_SIZE / 2;

                    for (let i = 0; i < 6; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1.5 + Math.random() * 4;
                        this.particles.push({
                            x: px,
                            y: py,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            size: 2 + Math.random() * 3,
                            alpha: 1,
                            decay: 0.02 + Math.random() * 0.03,
                            color: color
                        });
                    }
                }
            }
        }

        removeRows(rowIndices) {
            this.grid = this.grid.filter((_, idx) => !rowIndices.includes(idx));
            while (this.grid.length < ROWS) {
                this.grid.unshift(Array(COLS).fill(0));
            }
        }

        updateParticles() {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;
                if (p.alpha <= 0) {
                    this.particles.splice(i, 1);
                }
            }
        }

        drawBlock(ctx, x, y, size, color, glow, isGhost = false) {
            const px = x * size;
            const py = y * size;

            if (isGhost) {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
                ctx.fillStyle = glow.replace(/[\d.]+\)$/, '0.12)');
                ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
                ctx.restore();
                return;
            }

            ctx.save();
            ctx.shadowColor = glow;
            ctx.shadowBlur = 10;
            ctx.fillStyle = color;
            ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(px + 1, py + 1, size - 2, 3);
            ctx.fillRect(px + 1, py + 1, 3, size - 2);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(px + 1, py + size - 4, size - 2, 3);
            ctx.fillRect(px + size - 4, py + 1, 3, size - 2);
            ctx.restore();
        }

        draw(activePiece = null) {
            const { ctx, canvas } = this;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            for (let r = 0; r <= ROWS; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * BLOCK_SIZE);
                ctx.lineTo(canvas.width, r * BLOCK_SIZE);
                ctx.stroke();
            }
            for (let c = 0; c <= COLS; c++) {
                ctx.beginPath();
                ctx.moveTo(c * BLOCK_SIZE, 0);
                ctx.lineTo(c * BLOCK_SIZE, canvas.height);
                ctx.stroke();
            }

            for (let r = 0; r < ROWS; r++) {
                const isClearing = this.clearingRows.includes(r);
                for (let c = 0; c < COLS; c++) {
                    const cell = this.grid[r][c];
                    if (cell) {
                        if (isClearing) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                            ctx.fillRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        } else {
                            this.drawBlock(ctx, c, r, BLOCK_SIZE, cell.color, cell.glow);
                        }
                    }
                }
            }

            if (activePiece) {
                const ghostY = activePiece.getGhostY(this);
                for (let r = 0; r < activePiece.shape.length; r++) {
                    for (let c = 0; c < activePiece.shape[r].length; c++) {
                        if (activePiece.shape[r][c]) {
                            const drawY = ghostY + r;
                            const drawX = activePiece.x + c;
                            if (drawY >= 0) {
                                this.drawBlock(ctx, drawX, drawY, BLOCK_SIZE, activePiece.color, activePiece.glow, true);
                            }
                        }
                    }
                }

                for (let r = 0; r < activePiece.shape.length; r++) {
                    for (let c = 0; c < activePiece.shape[r].length; c++) {
                        if (activePiece.shape[r][c]) {
                            const drawY = activePiece.y + r;
                            const drawX = activePiece.x + c;
                            if (drawY >= 0) {
                                this.drawBlock(ctx, drawX, drawY, BLOCK_SIZE, activePiece.color, activePiece.glow, false);
                            }
                        }
                    }
                }
            }

            for (const p of this.particles) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    // ==========================================
    // 5. 游戏主控逻辑 (Game)
    // ==========================================
    class Game {
        constructor() {
            this.mainCanvas = document.getElementById('board');
            this.nextCanvas = document.getElementById('next-canvas');
            this.holdCanvas = document.getElementById('hold-canvas');

            this.board = new Board(this.mainCanvas);
            this.nextCtx = this.nextCanvas.getContext('2d');
            this.holdCtx = this.holdCanvas.getContext('2d');

            this.nextCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
            this.nextCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
            this.holdCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
            this.holdCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;

            this.scoreEl = document.getElementById('score');
            this.linesEl = document.getElementById('lines');
            this.levelEl = document.getElementById('level');
            this.highScoreEl = document.getElementById('high-score');
            this.overlayEl = document.getElementById('overlay');
            this.overlayTitleEl = document.getElementById('overlay-title');
            this.overlaySubtitleEl = document.getElementById('overlay-subtitle');
            this.btnStart = document.getElementById('btn-start');
            this.btnPause = document.getElementById('btn-pause');
            this.btnSound = document.getElementById('btn-sound');

            this.randomizer = new BagRandomizer();
            this.currentPiece = null;
            this.nextPiece = null;
            this.heldPiece = null;
            this.canHold = true;

            this.score = 0;
            this.lines = 0;
            this.level = 1;
            this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
            this.highScoreEl.textContent = this.highScore;

            this.dropCounter = 0;
            this.lastTime = 0;
            this.isGameOver = false;
            this.isPaused = false;
            this.isPlaying = false;
            this.isClearing = false;

            this.animationId = null;

            this.initEventListeners();
            this.drawPreview(this.nextCtx, null);
            this.drawPreview(this.holdCtx, null);
            this.board.draw(null);
        }

        start() {
            sound.init();
            this.board.reset();
            this.randomizer = new BagRandomizer();

            this.score = 0;
            this.lines = 0;
            this.level = 1;
            this.canHold = true;
            this.heldPiece = null;
            this.isGameOver = false;
            this.isPaused = false;
            this.isPlaying = true;
            this.isClearing = false;

            this.updateUI();

            this.currentPiece = this.randomizer.next();
            this.nextPiece = this.randomizer.next();

            this.hideOverlay();
            this.btnPause.textContent = '⏸ 暂停 (P)';

            this.lastTime = performance.now();
            this.dropCounter = 0;

            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            this.loop(this.lastTime);
        }

        togglePause() {
            if (!this.isPlaying || this.isGameOver) return;

            this.isPaused = !this.isPaused;
            if (this.isPaused) {
                this.showOverlay('游戏已暂停', '按 P 键或点击按钮继续');
                this.btnPause.textContent = '▶ 继续 (P)';
            } else {
                this.hideOverlay();
                this.btnPause.textContent = '⏸ 暂停 (P)';
                this.lastTime = performance.now();
                this.loop(this.lastTime);
            }
        }

        loop(time = 0) {
            if (!this.isPlaying || this.isPaused || this.isGameOver) return;

            const deltaTime = time - this.lastTime;
            this.lastTime = time;

            this.board.updateParticles();

            if (!this.isClearing) {
                this.dropCounter += deltaTime;
                const dropInterval = this.getDropInterval();

                if (this.dropCounter > dropInterval) {
                    this.dropPiece();
                    this.dropCounter = 0;
                }
            }

            this.board.draw(this.currentPiece);
            this.drawPreview(this.nextCtx, this.nextPiece);
            this.drawPreview(this.holdCtx, this.heldPiece);

            this.animationId = requestAnimationFrame((t) => this.loop(t));
        }

        getDropInterval() {
            const idx = Math.min(this.level - 1, SPEED_CURVE.length - 1);
            return SPEED_CURVE[idx];
        }

        dropPiece() {
            if (!this.currentPiece) return;
            if (!this.currentPiece.move(0, 1, this.board)) {
                this.lockCurrentPiece();
            }
        }

        softDrop() {
            if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
            if (this.currentPiece.move(0, 1, this.board)) {
                this.addScore(SOFT_DROP_POINTS);
                sound.playMove();
                this.dropCounter = 0;
            } else {
                this.lockCurrentPiece();
            }
        }

        hardDrop() {
            if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;

            let droppedRows = 0;
            while (this.currentPiece.move(0, 1, this.board)) {
                droppedRows++;
            }

            if (droppedRows > 0) {
                this.addScore(droppedRows * HARD_DROP_POINTS);
            }
            sound.playDrop();
            this.lockCurrentPiece();
        }

        movePiece(dx) {
            if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
            if (this.currentPiece.move(dx, 0, this.board)) {
                sound.playMove();
            }
        }

        rotatePiece(clockwise = true) {
            if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
            if (this.currentPiece.rotate(this.board, clockwise)) {
                sound.playRotate();
            }
        }

        hold() {
            if (!this.isPlaying || this.isPaused || this.isClearing || !this.canHold || !this.currentPiece) return;

            sound.playHold();
            const currentType = this.currentPiece.type;

            if (!this.heldPiece) {
                this.heldPiece = new Piece(currentType);
                this.currentPiece = this.nextPiece;
                this.nextPiece = this.randomizer.next();
            } else {
                const tempType = this.heldPiece.type;
                this.heldPiece = new Piece(currentType);
                this.currentPiece = new Piece(tempType);
            }

            this.canHold = false;
            this.dropCounter = 0;
        }

        lockCurrentPiece() {
            this.board.lockPiece(this.currentPiece);

            const fullRows = this.board.getCompletedRows();
            if (fullRows.length > 0) {
                this.isClearing = true;
                this.currentPiece = null; // 消行闪烁期间清空活动方块，避免残留多余幽灵虚影
                this.board.clearingRows = fullRows;
                this.board.spawnClearParticles(fullRows);
                sound.playClear(fullRows.length);

                setTimeout(() => {
                    this.board.removeRows(fullRows);
                    this.board.clearingRows = [];
                    this.isClearing = false;

                    const clearedCount = fullRows.length;
                    this.lines += clearedCount;
                    const gained = LINE_POINTS[clearedCount] * this.level;
                    this.addScore(gained);

                    const newLevel = Math.floor(this.lines / 10) + 1;
                    if (newLevel > this.level) {
                        this.level = newLevel;
                        sound.playLevelUp();
                    }

                    this.updateUI();
                    this.spawnNext();
                }, 180);
            } else {
                this.spawnNext();
            }
        }

        spawnNext() {
            this.currentPiece = this.nextPiece;
            this.nextPiece = this.randomizer.next();
            this.canHold = true;

            if (!this.board.isValidMove(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
                this.triggerGameOver();
            }
        }

        triggerGameOver() {
            this.isGameOver = true;
            this.isPlaying = false;
            sound.playGameOver();

            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('tetris_high_score', this.highScore.toString());
                this.highScoreEl.textContent = this.highScore;
            }

            this.showOverlay('游戏结束', `最终得分: ${this.score} (消行: ${this.lines})`);
            this.btnStart.textContent = '🔄 重新开始';
        }

        addScore(pts) {
            this.score += pts;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('tetris_high_score', this.highScore.toString());
            }
            this.updateUI();
        }

        updateUI() {
            this.scoreEl.textContent = this.score;
            this.linesEl.textContent = this.lines;
            this.levelEl.textContent = this.level;
            this.highScoreEl.textContent = this.highScore;
        }

        drawPreview(ctx, piece) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (!piece) return;

            const shape = piece.getShape(0);
            const rows = shape.length;
            const cols = shape[0].length;

            const offsetX = (ctx.canvas.width - cols * PREVIEW_BLOCK_SIZE) / 2;
            const offsetY = (ctx.canvas.height - rows * PREVIEW_BLOCK_SIZE) / 2;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (shape[r][c]) {
                        const px = offsetX + c * PREVIEW_BLOCK_SIZE;
                        const py = offsetY + r * PREVIEW_BLOCK_SIZE;

                        ctx.save();
                        ctx.shadowColor = piece.glow;
                        ctx.shadowBlur = 6;
                        ctx.fillStyle = piece.color;
                        ctx.fillRect(px + 1, py + 1, PREVIEW_BLOCK_SIZE - 2, PREVIEW_BLOCK_SIZE - 2);

                        ctx.shadowBlur = 0;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.fillRect(px + 1, py + 1, PREVIEW_BLOCK_SIZE - 2, 2);
                        ctx.fillRect(px + 1, py + 1, 2, PREVIEW_BLOCK_SIZE - 2);
                        ctx.restore();
                    }
                }
            }
        }

        showOverlay(title, subtitle) {
            this.overlayTitleEl.textContent = title;
            this.overlaySubtitleEl.textContent = subtitle;
            this.overlayEl.classList.remove('hidden');
        }

        hideOverlay() {
            this.overlayEl.classList.add('hidden');
        }

        initEventListeners() {
            window.addEventListener('keydown', (e) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                    e.preventDefault();
                }

                // 未在游戏中，或游戏已经结束时，按空格或回车均可重新开始
                if (!this.isPlaying || this.isGameOver) {
                    if (e.code === 'Space' || e.code === 'Enter') {
                        this.start();
                        return;
                    }
                }

                switch (e.code) {
                    case 'ArrowLeft':
                    case 'KeyA':
                        this.movePiece(-1);
                        break;
                    case 'ArrowRight':
                    case 'KeyD':
                        this.movePiece(1);
                        break;
                    case 'ArrowUp':
                    case 'KeyW':
                        this.rotatePiece(true);
                        break;
                    case 'ArrowDown':
                    case 'KeyS':
                        this.softDrop();
                        break;
                    case 'Space':
                        this.hardDrop();
                        break;
                    case 'KeyC':
                    case 'ShiftLeft':
                    case 'ShiftRight':
                        this.hold();
                        break;
                    case 'KeyP':
                    case 'Escape':
                        this.togglePause();
                        break;
                }
            });

            this.btnStart.addEventListener('click', () => {
                this.start();
            });

            this.btnPause.addEventListener('click', () => {
                this.togglePause();
            });

            this.btnSound.addEventListener('click', () => {
                const isMuted = sound.toggleMute();
                this.btnSound.textContent = isMuted ? '🔇 静音' : '🔊 音效';
                this.btnSound.classList.toggle('muted', isMuted);
            });

            // 触控/屏幕虚拟按键支持（优先 pointerdown 实现零延迟响应）
            const bindButton = (id, action) => {
                const btn = document.getElementById(id);
                if (btn) {
                    let triggered = false;
                    btn.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        triggered = true;
                        action();
                    });
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (!triggered) {
                            action();
                        }
                        triggered = false;
                    });
                }
            };

            bindButton('ctrl-left', () => this.movePiece(-1));
            bindButton('ctrl-right', () => this.movePiece(1));
            bindButton('ctrl-rotate', () => this.rotatePiece(true));
            bindButton('ctrl-down', () => this.softDrop());
            bindButton('ctrl-drop', () => this.hardDrop());
            bindButton('ctrl-hold', () => this.hold());
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        window.tetrisGame = new Game();
    });
})();
