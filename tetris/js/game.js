/**
 * 游戏主循环控制器与事件交互引擎
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

        // 上下文与主面板
        this.board = new Board(this.mainCanvas);
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCtx = this.holdCanvas.getContext('2d');

        // 设置小画布尺寸
        this.nextCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.nextCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.holdCanvas.width = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;
        this.holdCanvas.height = PREVIEW_SIZE * PREVIEW_BLOCK_SIZE;

        // UI 文本元素
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
        this.drawPreview(this.nextCtx, null);
        this.drawPreview(this.holdCtx, null);
        this.board.draw(null);
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
        this.btnPause.textContent = '暂停 (P)';

        this.lastTime = performance.now();
        this.dropCounter = 0;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.loop(this.lastTime);
    }

    /**
     * 暂停/继续切换
     */
    togglePause() {
        if (!this.isPlaying || this.isGameOver) return;

        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.showOverlay('游戏已暂停', '按 P 键或点击按钮继续');
            this.btnPause.textContent = '继续 (P)';
        } else {
            this.hideOverlay();
            this.btnPause.textContent = '暂停 (P)';
            this.lastTime = performance.now();
            this.loop(this.lastTime);
        }
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

    /**
     * 计算当前等级的下落间隔
     */
    getDropInterval() {
        const idx = Math.min(this.level - 1, SPEED_CURVE.length - 1);
        return SPEED_CURVE[idx];
    }

    /**
     * 自然下落一格
     */
    dropPiece() {
        if (!this.currentPiece) return;

        if (!this.currentPiece.move(0, 1, this.board)) {
            // 无法下落，落地锁定
            this.lockCurrentPiece();
        }
    }

    /**
     * 软降（向下轻触）
     */
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

    /**
     * 硬降（瞬降到底）
     */
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

    /**
     * 左右横向移动
     */
    movePiece(dx) {
        if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
        if (this.currentPiece.move(dx, 0, this.board)) {
            sound.playMove();
        }
    }

    /**
     * 旋转当前方块
     */
    rotatePiece(clockwise = true) {
        if (!this.isPlaying || this.isPaused || this.isClearing || !this.currentPiece) return;
        if (this.currentPiece.rotate(this.board, clockwise)) {
            sound.playRotate();
        }
    }

    /**
     * 暂存（Hold）机制
     */
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

    /**
     * 锁定当前方块，执行消除判定与生成下一块
     */
    lockCurrentPiece() {
        this.board.lockPiece(this.currentPiece);

        // 检查是否有满行消除
        const fullRows = this.board.getCompletedRows();
        if (fullRows.length > 0) {
            this.isClearing = true;
            this.currentPiece = null; // 消行闪烁期间清空活动方块，避免残留多余幽灵虚影
            this.board.clearingRows = fullRows;
            this.board.spawnClearParticles(fullRows);
            sound.playClear(fullRows.length);

            // 闪烁动画 180ms 后物理清除行并恢复下落
            setTimeout(() => {
                this.board.removeRows(fullRows);
                this.board.clearingRows = [];
                this.isClearing = false;

                // 计分与消行统计
                const clearedCount = fullRows.length;
                this.lines += clearedCount;
                const gained = LINE_POINTS[clearedCount] * this.level;
                this.addScore(gained);

                // 每消除 10 行升一级
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

    /**
     * 生成下一个活动方块
     */
    spawnNext() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.randomizer.next();
        this.canHold = true;

        // 若新方块刚生成就发生碰撞，判定 Game Over
        if (!this.board.isValidMove(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            this.triggerGameOver();
        }
    }

    /**
     * 游戏结束
     */
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
        this.btnStart.textContent = '重新开始';
    }

    /**
     * 增加得分并刷新最高分
     */
    addScore(pts) {
        this.score += pts;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetris_high_score', this.highScore.toString());
        }
        this.updateUI();
    }

    /**
     * 刷新界面数字展示
     */
    updateUI() {
        this.scoreEl.textContent = this.score;
        this.linesEl.textContent = this.lines;
        this.levelEl.textContent = this.level;
        this.highScoreEl.textContent = this.highScore;
    }

    /**
     * 在小 Canvas 中居中渲染预览方块（Next 或 Hold）
     */
    drawPreview(ctx, piece) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!piece) return;

        const shape = piece.getShape(0);
        const rows = shape.length;
        const cols = shape[0].length;

        // 计算居中偏移像素
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
     * 初始化键盘与虚拟控制按钮事件监听
     */
    initEventListeners() {
        // 键盘按键映射
        window.addEventListener('keydown', (e) => {
            // 防止方向键滚动页面
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

        // 页面控制按钮
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

// 页面加载完成后实例化并挂载
window.addEventListener('DOMContentLoaded', () => {
    window.tetrisGame = new Game();
});
