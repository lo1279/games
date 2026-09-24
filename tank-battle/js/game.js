/**
 * 坦克大战 - 核心游戏主引擎 (Game Engine & State Machine)
 */
class TankGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 状态常量
    this.STATE = {
      TITLE: 0,
      STAGE_START: 1,
      PLAYING: 2,
      PAUSED: 3,
      VICTORY: 4,
      GAME_OVER: 5
    };
    this.state = this.STATE.TITLE;

    // 核心管理器
    this.mapManager = new MapManager();
    this.mapManager.loadLevel(0);
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.explosions = [];
    this.powerups = [];

    // 关卡与进度
    this.currentLevelIndex = 0;
    this.enemyQueue = [...LEVELS[0].enemies]; // 预设第一关敌军总览
    this.spawnPoints = [
      { x: 0, y: 0 },
      { x: 12 * CONFIG.TILE_SIZE, y: 0 },
      { x: 24 * CONFIG.TILE_SIZE, y: 0 }
    ];
    this.nextSpawnIndex = 0;
    this.spawnTimer = 0;

    // 全局道具生效状态
    this.freezeTimer = 0; // 钟表定格时间

    // 关卡切换计时与复活倒计时
    this.stageBannerTimer = 0;
    this.gameOverTimer = 0;
    this.playerRespawnTimer = 0;

    // 按键输入跟踪
    this.keys = {};
    this.initInput();
    this.updateHUD();

    // 循环驱动
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * 初始化按键与事件监听
   */
  initInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // 首次按键唤醒 Web Audio API
      soundEngine.init();
      soundEngine.resume();

      // 开始界面按 Enter 或 J 或 空格直接开打
      if (this.state === this.STATE.TITLE) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') {
          this.startNewGame();
        }
      } else if (this.state === this.STATE.PLAYING) {
        // P 键暂停
        if (e.code === 'KeyP') {
          this.state = this.STATE.PAUSED;
        }
        // J 或 空格发射子弹
        if (e.code === 'KeyJ' || e.code === 'Space' || e.code === 'KeyK') {
          this.playerShoot();
        }
      } else if (this.state === this.STATE.PAUSED) {
        if (e.code === 'KeyP') {
          this.state = this.STATE.PLAYING;
        }
      } else if (this.state === this.STATE.GAME_OVER) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
          this.startNewGame();
        }
      }

      // 静音快捷键 M
      if (e.code === 'KeyM') {
        const isMuted = soundEngine.toggleMute();
        this.updateMuteUI(isMuted);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  updateMuteUI(muted) {
    const btn = document.getElementById('muteBtn');
    if (btn) {
      btn.innerText = muted ? '🔇 已静音' : '🔊 声音开启';
    }
  }

  /**
   * 开始新游戏
   */
  startNewGame() {
    this.currentLevelIndex = 0;
    this.player = new PlayerTank(8 * CONFIG.TILE_SIZE, 24 * CONFIG.TILE_SIZE, this.mapManager);
    this.loadStage(this.currentLevelIndex);
  }

  /**
   * 加载指定关卡
   */
  loadStage(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.mapManager.loadLevel(levelIndex);
    this.bullets = [];
    this.explosions = [];
    this.powerups = [];
    this.enemies = [];
    this.freezeTimer = 0;

    // 解析当前关卡敌军阵列
    const lvl = LEVELS[this.currentLevelIndex % LEVELS.length];
    this.enemyQueue = [...lvl.enemies];
    this.spawnTimer = 0.5;
    this.nextSpawnIndex = 0;

    // 复位玩家位置
    if (this.player) {
      this.player.respawn();
    }

    // 播放关卡前奏与转场横幅
    this.state = this.STATE.STAGE_START;
    this.stageBannerTimer = 2.0;
    soundEngine.playLevelStart();

    this.updateHUD();
  }

  /**
   * 玩家开火
   */
  playerShoot() {
    if (!this.player || this.player.destroyed) return;
    const b = this.player.createBullet('PLAYER');
    if (b) {
      this.bullets.push(b);
      soundEngine.playShoot();
    }
  }

  /**
   * 游戏主循环
   */
  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * 逻辑更新
   */
  update(dt) {
    if (this.state === this.STATE.PLAYING) {
      this.updatePlaying(dt);
    } else if (this.state === this.STATE.STAGE_START) {
      this.stageBannerTimer -= dt;
      if (this.stageBannerTimer <= 0) {
        this.state = this.STATE.PLAYING;
      }
    } else if (this.state === this.STATE.VICTORY) {
      this.stageBannerTimer -= dt;
      // 保持最后一辆敌军爆炸的绚丽粒子正常播放
      for (const exp of this.explosions) exp.update(dt);
      this.explosions = this.explosions.filter(e => !e.finished);
      if (this.stageBannerTimer <= 0) {
        this.loadStage(this.currentLevelIndex + 1);
      }
    } else if (this.state === this.STATE.GAME_OVER) {
      this.gameOverTimer += dt;
      // 仍然更新已有爆炸残留
      for (const exp of this.explosions) exp.update(dt);
      this.explosions = this.explosions.filter(e => !e.finished);
    }
  }

  /**
   * 战斗进行中状态更新
   */
  updatePlaying(dt) {
    // 1. 地图动态水流与铁壁计时
    this.mapManager.update(dt);

    // 2. 冻结道具倒计时
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
    }

    // 3. 玩家更新与安全复活倒计时
    if (this.player) {
      if (this.player.destroyed && this.player.lives > 0) {
        this.playerRespawnTimer -= dt;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn();
        }
      } else {
        this.player.update(dt, this.keys, this.enemies);
      }
    }

    // 4. 敌军生成管理 (场上最多 MAX_ACTIVE_ENEMIES，且队列还有剩余)
    this.spawnTimer -= dt;
    if (
      this.spawnTimer <= 0 &&
      this.enemies.length < CONFIG.MAX_ACTIVE_ENEMIES &&
      this.enemyQueue.length > 0
    ) {
      this.spawnEnemy();
      this.spawnTimer = 2.5; // 每隔 2.5 秒尝试生成一辆
    }

    // 5. 敌军更新 (传入其它坦克列表防止敌我或敌军间穿模)
    const isFrozen = this.freezeTimer > 0;
    const allTanks = [...(this.player && !this.player.destroyed ? [this.player] : []), ...this.enemies];
    for (const enemy of this.enemies) {
      enemy.updateAI(dt, isFrozen, this.player, this.mapManager.eaglePos, this.bullets, allTanks);
    }

    // 6. 子弹更新与全方位碰撞判定
    this.updateBullets(dt);

    // 7. 道具检测
    this.updatePowerups(dt);

    // 8. 爆炸特效更新
    for (const exp of this.explosions) {
      exp.update(dt);
    }
    this.explosions = this.explosions.filter(e => !e.finished);

    // 9. 胜负条件判定
    this.checkGameConditions();

    // 10. 刷新 HUD 界面
    this.updateHUD();
  }

  /**
   * 生成一辆敌军坦克
   */
  spawnEnemy() {
    const rawType = this.enemyQueue.shift();
    let isBonus = false;
    let typeVal = rawType;

    if (typeof rawType === 'string' && rawType.startsWith('*')) {
      isBonus = true;
      typeVal = parseInt(rawType.substring(1), 10);
    }

    const pt = this.spawnPoints[this.nextSpawnIndex];
    this.nextSpawnIndex = (this.nextSpawnIndex + 1) % this.spawnPoints.length;

    // 检查出生点是否有别的坦克重叠
    const canSpawn = !this.enemies.some(e => Math.abs(e.x - pt.x) < 30 && Math.abs(e.y - pt.y) < 30);
    if (canSpawn) {
      const enemy = new EnemyTank(pt.x, pt.y, typeVal, isBonus, this.mapManager);
      this.enemies.push(enemy);
    } else {
      // 稍后再放回队列尝试
      this.enemyQueue.unshift(rawType);
    }
  }

  /**
   * 子弹全维度碰撞处理
   */
  updateBullets(dt) {
    // 运动
    for (const b of this.bullets) {
      b.update(dt);
    }

    // 子弹与地形破坏测试
    for (const b of this.bullets) {
      if (!b.destroyed) {
        const hitTile = this.mapManager.hitTestBullet(b);
        if (hitTile) {
          b.destroyed = true;
          this.explosions.push(new Explosion(b.x, b.y, false));
        }
      }
    }

    // 子弹与子弹空中抵消互爆
    for (let i = 0; i < this.bullets.length; i++) {
      for (let j = i + 1; j < this.bullets.length; j++) {
        const b1 = this.bullets[i];
        const b2 = this.bullets[j];
        if (!b1.destroyed && !b2.destroyed && b1.ownerType !== b2.ownerType) {
          if (b1.collidesWith(b2)) {
            b1.destroyed = true;
            b2.destroyed = true;
            this.explosions.push(new Explosion((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, false));
            soundEngine.playHitBrick();
          }
        }
      }
    }

    // 玩家子弹打击敌方坦克
    for (const b of this.bullets) {
      if (b.destroyed || b.ownerType !== 'PLAYER') continue;

      for (const enemy of this.enemies) {
        if (!enemy.destroyed && !enemy.spawning && b.collidesWith(enemy)) {
          b.destroyed = true;
          const killed = enemy.takeDamage(b.power);
          if (killed) {
            this.player.score += enemy.scoreValue;
            this.explosions.push(new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, true));
            soundEngine.playExplosion();

            // 若击毁闪烁红装车，随机刷出道具！
            if (enemy.isBonusTank) {
              this.dropRandomPowerUp();
            }
          } else {
            this.explosions.push(new Explosion(b.x, b.y, false));
          }
          break;
        }
      }
    }

    // 敌方子弹打中玩家
    for (const b of this.bullets) {
      if (b.destroyed || b.ownerType !== 'ENEMY') continue;

      if (this.player && !this.player.destroyed && b.collidesWith(this.player)) {
        b.destroyed = true;
        const killed = this.player.takeDamage(1);
        if (killed) {
          this.explosions.push(new Explosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, true));
          if (this.player.lives > 0) {
            // 设置 1 秒安全帧复活倒计时 (受暂停与游戏时钟精准控制)
            this.playerRespawnTimer = 1.0;
          }
        } else {
          this.explosions.push(new Explosion(b.x, b.y, false));
        }
      }
    }

    // 过滤已销毁的子弹，并回收坦克炮弹发射配额
    for (const b of this.bullets) {
      if (b.destroyed) {
        if (b.ownerType === 'PLAYER' && this.player) {
          this.player.activeBullets = Math.max(0, this.player.activeBullets - 1);
        }
      }
    }

    this.bullets = this.bullets.filter(b => !b.destroyed);
    this.enemies = this.enemies.filter(e => !e.destroyed);
  }

  /**
   * 掉落随机道具
   */
  dropRandomPowerUp() {
    // 随机寻找地图中一块空地
    const types = [
      CONFIG.POWERUP.STAR,
      CONFIG.POWERUP.BOMB,
      CONFIG.POWERUP.CLOCK,
      CONFIG.POWERUP.SHOVEL,
      CONFIG.POWERUP.HELMET,
      CONFIG.POWERUP.TANK
    ];
    const pickedType = types[Math.floor(Math.random() * types.length)];

    // 随机挑选合理的瓦片坐标
    let px = Math.floor(Math.random() * (CONFIG.MAP_COLS - 4) + 2) * CONFIG.TILE_SIZE;
    let py = Math.floor(Math.random() * (CONFIG.MAP_ROWS - 6) + 2) * CONFIG.TILE_SIZE;

    this.powerups.push(new PowerUp(px, py, pickedType));
    soundEngine.playPowerup();
  }

  /**
   * 拾取道具处理
   */
  updatePowerups(dt) {
    for (const p of this.powerups) {
      p.update(dt);
      if (!p.collected && this.player && !this.player.destroyed && p.collidesWith(this.player)) {
        p.collected = true;
        this.applyPowerUp(p.type);
        soundEngine.playPowerup();
        this.player.score += 500;
      }
    }
    this.powerups = this.powerups.filter(p => !p.collected);
  }

  /**
   * 激活道具效果
   */
  applyPowerUp(type) {
    switch (type) {
      case CONFIG.POWERUP.STAR:
        this.player.upgrade();
        break;

      case CONFIG.POWERUP.BOMB:
        // 全屏消灭场上全部敌军
        for (const e of this.enemies) {
          e.destroyed = true;
          this.player.score += e.scoreValue;
          this.explosions.push(new Explosion(e.x + e.width / 2, e.y + e.height / 2, true));
        }
        soundEngine.playExplosion();
        break;

      case CONFIG.POWERUP.CLOCK:
        // 冻结敌方 10 秒
        this.freezeTimer = CONFIG.DURATION.CLOCK_FREEZE;
        break;

      case CONFIG.POWERUP.SHOVEL:
        // 基地加固为铁壁
        this.mapManager.activateShovel();
        break;

      case CONFIG.POWERUP.HELMET:
        // 玩家 10 秒金钟罩护盾
        this.player.activateShield(CONFIG.DURATION.HELMET_INVULNERABLE);
        break;

      case CONFIG.POWERUP.TANK:
        // 奖励一条命
        this.player.lives++;
        break;
    }
  }

  /**
   * 检查胜负条件
   */
  checkGameConditions() {
    // 1. 基地老鹰被毁
    if (!this.mapManager.eagleAlive) {
      this.triggerGameOver();
      return;
    }

    // 2. 玩家命耗尽
    if (this.player && this.player.lives <= 0 && this.player.destroyed) {
      this.triggerGameOver();
      return;
    }

    // 3. 关卡敌方 20 辆全部清空 -> 胜利进入下一关
    if (this.enemyQueue.length === 0 && this.enemies.length === 0) {
      this.state = this.STATE.VICTORY;
      this.stageBannerTimer = 3.0; // 3秒后载入下一关
      soundEngine.playLevelStart();
    }
  }

  triggerGameOver() {
    this.state = this.STATE.GAME_OVER;
    this.gameOverTimer = 0;
  }

  /**
   * 更新右侧 HUD 与信息看板
   */
  updateHUD() {
    const scoreEl = document.getElementById('hudScore');
    const livesEl = document.getElementById('hudLives');
    const stageEl = document.getElementById('hudStage');
    const levelNameEl = document.getElementById('hudLevelName');
    const enemyIconsEl = document.getElementById('hudEnemyIcons');

    if (scoreEl && this.player) scoreEl.innerText = this.player.score;
    if (livesEl && this.player) livesEl.innerText = Math.max(0, this.player.lives);
    if (stageEl) stageEl.innerText = this.currentLevelIndex + 1;

    const curLvl = LEVELS[this.currentLevelIndex % LEVELS.length];
    if (levelNameEl && curLvl) levelNameEl.innerText = curLvl.name;

    // 渲染待击毁剩余敌军坦克图标矩阵
    const remainingTotal = this.enemyQueue.length + this.enemies.length;
    if (enemyIconsEl) {
      let html = '';
      for (let i = 0; i < remainingTotal; i++) {
        html += '<span class="enemy-icon">▲</span>';
      }
      enemyIconsEl.innerHTML = html;
    }

    // 同步更新移动端紧凑顶部 HUD
    const mStage = document.getElementById('mHudStage');
    const mScore = document.getElementById('mHudScore');
    const mLives = document.getElementById('mHudLives');
    const mEnemy = document.getElementById('mHudEnemyCount');
    if (mStage) mStage.innerText = this.currentLevelIndex + 1;
    if (mScore && this.player) mScore.innerText = this.player.score;
    if (mLives && this.player) mLives.innerText = Math.max(0, this.player.lives);
    if (mEnemy) mEnemy.innerText = remainingTotal;
  }

  /**
   * 渲染画面
   */
  render() {
    const ctx = this.ctx;
    const w = CONFIG.CANVAS_WIDTH;
    const h = CONFIG.CANVAS_HEIGHT;

    // 清屏全黑底色
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // 1. 绘制地图实体层 (砖、铁、水、冰、老鹰基地)
    this.mapManager.renderBase(ctx);

    // 2. 绘制掉落道具
    for (const p of this.powerups) {
      p.render(ctx);
    }

    // 3. 绘制玩家坦克
    if (this.player) {
      this.player.render(ctx);
    }

    // 4. 绘制敌方坦克
    for (const enemy of this.enemies) {
      enemy.render(ctx);
    }

    // 5. 绘制所有飞行子弹
    for (const b of this.bullets) {
      b.render(ctx);
    }

    // 6. 绘制爆炸与粒子烟雾
    for (const exp of this.explosions) {
      exp.render(ctx);
    }

    // 7. 绘制地图上层掩盖物 (丛林树叶 Grass)
    this.mapManager.renderTop(ctx);

    // 8. 绘制状态叠加层 (标题、过场、暂停、Game Over)
    this.renderOverlay(ctx, w, h);
  }

  /**
   * 渲染状态遮罩与文字浮层
   */
  renderOverlay(ctx, w, h) {
    if (this.state === this.STATE.TITLE) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ff3838';
      ctx.font = 'bold 44px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TANK BATTLE', w / 2, h / 2 - 80);

      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 20px "Press Start 2P", monospace, sans-serif';
      ctx.fillText('坦 克 大 战', w / 2, h / 2 - 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('按 ENTER / 空格 或 点击 [A开火] 开始', w / 2, h / 2 + 50);

      ctx.fillStyle = '#7f8c8d';
      ctx.font = '14px monospace';
      ctx.fillText('移动: 方向键 / 滑动十字盘   开火: J / A键', w / 2, h / 2 + 100);
      ctx.fillText('连发: B键   暂停: P键   重开: R键', w / 2, h / 2 + 130);
    } else if (this.state === this.STATE.STAGE_START) {
      // 经典灰黑色转场屏
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`STAGE ${this.currentLevelIndex + 1}`, w / 2, h / 2 - 20);

      const curLvl = LEVELS[this.currentLevelIndex % LEVELS.length];
      ctx.fillStyle = '#f1c40f';
      ctx.font = '18px monospace';
      ctx.fillText(curLvl ? curLvl.name : '', w / 2, h / 2 + 25);
    } else if (this.state === this.STATE.PAUSED) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 32px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED 暂停中', w / 2, h / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('按 P 键或点击 [暂停] 继续战斗', w / 2, h / 2 + 40);
    } else if (this.state === this.STATE.VICTORY) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 36px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE CLEAR!', w / 2, h / 2 - 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      ctx.fillText('正在进入下一防区...', w / 2, h / 2 + 30);
    } else if (this.state === this.STATE.GAME_OVER) {
      // 经典红色 GAME OVER 从屏幕下方升起
      const riseOffset = Math.max(0, 100 - this.gameOverTimer * 80);

      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 44px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 + riseOffset);

      ctx.fillStyle = '#ecf0f1';
      ctx.font = '16px monospace';
      ctx.fillText('按 ENTER / R 或 点击 [A开火] 重新出击', w / 2, h / 2 + riseOffset + 50);
    }
  }
}

// 页面加载就绪时启动
window.addEventListener('DOMContentLoaded', () => {
  window.game = new TankGame();
});
