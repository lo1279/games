/**
 * 方块实例类与 7-Bag 随机生成器（支持可变换形状的变色龙动态方块）
 */

import { TETROMINOES, WALL_KICKS_JLSZT, WALL_KICKS_I, COLS, MORPH_CHANCE } from './constants.js';

export class Piece {
    constructor(type, isMorphing = false) {
        this.type = type;
        this.config = TETROMINOES[type];
        this.rotation = 0; // 0, 1, 2, 3
        this.shape = this.config.shapes[0];
        this.color = this.config.color;
        this.glow = this.config.glow;

        // 变异变色龙方块特异属性
        this.isMorphing = isMorphing;
        this.morphTimer = 0;
        this.hue = Math.floor(Math.random() * 360);

        // 初始生成位置（居中靠顶）
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = this.type === 'I' ? -1 : 0;
    }

    /**
     * 获取指定旋转状态下的形状矩阵
     */
    getShape(rotIndex = this.rotation) {
        return this.config.shapes[rotIndex % 4];
    }

    /**
     * 获取当前渲染颜色（变异方块呈现动态彩虹流光霓虹色彩）
     */
    getDisplayColor() {
        if (this.isMorphing) {
            this.hue = (this.hue + 2.5) % 360;
            return `hsl(${this.hue}, 100%, 62%)`;
        }
        return this.color;
    }

    getDisplayGlow() {
        if (this.isMorphing) {
            return `hsla(${this.hue}, 100%, 65%, 0.8)`;
        }
        return this.glow;
    }

    /**
     * 变异变形逻辑：在下落途中变换为另一种全新形状，带防卡模智能偏移保护
     */
    morph(board) {
        if (!this.isMorphing) return false;

        const allTypes = Object.keys(TETROMINOES).filter(t => t !== this.type);
        // Fisher-Yates 随机洗牌候选类型
        for (let i = allTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allTypes[i], allTypes[j]] = [allTypes[j], allTypes[i]];
        }

        // 尝试变形到下一个能放得下的形状
        for (const candidateType of allTypes) {
            const candidateConfig = TETROMINOES[candidateType];
            const candidateShape = candidateConfig.shapes[0]; // 变异后恢复至基准状态 0

            // 智能微调偏移探测（原位 -> 左右 1 格 -> 向上 1 格 -> 左右 2 格）
            const testOffsets = [
                [0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2]
            ];

            for (const [ox, oy] of testOffsets) {
                const targetX = this.x + ox;
                const targetY = this.y + oy;

                if (board.isValidMove(targetX, targetY, candidateShape)) {
                    this.type = candidateType;
                    this.config = candidateConfig;
                    this.rotation = 0;
                    this.shape = candidateShape;
                    this.x = targetX;
                    this.y = targetY;
                    this.color = candidateConfig.color;
                    this.glow = candidateConfig.glow;
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 尝试顺时针或逆时针旋转方块，使用标准 SRS 踢墙测试
     */
    rotate(board, clockwise = true) {
        const nextRotation = clockwise 
            ? (this.rotation + 1) % 4 
            : (this.rotation + 3) % 4;

        const nextShape = this.getShape(nextRotation);
        const kickKey = `${this.rotation}->${nextRotation}`;
        const kickTable = this.type === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSZT;
        const kicks = kickTable[kickKey] || [[0, 0]];

        // 依次尝试踢墙偏移表中的各个偏移点
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

    /**
     * 移动方块
     */
    move(dx, dy, board) {
        if (board.isValidMove(this.x + dx, this.y + dy, this.shape)) {
            this.x += dx;
            this.y += dy;
            return true;
        }
        return false;
    }

    /**
     * 计算幽灵方块（落点投影 Ghost Piece）的 Y 坐标
     */
    getGhostY(board) {
        let ghostY = this.y;
        while (board.isValidMove(this.x, ghostY + 1, this.shape)) {
            ghostY++;
        }
        return ghostY;
    }
}

/**
 * 7-Bag 随机袋生成算法（支持动态生成特殊变异方块）
 */
export class BagRandomizer {
    constructor() {
        this.bag = [];
    }

    next(forceMorph = false) {
        if (this.bag.length === 0) {
            this.bag = Object.keys(TETROMINOES);
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        const type = this.bag.pop();
        const isMorphing = forceMorph || (Math.random() < MORPH_CHANCE);
        return new Piece(type, isMorphing);
    }
}
