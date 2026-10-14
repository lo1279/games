/**
 * 视差星空背景系统 (Parallax Starfield & Nebula Background)
 * 多层深度渲染：星云雾气、远星、中星、近景流星穿梭
 */
class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.stars = [];
        this.meteors = [];
        this.nebulaOffset = 0;
        this.initStars();
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.initStars();
    }

    initStars() {
        this.stars = [];
        // 远景层星星 90 颗 (极细微弱星)
        for (let i = 0; i < 90; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 0.5 + 0.3,
                speed: Math.random() * 0.35 + 0.2,
                brightness: Math.random() * 0.2 + 0.08,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                color: '#6c82a3'
            });
        }
        // 中景层星星 45 颗 (柔和暗白点)
        for (let i = 0; i < 45; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 0.5 + 0.6,
                speed: Math.random() * 0.9 + 0.6,
                brightness: Math.random() * 0.22 + 0.12,
                twinkleSpeed: Math.random() * 0.04 + 0.02,
                color: '#9cb3d1'
            });
        }
        // 近景疾驰星尘 20 颗 (温润微光星丝，绝不抢镜或误判为子弹)
        for (let i = 0; i < 20; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 0.5 + 0.8,
                speed: Math.random() * 2.2 + 1.6,
                brightness: 0.22,
                twinkleSpeed: 0,
                color: '#b0d6ff'
            });
        }
    }

    spawnMeteor() {
        if (Math.random() < 0.012 && this.meteors.length < 3) {
            this.meteors.push({
                x: Math.random() * this.width,
                y: -50,
                len: Math.random() * 80 + 50,
                speed: Math.random() * 8 + 12,
                angle: (Math.PI / 2) + (Math.random() - 0.5) * 0.2,
                opacity: 0.8
            });
        }
    }

    update(speedMultiplier = 1.0) {
        this.nebulaOffset = (this.nebulaOffset + 0.2 * speedMultiplier) % this.height;

        for (let s of this.stars) {
            s.y += s.speed * speedMultiplier;
            if (s.y > this.height) {
                s.y = 0;
                s.x = Math.random() * this.width;
            }
            if (s.twinkleSpeed > 0) {
                s.brightness += Math.sin(Date.now() * s.twinkleSpeed) * 0.02;
                s.brightness = Math.max(0.1, Math.min(1.0, s.brightness));
            }
        }

        this.spawnMeteor();
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.y += Math.sin(m.angle) * m.speed * speedMultiplier;
            m.x += Math.cos(m.angle) * m.speed * speedMultiplier;
            m.opacity -= 0.012;
            if (m.y > this.height + 100 || m.opacity <= 0) {
                this.meteors.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // 1. 深邃太空底色
        ctx.fillStyle = '#060814';
        ctx.fillRect(0, 0, this.width, this.height);

        // 2. 柔和星云渐变 (Cyan & Purple Nebula)
        const grad1 = ctx.createRadialGradient(
            this.width * 0.3, (this.nebulaOffset + 200) % this.height, 50,
            this.width * 0.3, (this.nebulaOffset + 200) % this.height, 350
        );
        grad1.addColorStop(0, 'rgba(30, 20, 70, 0.45)');
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, this.width, this.height);

        const grad2 = ctx.createRadialGradient(
            this.width * 0.75, (this.nebulaOffset + 600) % this.height, 40,
            this.width * 0.75, (this.nebulaOffset + 600) % this.height, 300
        );
        grad2.addColorStop(0, 'rgba(10, 45, 80, 0.4)');
        grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, this.width, this.height);

        // 3. 细腻深空星群渲染 (微弱半透明，绝不遮挡视野或混淆子弹)
        for (let s of this.stars) {
            ctx.save();
            ctx.globalAlpha = s.brightness;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 4. 流星拖尾绘制
        for (let m of this.meteors) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, m.opacity);
            const tailX = m.x - Math.cos(m.angle) * m.len;
            const tailY = m.y - Math.sin(m.angle) * m.len;
            const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
            grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
            ctx.restore();
        }
    }
}

window.Starfield = Starfield;
