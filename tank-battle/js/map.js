/**
 * 坦克大战 - 地图瓦片与战场环境管理器
 */
class MapManager {
  constructor() {
    this.cols = CONFIG.MAP_COLS;
    this.rows = CONFIG.MAP_ROWS;
    this.tileSize = CONFIG.TILE_SIZE;
    
    // grid 存储瓦片类型
    this.grid = [];
    // brickMask 存储砖块微结构
    this.brickMask = [];

    // 默认预先初始化空网格
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Array(this.cols).fill(CONFIG.TILE.EMPTY);
      this.brickMask[r] = new Array(this.cols).fill(0);
    }
    
    // 老鹰基地的状态 (true: 存活, false: 阵亡)
    this.eagleAlive = true;
    this.eaglePos = { x: 12, y: 24, w: 2, h: 2 }; // 瓦片坐标 (12, 24) 跨度 2x2

    // 铁锹加固基地计时器 (秒)
    this.shovelTimer = 0;
    this.isShovelActive = false;
    // 基地周边护墙瓦片坐标
    this.baseWallCoords = [
      { x: 11, y: 23 }, { x: 12, y: 23 }, { x: 13, y: 23 }, { x: 14, y: 23 },
      { x: 11, y: 24 },                                     { x: 14, y: 24 },
      { x: 11, y: 25 },                                     { x: 14, y: 25 }
    ];

    // 水流动画计时器
    this.waterFrame = 0;
  }

  /**
   * 加载关卡
   */
  loadLevel(levelIndex) {
    const levelData = LEVELS[levelIndex % LEVELS.length];
    this.grid = [];
    this.brickMask = [];
    this.eagleAlive = true;
    this.shovelTimer = 0;
    this.isShovelActive = false;

    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      this.brickMask[r] = [];
      const rowStr = levelData.layout[r] || '..........................';
      for (let c = 0; c < this.cols; c++) {
        const ch = rowStr[c] || '.';
        let tileType = CONFIG.TILE.EMPTY;
        let mask = 0;

        switch (ch) {
          case 'B': tileType = CONFIG.TILE.BRICK; mask = 0b1111; break;
          case 'S': tileType = CONFIG.TILE.STEEL; break;
          case 'W': tileType = CONFIG.TILE.WATER; break;
          case 'G': tileType = CONFIG.TILE.GRASS; break;
          case 'I': tileType = CONFIG.TILE.ICE; break;
          case 'E': tileType = CONFIG.TILE.EAGLE; break;
          default: tileType = CONFIG.TILE.EMPTY; break;
        }

        this.grid[r][c] = tileType;
        this.brickMask[r][c] = mask;
      }
    }

    // 确保基地位置是老鹰 (2x2)
    this.grid[24][12] = CONFIG.TILE.EAGLE;
    this.grid[24][13] = CONFIG.TILE.EAGLE;
    this.grid[25][12] = CONFIG.TILE.EAGLE;
    this.grid[25][13] = CONFIG.TILE.EAGLE;
  }

  /**
   * 激活铁壁防护 (铲子道具)
   */
  activateShovel() {
    this.shovelTimer = CONFIG.DURATION.SHOVEL_STEEL;
    this.isShovelActive = true;
    this.setBaseWalls(CONFIG.TILE.STEEL);
  }

  /**
   * 设置基地护墙材质
   */
  setBaseWalls(type) {
    for (const pos of this.baseWallCoords) {
      // 只有不是已被老鹰占据的坐标才变
      if (this.grid[pos.y][pos.x] !== CONFIG.TILE.EAGLE && this.grid[pos.y][pos.x] !== CONFIG.TILE.EAGLE_DEAD) {
        this.grid[pos.y][pos.x] = type;
        if (type === CONFIG.TILE.BRICK) {
          this.brickMask[pos.y][pos.x] = 0b1111;
        }
      }
    }
  }

  /**
   * 更新地图动态效果与道具时效
   */
  update(dt) {
    // 水纹流动动画
    this.waterFrame = (this.waterFrame + dt * 2.5) % 2;

    // 铁锹倒计时逻辑
    if (this.isShovelActive) {
      this.shovelTimer -= dt;
      if (this.shovelTimer <= 0) {
        this.isShovelActive = false;
        this.shovelTimer = 0;
        this.setBaseWalls(CONFIG.TILE.BRICK);
      } else if (this.shovelTimer <= 3.0) {
        // 快结束时高频闪烁警示
        const blink = Math.floor(this.shovelTimer * 4) % 2 === 0;
        this.setBaseWalls(blink ? CONFIG.TILE.STEEL : CONFIG.TILE.BRICK);
      }
    }
  }

  /**
   * 检查矩形与实心障碍物碰撞 (坦克移动阻挡)
   * 障碍物包括：砖墙、铁墙、水域、老鹰基地、不可逾越的边界
   */
  isObstacle(x, y, w, h) {
    const minCol = Math.max(0, Math.floor(x / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + w - 0.01) / this.tileSize));
    const minRow = Math.max(0, Math.floor(y / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + h - 0.01) / this.tileSize));

    // 检查越界
    if (x < 0 || y < 0 || x + w > CONFIG.CANVAS_WIDTH || y + h > CONFIG.CANVAS_HEIGHT) {
      return true;
    }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const type = this.grid[r][c];
        if (type === CONFIG.TILE.STEEL || type === CONFIG.TILE.WATER || type === CONFIG.TILE.EAGLE || type === CONFIG.TILE.EAGLE_DEAD) {
          return true;
        }
        if (type === CONFIG.TILE.BRICK) {
          // 进一步检查砖块微小瓦片掩码
          if (this.checkBrickAABBOverlap(c, r, x, y, w, h)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 砖块微小四分格与 AABB 盒子交叠检测
   */
  checkBrickAABBOverlap(c, r, x, y, w, h) {
    const mask = this.brickMask[r][c];
    if (mask === 0) return false;
    const half = this.tileSize / 2;
    const bx = c * this.tileSize;
    const by = r * this.tileSize;

    // 4个子块检查
    const subBoxes = [
      { active: (mask & 1) !== 0, x: bx, y: by, w: half, h: half },
      { active: (mask & 2) !== 0, x: bx + half, y: by, w: half, h: half },
      { active: (mask & 4) !== 0, x: bx, y: by + half, w: half, h: half },
      { active: (mask & 8) !== 0, x: bx + half, y: by + half, w: half, h: half }
    ];

    for (const b of subBoxes) {
      if (b.active) {
        if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 子弹击中瓦片测试与破坏处理
   * @param {Object} bullet
   * @returns {boolean} 是否发生吸收/阻挡碰撞
   */
  hitTestBullet(bullet) {
    const bx = bullet.x;
    const by = bullet.y;
    const bw = bullet.width;
    const bh = bullet.height;

    const minCol = Math.max(0, Math.floor(bx / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((bx + bw) / this.tileSize));
    const minRow = Math.max(0, Math.floor(by / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((by + bh) / this.tileSize));

    let hitOccurred = false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const type = this.grid[r][c];

        // 1. 击中砖墙 (精确微小四分格检测)
        if (type === CONFIG.TILE.BRICK) {
          if (this.checkBrickAABBOverlap(c, r, bx, by, bw, bh)) {
            const destroyedPart = this.damageBrick(c, r, bullet.dir, bullet.power);
            if (destroyedPart) {
              hitOccurred = true;
            }
          }
        }
        // 2. 击中铁墙
        else if (type === CONFIG.TILE.STEEL) {
          hitOccurred = true;
          if (bullet.canBreakSteel) {
            // 4级坦克强力火炮可摧毁铁墙
            this.grid[r][c] = CONFIG.TILE.EMPTY;
            soundEngine.playHitBrick();
          } else {
            soundEngine.playHitSteel();
          }
        }
        // 3. 击中老鹰基地
        else if (type === CONFIG.TILE.EAGLE) {
          hitOccurred = true;
          this.destroyEagle();
        }
      }
    }

    return hitOccurred;
  }

  /**
   * 破坏砖块细节
   */
  damageBrick(col, row, dir, power = 1) {
    let mask = this.brickMask[row][col];
    if (mask === 0) return false;

    // 强力高爆炮直接粉碎整块砖
    if (power >= 2) {
      this.brickMask[row][col] = 0;
      this.grid[row][col] = CONFIG.TILE.EMPTY;
      soundEngine.playHitBrick();
      return true;
    }

    // 根据子弹入射方向精准削切小微砖
    // bit0:TL (1), bit1:TR (2), bit2:BL (4), bit3:BR (8)
    if (dir === CONFIG.DIR.UP) {
      // 向上射入，先破坏下方 (BL, BR)
      if ((mask & 0b1100) !== 0) {
        mask &= 0b0011;
      } else {
        mask = 0;
      }
    } else if (dir === CONFIG.DIR.DOWN) {
      // 向下射入，先破坏上方 (TL, TR)
      if ((mask & 0b0011) !== 0) {
        mask &= 0b1100;
      } else {
        mask = 0;
      }
    } else if (dir === CONFIG.DIR.LEFT) {
      // 向左射入，先破坏右侧 (TR, BR)
      if ((mask & 0b1010) !== 0) {
        mask &= 0b0101;
      } else {
        mask = 0;
      }
    } else if (dir === CONFIG.DIR.RIGHT) {
      // 向右射入，先破坏左侧 (TL, BL)
      if ((mask & 0b0101) !== 0) {
        mask &= 0b1010;
      } else {
        mask = 0;
      }
    }

    this.brickMask[row][col] = mask;
    if (mask === 0) {
      this.grid[row][col] = CONFIG.TILE.EMPTY;
    }
    soundEngine.playHitBrick();
    return true;
  }

  /**
   * 摧毁基地
   */
  destroyEagle() {
    if (!this.eagleAlive) return;
    this.eagleAlive = false;
    soundEngine.playExplosion();
    soundEngine.playGameOver();

    // 基地四格全部切换为阵亡碎石
    this.grid[24][12] = CONFIG.TILE.EAGLE_DEAD;
    this.grid[24][13] = CONFIG.TILE.EAGLE_DEAD;
    this.grid[25][12] = CONFIG.TILE.EAGLE_DEAD;
    this.grid[25][13] = CONFIG.TILE.EAGLE_DEAD;
  }

  /**
   * 渲染底层/实体层瓦片 (砖、铁、水、冰、基地)
   */
  renderBase(ctx) {
    const s = this.tileSize;
    const half = s / 2;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.grid[r][c];
        const x = c * s;
        const y = r * s;

        if (type === CONFIG.TILE.BRICK) {
          this.renderBrickTile(ctx, x, y, this.brickMask[r][c]);
        } else if (type === CONFIG.TILE.STEEL) {
          this.renderSteelTile(ctx, x, y);
        } else if (type === CONFIG.TILE.WATER) {
          this.renderWaterTile(ctx, x, y);
        } else if (type === CONFIG.TILE.ICE) {
          this.renderIceTile(ctx, x, y);
        }
      }
    }

    // 渲染老鹰基地 (2x2)
    this.renderEagle(ctx);
  }

  /**
   * 渲染上层覆盖瓦片 (草丛掩盖层，需要在坦克之后绘制)
   */
  renderTop(ctx) {
    const s = this.tileSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === CONFIG.TILE.GRASS) {
          this.renderGrassTile(ctx, c * s, r * s);
        }
      }
    }
  }

  /**
   * 绘制四格微砖块
   */
  renderBrickTile(ctx, x, y, mask) {
    if (mask === 0) return;
    const half = this.tileSize / 2;
    const quarters = [
      { active: (mask & 1) !== 0, x: x, y: y },
      { active: (mask & 2) !== 0, x: x + half, y: y },
      { active: (mask & 4) !== 0, x: x, y: y + half },
      { active: (mask & 8) !== 0, x: x + half, y: y + half }
    ];

    for (const q of quarters) {
      if (!q.active) continue;
      // 砖块主体红褐色
      ctx.fillStyle = '#b84418';
      ctx.fillRect(q.x, q.y, half, half);

      // 砖缝细节线条
      ctx.fillStyle = '#3a1608';
      ctx.fillRect(q.x, q.y + half - 2, half, 2);
      ctx.fillRect(q.x + half - 2, q.y, 2, half);

      // 高光微立体边缘
      ctx.fillStyle = '#e87343';
      ctx.fillRect(q.x, q.y, half - 2, 2);
      ctx.fillRect(q.x, q.y, 2, half - 2);
    }
  }

  /**
   * 绘制坚固铁块
   */
  renderSteelTile(ctx, x, y) {
    const s = this.tileSize;
    ctx.fillStyle = '#dcdde1';
    ctx.fillRect(x, y, s, s);

    // 铁块四宫格铆钉感
    ctx.fillStyle = '#718093';
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);

    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(x + 4, y + 4, s - 8, s - 8);

    ctx.fillStyle = '#2f3640';
    ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
  }

  /**
   * 绘制流动水域
   */
  renderWaterTile(ctx, x, y) {
    const s = this.tileSize;
    ctx.fillStyle = '#1e3799';
    ctx.fillRect(x, y, s, s);

    // 水波纹路流动交替
    ctx.fillStyle = '#4a69bd';
    const offset = Math.floor(this.waterFrame) * 4;
    ctx.fillRect(x, y + 4 + offset, s, 3);
    ctx.fillRect(x, y + 14 - offset, s, 3);
  }

  /**
   * 绘制冰面
   */
  renderIceTile(ctx, x, y) {
    const s = this.tileSize;
    ctx.fillStyle = '#82ccdd';
    ctx.fillRect(x, y, s, s);

    ctx.fillStyle = '#dff9fb';
    ctx.fillRect(x + 3, y + 3, 5, 2);
    ctx.fillRect(x + 12, y + 10, 8, 2);
    ctx.fillRect(x + 5, y + 18, 6, 2);
  }

  /**
   * 绘制丛林遮罩
   */
  renderGrassTile(ctx, x, y) {
    const s = this.tileSize;
    ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
    ctx.fillRect(x, y, s, s);

    // 杂草树叶纹理
    ctx.fillStyle = '#2e7d32';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + (i * 6) + 2, y + 3, 3, 6);
      ctx.fillRect(x + (i * 6), y + 13, 3, 6);
    }
  }

  /**
   * 绘制老鹰基地
   */
  renderEagle(ctx) {
    const x = 12 * this.tileSize;
    const y = 24 * this.tileSize;
    const size = this.tileSize * 2; // 48x48

    if (this.eagleAlive) {
      // 存活老鹰背景底座
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x, y, size, size);

      // 金鹰翅膀与头部
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      // 头部
      ctx.arc(x + 24, y + 16, 10, 0, Math.PI * 2);
      // 翅膀与身躯
      ctx.moveTo(x + 6, y + 40);
      ctx.lineTo(x + 24, y + 20);
      ctx.lineTo(x + 42, y + 40);
      ctx.lineTo(x + 24, y + 32);
      ctx.closePath();
      ctx.fill();

      // 鹰眼与红心
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x + 22, y + 14, 4, 4);

      // 外圈光辉金边
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    } else {
      // 阵亡残骸废墟
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(x, y, size, size);

      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(x + 8, y + 12, 14, 10);
      ctx.fillRect(x + 24, y + 20, 16, 12);
      ctx.fillRect(x + 12, y + 30, 24, 8);

      // 烧焦残骸黑色裂痕与白骨废旗
      ctx.fillStyle = '#d2dae2';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✕', x + 24, y + 32);
    }
  }
}
