/**
 * 史诗 Boss 战系统 (Epic Dreadnought Boss System)
 * 「毁灭母舰·雷霆终结者」：三阶段形态、警告演出、旋转弹幕、主炮粗激光、万花筒弹幕与多段爆炸演出
 */

class Boss {
    constructor(canvasWidth, canvasHeight, level = 1) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.level = level;

        this.maxHp = 3500 + level * 1000;
        this.hp = this.maxHp;
        this.name = `TITAN-DREADNOUGHT MK-${level}`;

        this.x = canvasWidth / 2;
        this.y = -180; // 从屏幕外缓缓降临
        this.targetY = 120;
        this.radius = 65; // 核心判定体积

        this.vx = 2.0;
        this.alive = true;
        this.isEntering = true;
        this.hitFlash = 0;

        // 攻击计时器
        this.timer = 0;
        this.spiralAngle = 0;
        this.phase = 1; // 1 -> 2 -> 3

        // 蓄力粗激光
        this.laser = null;

        // 死亡烟火演出
        this.isDying = false;
        this.deathTimer = 180; // 3秒多段爆炸
    }

    takeDamage(damage) {
        if (!this.alive || this.isEntering || this.isDying) return;
        this.hp -= damage;
        this.hitFlash = 4;

        // 检测阶段转换
        const hpPct = this.hp / this.maxHp;
        if (hpPct <= 0.3 && this.phase < 3) {
            this.phase = 3;
            if (window.sounds) window.sounds.playWarning();
            if (window.particles) {
                window.particles.addText('BOSS ENRAGED PHASE 3!', this.x, this.y + 60, '#ff0055', 22);
                window.particles.shockwaves.push(new Shockwave(this.x, this.y, 220, '#ff0055', 0.5));
            }
        } else if (hpPct <= 0.65 && this.phase < 2) {
            this.phase = 2;
            if (window.particles) {
                window.particles.addText('BOSS PHASE 2: LASER CHARGED!', this.x, this.y + 60, '#ffaa00', 20);
                window.particles.shockwaves.push(new Shockwave(this.x, this.y, 180, '#ffaa00', 0.5));
            }
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this.startDeathSequence();
        }
    }

    startDeathSequence() {
        this.isDying = true;
        if (this.laser) this.laser.alive = false;
        if (window.sounds) window.sounds.playExplosionLarge();
    }

    update(bounds, player, bullets) {
        if (this.hitFlash > 0) this.hitFlash--;

        // 1. 进场动画
        if (this.isEntering) {
            this.y += 1.8;
            if (this.y >= this.targetY) {
                this.isEntering = false;
            }
            return;
        }

        // 2. 死亡演出
        if (this.isDying) {
            this.deathTimer--;
            // 每隔几帧在随机部位爆炸
            if (this.deathTimer % 8 === 0 && window.particles) {
                const ex = this.x + (Math.random() - 0.5) * 120;
                const ey = this.y + (Math.random() - 0.5) * 80;
                window.particles.emitExplosion(ex, ey, '#ff3366', 20);
                if (window.sounds) window.sounds.playExplosionSmall();
            }

            if (this.deathTimer <= 0) {
                this.alive = false;
                if (window.sounds) window.sounds.playBomb();
                if (window.particles) {
                    window.particles.emitMegaExplosion(this.x, this.y);
                    window.particles.addText('VICTORY! BOSS DESTROYED!', this.canvasWidth / 2, this.canvasHeight / 2, '#00f6ff', 28);
                }
                // 掉落海量水晶与全套补给
                this.dropRewards();

                // 清理掉残余的场上普通敌机，确保平滑进阶
                if (window.game && window.game.enemies) {
                    for (let e of window.game.enemies) {
                        e.destroy();
                    }
                    window.game.enemies = [];
                }
            }
            return;
        }

        // 3. 常规移动机制
        this.x += this.vx;
        if (this.x < 110 || this.x > bounds.width - 110) {
            this.vx = -this.vx;
        }

        // 4. 激光武器更新
        if (this.laser) {
            this.laser.update(this.x, this.y + 40);
            if (this.laser.checkPlayerCollision(player)) {
                player.takeDamage(this.laser.damage);
                if (window.game) window.game.triggerShake(8, 10);
            }
            if (!this.laser.alive) {
                this.laser = null;
            }
        }

        // 5. 各阶段弹幕攻击 AI
        this.timer++;
        this.executeAttackPattern(bounds, player, bullets);
    }

    executeAttackPattern(bounds, player, bullets) {
        if (!window.EnemyBullet) return;

        // --- Phase 1: 螺旋花瓣弹幕 + 自机狙 ---
        if (this.phase === 1) {
            // 每 6 帧发射一次微度旋转弹
            if (this.timer % 6 === 0) {
                this.spiralAngle += 0.25;
                const speed = 4.2;
                bullets.push(new EnemyBullet(
                    this.x - 45, this.y + 20,
                    Math.cos(this.spiralAngle) * speed,
                    Math.sin(this.spiralAngle) * speed,
                    12, '#00d2ff', 4.5
                ));
                bullets.push(new EnemyBullet(
                    this.x + 45, this.y + 20,
                    Math.cos(-this.spiralAngle) * speed,
                    Math.sin(-this.spiralAngle) * speed,
                    12, '#00d2ff', 4.5
                ));
            }

            // 每 80 帧向玩家发射一束三向狙击弹
            if (this.timer % 80 === 0) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                [-0.2, 0, 0.2].forEach(diff => {
                    bullets.push(new EnemyBullet(
                        this.x, this.y + 40,
                        Math.cos(angle + diff) * 5.5,
                        Math.sin(angle + diff) * 5.5,
                        15, '#ff4757', 5
                    ));
                });
            }
        }

        // --- Phase 2: 蓄力主炮极光 + 连射追踪飞弹 ---
        else if (this.phase === 2) {
            // 周期性激活主炮激光
            if (this.timer % 240 === 0 && !this.laser) {
                if (window.sounds) window.sounds.playWarning();
                this.laser = new BossLaserBeam(this.x, this.y + 40, 42, 90);
            }

            // 环形 12 向扩散弹
            if (this.timer % 60 === 0) {
                const count = 12;
                for (let i = 0; i < count; i++) {
                    const a = (i * Math.PI * 2) / count + (this.timer * 0.05);
                    bullets.push(new EnemyBullet(
                        this.x, this.y + 25,
                        Math.cos(a) * 4.0,
                        Math.sin(a) * 4.0,
                        12, '#ffa502', 4.5
                    ));
                }
            }
        }

        // --- Phase 3 (暴走狂化): 万花筒全屏连射 + 极速俯冲 ---
        else if (this.phase === 3) {
            this.vx = (this.vx > 0 ? 3.5 : -3.5);

            // 高频万花筒弹幕
            if (this.timer % 4 === 0) {
                this.spiralAngle += 0.38;
                for (let i = 0; i < 4; i++) {
                    const a = this.spiralAngle + (i * Math.PI / 2);
                    bullets.push(new EnemyBullet(
                        this.x, this.y + 30,
                        Math.cos(a) * 4.8,
                        Math.sin(a) * 4.8,
                        14, '#ff0055', 5.0
                    ));
                }
            }

            // 偶尔触发主炮闪电突射
            if (this.timer % 180 === 0 && !this.laser) {
                this.laser = new BossLaserBeam(this.x, this.y + 40, 50, 70);
            }
        }
    }

    dropRewards() {
        if (!window.Item || !window.currentItems) return;
        // 满屏爆出 18 个水晶 + 2 个武器升级 + 1 个护盾 + 1 个核弹
        for (let i = 0; i < 18; i++) {
            window.currentItems.push(new Item(
                this.x + (Math.random() - 0.5) * 100,
                this.y + (Math.random() - 0.5) * 60,
                'crystal'
            ));
        }
        window.currentItems.push(new Item(this.x - 30, this.y, 'power'));
        window.currentItems.push(new Item(this.x + 30, this.y, 'power'));
        window.currentItems.push(new Item(this.x - 60, this.y + 20, 'shield'));
        window.currentItems.push(new Item(this.x + 60, this.y + 20, 'bomb'));
    }

    draw(ctx, bounds) {
        if (!this.alive) return;

        // 绘制激光
        if (this.laser) {
            this.laser.draw(ctx, bounds);
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        const glowColor = this.phase === 3 ? '#ff0055' : (this.phase === 2 ? '#ffa502' : '#00f6ff');
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;

        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#1a1e2e';
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 3;

        // 绘制巨型战列母舰轮廓 (装甲重坦风格)
        ctx.beginPath();
        ctx.moveTo(0, 48);        // 主舰艏
        ctx.lineTo(35, 25);
        ctx.lineTo(85, 30);       // 右侧重甲翼
        ctx.lineTo(105, -15);
        ctx.lineTo(80, -45);      // 右侧尾翼
        ctx.lineTo(40, -35);
        ctx.lineTo(25, -55);
        ctx.lineTo(-25, -55);
        ctx.lineTo(-40, -35);
        ctx.lineTo(-80, -45);     // 左侧尾翼
        ctx.lineTo(-105, -15);
        ctx.lineTo(-85, 30);      // 左侧重甲翼
        ctx.lineTo(-35, 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 左右高能炮台
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-52, 10, 16, 24);
        ctx.strokeRect(-52, 10, 16, 24);
        ctx.fillRect(36, 10, 16, 24);
        ctx.strokeRect(36, 10, 16, 24);

        // 核心能量反应炉 (带脉动辉光)
        const corePulse = Math.sin(Date.now() * 0.008) * 4;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + corePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

window.Boss = Boss;
