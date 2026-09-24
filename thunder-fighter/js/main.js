/**
 * 游戏主控制器与状态机 (Main Game Loop & Wave Controller)
 * 整合：输入捕获、波次生成、碰撞解算、Combo系统、屏幕震动与UI数据同步
 */

class ThunderGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 动态全屏高清分辨率与 Retina 缩放
        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this.width = window.innerWidth || 480;
        this.height = window.innerHeight || 720;

        // 核心子系统
        this.starfield = new Starfield(this.width, this.height);
        this.player = new Player(this.width, this.height);
        this.bullets = [];
        this.enemies = [];
        this.items = [];
        this.spawnQueue = [];
        window.currentItems = this.items;
        this.boss = null;

        // 状态系统
        this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('TF_HIGHSCORE') || '0', 10);
        this.kills = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.stage = 1;
        this.waveTimer = 0;
        this.bossWarningTimer = 0;
        this.isGameOverPending = false;

        // 震屏效果
        this.shakeTime = 0;
        this.shakeIntensity = 0;

        // 控制输入状态 (触屏相对拖拽微操，视线完全开阔)
        this.keys = {};
        this.mousePos = { x: this.width / 2, y: this.height - 100, active: false };
        this.touchPos = { x: this.width / 2, y: this.height - 100, deltaX: 0, deltaY: 0, active: false };
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.lastTouchTime = 0;

        this.resize();
        this.initInput();
        this.bindUI();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));

        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    // 动态全屏自适应与 Retina 像素比缩放
    resize() {
        const container = document.getElementById('game-container') || document.body;
        const w = container.clientWidth || window.innerWidth || 480;
        const h = container.clientHeight || window.innerHeight || 720;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this.width = w;
        this.height = h;

        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        if (this.starfield) {
            this.starfield.resize(w, h);
        }
        if (this.player) {
            this.player.canvasWidth = w;
            this.player.canvasHeight = h;
        }
    }

    // 微信小程序与现代手机震动反馈
    hapticFeedback(type = 'light') {
        try {
            if (window.wx && typeof wx.vibrateShort === 'function') {
                wx.vibrateShort({ type: type === 'heavy' ? 'heavy' : 'light' });
            } else if (navigator.vibrate) {
                navigator.vibrate(type === 'heavy' ? [30, 40, 60] : 18);
            }
        } catch(e) {}
    }

    initInput() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            // 只要按下任意方向控制键，立即临时挂起鼠标跟随，避免冲突
            if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                this.mousePos.active = false;
            }
            if (e.code === 'KeyB') {
                if (this.state === 'PLAYING') {
                    const used = this.player.useBomb(this.bullets, this.enemies, this.boss);
                    if (used) this.hapticFeedback('heavy');
                }
            }
            if (e.code === 'KeyP') {
                this.togglePause();
            }
            if (window.sounds) window.sounds.ensureResume();
        });

        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        // 鼠标控制 (鼠标有实际位移时再激活)
        const getCanvasCoord = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        this.canvas.addEventListener('mousemove', e => {
            const pos = getCanvasCoord(e);
            this.mousePos.x = pos.x;
            this.mousePos.y = pos.y;
            this.mousePos.active = true;
            if (window.sounds) window.sounds.ensureResume();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos.active = false;
        });

        // 手机触屏微操控制 (支持屏幕任意区域盲操相对位移 + 双击释放核弹)
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
                this.touchPos.deltaX = 0;
                this.touchPos.deltaY = 0;
                this.touchPos.active = true;

                // 双击全屏释放核弹 (Double Tap Bomb)
                const now = performance.now();
                if (now - this.lastTouchTime < 320) {
                    if (this.state === 'PLAYING') {
                        const used = this.player.useBomb(this.bullets, this.enemies, this.boss);
                        if (used) this.hapticFeedback('heavy');
                    }
                }
                this.lastTouchTime = now;

                if (window.sounds) window.sounds.ensureResume();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                // 累计手指位移差，驱动战机防遮挡平滑机动
                const dx = touch.clientX - this.lastTouchX;
                const dy = touch.clientY - this.lastTouchY;
                this.touchPos.deltaX += dx;
                this.touchPos.deltaY += dy;
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
                this.touchPos.active = true;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.touchPos.active = false;
            this.touchPos.deltaX = 0;
            this.touchPos.deltaY = 0;
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.touchPos.active = false;
            this.touchPos.deltaX = 0;
            this.touchPos.deltaY = 0;
        });
    }

    bindUI() {
        document.getElementById('start-btn')?.addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn')?.addEventListener('click', () => this.startGame());
        document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('bomb-btn')?.addEventListener('click', () => {
            if (this.state === 'PLAYING') {
                const used = this.player.useBomb(this.bullets, this.enemies, this.boss);
                if (used) this.hapticFeedback('heavy');
            }
        });
        document.getElementById('sound-toggle')?.addEventListener('click', () => {
            if (window.sounds) {
                const muted = window.sounds.toggleMute();
                document.getElementById('sound-toggle').innerText = muted ? '🔇 静音' : '🔊 音效';
            }
        });
    }

    startGame() {
        if (window.sounds) window.sounds.ensureResume();
        this.player.reset();
        this.bullets = [];
        this.enemies = [];
        this.items = [];
        this.spawnQueue = [];
        window.currentItems = this.items;
        this.boss = null;
        if (window.particles) window.particles.reset();

        this.score = 0;
        this.kills = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.stage = 1;
        this.waveTimer = 0;
        this.bossWarningTimer = 0;
        this.isGameOverPending = false;
        this.state = 'PLAYING';

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-screen').classList.add('hidden');
        }
    }

    triggerShake(intensity = 8, frames = 15) {
        this.shakeIntensity = intensity;
        this.shakeTime = frames;
    }

    // 统一处理敌机击杀（无论是子弹打死还是核弹清屏轰死）
    onEnemyKilled(enemy) {
        this.kills++;
        this.addScore(enemy.scoreValue);
    }

    addScore(pts) {
        // Combo 倍率加成
        this.combo++;
        this.comboTimer = 180; // 3 秒维持
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        const multiplier = Math.min(5.0, 1.0 + Math.floor(this.combo / 5) * 0.5);
        const earned = Math.round(pts * multiplier);
        this.score += earned;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('TF_HIGHSCORE', this.highScore.toString());
        }
    }

    // 波次生成逻辑 (基于内部帧队列，彻底避免跨局异步泄漏)
    updateWaves() {
        // 1. 处理待生成的队列小怪
        for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
            const item = this.spawnQueue[i];
            item.delay--;
            if (item.delay <= 0) {
                if (this.state === 'PLAYING') {
                    this.enemies.push(item.enemy);
                }
                this.spawnQueue.splice(i, 1);
            }
        }

        if (this.boss && this.boss.alive) return; // Boss 战斗中不生成普通小怪
        if (this.bossWarningTimer > 0) {
            this.bossWarningTimer--;
            if (this.bossWarningTimer === 0) {
                // 生成 Boss
                this.boss = new Boss(this.width, this.height, this.stage);
                if (window.sounds) window.sounds.playWarning();
            }
            return;
        }

        this.waveTimer++;

        // 阶段 1: 侦察机编队 (直线 / 正弦，使用帧队列替代不安全的setTimeout)
        if (this.waveTimer % 90 === 0 && this.waveTimer < 900) {
            const count = 4;
            const startX = 60 + Math.random() * (this.width - 160);
            const trajectory = Math.random() > 0.5 ? 'sine' : 'straight';
            for (let i = 0; i < count; i++) {
                this.spawnQueue.push({
                    delay: i * 12, // 间隔12帧
                    enemy: new ScoutFighter(startX + i * 24, -20 - i * 30, trajectory)
                });
            }
        }

        // 阶段 2: 巡航舰加入战场
        if (this.waveTimer % 180 === 0 && this.waveTimer > 300 && this.waveTimer < 1100) {
            const rx = 80 + Math.random() * (this.width - 160);
            this.enemies.push(new Cruiser(rx, -40));
        }

        // 阶段 3: 重型装甲炮艇与自杀机
        if (this.waveTimer % 240 === 0 && this.waveTimer > 600 && this.waveTimer < 1200) {
            this.enemies.push(new Gunship(Math.random() * (this.width - 120) + 60, -50));
            this.enemies.push(new Kamikaze(Math.random() * (this.width - 80) + 40, -30, this.player));
        }

        // 阶段 4: 波次结束，触发史诗 Boss 降临！
        if (this.waveTimer >= 1300 && !this.boss) {
            this.bossWarningTimer = 180; // 3秒红色警报
            if (window.sounds) window.sounds.playWarning();
            if (window.particles) {
                window.particles.addText('WARNING: DREADNOUGHT INCOMING!', this.width / 2, this.height / 2, '#ff0055', 26);
            }
        }

        // 击败 Boss 后的关卡循环与进阶
        if (this.boss && !this.boss.alive && this.enemies.length === 0) {
            this.stage++;
            this.waveTimer = 0;
            this.boss = null;
            if (window.particles) {
                window.particles.addText(`STAGE ${this.stage} START!`, this.width / 2, this.height / 2, '#00f6ff', 28);
            }
        }
    }

    // 碰撞检测与解算
    resolveCollisions() {
        const bounds = { width: this.width, height: this.height };

        // 1. 玩家子弹 vs 普通敌机
        for (let b of this.bullets) {
            if (!b.isPlayer || !b.alive) continue;

            for (let e of this.enemies) {
                if (!e.alive) continue;

                // 激光采用高精度矩形AABB包围盒判定，其他子弹采用圆形判定
                const isHit = (b instanceof LaserBeam) 
                    ? b.checkHit(e)
                    : (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius);

                if (isHit) {
                    if (b.piercing) {
                        if (!b.hitEntities.has(e)) {
                            b.hitEntities.add(e);
                            e.takeDamage(b.damage, true);
                            if (window.particles) window.particles.emitHitSpark(e.x, e.y);
                        }
                    } else {
                        e.takeDamage(b.damage, true);
                        b.alive = false;
                        if (window.particles) window.particles.emitHitSpark(b.x, b.y);
                        break;
                    }
                }
            }

            // 玩家子弹 vs Boss
            if (this.boss && this.boss.alive && !this.boss.isEntering && !this.boss.isDying) {
                const isHitBoss = (b instanceof LaserBeam)
                    ? b.checkHit(this.boss)
                    : (Math.hypot(b.x - this.boss.x, b.y - this.boss.y) < b.radius + this.boss.radius);

                if (isHitBoss) {
                    if (b.piercing) {
                        if (!b.hitEntities.has(this.boss)) {
                            b.hitEntities.add(this.boss);
                            this.boss.takeDamage(b.damage);
                            if (window.particles) window.particles.emitHitSpark(b.x, b.y);
                        }
                    } else {
                        this.boss.takeDamage(b.damage);
                        b.alive = false;
                        if (window.particles) window.particles.emitHitSpark(b.x, b.y);
                    }

                    if (!this.boss.alive) {
                        this.addScore(10000 * this.stage);
                        this.triggerShake(16, 45);
                    }
                }
            }
        }

        // 2. 敌方子弹 vs 玩家
        if (this.player.alive) {
            for (let b of this.bullets) {
                if (b.isPlayer || !b.alive) continue;
                const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
                if (dist < b.radius + this.player.radius) {
                    b.alive = false;
                    this.player.takeDamage(b.damage);
                    this.triggerShake(6, 12);
                    this.combo = 0; // 受击中断 combo
                    break;
                }
            }

            // 3. 敌机机体撞击 vs 玩家
            for (let e of this.enemies) {
                if (!e.alive) continue;
                const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
                if (dist < e.radius + this.player.radius) {
                    e.takeDamage(100, true);
                    this.player.takeDamage(35);
                    this.triggerShake(10, 18);
                    this.combo = 0;
                }
            }

            // 4. 拾取道具 vs 玩家
            for (let item of this.items) {
                if (!item.alive) continue;
                const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
                if (dist < item.radius + this.player.radius + 12) {
                    item.applyEffect(this.player);
                }
            }
        }
    }

    update() {
        if (this.state !== 'PLAYING') {
            this.starfield.update(0.5);
            return;
        }

        // 视差星空
        this.starfield.update(this.player.isRage ? 2.5 : 1.2);

        // 子弹与边界定义
        const bounds = { width: this.width, height: this.height };

        // 玩家更新 (传入动态视口边界)
        this.player.update(this.keys, this.mousePos, this.touchPos, this.bullets, this.enemies, bounds);
        for (let b of this.bullets) {
            if (b instanceof HomingMissile) {
                b.update(bounds, this.enemies.concat(this.boss ? [this.boss] : []));
            } else {
                b.update(bounds);
            }
        }
        this.bullets = this.bullets.filter(b => b.alive);

        // 敌机更新
        for (let e of this.enemies) {
            e.update(bounds, this.player, this.bullets);
        }
        this.enemies = this.enemies.filter(e => e.alive);

        // Boss 更新
        if (this.boss) {
            this.boss.update(bounds, this.player, this.bullets);
        }

        // 道具更新
        for (let item of this.items) {
            item.update(bounds, this.player);
        }
        this.items = this.items.filter(item => item.alive);
        window.currentItems = this.items;

        // 粒子更新
        if (window.particles) {
            window.particles.update();
        }

        // 碰撞计算
        this.resolveCollisions();

        // 波次推进
        this.updateWaves();

        // Combo 维持时限
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        // 震屏衰减
        if (this.shakeTime > 0) {
            this.shakeTime--;
        }

        // 死亡检测 (使用 isGameOverPending 单次加锁保护，根治定时器风暴)
        if (!this.player.alive && !this.isGameOverPending) {
            this.isGameOverPending = true;
            setTimeout(() => {
                this.state = 'GAMEOVER';
                document.getElementById('game-over-screen').classList.remove('hidden');
                document.getElementById('final-score').innerText = this.score;
                document.getElementById('final-kills').innerText = this.kills;
                document.getElementById('final-combo').innerText = this.maxCombo;
            }, 1200);
        }

        // 同步 HUD 数据
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('hud-score').innerText = this.score.toString().padStart(7, '0');
        document.getElementById('hud-bombs').innerText = '💣'.repeat(this.player.bombs);
        document.getElementById('hud-stage').innerText = `STAGE 0${this.stage}`;

        // 生命值条与护盾条
        const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
        const shieldPct = Math.max(0, (this.player.shield / this.player.maxShield) * 100);
        document.getElementById('hp-bar').style.width = `${hpPct}%`;
        document.getElementById('shield-bar').style.width = `${shieldPct}%`;

        // 暴走能量条
        const ragePct = Math.max(0, this.player.rage);
        const rageBar = document.getElementById('rage-bar');
        if (rageBar) {
            rageBar.style.width = `${ragePct}%`;
            if (this.player.isRage) {
                rageBar.classList.add('raging');
            } else {
                rageBar.classList.remove('raging');
            }
        }

        // Combo 徽章
        const comboElem = document.getElementById('hud-combo');
        if (comboElem) {
            if (this.combo > 1) {
                comboElem.innerText = `${this.combo} COMBO!`;
                comboElem.style.opacity = '1';
            } else {
                comboElem.style.opacity = '0';
            }
        }

        // Boss 血条
        const bossHud = document.getElementById('boss-hud');
        if (this.boss && this.boss.alive && !this.boss.isEntering) {
            bossHud.classList.remove('hidden');
            const bossHpPct = Math.max(0, (this.boss.hp / this.boss.maxHp) * 100);
            document.getElementById('boss-hp-bar').style.width = `${bossHpPct}%`;
            document.getElementById('boss-name').innerText = this.boss.name;
        } else {
            bossHud.classList.add('hidden');
        }
    }

    draw() {
        this.ctx.save();
        if (this.dpr && this.dpr !== 1) {
            this.ctx.scale(this.dpr, this.dpr);
        }

        // 震屏位移
        if (this.shakeTime > 0) {
            const rx = (Math.random() - 0.5) * this.shakeIntensity;
            const ry = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(rx, ry);
        }

        // 1. 视差星空宇宙
        this.starfield.draw(this.ctx);

        // 2. Boss 警告红色光晕脉冲
        if (this.bossWarningTimer > 0) {
            const alpha = (Math.sin(Date.now() * 0.02) + 1) * 0.15;
            this.ctx.fillStyle = `rgba(255, 0, 50, ${alpha})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // 3. 道具拾取物
        for (let item of this.items) {
            item.draw(this.ctx);
        }

        // 4. 敌机编队
        for (let e of this.enemies) {
            e.draw(this.ctx);
        }

        // 5. Boss 巨型战舰
        if (this.boss) {
            this.boss.draw(this.ctx, { width: this.width, height: this.height });
        }

        // 6. 玩家战机
        this.player.draw(this.ctx);

        // 7. 子弹弹幕 (混合光效提升发光质感)
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        for (let b of this.bullets) {
            b.draw(this.ctx);
        }
        this.ctx.restore();

        // 8. 粒子系统
        if (window.particles) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            window.particles.draw(this.ctx);
            this.ctx.restore();
        }

        this.ctx.restore();
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', () => {
    window.game = new ThunderGame();
});
