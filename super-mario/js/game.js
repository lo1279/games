/**
 * 🎮 超级马里奥兄弟 - 核心游戏主引擎 (支持 World 1-1 地表 & World 1-2 地下双关连续挑战)
 */

class MarioGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; // 保持像素复古锯齿质感

    // 虚拟分辨率
    this.width = CONFIG.VIEWPORT_WIDTH;
    this.height = CONFIG.VIEWPORT_HEIGHT;

    // 关卡进度系统
    this.currentWorld = 1;
    this.currentStage = 1;
    this.transitionTimer = 0;

    // 游戏状态: TITLE, LEVEL_TRANSITION, PLAYING, MARIO_DIE, STAGE_CLEAR, ALL_CLEAR, GAME_OVER, PAUSED
    this.gameState = 'TITLE';
    this.cameraX = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.timeLeft = 400;
    this.timeCounter = 0;
    this.animClock = 0;

    // 输入状态
    this.input = {
      left: false,
      right: false,
      down: false,
      jump: false,
      runHeld: false
    };

    // 实体容器
    this.tileMap = null;
    this.mario = null;
    this.enemies = [];
    this.items = [];
    this.particles = [];

    // 过关动画控制
    this.clearSeqTimer = 0;
    this.dieTimer = 0;

    this.bindKeyboard();
    this.resetToTitle();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resetToTitle() {
    this.gameState = 'TITLE';
    this.currentWorld = 1;
    this.currentStage = 1;
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.cameraX = 0;
    this.initLevel(false);
  }

  // 开始新游戏
  startNewGame() {
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.currentWorld = 1;
    this.currentStage = 1;
    this.startLevelTransition(1, 1, false);
  }

  // 开启关卡黑屏过渡页 (WORLD X-X  × 3)
  startLevelTransition(world, stage, preserveMarioState = true) {
    this.gameState = 'LEVEL_TRANSITION';
    this.currentWorld = world;
    this.currentStage = stage;
    this.transitionTimer = 0;
    this.preserveMarioState = preserveMarioState;
    window.marioAudio.ensureContext();
    window.marioAudio.stopBGM();
  }

  // 重置/加载关卡 (保留或重置马里奥形态)
  initLevel(preserveMarioState = false) {
    const prevType = (preserveMarioState && this.mario) ? this.mario.type : 'small';

    this.tileMap = new LevelTileMap(this.currentWorld, this.currentStage);
    this.cameraX = 0;
    this.timeLeft = 400;
    this.timeCounter = 0;
    this.clearSeqTimer = 0;
    this.dieTimer = 0;

    // 1-2 地下关卡马里奥从左上管口自然下落，1-1 和 1-3 则出生在地面上
    const spawnY = (this.currentStage === 2) ? (4 * 16) : (11 * 16);
    this.mario = new Mario(40, spawnY);

    if (prevType === 'super') {
      this.mario.powerUp();
    }

    // 初始化敌人列表 (支持敌人自定义 Y 轴出生高度，适配树冠平台)
    this.enemies = [];
    this.tileMap.enemiesSpawnConfig.forEach(cfg => {
      const defaultY = (cfg.type === 'koopa') ? (10 * 16 + 8) : (11 * 16);
      const enemyY = (cfg.y !== undefined) ? cfg.y : defaultY;
      if (cfg.type === 'goomba') {
        this.enemies.push(new Goomba(cfg.x, enemyY));
      } else if (cfg.type === 'koopa') {
        this.enemies.push(new Koopa(cfg.x, enemyY));
      }
    });

    this.items = [];
    this.particles = [];

    // 启动对应关卡主题的 BGM (地表 / 地下)
    window.marioAudio.startBGM(this.tileMap.theme);
  }

  // 绑定键盘控制
  bindKeyboard() {
    const keyMap = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowDown: 'down', KeyS: 'down',
      KeyZ: 'jump', KeyK: 'jump', Space: 'jump',
      KeyX: 'run', KeyJ: 'run', ShiftLeft: 'run', ShiftRight: 'run'
    };

    window.addEventListener('keydown', (e) => {
      window.marioAudio.ensureContext();

      if (e.code === 'KeyP') {
        if (this.gameState === 'PLAYING') {
          this.gameState = 'PAUSED';
          window.marioAudio.stopBGM();
        } else if (this.gameState === 'PAUSED') {
          this.gameState = 'PLAYING';
          window.marioAudio.startBGM(this.tileMap ? this.tileMap.theme : 'overworld');
        }
        return;
      }

      if (e.code === 'KeyR') {
        this.startLevelTransition(this.currentWorld, this.currentStage, false);
        return;
      }

      if (this.gameState === 'TITLE' || this.gameState === 'GAME_OVER' || this.gameState === 'ALL_CLEAR') {
        if (e.code === 'Enter' || e.code === 'Space') {
          this.startNewGame();
          return;
        }
      }

      const mapped = keyMap[e.code];
      if (mapped) {
        e.preventDefault();
        if (mapped === 'jump') this.input.jump = true;
        if (mapped === 'run') this.input.runHeld = true;
        if (mapped === 'left') this.input.left = true;
        if (mapped === 'right') this.input.right = true;
        if (mapped === 'down') this.input.down = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const mapped = keyMap[e.code];
      if (mapped) {
        if (mapped === 'jump') this.input.jump = false;
        if (mapped === 'run') this.input.runHeld = false;
        if (mapped === 'left') this.input.left = false;
        if (mapped === 'right') this.input.right = false;
        if (mapped === 'down') this.input.down = false;
      }
    });
  }

  // 增加分数与飘字
  addScore(pts, x, y) {
    this.score += pts;
    this.particles.push(new ScoreParticle(x, y, `+${pts}`));
  }

  // 砖块被顶响应回调
  handleBlockHit(action, col, row) {
    const px = col * 16;
    const py = row * 16;
    if (action === 'coin') {
      this.coins++;
      this.addScore(200, px, py - 12);
      this.items.push(new PopCoin(px, py - 8));
    } else if (action === 'break') {
      this.particles.push(new DebrisParticle(px, py, -1.8, -4.5));
      this.particles.push(new DebrisParticle(px + 8, py, 1.8, -4.5));
      this.particles.push(new DebrisParticle(px, py + 8, -1.2, -2.5));
      this.particles.push(new DebrisParticle(px + 8, py + 8, 1.2, -2.5));
      this.addScore(50, px, py);
    }
  }

  // 道具生成回调
  spawnItem(type, x, y) {
    if (type === 'mushroom') {
      this.items.push(new Mushroom(x, y));
    }
  }

  // 主循环
  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop);
  }

  // 状态更新
  update() {
    this.animClock += 0.05;

    if (this.gameState === 'TITLE' || this.gameState === 'PAUSED' || this.gameState === 'GAME_OVER' || this.gameState === 'ALL_CLEAR') {
      return;
    }

    // 0. 关卡黑屏过渡处理 (WORLD X-X)
    if (this.gameState === 'LEVEL_TRANSITION') {
      this.transitionTimer++;
      if (this.transitionTimer >= 80) { // 约 1.3 秒过渡
        this.initLevel(this.preserveMarioState);
        this.gameState = 'PLAYING';
      }
      return;
    }

    // 1. 关卡进行中逻辑
    if (this.gameState === 'PLAYING') {
      // 倒计时
      this.timeCounter++;
      if (this.timeCounter >= 60) {
        this.timeCounter = 0;
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.mario.die();
        }
      }

      // 地图砖块动量动画
      this.tileMap.updateBumpingBlocks();

      // 更新马里奥
      this.mario.update(
        this.input,
        this.tileMap,
        this.cameraX,
        (action, col, row) => this.handleBlockHit(action, col, row),
        (type, x, y) => this.spawnItem(type, x, y)
      );

      // 摄像机镜头平滑向右单向推进 (NES 经典规则：不向左回退)
      const targetCamX = this.mario.x - 90;
      if (targetCamX > this.cameraX) {
        this.cameraX = targetCamX;
      }

      // 检查马里奥是否死亡
      if (this.mario.isDead) {
        this.gameState = 'MARIO_DIE';
        this.dieTimer = 0;
        return;
      }

      // 检查是否到达终点旗杆
      if (this.mario.x >= this.tileMap.flagPoleX - 2 && this.mario.x <= this.tileMap.flagPoleX + 8) {
        this.triggerStageClear();
        return;
      }

      // 更新并检测道具拾取
      this.updateItems();

      // 更新并检测敌人交互
      this.updateEnemies();

      // 更新粒子特效
      this.updateParticles();
    }

    // 2. 马里奥死亡动画阶段
    else if (this.gameState === 'MARIO_DIE') {
      this.mario.update(this.input, this.tileMap, this.cameraX, () => {}, () => {});
      this.dieTimer++;
      if (this.dieTimer > 150) {
        this.lives--;
        if (this.lives > 0) {
          // 当前关卡重新挑战，马里奥形态重置为 small
          this.startLevelTransition(this.currentWorld, this.currentStage, false);
        } else {
          this.gameState = 'GAME_OVER';
        }
      }
    }

    // 3. 通关旗杆下滑与进入城堡过场动画
    else if (this.gameState === 'STAGE_CLEAR') {
      this.clearSeqTimer++;
      this.tileMap.updateBumpingBlocks();
      this.updateParticles();

      // 阶段 1：旗帜与马里奥顺着旗杆缓缓下滑 (0 ~ 70 帧)
      if (this.clearSeqTimer < 70) {
        if (this.tileMap.flagY < this.tileMap.flagBottomY) {
          this.tileMap.flagY += 1.8;
        }
        if (this.mario.y < 11 * 16) {
          this.mario.y += 1.8;
          this.mario.state = 'jump';
        }
      }
      // 阶段 2：马里奥跳下旗杆台阶走向城堡大门 (70 ~ 210 帧)
      else if (this.clearSeqTimer < 210) {
        this.mario.facingRight = true;
        this.mario.state = 'run';
        this.mario.runAnimFrame += 0.2;
        if (this.mario.x < this.tileMap.castleDoorX) {
          this.mario.x += 1.2;
        } else {
          this.mario.x = this.tileMap.castleDoorX + 10;
        }
      }
      // 阶段 3：剩余时间加分结算
      else {
        if (this.timeLeft > 0) {
          this.timeLeft = Math.max(0, this.timeLeft - 4);
          this.score += 200;
          if (this.timeLeft % 8 === 0) {
            window.marioAudio.playCoin();
          }
        } else {
          // 时间结算完毕后，判断是否轮转到下一个关卡世界
          if (this.clearSeqTimer > 230) {
            if (this.currentStage === 1) {
              // 1-1 通关，平滑晋升至 World 1-2 地下世界！继承马里奥形态与分数
              this.startLevelTransition(1, 2, true);
            } else if (this.currentStage === 2) {
              // 1-2 通关，平滑晋升至 World 1-3 高空树冠悬崖世界！
              this.startLevelTransition(1, 3, true);
            } else {
              // 1-3 也通关，进入三连关大满贯全通关界面
              this.gameState = 'ALL_CLEAR';
            }
          }
        }
      }
    }
  }

  // 触发终点通关
  triggerStageClear() {
    this.gameState = 'STAGE_CLEAR';
    this.clearSeqTimer = 0;
    this.mario.vx = 0;
    this.mario.vy = 0;
    this.mario.x = this.tileMap.flagPoleX - 6;

    // 清理剩余活跃敌人
    this.enemies = [];

    // 旗杆高度得分折算 (100 ~ 5000分)
    const poleHitRatio = Math.max(0, Math.min(1, (12 * 16 - this.mario.y) / (9 * 16)));
    const clearPoints = Math.round(poleHitRatio * 4000 / 100) * 100 + 1000;
    this.addScore(clearPoints, this.mario.x, this.mario.y);

    window.marioAudio.playStageClear();
  }

  // 更新与碰撞检测：道具
  updateItems() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.update(this.tileMap);

      if (item instanceof Mushroom && !item.isSpawning) {
        if (this.checkCollision(this.mario, item)) {
          item.isDead = true;
          this.mario.powerUp();
          this.addScore(1000, item.x, item.y);
        }
      }

      if (item.isDead) {
        this.items.splice(i, 1);
      }
    }
  }

  // 更新与碰撞检测：敌人
  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy instanceof Koopa) {
        enemy.update(this.tileMap, this.cameraX, this.enemies, (pts, x, y) => this.addScore(pts, x, y));
      } else {
        enemy.update(this.tileMap, this.cameraX);
      }

      if (!enemy.isDead && !this.mario.isDead && this.checkCollision(this.mario, enemy)) {
        const marioBottom = this.mario.y + this.mario.height;
        const enemyTop = enemy.y;
        const isStomp = this.mario.vy > 0 && marioBottom <= enemyTop + 10;

        if (isStomp) {
          window.marioAudio.playStomp();
          this.mario.vy = CONFIG.PHYSICS.BOUNCE_IMPULSE;
          enemy.stomp();
          this.addScore(100, enemy.x, enemy.y);
        } else {
          if (enemy instanceof Koopa && enemy.state === 'shell') {
            window.marioAudio.playKick();
            const dir = this.mario.x < enemy.x ? 1 : -1;
            enemy.kick(dir);
            this.addScore(400, enemy.x, enemy.y);
          } else {
            this.mario.takeDamage();
          }
        }
      }

      if (enemy.isDead) {
        this.enemies.splice(i, 1);
      }
    }
  }

  // 更新粒子
  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead) {
        this.particles.splice(i, 1);
      }
    }
  }

  checkCollision(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // 渲染总管线
  render() {
    const ctx = this.ctx;

    // 1. 根据关卡主题清屏 (地表：天际渐变蓝；地下：深渊黑)
    if (this.tileMap && this.tileMap.theme === 'underground') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
      skyGrad.addColorStop(0, '#548bf2');
      skyGrad.addColorStop(0.65, '#5c94fc');
      skyGrad.addColorStop(1, '#689efc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 2. 渲染地图瓦片与背景物
    if (this.tileMap) {
      this.tileMap.render(ctx, this.cameraX, this.animClock);
    }

    // 3. 渲染道具
    this.items.forEach(item => item.render(ctx, this.cameraX));

    // 4. 渲染敌人
    this.enemies.forEach(enemy => enemy.render(ctx, this.cameraX));

    // 5. 渲染马里奥
    if (this.mario) {
      this.mario.render(ctx, this.cameraX);
    }

    // 6. 渲染飘字与飞溅粒子
    this.particles.forEach(p => p.render(ctx, this.cameraX));

    // 7. 渲染顶部经典 HUD 状态栏
    this.renderHUD(ctx);

    // 8. 渲染游戏标题 / 过渡 / 结束 / 暂停 / 通关弹窗
    this.renderOverlays(ctx);
  }

  // 经典 NES HUD
  renderHUD(ctx) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P", monospace';

    // MARIO 计分
    ctx.fillText('MARIO', 16, 14);
    const scoreStr = String(this.score).padStart(6, '0');
    ctx.fillText(scoreStr, 16, 25);

    // 金币数
    SpriteRenderer.drawCoin(ctx, 88, 16, this.animClock);
    const coinStr = '×' + String(this.coins).padStart(2, '0');
    ctx.fillText(coinStr, 102, 25);

    // 关卡名 (动态显示 WORLD 1-1 或 WORLD 1-2)
    ctx.fillText('WORLD', 148, 14);
    ctx.fillText(`${this.currentWorld}-${this.currentStage}`, 154, 25);

    // 倒计时
    ctx.fillText('TIME', 208, 14);
    const timeStr = String(Math.max(0, this.timeLeft)).padStart(3, '0');
    ctx.fillText(timeStr, 212, 25);

    ctx.restore();
  }

  // 弹窗与状态遮罩
  renderOverlays(ctx) {
    ctx.save();

    // 1. 关卡黑屏过渡卡 (NES 原版经典 WORLD X-X)
    if (this.gameState === 'LEVEL_TRANSITION') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WORLD ${this.currentWorld}-${this.currentStage}`, this.width / 2, 90);

      // 绘制小马里奥图标和生命数
      SpriteRenderer.drawSmallMario(ctx, this.width / 2 - 24, 115, true, 'idle', 0);
      ctx.fillText(` ×  ${this.lives}`, this.width / 2 + 14, 128);
    }
    // 2. 主标题画面
    else if (this.gameState === 'TITLE') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#fc9838';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUPER MARIO BROS.', this.width / 2, 80);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('WORLD 1-1 ~ 1-3 TRILOGY EDITION', this.width / 2, 104);

      if (Math.floor(this.animClock * 2) % 2 === 0) {
        ctx.fillStyle = '#fce000';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText('PRESS ENTER / TAP TO START', this.width / 2, 145);
      }

      ctx.fillStyle = '#a0a0a0';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('© 1985 NINTENDO / GAME HUB', this.width / 2, 192);
    }
    // 3. 暂停状态
    else if (this.gameState === 'PAUSED') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', this.width / 2, this.height / 2);
    }
    // 4. 游戏结束 Game Over
    else if (this.gameState === 'GAME_OVER') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#ff2222';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.width / 2, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`SCORE: ${this.score}`, this.width / 2, 130);
      ctx.fillText('PRESS ENTER TO RESTART', this.width / 2, 160);
    }
    // 5. 三连关大满贯全通关庆祝画面
    else if (this.gameState === 'ALL_CLEAR') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(16, 45, this.width - 32, 140);
      ctx.strokeStyle = '#fc9838';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 45, this.width - 32, 140);

      ctx.fillStyle = '#fce000';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CONGRATULATIONS!', this.width / 2, 70);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('TRILOGY MASTER CLEARED!', this.width / 2, 92);

      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(`FINAL SCORE: ${this.score}`, this.width / 2, 116);
      ctx.fillText(`TOTAL COINS: ${this.coins}`, this.width / 2, 132);

      ctx.fillStyle = '#4ade80';
      ctx.fillText('PRESS ENTER OR R TO PLAY AGAIN', this.width / 2, 160);
    }

    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.marioGame = new MarioGame();
});
