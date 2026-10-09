/**
 * 🎮 超级马里奥兄弟 - 角色与实体引擎 (Mario, Goomba, Koopa, Items, Particles)
 */

// 1. 浮动得分文字粒子
class ScoreParticle {
  constructor(x, y, text) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.timer = 0;
    this.maxTime = 40;
    this.vy = -0.7;
    this.isDead = false;
  }

  update() {
    this.y += this.vy;
    this.timer++;
    if (this.timer >= this.maxTime) {
      this.isDead = true;
    }
  }

  render(ctx, cameraX) {
    const sx = Math.floor(this.x - cameraX);
    const sy = Math.floor(this.y);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.fillText(this.text, sx, sy);
    ctx.restore();
  }
}

// 2. 砖块击碎飞溅碎片
class DebrisParticle {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.isDead = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.25; // 重力
    if (this.y > CONFIG.VIEWPORT_HEIGHT + 20) {
      this.isDead = true;
    }
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawBrickDebris(ctx, this.x - cameraX, this.y);
  }
}

// 3. 弹出的金币
class PopCoin {
  constructor(x, y) {
    this.x = x + 4;
    this.startY = y;
    this.y = y;
    this.vy = -4.0;
    this.frame = 0;
    this.isDead = false;
  }

  update() {
    this.y += this.vy;
    this.vy += 0.35;
    this.frame += 0.25;
    if (this.vy > 0 && this.y >= this.startY - 4) {
      this.isDead = true;
    }
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawCoin(ctx, this.x - cameraX, this.y, this.frame);
  }
}

// 4. 超级红蘑菇道具
class Mushroom {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.vx = 1.0;
    this.vy = 0;
    this.isSpawning = true;
    this.spawnTargetY = y - 16;
    this.isDead = false;
  }

  update(tileMap) {
    if (this.isSpawning) {
      this.y -= 0.5;
      if (this.y <= this.spawnTargetY) {
        this.y = this.spawnTargetY;
        this.isSpawning = false;
      }
      return;
    }

    // 蘑菇在地面滑行物理
    this.vy = Math.min(this.vy + CONFIG.PHYSICS.GRAVITY, CONFIG.PHYSICS.MAX_FALL_SPEED);

    // 水平移动与障碍碰撞
    this.x += this.vx;
    const colLeft = Math.floor(this.x / 16);
    const colRight = Math.floor((this.x + this.width - 1) / 16);
    const rowMid = Math.floor((this.y + 8) / 16);

    if (this.vx > 0 && tileMap.isSolid(tileMap.getTile(colRight, rowMid))) {
      this.x = colRight * 16 - this.width;
      this.vx = -this.vx;
    } else if (this.vx < 0 && tileMap.isSolid(tileMap.getTile(colLeft, rowMid))) {
      this.x = (colLeft + 1) * 16;
      this.vx = -this.vx;
    }

    // 垂直重力与地面碰撞
    this.y += this.vy;
    const footRow = Math.floor((this.y + this.height) / 16);
    const colA = Math.floor((this.x + 2) / 16);
    const colB = Math.floor((this.x + this.width - 3) / 16);

    if (tileMap.isSolid(tileMap.getTile(colA, footRow)) || tileMap.isSolid(tileMap.getTile(colB, footRow))) {
      this.y = footRow * 16 - this.height;
      this.vy = 0;
    }

    if (this.y > CONFIG.VIEWPORT_HEIGHT + 32) {
      this.isDead = true;
    }
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawMushroom(ctx, this.x - cameraX, this.y);
  }
}

// 5. 板栗仔 (Goomba)
class Goomba {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 16;
    this.vx = -0.55;
    this.vy = 0;
    this.isFlat = false;
    this.flatTimer = 0;
    this.isDead = false;
    this.animFrame = 0;
    this.isActive = false;
  }

  update(tileMap, cameraX) {
    // 只有当进入屏幕附近视野时激活行动
    if (!this.isActive) {
      if (this.x < cameraX + CONFIG.VIEWPORT_WIDTH + 32) {
        this.isActive = true;
      } else {
        return;
      }
    }

    if (this.isFlat) {
      this.flatTimer++;
      if (this.flatTimer > 30) {
        this.isDead = true;
      }
      return;
    }

    this.animFrame += 0.08;
    this.vy = Math.min(this.vy + CONFIG.PHYSICS.GRAVITY, CONFIG.PHYSICS.MAX_FALL_SPEED);

    // 水平巡逻移动
    this.x += this.vx;
    const checkRow = Math.floor((this.y + 8) / 16);
    if (this.vx < 0) {
      const c = Math.floor(this.x / 16);
      if (tileMap.isSolid(tileMap.getTile(c, checkRow))) {
        this.x = (c + 1) * 16;
        this.vx = -this.vx;
      }
    } else {
      const c = Math.floor((this.x + this.width) / 16);
      if (tileMap.isSolid(tileMap.getTile(c, checkRow))) {
        this.x = c * 16 - this.width;
        this.vx = -this.vx;
      }
    }

    // 垂直地面碰撞
    this.y += this.vy;
    if (this.vy >= 0) {
      const footRow = Math.floor((this.y + this.height) / 16);
      const colA = Math.floor((this.x + 2) / 16);
      const colB = Math.floor((this.x + this.width - 3) / 16);

      if (tileMap.isSolid(tileMap.getTile(colA, footRow)) || tileMap.isSolid(tileMap.getTile(colB, footRow))) {
        this.y = footRow * 16 - this.height;
        this.vy = 0;
      }
    }

    if (this.y > CONFIG.VIEWPORT_HEIGHT + 32 || this.x < cameraX - 60) {
      this.isDead = true;
    }
  }

  stomp() {
    this.isFlat = true;
    this.vx = 0;
    this.vy = 0;
  }

  kickDie() {
    this.isDead = true;
  }

  render(ctx, cameraX) {
    if (!this.isActive) return;
    SpriteRenderer.drawGoomba(ctx, this.x - cameraX, this.y, this.animFrame, this.isFlat);
  }
}

// 6. 绿乌龟 (Koopa)
class Koopa {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 24;
    this.vx = -0.55;
    this.vy = 0;
    this.state = 'walk'; // walk, shell, shell_moving
    this.facingRight = false;
    this.animFrame = 0;
    this.isDead = false;
    this.isActive = false;
  }

  update(tileMap, cameraX, enemies, addScore) {
    if (!this.isActive) {
      if (this.x < cameraX + CONFIG.VIEWPORT_WIDTH + 32) {
        this.isActive = true;
      } else {
        return;
      }
    }

    this.animFrame += 0.08;
    this.vy = Math.min(this.vy + CONFIG.PHYSICS.GRAVITY, CONFIG.PHYSICS.MAX_FALL_SPEED);

    // 水平移动
    this.x += this.vx;
    const checkRow = Math.floor((this.y + this.height - 8) / 16);
    if (this.vx < 0) {
      const c = Math.floor(this.x / 16);
      if (tileMap.isSolid(tileMap.getTile(c, checkRow))) {
        this.x = (c + 1) * 16;
        this.vx = -this.vx;
        this.facingRight = true;
      }
    } else if (this.vx > 0) {
      const c = Math.floor((this.x + this.width) / 16);
      if (tileMap.isSolid(tileMap.getTile(c, checkRow))) {
        this.x = c * 16 - this.width;
        this.vx = -this.vx;
        this.facingRight = false;
      }
    }

    // 垂直地面碰撞
    this.y += this.vy;
    if (this.vy >= 0) {
      const footRow = Math.floor((this.y + this.height) / 16);
      const colA = Math.floor((this.x + 2) / 16);
      const colB = Math.floor((this.x + this.width - 3) / 16);

      if (tileMap.isSolid(tileMap.getTile(colA, footRow)) || tileMap.isSolid(tileMap.getTile(colB, footRow))) {
        this.y = footRow * 16 - this.height;
        this.vy = 0;
      }
    }

    // 高速滑壳状态击倒沿途怪物
    if (this.state === 'shell_moving') {
      enemies.forEach(other => {
        if (other !== this && !other.isDead && this.checkCollision(other)) {
          other.kickDie();
          window.marioAudio.playKick();
          addScore(100, other.x, other.y);
        }
      });
    }

    if (this.y > CONFIG.VIEWPORT_HEIGHT + 32 || this.x < cameraX - 80) {
      this.isDead = true;
    }
  }

  checkCollision(other) {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }

  stomp() {
    if (this.state === 'walk') {
      this.state = 'shell';
      this.height = 16;
      this.y += 8;
      this.vx = 0;
    } else if (this.state === 'shell') {
      this.state = 'shell_moving';
      this.vx = 3.5;
    } else if (this.state === 'shell_moving') {
      this.state = 'shell';
      this.vx = 0;
    }
  }

  kick(direction) {
    this.state = 'shell_moving';
    this.vx = direction * 3.8;
  }

  kickDie() {
    this.isDead = true;
  }

  render(ctx, cameraX) {
    if (!this.isActive) return;
    SpriteRenderer.drawKoopa(ctx, this.x - cameraX, this.y, this.facingRight, this.state, this.animFrame);
  }
}

// 7. 马里奥核心实体 (Mario)
class Mario {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.type = 'small'; // 'small' 或 'super'
    this.width = 12;     // 物理包围盒宽度略微紧凑以便顺畅穿行
    this.height = 16;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.facingRight = true;
    this.state = 'idle'; // idle, run, skid, jump, die, flag, walk
    this.runAnimFrame = 0;
    this.jumpFrames = 0;
    this.isJumping = false;
    this.isCrouching = false;
    this.invulnerableTimer = 0;
    this.growingTimer = 0;
    this.isDead = false;
  }

  // 变身超级马里奥
  powerUp() {
    if (this.type === 'small') {
      this.type = 'super';
      this.height = 28;
      this.y -= 12;
      this.growingTimer = 30;
      window.marioAudio.playPowerup();
    }
  }

  // 受伤降级
  takeDamage() {
    if (this.invulnerableTimer > 0) return false;

    if (this.type === 'super') {
      this.type = 'small';
      this.height = 16;
      this.y += 12;
      this.invulnerableTimer = 90; // 1.5秒无敌保护
      window.marioAudio.playPipe();
      return false;
    } else {
      // 阵亡
      this.die();
      return true;
    }
  }

  die() {
    this.state = 'die';
    this.isDead = true;
    this.vx = 0;
    this.vy = -5.0;
    window.marioAudio.playDie();
  }

  update(input, tileMap, cameraX, onBlockHit, spawnItem) {
    if (this.state === 'die') {
      this.y += this.vy;
      this.vy += 0.28;
      return;
    }

    if (this.growingTimer > 0) {
      this.growingTimer--;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer--;
    }

    // 1. 水平输入与惯性加速计算
    const P = CONFIG.PHYSICS;
    const accel = input.runHeld ? P.RUN_ACCEL : P.WALK_ACCEL;
    const maxSpeed = input.runHeld ? P.MAX_RUN_SPEED : P.MAX_WALK_SPEED;

    // 下蹲状态与物理包围盒动态判定 (限大马里奥)
    if (this.type === 'super' && this.isGrounded) {
      if (input.down) {
        if (!this.isCrouching) {
          this.isCrouching = true;
          this.height = 16;
          this.y += 12;
        }
      } else if (this.isCrouching) {
        // 松开下蹲，检测头顶上方是否有硬砖阻挡
        const testTopRow = Math.floor((this.y - 12) / 16);
        const colL = Math.floor((this.x + 2) / 16);
        const colR = Math.floor((this.x + this.width - 2) / 16);
        if (!tileMap.isSolid(tileMap.getTile(colL, testTopRow)) && !tileMap.isSolid(tileMap.getTile(colR, testTopRow))) {
          this.isCrouching = false;
          this.height = 28;
          this.y -= 12;
        }
      }
    } else if (this.isCrouching && !this.isGrounded) {
      this.isCrouching = false;
      this.height = this.type === 'super' ? 28 : 16;
    }

    if (!this.isCrouching) {
      if (input.left) {
        this.facingRight = false;
        if (this.vx > 0) {
          this.vx -= P.SKID_FRICTION;
          this.state = 'skid';
        } else {
          this.vx = Math.max(this.vx - accel, -maxSpeed);
          this.state = 'run';
        }
      } else if (input.right) {
        this.facingRight = true;
        if (this.vx < 0) {
          this.vx += P.SKID_FRICTION;
          this.state = 'skid';
        } else {
          this.vx = Math.min(this.vx + accel, maxSpeed);
          this.state = 'run';
        }
      } else {
        // 无按键时摩擦力减速
        if (Math.abs(this.vx) < P.FRICTION) {
          this.vx = 0;
          this.state = 'idle';
        } else {
          this.vx += this.vx > 0 ? -P.FRICTION : P.FRICTION;
          this.state = 'run';
        }
      }
    } else {
      // 下蹲时滑动摩擦力减速
      if (Math.abs(this.vx) < P.FRICTION * 1.5) {
        this.vx = 0;
      } else {
        this.vx += this.vx > 0 ? -P.FRICTION * 1.5 : P.FRICTION * 1.5;
      }
    }

    // 2. 跳跃处理 (按住时间越长跳越高)
    if (input.jump && this.isGrounded && !this.isJumping) {
      this.isJumping = true;
      this.isGrounded = false;
      this.jumpFrames = 0;
      this.vy = P.JUMP_IMPULSE - Math.abs(this.vx) * 0.15; // 跑动起跳高度加成
      if (this.type === 'small') {
        window.marioAudio.playJumpSmall();
      } else {
        window.marioAudio.playJumpSuper();
      }
    }

    if (input.jump && this.isJumping) {
      if (this.jumpFrames < P.MAX_JUMP_FRAMES) {
        this.vy += P.JUMP_HOLD_BONUS;
        this.jumpFrames++;
      }
    } else {
      this.isJumping = false;
    }

    // 重力
    this.vy = Math.min(this.vy + P.GRAVITY, P.MAX_FALL_SPEED);

    // 3. 水平位移与瓦片碰撞检测
    this.x += this.vx;
    // 摄像机左边界阻挡 (不能向左回走出屏幕)
    if (this.x < cameraX) {
      this.x = cameraX;
      this.vx = 0;
    }

    this.checkHorizontalCollisions(tileMap);

    // 4. 垂直位移与瓦片碰撞检测
    this.y += this.vy;
    this.isGrounded = false;
    this.checkVerticalCollisions(tileMap, onBlockHit, spawnItem);

    // 5. 状态与动画帧刷新
    if (!this.isGrounded) {
      this.state = 'jump';
    } else if (Math.abs(this.vx) > 0.1) {
      if (this.state !== 'skid') this.state = 'run';
      this.runAnimFrame += Math.abs(this.vx) * 0.14;
    } else {
      this.state = 'idle';
      this.runAnimFrame = 0;
    }

    // 坠入悬崖断崖判定
    if (this.y > CONFIG.VIEWPORT_HEIGHT + 16) {
      this.die();
    }
  }

  checkHorizontalCollisions(tileMap) {
    const leftCol = Math.floor(this.x / 16);
    const rightCol = Math.floor((this.x + this.width) / 16);
    const topRow = Math.floor(this.y / 16);
    const bottomRow = Math.floor((this.y + this.height - 1) / 16);

    for (let r = topRow; r <= bottomRow; r++) {
      if (this.vx > 0) {
        if (tileMap.isSolid(tileMap.getTile(rightCol, r))) {
          this.x = rightCol * 16 - this.width - 0.01;
          this.vx = 0;
          break;
        }
      } else if (this.vx < 0) {
        if (tileMap.isSolid(tileMap.getTile(leftCol, r))) {
          this.x = (leftCol + 1) * 16 + 0.01;
          this.vx = 0;
          break;
        }
      }
    }
  }

  checkVerticalCollisions(tileMap, onBlockHit, spawnItem) {
    const leftCol = Math.floor((this.x + 2) / 16);
    const rightCol = Math.floor((this.x + this.width - 2) / 16);

    if (this.vy > 0) {
      // 向下落，检测脚下落地
      const footRow = Math.floor((this.y + this.height) / 16);
      const tileL = tileMap.getTile(leftCol, footRow);
      const tileR = tileMap.getTile(rightCol, footRow);

      if (tileMap.isSolid(tileL) || tileMap.isSolid(tileR)) {
        this.y = footRow * 16 - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.isJumping = false;
      }
    } else if (this.vy < 0) {
      // 向上跃起，检测头顶双采样点撞击 (左肩与右肩防穿缝)
      const headRow = Math.floor(this.y / 16);
      const leftHitCol = Math.floor((this.x + 3) / 16);
      const rightHitCol = Math.floor((this.x + this.width - 3) / 16);

      let hitCol = -1;
      let headTile = CONFIG.TILE.EMPTY;

      if (tileMap.isSolid(tileMap.getTile(leftHitCol, headRow))) {
        hitCol = leftHitCol;
        headTile = tileMap.getTile(leftHitCol, headRow);
      } else if (tileMap.isSolid(tileMap.getTile(rightHitCol, headRow))) {
        hitCol = rightHitCol;
        headTile = tileMap.getTile(rightHitCol, headRow);
      }

      if (tileMap.isSolid(headTile)) {
        this.y = (headRow + 1) * 16;
        this.vy = 0.5; // 触顶反弹下落
        this.isJumping = false;

        // 触发砖块响应
        if (headTile === CONFIG.TILE.QUESTION_COIN) {
          tileMap.setTile(hitCol, headRow, CONFIG.TILE.EMPTY_BLOCK);
          tileMap.triggerBlockBump(hitCol, headRow);
          window.marioAudio.playCoin();
          onBlockHit('coin', hitCol, headRow);
        } else if (headTile === CONFIG.TILE.QUESTION_MUSHROOM) {
          tileMap.setTile(hitCol, headRow, CONFIG.TILE.EMPTY_BLOCK);
          tileMap.triggerBlockBump(hitCol, headRow);
          window.marioAudio.playPowerupAppears();
          spawnItem('mushroom', hitCol * 16, headRow * 16);
        } else if (headTile === CONFIG.TILE.BRICK) {
          if (this.type === 'super') {
            // 大马里奥粉碎砖块
            tileMap.setTile(hitCol, headRow, CONFIG.TILE.EMPTY);
            window.marioAudio.playBreakBlock();
            onBlockHit('break', hitCol, headRow);
          } else {
            // 小马里奥颠动砖块
            tileMap.triggerBlockBump(hitCol, headRow);
            window.marioAudio.playBump();
          }
        } else {
          window.marioAudio.playBump();
        }
      }
    }
  }

  render(ctx, cameraX) {
    // 受伤无敌期间快速闪烁
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const drawX = this.x - cameraX - 2; // 偏移补偿贴图与包围盒
    if (this.type === 'small') {
      SpriteRenderer.drawSmallMario(ctx, drawX, this.y, this.facingRight, this.state, this.runAnimFrame);
    } else {
      SpriteRenderer.drawBigMario(ctx, drawX, this.y - (this.isCrouching ? 0 : 0), this.facingRight, this.state, this.runAnimFrame, this.isCrouching);
    }
  }
}

// 8. 城堡经典旋转火球棒 (Firebar)
class Firebar {
  constructor(blockCol, blockRow, length = 5, speed = 0.045, initialAngle = 0) {
    // 旋转中心位于方块中心
    this.centerX = blockCol * 16 + 8;
    this.centerY = blockRow * 16 + 8;
    this.length = length; // 火球颗数
    this.speed = speed;   // 角速度 (正数顺时针，负数逆时针)
    this.angle = initialAngle;
    this.spacing = 8;     // 相邻火球间距
    this.animClock = 0;
  }

  update() {
    this.angle += this.speed;
    this.animClock += 0.1;
  }

  // 检测火球是否碰触马里奥 (马里奥 AABB 碰撞盒)
  checkCollision(mario) {
    if (mario.isDead || mario.invulnerableTimer > 0) return false;
    const mbLeft = mario.x;
    const mbRight = mario.x + mario.width;
    const mbTop = mario.y;
    const mbBottom = mario.y + mario.height;

    for (let i = 1; i <= this.length; i++) {
      const dist = i * this.spacing;
      const bx = this.centerX + Math.cos(this.angle) * dist;
      const by = this.centerY + Math.sin(this.angle) * dist;

      // 每颗火球 8x8，中心半径 4px
      if (bx + 3 >= mbLeft && bx - 3 <= mbRight && by + 3 >= mbTop && by - 3 <= mbBottom) {
        return true;
      }
    }
    return false;
  }

  render(ctx, cameraX) {
    const scx = this.centerX - cameraX;
    if (scx < -60 || scx > CONFIG.VIEWPORT_WIDTH + 60) return;

    // 绘制中心固定轴承黑点
    ctx.fillStyle = '#000000';
    ctx.fillRect(scx - 2, this.centerY - 2, 4, 4);

    // 绘制沿半径旋转的一串火球
    for (let i = 1; i <= this.length; i++) {
      const dist = i * this.spacing;
      const bx = this.centerX + Math.cos(this.angle) * dist;
      const by = this.centerY + Math.sin(this.angle) * dist;
      SpriteRenderer.drawFirebarBall(ctx, bx - cameraX - 4, by - 4, this.animClock);
    }
  }
}

// 9. 大魔王库巴横向飞行的炙热火球
class BowserFire {
  constructor(x, y, vx = -2.2) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.width = 24;
    this.height = 8;
    this.isDead = false;
    this.animClock = 0;
  }

  update(cameraX) {
    this.x += this.vx;
    this.animClock += 0.15;
    // 飞出屏幕左侧销毁
    if (this.x < cameraX - 40) {
      this.isDead = true;
    }
  }

  checkCollision(mario) {
    if (mario.isDead || mario.invulnerableTimer > 0) return false;
    return (
      this.x < mario.x + mario.width &&
      this.x + this.width > mario.x &&
      this.y < mario.y + mario.height &&
      this.y + this.height > mario.y
    );
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawBowserFire(ctx, this.x - cameraX, this.y, this.animClock);
  }
}

// 10. 关底终极大魔王库巴 (Bowser Boss)
class Bowser {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 28;
    this.height = 32;
    this.vx = -0.4;
    this.vy = 0;
    this.facingLeft = true;

    // 巡逻踱步边界 (在熔岩吊桥上来回巡视)
    this.startX = x;
    this.minX = x - 48;
    this.maxX = x + 16;

    this.jumpTimer = 0;
    this.roarTimer = 0;
    this.fireTimer = 0;
    this.fireCooldown = 110;
    this.isRoaring = false;
    this.isDead = false;
    this.isFallingInLava = false;
    this.animClock = 0;
  }

  // 触发断桥坠落岩浆
  dropIntoLava() {
    this.isFallingInLava = true;
    this.isDead = true;
    this.vy = -2.0; // 悬空受惊挣扎小跳然后笔直坠亡
    this.vx = 0;
  }

  update(tileMap, marioX, onSpawnFire = () => {}) {
    this.animClock += 0.05;

    // 1. 坠入熔岩处理
    if (this.isFallingInLava) {
      this.vy += 0.22;
      this.y += this.vy;
      if (this.y > CONFIG.VIEWPORT_HEIGHT + 40) {
        this.isDead = true;
      }
      return;
    }

    // 2. 正常踱步与跳跃
    this.x += this.vx;
    if (this.x <= this.minX) {
      this.x = this.minX;
      this.vx = 0.4;
    } else if (this.x >= this.maxX) {
      this.x = this.maxX;
      this.vx = -0.4;
    }

    // 面向马里奥
    this.facingLeft = marioX < this.x + 16;

    // 周期性小跳跃
    this.jumpTimer++;
    if (this.jumpTimer > 120 && Math.abs(this.vy) < 0.1) {
      this.jumpTimer = 0;
      this.vy = -3.2; // 腾空跳跃
    }

    // 重力下落与吊桥地面吸附
    this.vy += 0.25;
    if (this.vy > 4.5) this.vy = 4.5;
    this.y += this.vy;

    // 站在桥面 (吊桥在 row 11 或 12)
    const bridgeY = 11 * 16;
    if (this.y >= bridgeY) {
      this.y = bridgeY;
      this.vy = 0;
    }

    // 3. 喷吐烈焰火球机制
    this.fireTimer++;
    if (this.fireTimer >= this.fireCooldown - 25) {
      this.isRoaring = true; // 张嘴前摇
    }
    if (this.fireTimer >= this.fireCooldown) {
      this.fireTimer = 0;
      this.isRoaring = false;
      // 从嘴部生成一颗向左喷射的火球
      const fireY = this.y + 10 + (Math.random() > 0.5 ? 0 : 8);
      onSpawnFire(this.x - 16, fireY);
    }
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawBowser(
      ctx,
      this.x - cameraX,
      this.y,
      this.facingLeft,
      this.animClock,
      this.isRoaring,
      this.isFallingInLava
    );
  }
}

// 11. 终点被解救的蘑菇侍从奇诺比奥 (Toad)
class Toad {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 24;
  }

  render(ctx, cameraX) {
    SpriteRenderer.drawToad(ctx, this.x - cameraX, this.y);
  }
}
