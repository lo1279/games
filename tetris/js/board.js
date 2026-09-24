/**
 * 游戏网格面板逻辑与渲染引擎
 */

import { COLS, ROWS, BLOCK_SIZE } from './constants.js';

export class Board {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = this.createEmptyGrid();
        this.particles = [];
        this.clearingRows = []; // 正在执行消行动画的行

        // 设置画布物理像素分辨率适配
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

    /**
     * 检测目标位置与形状是否合法（未越界且未与已有方块重合）
     */
    isValidMove(x, y, shape) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const boardX = x + c;
                    const boardY = y + r;

                    // 左右与下边界检测
                    if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                        return false;
                    }
                    // 上方区域允许暂时超出（生成缓冲区）
                    if (boardY >= 0 && this.grid[boardY][boardX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * 将活动方块锁定到底板网格中
     */
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

    /**
     * 获取所有已填满的行
     */
    getCompletedRows() {
        const fullRows = [];
        for (let r = 0; r < ROWS; r++) {
            if (this.grid[r].every(cell => cell !== 0)) {
                fullRows.push(r);
            }
        }
        return fullRows;
    }

    /**
     * 触发消行粒子效果
     */
    spawnClearParticles(rowIndices) {
        for (const row of rowIndices) {
            for (let c = 0; c < COLS; c++) {
                const cell = this.grid[row][c];
                const color = cell ? cell.color : '#ffffff';
                const px = c * BLOCK_SIZE + BLOCK_SIZE / 2;
                const py = row * BLOCK_SIZE + BLOCK_SIZE / 2;

                // 每个格子散发若干小粒子
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

    /**
     * 清除满行并将上方行向下移动
     */
    removeRows(rowIndices) {
        this.grid = this.grid.filter((_, idx) => !rowIndices.includes(idx));
        while (this.grid.length < ROWS) {
            this.grid.unshift(Array(COLS).fill(0));
        }
    }

    /**
     * 更新粒子状态
     */
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

    /**
     * 绘制单一带立体倒角质感的方块单元
     */
    drawBlock(ctx, x, y, size, color, glow, isGhost = false) {
        const px = x * size;
        const py = y * size;

        if (isGhost) {
            // 幽灵投影：虚线外框与微透底色
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
        // 外围发光
        ctx.shadowColor = glow;
        ctx.shadowBlur = 10;

        // 主体填充
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

        // 立体高光（上方与左侧边框）
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(px + 1, py + 1, size - 2, 3);
        ctx.fillRect(px + 1, py + 1, 3, size - 2);

        // 阴影斜切（右侧与下方边框）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(px + 1, py + size - 4, size - 2, 3);
        ctx.fillRect(px + size - 4, py + 1, 3, size - 2);

        ctx.restore();
    }

    /**
     * 渲染完整游戏底板、背景网格、活动方块及粒子
     */
    draw(activePiece = null) {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. 绘制暗色半透明网格线
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

        // 2. 绘制已固定的底板方块
        for (let r = 0; r < ROWS; r++) {
            // 如果该行正处于消行动画阶段，绘制高亮闪烁
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

        // 3. 绘制幽灵方块投影（Ghost Piece）
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

            // 4. 绘制当前正在操作的活动方块
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

        // 5. 渲染散开的微粒子
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
