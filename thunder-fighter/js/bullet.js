/**
 * 子弹与弹幕系统 (Bullet & Bullet Hell System)
 * 涵盖玩家等离子弹、激光束、追踪导弹及敌方各型花式弹幕
 */

class Bullet {
    constructor(x, y, vx, vy, isPlayer = true, damage = 10, color = '#00f0ff', radius = 4) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.isPlayer = isPlayer;
        this.damage = damage;
        this.color = color;
        this.radius = radius;
        this.alive = true;
        this.piercing = false;
        this.hitEntities = new Set();
    }

    update(bounds) {
        this.x += this.vx;
        this.y += this.vy;

        // 越界回收
        if (
            this.x < -40 ||
            this.x > bounds.width + 40 ||
            this.y < -40 ||
            this.y > bounds.height + 40
        ) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 1. 玩家高能激光束子弹 (长条形穿透弹)
class LaserBeam extends Bullet {
    constructor(x, y, damage = 25, isRage = false) {
        super(x, y, 0, -22, true, damage, isRage ? '#ff0055' : '#00f6ff', 8);
        this.height = 36;
        this.width = isRage ? 12 : 8;
        this.piercing = true;
        this.isRage = isRage;
    }

    // 精确的矩形-圆形/盒装包围盒碰撞检测，彻底根除长条激光穿模假空枪
    checkHit(target) {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        // 查找目标最近点
        const closestX = Math.max(this.x - halfW, Math.min(target.x, this.x + halfW));
        const closestY = Math.max(this.y - halfH, Math.min(target.y, this.y + halfH));
        const distX = target.x - closestX;
        const distY = target.y - closestY;
        return (distX * distX + distY * distY) < (target.radius * target.radius);
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        
        // 外层流光
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - this.width / 2 - 1, this.y - this.height / 2 - 2, this.width + 2, this.height + 4);
        ctx.restore();
    }
}

// 2. 玩家自动追踪导弹 (微型自寻导弹)
class HomingMissile extends Bullet {
    constructor(x, y, target = null, damage = 35) {
        super(x, y, (Math.random() - 0.5) * 4, -6, true, damage, '#ffaa00', 4);
        this.target = target;
        this.speed = 10;
        this.turnRate = 0.12;
        this.angle = -Math.PI / 2;
        this.smokeTimer = 0;
    }

    update(bounds, enemies) {
        // 动态索敌：若目标已死亡或离开，重新寻找最近存活敌机
        if (!this.target || !this.target.alive) {
            let minDist = Infinity;
            let closest = null;
            for (let e of enemies) {
                if (e.alive && e.y > 0 && e.y < bounds.height) {
                    const dist = Math.hypot(e.x - this.x, e.y - this.y);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = e;
                    }
                }
            }
            this.target = closest;
        }

        // 导弹向目标偏转
        if (this.target && this.target.alive) {
            const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = targetAngle - this.angle;
            // 归一化角差到 [-PI, PI]
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += Math.max(-this.turnRate, Math.min(this.turnRate, diff));
        }

        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;

        this.x += this.vx;
        this.y += this.vy;

        // 喷射烟雾粒子
        this.smokeTimer++;
        if (this.smokeTimer % 2 === 0 && window.particles) {
            window.particles.particles.push(new Particle(
                this.x - Math.cos(this.angle) * 8,
                this.y - Math.sin(this.angle) * 8,
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                '#888888',
                2.5,
                0.6,
                0.05
            ));
        }

        if (
            this.x < -40 ||
            this.x > bounds.width + 40 ||
            this.y < -40 ||
            this.y > bounds.height + 40
        ) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.fillStyle = '#ff3300';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8;
        // 绘制微型导弹体
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(3, 4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// 3. 敌机弹幕 (可变色，可带发光光晕)
class EnemyBullet extends Bullet {
    constructor(x, y, vx, vy, damage = 15, color = '#ff3366', radius = 4.5) {
        super(x, y, vx, vy, false, damage, color, radius);
    }

    draw(ctx) {
        ctx.save();
        // 外发光环
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // 核心亮点
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 4. Boss 蓄力粗激光束 (持续照射判定，带内置攻击频率)
class BossLaserBeam {
    constructor(x, y, width = 36, duration = 120, maxDuration = 180) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.chargeTime = 60; // 蓄力阶段 (红线预警)
        this.activeTime = duration; // 射击发射阶段
        this.elapsed = 0;
        this.alive = true;
        this.isPlayer = false;
        this.damage = 18; // 每次判定造成强力打击
        this.hitCooldown = 0; // 内置伤害 CD
    }

    update(bossX, bossY) {
        this.x = bossX;
        this.y = bossY;
        this.elapsed++;
        if (this.hitCooldown > 0) this.hitCooldown--;
        if (this.elapsed > this.chargeTime + this.activeTime) {
            this.alive = false;
        }
    }

    isFiring() {
        return this.elapsed >= this.chargeTime && this.alive;
    }

    checkPlayerCollision(player) {
        if (!this.isFiring()) return false;
        const halfW = this.width / 2;
        const inside = (
            player.x >= this.x - halfW - player.radius &&
            player.x <= this.x + halfW + player.radius &&
            player.y >= this.y
        );

        if (inside && this.hitCooldown <= 0) {
            this.hitCooldown = 15; // 每 15 帧（约 250ms）造成一次重击
            return true;
        }
        return false;
    }

    draw(ctx, bounds) {
        if (!this.alive) return;
        ctx.save();
        if (this.elapsed < this.chargeTime) {
            // 预警阶段：虚线红线 / 闪烁微光
            const alpha = (Math.sin(this.elapsed * 0.3) + 1) * 0.4 + 0.2;
            ctx.strokeStyle = `rgba(255, 30, 60, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, bounds.height);
            ctx.stroke();
        } else {
            // 发射阶段：高能全屏通天粗光柱
            const beamAlpha = Math.min(1.0, (this.chargeTime + this.activeTime - this.elapsed) / 20);
            ctx.globalAlpha = beamAlpha;

            // 外围能量辉光
            const grad = ctx.createLinearGradient(this.x - this.width / 2, 0, this.x + this.width / 2, 0);
            grad.addColorStop(0, 'rgba(255, 0, 80, 0)');
            grad.addColorStop(0.2, 'rgba(255, 0, 100, 0.7)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
            grad.addColorStop(0.8, 'rgba(255, 0, 100, 0.7)');
            grad.addColorStop(1, 'rgba(255, 0, 80, 0)');

            ctx.fillStyle = grad;
            ctx.fillRect(this.x - this.width / 2, this.y, this.width, bounds.height - this.y);

            // 核心白光
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - this.width * 0.2, this.y, this.width * 0.4, bounds.height - this.y);
        }
        ctx.restore();
    }
}

window.Bullet = Bullet;
window.LaserBeam = LaserBeam;
window.HomingMissile = HomingMissile;
window.EnemyBullet = EnemyBullet;
window.BossLaserBeam = BossLaserBeam;
