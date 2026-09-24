/**
 * 扫雷核心逻辑与算法模块
 */

export const GameState = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  WON: 'WON',
  LOST: 'LOST'
};

export const CellState = {
  HIDDEN: 'HIDDEN',
  REVEALED: 'REVEALED',
  FLAGGED: 'FLAGGED',
  QUESTION: 'QUESTION'
};

export class MinesweeperGame {
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

  // 初始化空白棋盘网格
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

  // 获取周围有效坐标
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

  // 首次点击布雷，确保安全开局（首点及周围尽量不为地雷）
  generateMines(firstClickR, firstClickC) {
    const totalCells = this.rows * this.cols;
    const safeSet = new Set();

    // 默认首点及周围 8 格均加入避险区
    safeSet.add(`${firstClickR},${firstClickC}`);
    const neighbors = this.getNeighbors(firstClickR, firstClickC);
    
    // 如果棋盘总格数足以容纳地雷与 9 格安全区，则将 9 格全部作为避险区；否则只保证首格安全
    if (totalCells - 9 >= this.mines) {
      neighbors.forEach(n => safeSet.add(`${n.row},${n.col}`));
    }

    // 收集所有候选坐标
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!safeSet.has(`${r},${c}`)) {
          candidates.push({ r, c });
        }
      }
    }

    // 洗牌算法随机分配地雷
    let minesPlaced = 0;
    while (minesPlaced < this.mines && candidates.length > 0) {
      const randIdx = Math.floor(Math.random() * candidates.length);
      const { r, c } = candidates.splice(randIdx, 1)[0];
      this.grid[r][c].isMine = true;
      minesPlaced++;
    }
    this.mines = minesPlaced; // 同步实际地雷总数，确保极值配置下的通关判定绝对精准

    // 计算各格子周围的地雷数
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c].isMine) continue;
        const count = this.getNeighbors(r, c).filter(n => n.isMine).length;
        this.grid[r][c].adjacentMines = count;
      }
    }
  }

  // 左键翻开操作
  reveal(r, c) {
    if (this.status !== GameState.PLAYING && this.status !== GameState.READY) {
      return { status: this.status, changedCells: [] };
    }

    const cell = this.grid[r][c];
    if (cell.state !== CellState.HIDDEN) {
      return { status: this.status, changedCells: [] };
    }

    // 首次点击初始化（仅当点击有效未标记格时才触发布雷与计时）
    if (this.status === GameState.READY) {
      this.generateMines(r, c);
      this.status = GameState.PLAYING;
      this.startTime = Date.now();
    }

    const changedCells = [];

    // 踩雷处理
    if (cell.isMine) {
      cell.isExploded = true;
      cell.state = CellState.REVEALED;
      this.status = GameState.LOST;
      this.endTime = Date.now();
      changedCells.push(cell);

      // 翻开所有地雷并标出插错的旗子
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

    // 正常翻开与 Flood Fill (广度优先展开)
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

    // 胜利条件检测：已翻开非雷格数 == 总格数 - 总雷数
    const totalCells = this.rows * this.cols;
    if (this.revealedCount === totalCells - this.mines) {
      this.status = GameState.WON;
      this.endTime = Date.now();

      // 自动给所有剩余地雷插上旗子
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

  // 切换旗子/问号状态
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

  // 双击或和弦 (Chording) 展开周边
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

    // 只有当周围已标记的旗子数刚好等于该格数字时，才触发自动翻开
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

    // 先检查是否有触雷
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

    // 无触雷，逐一翻开并扩散
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

    // 检查是否达成胜利
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
