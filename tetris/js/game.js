/**
 * 游戏主循环控制器与事件交互引擎（支持手机端触控、手势滑动与微信小程序环境）
 */

import { Board } from './board.js';
import { Piece, BagRandomizer } from './piece.js';
import { sound } from './audio.js';
import { 
    SPEED_CURVE, 
    LINE_POINTS, 
    SOFT_DROP_POINTS, 
    HARD_DROP_POINTS, 
    PREVIEW_SIZE, 
    PREVIEW_BLOCK_SIZE 
} from './constants.js';

export class Game {
    constructor() {
        // 画布元素
        this.mainCanvas = document.getElementById('board');
        this.nextCanvas = document.getElementById('next-canvas');
        this.holdCanvas = document.getElementById('hold-canvas');
        this.boardContainer = document.getElementById('board-container');

        // 上下文与主面板
        this.board = new Board(this.mainCanvas);
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCtx = this.holdCanvas.getContext('2d');

        // 设置小画布尺寸
        this.nextCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.nextCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.holdCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.holdCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;

        // UI 文本与控制元素
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
        this.btnRestartTop = document.getElementById('btn-restart-top');

        // 游戏核心状态
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

        // 初始化交互与渲染
        this.initEventListeners();
        this.initTouchGestures();
        this.drawPreview(this.nextCtx, null);
        this.drawPreview(this.holdCtx, null);
        this.board.draw(null);
    }

    /**
     * 触感震动反馈（支持普通手机浏览器与微信小程序/内置浏览器）
     */
    triggerHaptic(type = 'light') {
        try {
            // 微信环境检测
            if (window.WeixinJSBridge && window.WeixinJSBridge.invoke) {
                window.WeixinJSBridge.invoke('vibrateShort', {});
                return;
            }
            // 标准 Web 震动 API
            if (navigator && navigator.vibrate) {
                if (type === 'heavy') {
                    navigator.vibrate(28);
                } else if (type === 'medium') {
                    navigator.vibrate(18);
                } else {
                    navigator.vibrate(10);
                }
            }
        } catch (e) {}
    }

    /**
     * 重置并开始新游戏
     */
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

        // 抽取首块与下一块
        this.currentPiece = this.randomizer.next();
        this.nextPiece = this.randomizer.next();

        this.hideOverlay();
        if (this.btnPause) this.btnPause.textContent = '⏸';

        this.lastTime = performance.now();
        this.dropCounter = 0;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.loop(this.lastTime);
        this.triggerHaptic('medium');
    }

    /**
     * 暂停/继续切换
     */
    togglePause() {
        if (!this.isPlaying || this.isGameOver) return;

        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.showOverlay('游戏已暂停', '点击继续按钮或按 P 键恢复');
            if (this.btnPause) this.btnPause.textContent = '▶';
        } else {
            this.hideOverlay();
            if (this.btnPause) this.btnPause.textContent = '⏸';
            this.lastTime = performance.now();
            this.loop(this.lastTime);
        }
        this.triggerHaptic('light');
    }

    /**
     * 游戏主循环 (requestAnimationFrame)
     */
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

        // 渲染重绘
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
            this.triggerHaptic('light');
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
        this.triggerHaptic('heavy');
        this.lockCurrentPiece();
    }

    movePiece(dx) {
        if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
        if (this.currentPiece.move(dx, 0, this.board)) {
            sound.playMove();
            this.triggerHaptic('light');
        }
    }

    rotatePiece(clockwise = true) {
        if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
        if (this.currentPiece.rotate(this.board, clockwise)) {
            sound.playRotate();
            this.triggerHaptic('light');
        }
    }

    hold() {
        if (!this.isPlaying || this.isPaused || this.isClearing || !this.canHold || !this.currentPiece) return;

        sound.playHold();
        this.triggerHaptic('medium');
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
            this.currentPiece = null;
            this.board.clearingRows = fullRows;
            this.board.spawnClearParticles(fullRows);
            sound.playClear(fullRows.length);
            this.triggerHaptic('heavy');

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
        this.triggerHaptic('heavy');

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetris_high_score', this.highScore.toString());
            this.highScoreEl.textContent = this.highScore;
        }

        this.showOverlay('游戏结束', `最终得分: ${this.score} (消行: ${this.lines})`);
        if (this.btnStart) this.btnStart.textContent = '🔄 重新开始';
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

    /**
     * 屏幕触摸手势系统（Swipe / Drag / Tap / Double Tap）
     */
    initTouchGestures() {
        const target = this.boardContainer || this.mainCanvas;
        let startX = 0;
        let startY = 0;
        let lastMoveX = 0;
        let lastMoveY = 0;
        let startTime = 0;
        let hasMoved = false;
        let lastTapTime = 0;

        const MOVE_THRESHOLD = 20; // 左右平移步进阈值
        const DROP_THRESHOLD = 26; // 下滑加速步进阈值

        target.addEventListener('touchstart', (e) => {
            if (!this.isPlaying || this.isPaused || this.isGameOver) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            lastMoveX = touch.clientX;
            lastMoveY = touch.clientY;
            startTime = performance.now();
            hasMoved = false;
        }, { passive: true });

        target.addEventListener('touchmove', (e) => {
            if (!this.isPlaying || this.isPaused || this.isGameOver) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastMoveX;
            const deltaY = touch.clientY - lastMoveY;

            // 水平滑移
            if (Math.abs(deltaX) >= MOVE_THRESHOLD) {
                const dir = deltaX > 0 ? 1 : -1;
                this.movePiece(dir);
                lastMoveX = touch.clientX;
                hasMoved = true;
            }

            // 向下滑动加速
            if (deltaY >= DROP_THRESHOLD) {
                this.softDrop();
                lastMoveY = touch.clientY;
                hasMoved = true;
            }
        }, { passive: true });

        target.addEventListener('touchend', (e) => {
            if (!this.isPlaying || this.isPaused || this.isGameOver) return;
            const now = performance.now();
            const duration = now - startTime;

            // 若无显著位移且轻触时间小于 260ms，判定为轻触点击
            if (!hasMoved && duration < 260) {
                // 双击检测（间隔小于 280ms 触发瞬降）
                if (now - lastTapTime < 280) {
                    this.hardDrop();
                    lastTapTime = 0;
                } else {
                    this.rotatePiece(true);
                    lastTapTime = now;
                }
            }
        }, { passive: true });
    }

    /**
     * 初始化事件监听（键盘、按钮、手柄及微信兼容）
     */
    initEventListeners() {
        // 键盘按键映射
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }

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

        // 按钮监听
        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => this.start());
        }

        if (this.btnPause) {
            this.btnPause.addEventListener('click', () => this.togglePause());
        }

        if (this.btnRestartTop) {
            this.btnRestartTop.addEventListener('click', () => this.start());
        }

        if (this.btnSound) {
            this.btnSound.addEventListener('click', () => {
                const isMuted = sound.toggleMute();
                this.btnSound.textContent = isMuted ? '🔇' : '🔊';
                this.btnSound.classList.toggle('muted', isMuted);
                this.triggerHaptic('light');
            });
        }

        // 移动端虚拟手柄监听（支持 pointerdown 极速触发）
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

        // 阻止移动端与微信全屏滚动干扰
        document.body.addEventListener('touchmove', (e) => {
            if (e.target.closest('.touch-btn, .icon-btn, .btn')) return;
            e.preventDefault();
        }, { passive: false });

        // 微信环境下音频预解锁
        document.addEventListener('WeixinJSBridgeReady', () => {
            sound.init();
        }, false);
    }
}

// 页面加载完成后实例化并挂载
window.addEventListener('DOMContentLoaded', () => {
    window.tetrisGame = new Game();
});
