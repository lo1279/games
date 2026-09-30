/**
 * 🎮 超级马里奥兄弟 - World 1-1 经典关卡地图与碰撞引擎
 */

class LevelTileMap {
  constructor() {
    this.cols = 212; // 关卡总宽度 (约 3392 像素)
    this.rows = 15;  // 经典 NES 视口垂直 15 格 (每格 16 像素，共 240 高)
    this.grid = [];  // 二维瓦片矩阵 [row][col]
    this.bumpingBlocks = []; // 正在被顶动弹跳的砖块
    this.enemiesSpawnConfig = []; // 初始怪物生成点配置
    this.flagPoleX = 198 * CONFIG.TILE_SIZE; // 胜利旗杆 X 坐标
    this.flagY = 3 * CONFIG.TILE_SIZE + 4; // 旗帜当前滑动位置
    this.flagBottomY = 12 * CONFIG.TILE_SIZE;
    this.castleDoorX = 206 * CONFIG.TILE_SIZE;
    this.initMap();
  }

  // 初始化地图网格
  initMap() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }

    // 1. 铺设地表基本地面 (row 13 与 14)
    for (let c = 0; c < this.cols; c++) {
      // 避开悬崖裂谷
      const isChasm = (c >= 69 && c <= 71) || (c >= 86 && c <= 88) || (c >= 153 && c <= 155);
      if (!isChasm) {
        this.grid[13][c] = CONFIG.TILE.GROUND;
        this.grid[14][c] = CONFIG.TILE.GROUND;
      }
    }

    // 2. 放置经典绿水管 (高 2, 3, 4, 4)
    this.placePipe(28, 13, 2);
    this.placePipe(38, 13, 3);
    this.placePipe(46, 13, 4);
    this.placePipe(57, 13, 4);
    this.placePipe(163, 13, 2);
    this.placePipe(179, 13, 2);

    // 3. 初始砖块群 (x=16 起)
    this.grid[9][16] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][20] = CONFIG.TILE.BRICK;
    this.grid[9][21] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][22] = CONFIG.TILE.BRICK;
    this.grid[9][23] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][24] = CONFIG.TILE.BRICK;
    this.grid[5][22] = CONFIG.TILE.QUESTION_COIN;

    // 4. 第二组砖块 (水管后 x=77 起)
    this.grid[9][77] = CONFIG.TILE.BRICK;
    this.grid[9][78] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][79] = CONFIG.TILE.BRICK;
    for (let c = 80; c <= 87; c++) {
      this.grid[5][c] = CONFIG.TILE.BRICK;
    }
    this.grid[5][83] = CONFIG.TILE.QUESTION_COIN;

    // 5. 第三组砖块 (两段式空岛 x=91..110)
    for (let c = 91; c <= 93; c++) {
      this.grid[5][c] = CONFIG.TILE.BRICK;
    }
    this.grid[9][94] = CONFIG.TILE.BRICK;
    this.grid[9][95] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][100] = CONFIG.TILE.BRICK;
    this.grid[9][101] = CONFIG.TILE.BRICK;
    this.grid[5][106] = CONFIG.TILE.QUESTION_COIN;
    this.grid[5][109] = CONFIG.TILE.QUESTION_COIN;
    this.grid[5][112] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][109] = CONFIG.TILE.BRICK;
    this.grid[9][118] = CONFIG.TILE.BRICK;
    this.grid[9][121] = CONFIG.TILE.BRICK;
    this.grid[9][122] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][123] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][124] = CONFIG.TILE.BRICK;

    // 6. 第一组阶梯 (x=134 起)
    this.placeStairs(134, 13, 4, 1);  // 上升 4 阶
    this.placeStairs(140, 13, 4, -1); // 下降 4 阶

    // 7. 第二组阶梯
    this.placeStairs(148, 13, 4, 1);
    this.placeStairs(155, 13, 4, -1);

    // 8. 终点终极大金字塔阶梯 (x=181 起, 高度 8 阶)
    this.placeStairs(181, 13, 8, 1);
    // 最后一阶平台延伸
    this.grid[5][189] = CONFIG.TILE.HARD_BLOCK;

    // 9. 旗杆底座与旗杆
    this.grid[12][198] = CONFIG.TILE.HARD_BLOCK;
    for (let r = 3; r <= 11; r++) {
      this.grid[r][198] = CONFIG.TILE.FLAG_POLE;
    }
    this.grid[2][198] = CONFIG.TILE.FLAG_TOP;

    // 10. 敌人生成初始点定义 (基于原版 1-1 分布)
    this.enemiesSpawnConfig = [
      { type: 'goomba', x: 22 * 16 },
      { type: 'goomba', x: 40 * 16 },
      { type: 'goomba', x: 51 * 16 },
      { type: 'goomba', x: 52.5 * 16 },
      { type: 'koopa',  x: 75 * 16 },
      { type: 'goomba', x: 80 * 16 },
      { type: 'goomba', x: 82 * 16 },
      { type: 'goomba', x: 97 * 16 },
      { type: 'goomba', x: 99 * 16 },
      { type: 'koopa',  x: 107 * 16 },
      { type: 'goomba', x: 120 * 16 },
      { type: 'goomba', x: 124 * 16 },
      { type: 'goomba', x: 128 * 16 },
      { type: 'goomba', x: 174 * 16 },
      { type: 'goomba', x: 176 * 16 }
    ];
  }

  // 辅助函数：放置坚固阶梯
  placeStairs(startCol, groundRow, height, direction) {
    for (let step = 0; step < height; step++) {
      const col = direction === 1 ? startCol + step : startCol + step;
      const stepHeight = direction === 1 ? step + 1 : height - step;
      for (let h = 0; h < stepHeight; h++) {
        const row = groundRow - 1 - h;
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          this.grid[row][col] = CONFIG.TILE.HARD_BLOCK;
        }
      }
    }
  }

  // 辅助函数：放置标准双格水管
  placePipe(col, groundRow, height) {
    const topRow = groundRow - height;
    if (topRow < 0) return;

    // 管口 Top
    this.grid[topRow][col] = CONFIG.TILE.PIPE_TL;
    this.grid[topRow][col + 1] = CONFIG.TILE.PIPE_TR;

    // 管身 Body
    for (let r = topRow + 1; r < groundRow; r++) {
      this.grid[r][col] = CONFIG.TILE.PIPE_BL;
      this.grid[r][col + 1] = CONFIG.TILE.PIPE_BR;
    }
  }

  // 获取指定行列的瓦片类型
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return CONFIG.TILE.EMPTY;
    }
    return this.grid[row][col];
  }

  // 设置指定行列瓦片
  setTile(col, row, type) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row][col] = type;
    }
  }

  // 判断是否为实体可碰撞瓦片
  isSolid(tile) {
    return (
      tile === CONFIG.TILE.GROUND ||
      tile === CONFIG.TILE.BRICK ||
      tile === CONFIG.TILE.QUESTION_COIN ||
      tile === CONFIG.TILE.QUESTION_MUSHROOM ||
      tile === CONFIG.TILE.EMPTY_BLOCK ||
      tile === CONFIG.TILE.HARD_BLOCK ||
      tile === CONFIG.TILE.PIPE_TL ||
      tile === CONFIG.TILE.PIPE_TR ||
      tile === CONFIG.TILE.PIPE_BL ||
      tile === CONFIG.TILE.PIPE_BR
    );
  }

  // 触发砖块被顶动画
  triggerBlockBump(col, row) {
    this.bumpingBlocks.push({
      col,
      row,
      timer: 0,
      maxTimer: 10,
      offsetY: 0
    });
  }

  // 更新砖块跳动动画
  updateBumpingBlocks() {
    for (let i = this.bumpingBlocks.length - 1; i >= 0; i--) {
      const b = this.bumpingBlocks[i];
      b.timer++;
      // 上弹后落下二次缓动
      const half = b.maxTimer / 2;
      if (b.timer <= half) {
        b.offsetY = -Math.sin((b.timer / half) * (Math.PI / 2)) * 6;
      } else {
        b.offsetY = -Math.cos(((b.timer - half) / half) * (Math.PI / 2)) * 6;
      }

      if (b.timer >= b.maxTimer) {
        this.bumpingBlocks.splice(i, 1);
      }
    }
  }

  getBumpOffsetY(col, row) {
    const found = this.bumpingBlocks.find(b => b.col === col && b.row === row);
    return found ? found.offsetY : 0;
  }

  // 渲染视口可见区域内的瓦片与背景装饰
  render(ctx, cameraX, animFrame) {
    const startCol = Math.max(0, Math.floor(cameraX / CONFIG.TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((cameraX + CONFIG.VIEWPORT_WIDTH) / CONFIG.TILE_SIZE));

    // 1. 绘制背景山丘与云朵装饰 (根据关卡距离规律散布)
    this.renderScenery(ctx, cameraX);

    // 2. 绘制终点城堡
    const castlePixelX = 202 * CONFIG.TILE_SIZE - cameraX;
    if (castlePixelX > -100 && castlePixelX < CONFIG.VIEWPORT_WIDTH + 100) {
      SpriteRenderer.drawCastle(ctx, castlePixelX, 8 * CONFIG.TILE_SIZE);
    }

    // 3. 绘制瓦片层
    for (let r = 0; r < this.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.grid[r][c];
        if (tile === CONFIG.TILE.EMPTY) continue;

        const x = c * CONFIG.TILE_SIZE - cameraX;
        const y = r * CONFIG.TILE_SIZE;
        const bumpY = this.getBumpOffsetY(c, r);

        switch (tile) {
          case CONFIG.TILE.GROUND:
            SpriteRenderer.drawGroundTile(ctx, x, y);
            break;
          case CONFIG.TILE.BRICK:
            SpriteRenderer.drawBrick(ctx, x, y, bumpY);
            break;
          case CONFIG.TILE.QUESTION_COIN:
          case CONFIG.TILE.QUESTION_MUSHROOM:
            SpriteRenderer.drawQuestionBlock(ctx, x, y, animFrame, bumpY);
            break;
          case CONFIG.TILE.EMPTY_BLOCK:
            SpriteRenderer.drawEmptyBlock(ctx, x, y, bumpY);
            break;
          case CONFIG.TILE.HARD_BLOCK:
            SpriteRenderer.drawHardBlock(ctx, x, y);
            break;
          case CONFIG.TILE.PIPE_TL:
          case CONFIG.TILE.PIPE_TR:
          case CONFIG.TILE.PIPE_BL:
          case CONFIG.TILE.PIPE_BR:
            SpriteRenderer.drawPipePart(ctx, x, y, tile);
            break;
          case CONFIG.TILE.FLAG_POLE:
            // 绿色旗杆立柱
            ctx.fillStyle = '#00a800';
            ctx.fillRect(x + 7, y, 2, 16);
            break;
          case CONFIG.TILE.FLAG_TOP:
            // 旗杆顶部圆球
            ctx.fillStyle = '#00a800';
            ctx.beginPath();
            ctx.arc(x + 8, y + 10, 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
      }
    }

    // 4. 绘制终点胜利旗帜 (跟随下降状态)
    const flagScreenX = this.flagPoleX - cameraX - 12;
    const flagScreenY = this.flagY;
    if (flagScreenX > -20 && flagScreenX < CONFIG.VIEWPORT_WIDTH + 20) {
      ctx.fillStyle = '#00a800';
      ctx.beginPath();
      ctx.moveTo(flagScreenX, flagScreenY);
      ctx.lineTo(flagScreenX + 14, flagScreenY + 6);
      ctx.lineTo(flagScreenX, flagScreenY + 12);
      ctx.fill();
    }
  }

  // 绘制关卡背景元素 (小山与云彩)
  renderScenery(ctx, cameraX) {
    // 经典背景点阵
    const sceneryPoints = [
      { type: 'cloud', col: 8, row: 3, w: 2 },
      { type: 'hill', col: 18, row: 11, h: 32 },
      { type: 'cloud', col: 36, row: 2, w: 3 },
      { type: 'hill', col: 48, row: 11, h: 32 },
      { type: 'cloud', col: 64, row: 4, w: 2 },
      { type: 'cloud', col: 90, row: 3, w: 3 },
      { type: 'hill', col: 104, row: 11, h: 32 },
      { type: 'cloud', col: 124, row: 2, w: 2 },
      { type: 'cloud', col: 145, row: 3, w: 3 },
      { type: 'hill', col: 168, row: 11, h: 32 }
    ];

    sceneryPoints.forEach(item => {
      const sx = item.col * 16 - cameraX;
      if (sx > -60 && sx < CONFIG.VIEWPORT_WIDTH + 60) {
        if (item.type === 'cloud') {
          SpriteRenderer.drawCloud(ctx, sx, item.row * 16, item.w);
        } else if (item.type === 'hill') {
          SpriteRenderer.drawHill(ctx, sx, item.row * 16, item.h);
        }
      }
    });
  }
}
