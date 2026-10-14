/**
 * utils/tetris.js - 霓虹俄罗斯方块核心逻辑（纯逻辑，无任何 wx / DOM / Canvas 依赖）
 *
 * 移植自根目录 tetris/js/（constants.js / piece.js / board.js / game.js），
 * 渲染与下落计时交由页面层（pages/games/tetris/index.js）处理，本模块只负责游戏规则。
 * 这样逻辑可在 Node 下独立自测，也方便后续其它端复用。
 */

// ===== 棋盘与速度配置 =====
const COLS = 10;
const ROWS = 20;

// 随着等级提升，每下落一格的毫秒数（等级 1~20）
const SPEED_CURVE = [
  800, 715, 630, 550, 470, 390, 310, 240, 180, 130,
  100, 80, 60, 50, 40, 30, 25, 20, 18, 15
];

// 得分规则（实际得分 = LINE_POINTS[消行数] * 当前等级）
const LINE_POINTS = [0, 100, 300, 500, 800]; // 0,1,2,3,4 行
const SOFT_DROP_POINTS = 1;
const HARD_DROP_POINTS = 2;

// ===== 7 种经典方块（含 4 个旋转状态矩阵 + 霓虹配色）=====
const TETROMINOES = {
  I: {
    id: 'I', color: '#00f0f0', glow: 'rgba(0, 240, 240, 0.65)',
    shapes: [
      [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
      [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]
    ]
  },
  J: {
    id: 'J', color: '#0055ff', glow: 'rgba(0, 85, 255, 0.65)',
    shapes: [
      [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
      [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
    ]
  },
  L: {
    id: 'L', color: '#ffaa00', glow: 'rgba(255, 170, 0, 0.65)',
    shapes: [
      [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
      [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
      [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
    ]
  },
  O: {
    id: 'O', color: '#ffea00', glow: 'rgba(255, 234, 0, 0.65)',
    shapes: [
      [[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 1], [1, 1]]
    ]
  },
  S: {
    id: 'S', color: '#00ff66', glow: 'rgba(0, 255, 102, 0.65)',
    shapes: [
      [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
      [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
      [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
    ]
  },
  T: {
    id: 'T', color: '#bb00ff', glow: 'rgba(187, 0, 255, 0.65)',
    shapes: [
      [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
    ]
  },
  Z: {
    id: 'Z', color: '#ff2255', glow: 'rgba(255, 34, 85, 0.65)',
    shapes: [
      [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
      [[0, 1, 0], [1, 1, 0], [1, 0, 0]]
    ]
  }
};

// SRS（Super Rotation System）踢墙偏移量表
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

/**
 * 方块实例：维护类型、旋转态、坐标，并提供旋转 / 移动 / 幽灵落点计算。
 */
class Piece {
  constructor(type) {
    this.type = type;
    this.config = TETROMINOES[type];
    this.rotation = 0;
    this.shape = this.config.shapes[0];
    this.color = this.config.color;
    this.glow = this.config.glow;
    // 初始生成位置（居中靠顶；I 块上移一格作为缓冲）
    this.x = Math.floor((COLS - this.shape[0].length) / 2);
    this.y = this.type === 'I' ? -1 : 0;
  }

  getShape(rotIndex) {
    return this.config.shapes[(rotIndex == null ? this.rotation : rotIndex) % 4];
  }

  /** 顺时针 / 逆时针旋转，使用标准 SRS 踢墙测试 */
  rotate(board, clockwise) {
    const nextRotation = clockwise ? (this.rotation + 1) % 4 : (this.rotation + 3) % 4;
    const nextShape = this.getShape(nextRotation);
    const kickKey = this.rotation + '->' + nextRotation;
    const kickTable = this.type === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSZT;
    const kicks = kickTable[kickKey] || [[0, 0]];

    for (let i = 0; i < kicks.length; i++) {
      const ox = kicks[i][0];
      const oy = kicks[i][1];
      const targetX = this.x + ox;
      const targetY = this.y - oy; // 表中 oy 为「上为正」，棋盘 y 向下，故取负
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

  /** 尝试平移；成功返回 true */
  move(dx, dy, board) {
    if (board.isValidMove(this.x + dx, this.y + dy, this.shape)) {
      this.x += dx;
      this.y += dy;
      return true;
    }
    return false;
  }

  /** 计算幽灵方块（落点投影）的 Y 坐标 */
  getGhostY(board) {
    let ghostY = this.y;
    while (board.isValidMove(this.x, ghostY + 1, this.shape)) {
      ghostY++;
    }
    return ghostY;
  }
}

/**
 * 7-Bag 随机袋生成器：每袋包含 7 种各一个，洗牌后依次发出，保证分布均匀。
 */
class BagRandomizer {
  constructor() {
    this.bag = [];
  }
  next() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(TETROMINOES);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this.bag[i];
        this.bag[i] = this.bag[j];
        this.bag[j] = tmp;
      }
    }
    const type = this.bag.pop();
    return new Piece(type);
  }
}

/**
 * 棋盘面板：二维网格 + 碰撞检测 + 锁定 + 消行。纯数据，不绘制。
 * grid[r][c] === 0 表示空，否则为 { color, glow }。
 */
class Board {
  constructor() {
    this.grid = this.createEmptyGrid();
    this.clearingRows = [];
  }
  createEmptyGrid() {
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(0);
      g.push(row);
    }
    return g;
  }
  reset() {
    this.grid = this.createEmptyGrid();
    this.clearingRows = [];
  }

  /** 检测目标位置与形状是否合法（未越界且与已有方块不重合；顶部缓冲区允许超出）*/
  isValidMove(x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const bx = x + c;
          const by = y + r;
          if (bx < 0 || bx >= COLS || by >= ROWS) return false;
          if (by >= 0 && this.grid[by][bx] !== 0) return false;
        }
      }
    }
    return true;
  }

  /** 将活动方块锁定进网格 */
  lockPiece(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const by = piece.y + r;
          const bx = piece.x + c;
          if (by >= 0) {
            this.grid[by][bx] = { color: piece.color, glow: piece.glow };
          }
        }
      }
    }
  }

  /** 返回所有已填满的行索引 */
  getCompletedRows() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      let filled = true;
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] === 0) { filled = false; break; }
      }
      if (filled) full.push(r);
    }
    return full;
  }

  /** 删除指定行并把上方行下落 */
  removeRows(rowIndices) {
    this.grid = this.grid.filter((_, idx) => rowIndices.indexOf(idx) === -1);
    while (this.grid.length < ROWS) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(0);
      this.grid.unshift(row);
    }
  }
}

/**
 * 游戏主控（纯逻辑）：持有棋盘、当前/下一个/暂存方块、分数等级与状态机。
 * 不拥有计时器与渲染——由页面层驱动下落与绘制。
 */
class TetrisGame {
  constructor() {
    this.board = new Board();
    this.randomizer = new BagRandomizer();
    this.currentPiece = null;
    this.nextPiece = null;
    this.heldPiece = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.highScore = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isPlaying = false;
    this.isClearing = false; // 消行动画窗口期（页面层据此暂停输入与下落）
  }

  /** 开始新局：重置状态并生成首块与下一块 */
  start() {
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
    this.board.clearingRows = [];
    this.currentPiece = this.randomizer.next();
    this.nextPiece = this.randomizer.next();
    // 极端情况下首块即重叠（理论上不会），按结束处理
    if (!this.board.isValidMove(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.isGameOver = true;
      this.isPlaying = false;
    }
  }

  getDropInterval() {
    const idx = Math.min(this.level - 1, SPEED_CURVE.length - 1);
    return SPEED_CURVE[idx];
  }

  /** 能否平移/下落（不修改状态） */
  canMove(dx, dy) {
    if (!this._active()) return false;
    return this.board.isValidMove(this.currentPiece.x + dx, this.currentPiece.y + dy, this.currentPiece.shape);
  }

  /** 执行平移（前提：调用方已用 canMove 校验） */
  applyMove(dx, dy) {
    if (this._active()) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;
    }
  }

  /** 执行旋转 */
  applyRotate(clockwise) {
    if (this._active()) return this.currentPiece.rotate(this.board, clockwise);
    return false;
  }

  /** 硬降至底部，返回下落行数（不含锁定） */
  dropToBottom() {
    if (!this._active()) return 0;
    let rows = 0;
    while (this.board.isValidMove(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
      this.currentPiece.y += 1;
      rows++;
    }
    return rows;
  }

  /** 幽灵落点 Y（页面绘制投影用） */
  ghostY() {
    if (!this._active()) return null;
    return this.currentPiece.getGhostY(this.board);
  }

  /**
   * 锁定当前活动方块。
   * @returns {{cleared: number[], gameOver: boolean}}
   *   - cleared 非空：进入消行窗口期（页面应高亮并在约 180ms 后调用 commitClear）
   *   - cleared 为空：已自动生成下一块，gameOver 表示新块直接碰撞
   */
  lockPiece() {
    if (!this._active()) return { cleared: [], gameOver: this.isGameOver };
    this.board.lockPiece(this.currentPiece);
    const full = this.board.getCompletedRows();
    if (full.length > 0) {
      this.isClearing = true;
      this.board.clearingRows = full;
      this.currentPiece = null;
      return { cleared: full, gameOver: false };
    }
    const go = this._spawn();
    return { cleared: [], gameOver: go };
  }

  /**
   * 消行窗口期结束后提交：删除满行、更新分数/等级/消行数并生成下一块。
   * @returns {{gameOver: boolean}}
   */
  commitClear() {
    const cleared = this.board.clearingRows;
    if (cleared && cleared.length) {
      this.board.removeRows(cleared);
      const n = cleared.length;
      this.lines += n;
      this.score += LINE_POINTS[n] * this.level;
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel > this.level) this.level = newLevel;
    }
    this.board.clearingRows = [];
    this.isClearing = false;
    const go = this._spawn();
    return { gameOver: go };
  }

  /** 暂存（Hold）：交换当前块与暂存块，每落定一次仅可暂存一次 */
  hold() {
    if (!this._active() || !this.canHold) return { gameOver: this.isGameOver };
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
    // 换出后若生成位即碰撞，判负
    if (!this.board.isValidMove(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.isGameOver = true;
      this.isPlaying = false;
      return { gameOver: true };
    }
    return { gameOver: false };
  }

  /** 加分（软降/硬降使用），并实时维护最高分 */
  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) this.highScore = this.score;
  }

  /** 结束处理：刷新最高分由页面层落库 */
  gameOver() {
    this.isGameOver = true;
    this.isPlaying = false;
  }

  // ===== 内部 =====
  _active() {
    return this.isPlaying && !this.isGameOver && !this.isClearing && this.currentPiece != null;
  }

  /** 生成下一块并重置暂存许可；若生成位碰撞则判负 */
  _spawn() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.randomizer.next();
    this.canHold = true;
    if (!this.board.isValidMove(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
      this.isGameOver = true;
      this.isPlaying = false;
      return true;
    }
    return false;
  }
}

module.exports = {
  TetrisGame,
  Piece,
  BagRandomizer,
  Board,
  COLS,
  ROWS,
  TETROMINOES
};
