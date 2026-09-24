/**
 * 战利品掉落与补给道具系统 (Drop Items & Power-ups)
 * 包括：武器升级(P)、护盾恢复(S)、雷霆核弹(B)、战力能量水晶(★)
 */

class Item {
    constructor(x, y, type = 'crystal') {
        this.x = x;
        this.y = y;
        this.type = type; // 'crystal', 'power', 'shield', 'bomb'
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = Math.random() * 1.5 + 1.2;
        this.radius = 12;
        this.alive = true;
        this.angle = 0;
        this.magnetDistance = 160; // 磁吸距离
        this.magnetSpeed = 8;

        if (this.type === 'crystal') {
            this.color = '#00f6ff';
            this.label = '★';
        } else if (this.type === 'power') {
            this.color = '#ffcc00';
            this.label = 'P';
        } else if (this.type === 'shield') {
            this.color = '#00ff88';
            this.label = 'S';
        } else if (this.type === 'bomb') {
            this.color = '#ff3366';
            this.label = 'B';
        }
    }

    update(bounds, player) {
        // 磁吸效应：当玩家靠近（或暴走状态全屏磁吸）时加速飞向玩家
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        const shouldMagnet = dist < this.magnetDistance || (player.isRage && this.type === 'crystal');

        if (shouldMagnet) {
            if (dist > 1) {
                this.vx = (dx / dist) * this.magnetSpeed;
                this.vy = (dy / dist) * this.magnetSpeed;
            } else {
                this.x = player.x;
                this.y = player.y;
                this.vx = 0;
                this.vy = 0;
            }
        } else {
            // 轻微正弦摆动缓缓下落
            this.vy = Math.min(2.5, this.vy + 0.02);
            this.x += Math.sin(this.angle) * 0.5;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.angle += 0.05;

        // 边界碰撞轻微回弹
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx);
        } else if (this.x > bounds.width - this.radius) {
            this.x = bounds.width - this.radius;
            this.vx = -Math.abs(this.vx);
        }

        if (this.y > bounds.height + 40) {
            this.alive = false;
        }
    }

    applyEffect(player) {
        if (this.type === 'crystal') {
            player.score += 200;
            player.addRage(6);
            if (window.sounds) window.sounds.playPickupCrystal();
            if (window.particles) window.particles.addText('+200', this.x, this.y, '#00f6ff', 14);
        } else if (this.type === 'power') {
            player.upgradeWeapon();
            if (window.sounds) window.sounds.playPowerUp();
            if (window.particles) window.particles.addText('WEAPON UP!', this.x, this.y, '#ffcc00', 18);
        } else if (this.type === 'shield') {
            player.restoreShield(40);
            if (window.sounds) window.sounds.playPowerUp();
            if (window.particles) window.particles.addText('SHIELD REPAIR!', this.x, this.y, '#00ff88', 18);
        } else if (this.type === 'bomb') {
            player.addBomb();
            if (window.sounds) window.sounds.playPowerUp();
            if (window.particles) window.particles.addText('+1 THUNDER BOMB!', this.x, this.y, '#ff3366', 18);
        }
        this.alive = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // 旋转发光边框
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // 绘制八边形勋章或晶体
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const a = (i * Math.PI * 2) / sides + this.angle;
            const px = Math.cos(a) * this.radius;
            const py = Math.sin(a) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 核心文字徽标
        ctx.fillStyle = this.color;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, 0, 1);

        ctx.restore();
    }
}

window.Item = Item;
