/**
 * 敌机编队与敌方单位系统 (Enemy Squadron & Combat AI)
 * 涵盖：突击侦察机、中型巡洋舰、重型装甲炮艇与极速自杀拦截机
 */

class Enemy {
    constructor(x, y, hp, scoreValue, color = '#ff3366') {
        this.x = x;
        this.y = y;
        this.hp = hp;
        this.maxHp = hp;
        this.scoreValue = scoreValue;
        this.color = color;
        this.alive = true;
        this.hitFlash = 0; // 受击闪白计时
        this.radius = 16;
        this.shootTimer = Math.floor(Math.random() * 30);
        this.killedByPlayer = false;
    }

    takeDamage(damage, fromPlayer = true) {
        if (!this.alive) return;
        this.hp -= damage;
        this.hitFlash = 4; // 闪白4帧

        if (this.hp <= 0) {
            this.hp = 0;
            this.killedByPlayer = fromPlayer;
            this.destroy();
        }
    }

    destroy() {
        this.alive = false;
        if (window.sounds) window.sounds.playExplosionSmall();
        if (window.particles) window.particles.emitExplosion(this.x, this.y, this.color, 24);

        // 如果被玩家消灭，同步战功与连击
        if (this.killedByPlayer && window.game) {
            window.game.onEnemyKilled(this);
        }

        // 掉落逻辑
        this.dropItems();
    }

    dropItems() {
        if (!window.Item || !window.currentItems) return;

        // 1. 必掉或高概率掉落战力水晶
        const crystalCount = this.scoreValue >= 500 ? 3 : 1;
        for (let i = 0; i < crystalCount; i++) {
            window.currentItems.push(new Item(
                this.x + (Math.random() - 0.5) * 20,
                this.y + (Math.random() - 0.5) * 20,
                'crystal'
            ));
        }

        // 2. 补给徽章掉落概率
        const roll = Math.random();
        if (roll < 0.12) {
            // 武器强化
            window.currentItems.push(new Item(this.x, this.y, 'power'));
        } else if (roll < 0.19) {
            // 护盾修复
            window.currentItems.push(new Item(this.x, this.y, 'shield'));
        } else if (roll < 0.22) {
            // 核弹补充
            window.currentItems.push(new Item(this.x, this.y, 'bomb'));
        }
    }

    update(bounds, player, bullets) {
        if (this.hitFlash > 0) this.hitFlash--;
        // 严谨的四向全越界检测，避免自杀机或特殊航线逸出无限远
        if (
            this.x < -80 ||
            this.x > bounds.width + 80 ||
            this.y < -80 ||
            this.y > bounds.height + 80
        ) {
            this.alive = false;
        }
    }

    draw(ctx) {
        // 子类继承重写
    }
}

// 1. 小型突击蜂 (ScoutFighter)
class ScoutFighter extends Enemy {
    constructor(x, y, trajectory = 'straight') {
        super(x, y, 40, 100, '#ff4757');
        this.trajectory = trajectory;
        this.radius = 14;
        this.speed = 3.6;
        this.angle = 0;
        this.originX = x;
    }

    update(bounds, player, bullets) {
        super.update(bounds, player, bullets);
        this.y += this.speed;

        if (this.trajectory === 'sine') {
            this.angle += 0.05;
            this.x = this.originX + Math.sin(this.angle) * 70;
        }

        // 偶尔点射一发子弹
        this.shootTimer++;
        if (this.shootTimer > 90) {
            this.shootTimer = 0;
            if (this.y > 40 && this.y < bounds.height - 150) {
                bullets.push(new EnemyBullet(this.x, this.y + 10, 0, 5, 10, '#ff3366', 4));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 优先使用高清精美敌机贴图
        const img = window.assets && window.assets.getImage('enemy_scout', this.hitFlash > 0);
        if (img) {
            const size = 38;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 6;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#2f3542';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(14, -12);
        ctx.lineTo(4, -6);
        ctx.lineTo(0, -14);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-14, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

// 2. 中型巡航舰 (Cruiser)
class Cruiser extends Enemy {
    constructor(x, y) {
        super(x, y, 160, 300, '#eccc68');
        this.radius = 24;
        this.targetY = 100 + Math.random() * 120;
        this.hovering = false;
        this.hoverTimer = 240; // 悬停4秒后撤离
        this.vx = Math.random() > 0.5 ? 1.5 : -1.5;
    }

    update(bounds, player, bullets) {
        super.update(bounds, player, bullets);

        if (!this.hovering) {
            this.y += 2.5;
            if (this.y >= this.targetY) {
                this.hovering = true;
            }
        } else {
            this.x += this.vx;
            if (this.x < 50 || this.x > bounds.width - 50) {
                this.vx = -this.vx;
            }
            this.hoverTimer--;
            if (this.hoverTimer <= 0) {
                this.y += 3.5; // 加速撤离
            }
        }

        // 扇形三向开火
        this.shootTimer++;
        if (this.shootTimer > 80 && this.hovering) {
            this.shootTimer = 0;
            const spread = [-0.25, 0, 0.25];
            for (let a of spread) {
                bullets.push(new EnemyBullet(
                    this.x, this.y + 16,
                    Math.sin(a) * 4.5, Math.cos(a) * 4.5,
                    12, '#ffa502', 4.5
                ));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 优先使用高清精美巡航舰贴图
        const img = window.assets && window.assets.getImage('enemy_cruiser', this.hitFlash > 0);
        if (img) {
            const size = 58;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#1e272e';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        // 重型六边形舰体 (Fallback)
        ctx.beginPath();
        ctx.moveTo(0, 24);
        ctx.lineTo(24, 6);
        ctx.lineTo(18, -20);
        ctx.lineTo(-18, -20);
        ctx.lineTo(-24, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 双能量喷口
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(-10, -22, 5, 4);
        ctx.fillRect(5, -22, 5, 4);

        ctx.restore();
    }
}

// 3. 重型突击炮艇 (Gunship)
class Gunship extends Enemy {
    constructor(x, y) {
        super(x, y, 320, 600, '#a55eea');
        this.radius = 32;
        this.vx = (Math.random() - 0.5) * 1.8;
        this.vy = 1.2;
        this.spiralAngle = 0;
    }

    update(bounds, player, bullets) {
        super.update(bounds, player, bullets);
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 60 || this.x > bounds.width - 60) {
            this.vx = -this.vx;
        }

        // 周期性发射自机狙 + 旋转花式弹
        this.shootTimer++;
        if (this.shootTimer > 60 && this.y > 50 && this.y < bounds.height - 120) {
            this.shootTimer = 0;

            // 1. 自机狙击弹 (瞄准玩家位置)
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new EnemyBullet(
                this.x, this.y + 20,
                Math.cos(angleToPlayer) * 5.5,
                Math.sin(angleToPlayer) * 5.5,
                15, '#ff0055', 5.5
            ));

            // 2. 双侧螺旋弹
            this.spiralAngle += 0.4;
            bullets.push(new EnemyBullet(
                this.x - 20, this.y,
                Math.cos(this.spiralAngle) * 3.5,
                Math.sin(this.spiralAngle) * 3.5,
                10, '#9b59b6', 4
            ));
            bullets.push(new EnemyBullet(
                this.x + 20, this.y,
                Math.cos(this.spiralAngle + Math.PI) * 3.5,
                Math.sin(this.spiralAngle + Math.PI) * 3.5,
                10, '#9b59b6', 4
            ));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 优先使用高清精美装甲炮艇贴图
        const img = window.assets && window.assets.getImage('enemy_gunship', this.hitFlash > 0);
        if (img) {
            const size = 76;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#2c2c54';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        // 堡垒机身构造 (Fallback)
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(26, 12);
        ctx.lineTo(34, -10);
        ctx.lineTo(16, -26);
        ctx.lineTo(-16, -26);
        ctx.lineTo(-34, -10);
        ctx.lineTo(-26, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 核心能量反应堆
        ctx.fillStyle = '#a55eea';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// 4. 自杀突袭机 (Kamikaze)
class Kamikaze extends Enemy {
    constructor(x, y, player) {
        super(x, y, 60, 200, '#ff1744');
        this.radius = 14;
        this.state = 'aiming'; // 'aiming' -> 'charging'
        this.aimTimer = 35;
        this.chargeVx = 0;
        this.chargeVy = 0;
        this.targetAngle = 0;
    }

    update(bounds, player, bullets) {
        super.update(bounds, player, bullets);

        if (this.state === 'aiming') {
            this.y += 1.8;
            this.aimTimer--;
            this.targetAngle = Math.atan2(player.y - this.y, player.x - this.x);

            if (this.aimTimer <= 0) {
                this.state = 'charging';
                const speed = 9.0;
                this.chargeVx = Math.cos(this.targetAngle) * speed;
                this.chargeVy = Math.sin(this.targetAngle) * speed;
            }
        } else {
            // 极速冲撞！
            this.x += this.chargeVx;
            this.y += this.chargeVy;

            // 冲刺拖尾粒子
            if (window.particles && Math.random() < 0.6) {
                window.particles.particles.push(new Particle(
                    this.x, this.y,
                    -this.chargeVx * 0.2, -this.chargeVy * 0.2,
                    '#ff1744', 3, 0.4, 0.08
                ));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const rot = this.state === 'charging' ? this.targetAngle - Math.PI / 2 : 0;
        ctx.rotate(rot);

        // 优先使用高清精美自杀机贴图
        const img = window.assets && window.assets.getImage('enemy_kamikaze', this.hitFlash > 0);
        if (img) {
            const size = 38;
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 10;
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#3d0c11';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;

        // 箭头尖刺形态 (Fallback)
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(12, -14);
        ctx.lineTo(0, -6);
        ctx.lineTo(-12, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

window.Enemy = Enemy;
window.ScoutFighter = ScoutFighter;
window.Cruiser = Cruiser;
window.Gunship = Gunship;
window.Kamikaze = Kamikaze;
