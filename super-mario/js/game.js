/**
 * 🎮 超级马里奥兄弟 - 核心游戏主引擎 (Game Engine)
 */

class MarioGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; // 保持像素复古锯齿质感

    // 虚拟分辨率
    this.width = CONFIG.VIEWPORT_WIDTH;
    this.height = CONFIG.VIEWPORT_HEIGHT;

    // 游戏状态
    this.gameState = 'TITLE'; // TITLE, PLAYING, STAGE_CLEAR, MARIO_DIE, GAME_OVER
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
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.cameraX = 0;
    this.initLevel();
  }

  // 开始新游戏
  startNewGame() {
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.initLevel();
    this.gameState = 'PLAYING';
    window.marioAudio.ensureContext();
    window.marioAudio.startBGM();
  }

  // 重置/加载关卡
  initLevel() {
    this.tileMap = new LevelTileMap();
    this.cameraX = 0;
    this.timeLeft = 400;
    this.timeCounter = 0;
    this.clearSeqTimer = 0;
    this.dieTimer = 0;

    // 初始化马里奥 (出生在 x=40, 地面上)
    this.mario = new Mario(40, 11 * 16);

    // 初始化敌人列表
    this.enemies = [];
    this.tileMap.enemiesSpawnConfig.forEach(cfg => {
      if (cfg.type === 'goomba') {
        this.enemies.push(new Goomba(cfg.x, 11 * 16));
      } else if (cfg.type === 'koopa') {
        this.enemies.push(new Koopa(cfg.x, 10 * 16 + 8));
      }
    });

    this.items = [];
    this.particles = [];
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
      // 激活音频上下文
      window.marioAudio.ensureContext();

      if (e.code === 'KeyP') {
        if (this.gameState === 'PLAYING') {
          this.gameState = 'PAUSED';
          window.marioAudio.stopBGM();
        } else if (this.gameState === 'PAUSED') {
          this.gameState = 'PLAYING';
          window.marioAudio.startBGM();
        }
        return;
      }

      if (e.code === 'KeyR') {
        this.initLevel();
        this.gameState = 'PLAYING';
        window.marioAudio.startBGM();
        return;
      }

      if (this.gameState === 'TITLE' || this.gameState === 'GAME_OVER') {
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
      // 产生四个方向飞溅的碎片
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

    if (this.gameState === 'TITLE' || this.gameState === 'PAUSED') {
      return;
    }

    if (this.gameState === 'GAME_OVER') {
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
          this.initLevel();
          this.gameState = 'PLAYING';
          window.marioAudio.startBGM();
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
          // 步入城门隐藏
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

    // 清理剩余活跃敌人，确保通关动画纯净无碰撞干扰
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

      // 与马里奥碰撞
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

      // 与马里奥碰撞判定
      if (!enemy.isDead && !this.mario.isDead && this.checkCollision(this.mario, enemy)) {
        // 判断是否为从上方踩踏 (马里奥正在下落且脚底高于怪物中心)
        const marioBottom = this.mario.y + this.mario.height;
        const enemyTop = enemy.y;
        const isStomp = this.mario.vy > 0 && marioBottom <= enemyTop + 10;

        if (isStomp) {
          // 踩怪成功
          window.marioAudio.playStomp();
          this.mario.vy = CONFIG.PHYSICS.BOUNCE_IMPULSE; // 踩中弹跳
          enemy.stomp();
          this.addScore(100, enemy.x, enemy.y);
        } else {
          // 侧身触碰
          if (enemy instanceof Koopa && enemy.state === 'shell') {
            // 踢飞静止的龟壳
            window.marioAudio.playKick();
            const dir = this.mario.x < enemy.x ? 1 : -1;
            enemy.kick(dir);
            this.addScore(400, enemy.x, enemy.y);
          } else {
            // 受伤或死亡
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

  // 简易 AABB 碰撞
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

    // 1. 经典 NES 8-Bit 天空阶梯渐变层
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#548bf2');
    skyGrad.addColorStop(0.65, '#5c94fc');
    skyGrad.addColorStop(1, '#689efc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

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

    // 8. 渲染游戏标题 / 结束 / 暂停 / 通关弹窗
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

    // 关卡名
    ctx.fillText('WORLD', 152, 14);
    ctx.fillText('1-1', 160, 25);

    // 倒计时
    ctx.fillText('TIME', 208, 14);
    const timeStr = String(Math.max(0, this.timeLeft)).padStart(3, '0');
    ctx.fillText(timeStr, 212, 25);

    ctx.restore();
  }

  // 弹窗与状态遮罩
  renderOverlays(ctx) {
    ctx.save();

    if (this.gameState === 'TITLE') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#fc9838';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SUPER MARIO BROS.', this.width / 2, 85);

      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('WORLD 1-1', this.width / 2, 112);

      // 闪烁提示按空格
      if (Math.floor(this.animClock * 2) % 2 === 0) {
        ctx.fillStyle = '#fce000';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText('PRESS ENTER / TAP TO START', this.width / 2, 150);
      }

      ctx.fillStyle = '#a0a0a0';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('© 1985 NINTENDO / GAME HUB', this.width / 2, 192);
    } else if (this.gameState === 'PAUSED') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', this.width / 2, this.height / 2);
    } else if (this.gameState === 'GAME_OVER') {
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
    } else if (this.gameState === 'STAGE_CLEAR' && this.clearSeqTimer > 210) {
      // 通关祝贺框
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(20, 56, this.width - 40, 118);
      ctx.strokeStyle = '#fc9838';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 56, this.width - 40, 118);

      ctx.fillStyle = '#fce000';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE CLEAR!', this.width / 2, 82);

      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(`TOTAL SCORE: ${this.score}`, this.width / 2, 108);
      ctx.fillText(`COINS: ${this.coins}`, this.width / 2, 126);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PRESS R / RESET TO REPLAY', this.width / 2, 150);
    }

    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.marioGame = new MarioGame();
});
