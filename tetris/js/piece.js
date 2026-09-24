/**
 * 方块实例类与 7-Bag 随机生成器
 */

import { TETROMINOES, WALL_KICKS_JLSZT, WALL_KICKS_I, COLS } from './constants.js';

export class Piece {
    constructor(type) {
        this.type = type;
        this.config = TETROMINOES[type];
        this.rotation = 0; // 0, 1, 2, 3
        this.shape = this.config.shapes[0];
        this.color = this.config.color;
        this.glow = this.config.glow;

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
            // SRS 的 oy 是向上为正，Canvas 坐标系 y 轴向下为正，故 dy = -oy
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
 * 7-Bag 随机袋生成算法
 * 保证每连续 7 个方块中必然包含全套 I, J, L, O, S, T, Z
 */
export class BagRandomizer {
    constructor() {
        this.bag = [];
    }

    next() {
        if (this.bag.length === 0) {
            this.bag = Object.keys(TETROMINOES);
            // Fisher-Yates 洗牌
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        const type = this.bag.pop();
        return new Piece(type);
    }
}
