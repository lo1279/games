/**
 * 玩家战机与僚机系统 (Player Fighter & Wingmen System)
 * 经典雷霆战机机体模型、武器进阶升级、暴走形态、僚机协防与核弹大招
 */

class Wingman {
    constructor(offsetX, offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.x = 0;
        this.y = 0;
        this.shootTimer = 0;
    }

    update(playerX, playerY) {
        // 平滑跟随在玩家侧后方
        this.x += (playerX + this.offsetX - this.x) * 0.25;
        this.y += (playerY + this.offsetY - this.y) * 0.25;
    }

    draw(ctx, isRage = false) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 优先使用高清贴图
        const wingmanImg = window.assets && window.assets.getImage('wingman');
        if (wingmanImg) {
            const size = 26;
            ctx.shadowColor = isRage ? '#ff0055' : '#00f6ff';
            ctx.shadowBlur = 8;
            ctx.drawImage(wingmanImg, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.fillStyle = isRage ? '#ff0055' : '#00f6ff';
        ctx.shadowColor = isRage ? '#ff0055' : '#00f6ff';
        ctx.shadowBlur = 8;

        // 浮游机菱形构造 (Fallback)
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(7, 4);
        ctx.lineTo(0, 10);
        ctx.lineTo(-7, 4);
        ctx.closePath();
        ctx.fill();

        // 核心发光点
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Player {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.reset();
    }

    reset() {
        this.x = this.canvasWidth / 2;
        this.y = this.canvasHeight - 120;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.speed = 7;
        this.radius = 16; // 核心判定体积

        // 战机属性
        this.maxHp = 100;
        this.hp = 100;
        this.maxShield = 100;
        this.shield = 100;
        this.shieldHitTimer = 0; // 护盾受击蜂窝矩阵激发计时
        this.bombs = 2; // 初始核弹
        this.score = 0;

        // 武器养成
        this.weaponLevel = 1; // 1 ~ 5
        this.shootInterval = 10; // 射击帧间隔
        this.shootTimer = 0;
        this.missileTimer = 0;

        // 暴走状态
        this.rage = 0; // 0 ~ 100
        this.isRage = false;
        this.rageDuration = 0; // 暴走持续帧数

        // 无敌闪烁与受击
        this.invincibleTimer = 0;
        this.alive = true;

        // 僚机
        this.wingmen = [
            new Wingman(-36, 20),
            new Wingman(36, 20)
        ];

        // 操控模式
        this.autoFire = true;
        this.isShooting = true;
    }

    upgradeWeapon() {
        if (this.weaponLevel < 4) {
            this.weaponLevel++;
        } else {
            // 已经是高阶，直接激发暴走
            this.triggerRage();
        }
    }

    addRage(amount) {
        if (this.isRage) return;
        this.rage = Math.min(100, this.rage + amount);
        if (this.rage >= 100) {
            this.triggerRage();
        }
    }

    triggerRage() {
        this.isRage = true;
        this.rage = 100;
        this.rageDuration = 600; // 暴走约 10 秒
        if (window.sounds) window.sounds.playHeavyLaser();
        if (window.particles) {
            window.particles.addText('MAX BERSERK RAGE!', this.x, this.y - 40, '#ff0055', 24);
            window.particles.shockwaves.push(new Shockwave(this.x, this.y, 200, '#ff0055', 0.5));
        }
    }

    restoreShield(amount) {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }

    addBomb() {
        this.bombs = Math.min(5, this.bombs + 1);
    }

    takeDamage(amount) {
        if (this.invincibleTimer > 0 || !this.alive) return;

        if (this.shield > 0) {
            this.shield -= amount;
            this.shieldHitTimer = 18; // 激发蜂窝护盾高能电弧脉冲
            if (window.sounds) window.sounds.playShieldHit();
            if (this.shield < 0) {
                this.hp += this.shield; // 剩余穿透到生命值
                this.shield = 0;
            }
        } else {
            this.hp -= amount;
            if (window.sounds) window.sounds.playExplosionSmall();
        }

        // 短暂无敌与闪烁
        this.invincibleTimer = 60; // 1秒无敌

        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
            if (window.sounds) window.sounds.playExplosionLarge();
            if (window.particles) window.particles.emitMegaExplosion(this.x, this.y);
        }
    }

    // 释放雷霆 EMP 必杀核弹
    useBomb(bullets, enemies, boss) {
        if (this.bombs <= 0 || !this.alive) return false;
        this.bombs--;

        if (window.sounds) window.sounds.playBomb();
        if (window.particles) {
            window.particles.shockwaves.push(new Shockwave(this.x, this.y, 450, '#ff0055', 0.8));
            window.particles.shockwaves.push(new Shockwave(this.x, this.y, 350, '#00ffff', 0.6));
            window.particles.addText('THUNDER EMP BOMB!', this.canvasWidth / 2, this.canvasHeight / 2, '#ff0055', 32);
        }

        // 1. 清空所有敌方普通弹幕并转化为分数水晶
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (!bullets[i].isPlayer) {
                if (window.Item && Math.random() < 0.35) {
                    window.currentItems && window.currentItems.push(new Item(bullets[i].x, bullets[i].y, 'crystal'));
                }
                bullets.splice(i, 1);
            }
        }

        // 2. 对所有普通敌机造成毁灭性打击 (传参 true 保证计入 kills 与加分)
        for (let enemy of enemies) {
            if (enemy.alive) {
                enemy.takeDamage(1200, true);
            }
        }

        // 3. 对 Boss 造成巨量削减
        if (boss && boss.alive) {
            boss.takeDamage(1500);
        }

        // 赋予玩家短暂无敌
        this.invincibleTimer = 120;
        return true;
    }

    update(keys, mousePos, touchPos, bullets, enemies, bounds = { width: this.canvasWidth, height: this.canvasHeight }) {
        if (!this.alive) return;

        // 1. 移动逻辑 (多输入源协同：手机端优先采用防遮挡相对位移微操)
        let moveX = 0;
        let moveY = 0;
        if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
            // 键盘处于活跃状态，抑制鼠标吸附干扰
            if (mousePos) mousePos.active = false;
            const len = Math.hypot(moveX, moveY);
            this.x += (moveX / len) * this.speed;
            this.y += (moveY / len) * this.speed;
        } else if (touchPos && touchPos.active) {
            // 手机端防遮挡微操：根据手指滑动的相对偏移量机动
            if (touchPos.deltaX !== 0 || touchPos.deltaY !== 0) {
                this.x += touchPos.deltaX * 1.1;
                this.y += touchPos.deltaY * 1.1;
                // 消耗本帧位移
                touchPos.deltaX = 0;
                touchPos.deltaY = 0;
            }
        } else if (mousePos && mousePos.active) {
            // PC 端鼠标跟随
            this.x += (mousePos.x - this.x) * 0.22;
            this.y += (mousePos.y - this.y) * 0.22;
        }

        // 动态全屏边界限制
        this.canvasWidth = bounds.width;
        this.canvasHeight = bounds.height;
        this.x = Math.max(26, Math.min(bounds.width - 26, this.x));
        this.y = Math.max(35, Math.min(bounds.height - 35, this.y));

        // 2. 尾焰喷射
        if (window.particles) {
            window.particles.emitThruster(this.x - 10, this.y + 24, '#00f6ff', this.isRage);
            window.particles.emitThruster(this.x + 10, this.y + 24, '#00f6ff', this.isRage);
        }

        // 3. 僚机更新
        for (let w of this.wingmen) {
            w.update(this.x, this.y);
        }

        // 4. 暴走时钟倒计时
        if (this.isRage) {
            this.rageDuration--;
            this.rage = (this.rageDuration / 600) * 100;
            if (this.rageDuration <= 0) {
                this.isRage = false;
                this.rage = 0;
            }
        }

        // 5. 无敌闪烁计时与护盾受击反馈
        if (this.invincibleTimer > 0) {
            this.invincibleTimer--;
        }
        if (this.shieldHitTimer > 0) {
            this.shieldHitTimer--;
        }

        // 6. 自动/手动开火逻辑
        const shouldFire = this.autoFire || this.isShooting || keys['Space'];
        if (shouldFire) {
            this.shootTimer++;
            const currentInterval = this.isRage ? 5 : (this.weaponLevel >= 4 ? 7 : this.shootInterval);
            if (this.shootTimer >= currentInterval) {
                this.shootTimer = 0;
                this.fireWeapons(bullets, enemies);
            }
        }

        // 7. 追踪导弹发射节奏
        if (this.weaponLevel >= 3 || this.isRage) {
            this.missileTimer++;
            const missileInterval = this.isRage ? 18 : 36;
            if (this.missileTimer >= missileInterval) {
                this.missileTimer = 0;
                this.fireMissiles(bullets, enemies);
            }
        }
    }

    fireWeapons(bullets, enemies) {
        if (!window.Bullet) return;

        // 暴走形态：全屏加特林 + 穿透极光
        if (this.isRage) {
            if (window.sounds) window.sounds.playHeavyLaser();
            // 中央强力双光束
            bullets.push(new LaserBeam(this.x - 12, this.y - 15, 30, true));
            bullets.push(new LaserBeam(this.x + 12, this.y - 15, 30, true));

            // 扇形八向弹幕
            const spreadAngles = [-0.35, -0.22, -0.1, 0.1, 0.22, 0.35];
            for (let a of spreadAngles) {
                bullets.push(new Bullet(
                    this.x, this.y - 10,
                    Math.sin(a) * 16, -Math.cos(a) * 16,
                    true, 18, '#ff0055', 4.5
                ));
            }
            // 僚机齐射
            for (let w of this.wingmen) {
                bullets.push(new Bullet(w.x, w.y - 8, 0, -18, true, 16, '#00ffff', 4));
            }
            return;
        }

        // 普通形态根据等级阶梯发射
        if (this.weaponLevel === 1) {
            if (window.sounds) window.sounds.playLaser();
            bullets.push(new Bullet(this.x - 8, this.y - 12, 0, -16, true, 15, '#00f6ff', 4));
            bullets.push(new Bullet(this.x + 8, this.y - 12, 0, -16, true, 15, '#00f6ff', 4));
        } else if (this.weaponLevel === 2) {
            if (window.sounds) window.sounds.playLaser();
            bullets.push(new Bullet(this.x - 14, this.y - 10, -1, -16, true, 16, '#00f6ff', 4));
            bullets.push(new Bullet(this.x - 5, this.y - 14, 0, -17, true, 16, '#00f6ff', 4));
            bullets.push(new Bullet(this.x + 5, this.y - 14, 0, -17, true, 16, '#00f6ff', 4));
            bullets.push(new Bullet(this.x + 14, this.y - 10, 1, -16, true, 16, '#00f6ff', 4));
        } else if (this.weaponLevel === 3) {
            if (window.sounds) window.sounds.playLaser();
            bullets.push(new Bullet(this.x, this.y - 18, 0, -18, true, 20, '#ffea00', 5));
            bullets.push(new Bullet(this.x - 12, this.y - 12, -2.5, -16, true, 16, '#00f6ff', 4));
            bullets.push(new Bullet(this.x + 12, this.y - 12, 2.5, -16, true, 16, '#00f6ff', 4));
            // 僚机发射
            for (let w of this.wingmen) {
                bullets.push(new Bullet(w.x, w.y - 6, 0, -16, true, 14, '#00f6ff', 3.5));
            }
        } else if (this.weaponLevel >= 4) {
            if (window.sounds) window.sounds.playHeavyLaser();
            // 双穿透激光束
            bullets.push(new LaserBeam(this.x - 10, this.y - 15, 26, false));
            bullets.push(new LaserBeam(this.x + 10, this.y - 15, 26, false));
            // 侧翼扇形弹
            bullets.push(new Bullet(this.x - 20, this.y - 6, -3.5, -15, true, 16, '#ffcc00', 4));
            bullets.push(new Bullet(this.x + 20, this.y - 6, 3.5, -15, true, 16, '#ffcc00', 4));
            // 僚机发射
            for (let w of this.wingmen) {
                bullets.push(new Bullet(w.x, w.y - 6, 0, -17, true, 16, '#00ffff', 4));
            }
        }
    }

    fireMissiles(bullets, enemies) {
        if (!window.HomingMissile) return;
        if (window.sounds) window.sounds.playMissile();
        bullets.push(new HomingMissile(this.x - 24, this.y + 5, null, 35));
        bullets.push(new HomingMissile(this.x + 24, this.y + 5, null, 35));
    }

    draw(ctx) {
        if (!this.alive) return;

        // 受击无敌闪烁 (偶数帧透明)
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
            return;
        }

        // 绘制僚机 (武器等级 >= 3 或暴走显现)
        if (this.weaponLevel >= 3 || this.isRage) {
            for (let w of this.wingmen) {
                w.draw(ctx, this.isRage);
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        const mainColor = this.isRage ? '#ff0055' : '#00f6ff';
        const spriteKey = this.isRage ? 'player_rage' : 'player';
        const isFlash = (this.invincibleTimer > 0 && this.invincibleTimer % 4 < 2);

        // 优先使用高清精美战机贴图渲染
        if (window.assets && window.assets.isLoaded(spriteKey)) {
            const img = window.assets.getImage(spriteKey, isFlash);
            if (img) {
                const size = this.isRage ? 74 : 68;
                ctx.shadowColor = mainColor;
                ctx.shadowBlur = this.isRage ? 18 : 10;
                ctx.drawImage(img, -size / 2, -size / 2, size, size);

                // 护盾发生器高科技蜂窝能量力场
                if (this.shield > 0) {
                    this.drawEnergyShield(ctx, this.isRage ? 45 : 40);
                }

                ctx.restore();
                return;
            }
        }

        // ================= Fallback 矢量几何绘制 =================
        const bodyColor = '#161d2d';
        const wingColor = '#243049';

        ctx.shadowColor = mainColor;
        ctx.shadowBlur = this.isRage ? 16 : 8;

        // 1. 战机双主翼 (高科技战机几何多边形)
        ctx.fillStyle = wingColor;
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, -28); // 尖锐机鼻
        ctx.lineTo(12, -6);
        ctx.lineTo(34, 14); // 右翼尖
        ctx.lineTo(24, 20);
        ctx.lineTo(12, 16);
        ctx.lineTo(6, 26);  // 右引擎
        ctx.lineTo(-6, 26); // 左引擎
        ctx.lineTo(-12, 16);
        ctx.lineTo(-24, 20);
        ctx.lineTo(-34, 14); // 左翼尖
        ctx.lineTo(-12, -6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. 机身中心甲板
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(8, -2);
        ctx.lineTo(8, 16);
        ctx.lineTo(-8, 16);
        ctx.lineTo(-8, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. 驾驶舱流光全息晶体 (Cockpit)
        const cockpitGrad = ctx.createLinearGradient(0, -18, 0, 4);
        cockpitGrad.addColorStop(0, '#ffffff');
        cockpitGrad.addColorStop(0.5, mainColor);
        cockpitGrad.addColorStop(1, 'rgba(0, 50, 100, 0.4)');

        ctx.fillStyle = cockpitGrad;
        ctx.beginPath();
        ctx.ellipse(0, -6, 4.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4. 机翼高能导流能量线
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16, 2);
        ctx.lineTo(-26, 12);
        ctx.moveTo(16, 2);
        ctx.lineTo(26, 12);
        ctx.stroke();

        // 5. 护盾发生器高科技蜂窝能量力场
        if (this.shield > 0) {
            this.drawEnergyShield(ctx, 38);
        }

        ctx.restore();
    }

    // 绘制现代科幻战机蜂窝能量偏折护盾 (取代简陋生硬圆圈)
    drawEnergyShield(ctx, radius) {
        ctx.save();
        const time = Date.now() * 0.003;
        const shieldRatio = this.shield / this.maxShield;
        const isHit = this.shieldHitTimer > 0;
        const baseColor = this.isRage ? '255, 0, 85' : '0, 240, 255';

        // 1. 柔和通透的边缘径向离子微光 (内部通透，绝不遮挡机体细节)
        const glowAlpha = isHit 
            ? 0.45 
            : (0.06 + shieldRatio * 0.08 + Math.sin(time * 2) * 0.03);
        const grad = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.15);
        grad.addColorStop(0, `rgba(${baseColor}, 0)`);
        grad.addColorStop(0.7, `rgba(${baseColor}, ${glowAlpha * 0.5})`);
        grad.addColorStop(1, `rgba(${baseColor}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 2. 旋转的六边形力场发生锚点与能量环线
        const hexAngleOffset = time * 0.5;
        const lineAlpha = isHit 
            ? (0.6 + (this.shieldHitTimer / 18) * 0.35) 
            : (0.15 + shieldRatio * 0.15 + Math.sin(time * 3) * 0.05);

        ctx.strokeStyle = `rgba(${baseColor}, ${lineAlpha})`;
        ctx.lineWidth = isHit ? 2.2 : 1.2;
        ctx.shadowColor = `rgb(${baseColor})`;
        ctx.shadowBlur = isHit ? 14 : 5;

        // 绘制正六边形偏折偏振网
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = hexAngleOffset + (i * Math.PI) / 3;
            const hx = Math.cos(angle) * radius;
            const hy = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();

        // 3. 六个微型能量发生器节点 (Emitter Nodes)
        for (let i = 0; i < 6; i++) {
            const angle = hexAngleOffset + (i * Math.PI) / 3;
            const hx = Math.cos(angle) * radius;
            const hy = Math.sin(angle) * radius;

            ctx.fillStyle = isHit ? '#ffffff' : `rgba(${baseColor}, ${lineAlpha + 0.3})`;
            ctx.beginPath();
            ctx.arc(hx, hy, isHit ? 2.5 : 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. 受击激发的蜂窝晶格力场网 (Hexagonal Lattice Flash)
        if (isHit) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.shieldHitTimer / 20})`;
            ctx.lineWidth = 1.5;
            // 内部小六边形晶格折射
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = -hexAngleOffset + (i * Math.PI) / 3;
                const hx = Math.cos(angle) * (radius * 0.55);
                const hy = Math.sin(angle) * (radius * 0.55);
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }
}

window.Player = Player;
