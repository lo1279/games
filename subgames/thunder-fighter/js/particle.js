/**
 * 粒子与特效引擎 (Particle & FX System)
 * 提供爆炸、尾焰、冲击波、击中火花和浮动提示文字等高质感视觉特效
 */
class Particle {
    constructor(x, y, vx, vy, color, size, life, decay = 0.02, shape = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.baseSize = size;
        this.life = life; // 0 ~ 1
        this.decay = decay;
        this.shape = shape;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.rotation += this.rotSpeed;
        this.size = Math.max(0.1, this.baseSize * this.life);
        return this.life > 0;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.life));
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'spark') {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.fillRect(-this.size, -this.size * 0.2, this.size * 2, this.size * 0.4);
        }
        ctx.restore();
    }
}

class Shockwave {
    constructor(x, y, maxRadius = 120, color = '#00f0ff', duration = 0.4) {
        this.x = x;
        this.y = y;
        this.radius = 2;
        this.maxRadius = maxRadius;
        this.color = color;
        this.progress = 0;
        this.speed = 1 / (60 * duration);
    }

    update() {
        this.progress += this.speed;
        this.radius = this.maxRadius * Math.sin(this.progress * Math.PI * 0.5);
        return this.progress < 1;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.progress);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1, (1 - this.progress) * 8);
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class FloatingText {
    constructor(text, x, y, color = '#ffffff', fontSize = 16) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.fontSize = fontSize;
        this.life = 1.0;
        this.vy = -1.2;
    }

    update() {
        this.y += this.vy;
        this.life -= 0.02;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `bold ${this.fontSize}px 'Segoe UI', Arial, sans-serif`;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class ParticleManager {
    constructor() {
        this.particles = [];
        this.shockwaves = [];
        this.floatingTexts = [];
    }

    reset() {
        this.particles = [];
        this.shockwaves = [];
        this.floatingTexts = [];
    }

    // 引擎尾焰喷射
    emitThruster(x, y, color = '#00d2ff', isRage = false) {
        const count = isRage ? 4 : 2;
        for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * 6;
            const vy = (isRage ? 6 : 4) + Math.random() * 3;
            const size = isRage ? (3 + Math.random() * 3) : (2 + Math.random() * 2);
            const particleColor = isRage ? (Math.random() > 0.5 ? '#ff0055' : '#ffaa00') : color;
            this.particles.push(new Particle(
                x + spread,
                y,
                (Math.random() - 0.5) * 1.5,
                vy,
                particleColor,
                size,
                1.0,
                0.08
            ));
        }
    }

    // 击中火花
    emitHitSpark(x, y, color = '#ffe600') {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                color,
                2 + Math.random() * 2,
                1.0,
                0.05,
                'spark'
            ));
        }
    }

    // 小型爆炸
    emitExplosion(x, y, color = '#ff7700', count = 22) {
        this.shockwaves.push(new Shockwave(x, y, 60, color, 0.25));
        const colors = [color, '#ffdd00', '#ffffff', '#ff1100'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 6;
            const c = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                c,
                3 + Math.random() * 4,
                1.0,
                0.03 + Math.random() * 0.02
            ));
        }
    }

    // 巨型 Boss 爆炸 / 必杀清屏爆炸
    emitMegaExplosion(x, y) {
        this.shockwaves.push(new Shockwave(x, y, 220, '#ff3366', 0.6));
        this.shockwaves.push(new Shockwave(x, y, 320, '#00ffff', 0.8));
        const colors = ['#ffffff', '#00f0ff', '#ff0055', '#ffbb00'];
        for (let i = 0; i < 70; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 9;
            const c = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                c,
                4 + Math.random() * 6,
                1.0,
                0.015 + Math.random() * 0.02
            ));
        }
    }

    // 漂浮提示文字
    addText(text, x, y, color = '#00ffff', size = 16) {
        this.floatingTexts.push(new FloatingText(text, x, y, color, size));
    }

    update() {
        this.particles = this.particles.filter(p => p.update());
        this.shockwaves = this.shockwaves.filter(s => s.update());
        this.floatingTexts = this.floatingTexts.filter(t => t.update());
    }

    draw(ctx) {
        // 先绘制冲击波
        for (let s of this.shockwaves) {
            s.draw(ctx);
        }
        // 再绘制粒子
        for (let p of this.particles) {
            p.draw(ctx);
        }
        // 浮动文字
        for (let t of this.floatingTexts) {
            t.draw(ctx);
        }
    }
}

window.particles = new ParticleManager();
