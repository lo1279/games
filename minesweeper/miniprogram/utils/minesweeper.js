/**
 * 扫雷核心逻辑与算法模块 (适配微信小程序)
 */

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

module.exports = {
  GameState,
  CellState,
  MinesweeperGame
};
