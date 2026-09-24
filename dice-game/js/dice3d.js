/**
 * 3D 骰子物理渲染引擎 (Three.js)
 * 支持多骰子同时真实翻滚、撞击弹跳、朝向精准停留、骰盅升降与偷瞄动画。
 */
class Dice3DEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.dices = [];
        this.cup = null;
        this.animating = false;
        this.targetValues = [];
        this.onRollComplete = null;

        this.init();
    }

    init() {
        if (!window.THREE) {
            console.error('Three.js 未加载');
            return;
        }

        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 450;

        // 场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c131d); // 深邃夜空黑蓝

        // 相机
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        this.camera.position.set(0, 10, 12);
        this.camera.lookAt(0, 0, 0);

        // 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 灯光系统
        this.setupLights();

        // 桌面/托盘
        this.setupTable();

        // 骰盅模型
        this.setupCup();

        // 骰子纹理贴图材质缓存
        this.materials = this.createDiceMaterials();

        // 窗口尺寸监听
        window.addEventListener('resize', () => this.onResize());

        // 启动主渲染循环
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupLights() {
        // 环境温和漫射光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        // 主聚光灯（投射柔和投影）
        const spotLight = new THREE.SpotLight(0xfffaed, 1.2);
        spotLight.position.set(5, 14, 8);
        spotLight.angle = Math.PI / 4;
        spotLight.penumbra = 0.5;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.camera.near = 5;
        spotLight.shadow.camera.far = 25;
        this.scene.add(spotLight);

        // 辅光源（提亮背光暗部）
        const backLight = new THREE.DirectionalLight(0x7395b0, 0.4);
        backLight.position.set(-6, 8, -6);
        this.scene.add(backLight);
    }

    setupTable() {
        // 赌场高级绿呢绒台面圆形托盘 (Casino Felt Mat)
        const tableGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.4, 64);
        const tableMat = new THREE.MeshStandardMaterial({
            color: 0x0f4c3a, // 经典英式深墨绿
            roughness: 0.85,
            metalness: 0.1
        });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.y = -0.2;
        table.receiveShadow = true;
        this.scene.add(table);

        // 托盘金色外框
        const rimGeo = new THREE.TorusGeometry(5.2, 0.22, 16, 64);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // 贵金属金黄
            roughness: 0.35,
            metalness: 0.75
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0;
        this.scene.add(rim);

        // 托盘底边暗圈
        const ringGeo = new THREE.RingGeometry(4.2, 4.3, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x1f7a60,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        this.scene.add(ring);
    }

    setupCup() {
        // 骰盅：高光暗金磨砂外壁
        const cupGroup = new THREE.Group();

        const bodyGeo = new THREE.CylinderGeometry(2.3, 2.7, 3.8, 32, 1, true);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a24,
            metalness: 0.85,
            roughness: 0.25,
            side: THREE.DoubleSide
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.9;
        body.castShadow = true;
        cupGroup.add(body);

        // 盅顶盖
        const topGeo = new THREE.CylinderGeometry(2.3, 2.3, 0.3, 32);
        const topMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.8,
            roughness: 0.3
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 3.8;
        top.castShadow = true;
        cupGroup.add(top);

        // 盅身金箍条纹装饰
        const stripeGeo = new THREE.TorusGeometry(2.5, 0.08, 16, 32);
        const stripe = new THREE.Mesh(stripeGeo, topMat);
        stripe.rotation.x = Math.PI / 2;
        stripe.position.y = 1.5;
        cupGroup.add(stripe);

        cupGroup.position.set(0, 0, 0);
        cupGroup.visible = false; // 默认隐藏，在需要骰盅的玩法模式下启用
        this.scene.add(cupGroup);
        this.cup = cupGroup;
    }

    /**
     * 高精度 Canvas 动态生成 6 个面的质感纹理
     * 1点: 硕大中国红
     * 2点: 双深蓝
     * 3点: 三深蓝
     * 4点: 四中国红
     * 5点: 4蓝 + 1红
     * 6点: 六深蓝
     */
    createDiceFaceCanvas(value) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 背景象牙白与内柔微阴影
        ctx.fillStyle = '#f8f8f6';
        ctx.fillRect(0, 0, size, size);

        // 边角极轻微暗影增添立体感
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, 130);
        gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(1, 'rgba(215,215,210,0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // 点数坐标分布
        const rRed = '#d92626';
        const cBlue = '#1f3c73';

        const drawDot = (cx, cy, r, color) => {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // 点内高光倒影
            ctx.beginPath();
            ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
            ctx.restore();
        };

        const c = size / 2;
        const q1 = size * 0.28;
        const q3 = size * 0.72;
        const dotR = 21;

        switch (value) {
            case 1:
                drawDot(c, c, 38, rRed); // 1点超大红心
                break;
            case 2:
                drawDot(q1, q1, dotR, cBlue);
                drawDot(q3, q3, dotR, cBlue);
                break;
            case 3:
                drawDot(q1, q1, dotR, cBlue);
                drawDot(c, c, dotR, cBlue);
                drawDot(q3, q3, dotR, cBlue);
                break;
            case 4:
                drawDot(q1, q1, dotR, rRed);
                drawDot(q3, q1, dotR, rRed);
                drawDot(q1, q3, dotR, rRed);
                drawDot(q3, q3, dotR, rRed);
                break;
            case 5:
                drawDot(q1, q1, dotR, cBlue);
                drawDot(q3, q1, dotR, cBlue);
                drawDot(c, c, dotR, rRed); // 中心红
                drawDot(q1, q3, dotR, cBlue);
                drawDot(q3, q3, dotR, cBlue);
                break;
            case 6:
                drawDot(q1, size * 0.22, dotR, cBlue);
                drawDot(q1, c, dotR, cBlue);
                drawDot(q1, size * 0.78, dotR, cBlue);
                drawDot(q3, size * 0.22, dotR, cBlue);
                drawDot(q3, c, dotR, cBlue);
                drawDot(q3, size * 0.78, dotR, cBlue);
                break;
        }

        return canvas;
    }

    createDiceMaterials() {
        const textures = [];
        for (let i = 1; i <= 6; i++) {
            const canvas = this.createDiceFaceCanvas(i);
            const texture = new THREE.CanvasTexture(canvas);
            textures[i] = texture;
        }

        // Three.js BoxGeometry 6个面的索引规则：
        // 0: +X (Right) -> 3
        // 1: -X (Left)  -> 4
        // 2: +Y (Top)   -> 1
        // 3: -Y (Bottom)-> 6
        // 4: +Z (Front) -> 2
        // 5: -Z (Back)  -> 5
        // 相对面之和全为 7
        return [
            new THREE.MeshStandardMaterial({ map: textures[3], roughness: 0.35, metalness: 0.1 }),
            new THREE.MeshStandardMaterial({ map: textures[4], roughness: 0.35, metalness: 0.1 }),
            new THREE.MeshStandardMaterial({ map: textures[1], roughness: 0.35, metalness: 0.1 }),
            new THREE.MeshStandardMaterial({ map: textures[6], roughness: 0.35, metalness: 0.1 }),
            new THREE.MeshStandardMaterial({ map: textures[2], roughness: 0.35, metalness: 0.1 }),
            new THREE.MeshStandardMaterial({ map: textures[5], roughness: 0.35, metalness: 0.1 })
        ];
    }

    /**
     * 计算当顶部想要显示特定点数 targetVal 时骰子目标四元数
     */
    getTargetQuaternion(targetVal, randomAngle = 0) {
        const q = new THREE.Quaternion();
        const baseEuler = new THREE.Euler(0, randomAngle, 0, 'YXZ');

        switch (targetVal) {
            case 1: // 默认 +Y 就是 1
                baseEuler.x = 0;
                baseEuler.z = 0;
                break;
            case 6: // -Y 翻到顶部
                baseEuler.x = Math.PI;
                baseEuler.z = 0;
                break;
            case 2: // +Z 翻到顶部
                baseEuler.x = -Math.PI / 2;
                baseEuler.z = 0;
                break;
            case 5: // -Z 翻到顶部
                baseEuler.x = Math.PI / 2;
                baseEuler.z = 0;
                break;
            case 3: // +X 翻到顶部
                baseEuler.x = 0;
                baseEuler.z = Math.PI / 2;
                break;
            case 4: // -X 翻到顶部
                baseEuler.x = 0;
                baseEuler.z = -Math.PI / 2;
                break;
        }

        q.setFromEuler(baseEuler);
        return q;
    }

    /**
     * 调整场上骰子数量
     */
    setDiceCount(count) {
        // 清理原有骰子
        this.dices.forEach(d => this.scene.remove(d.mesh));
        this.dices = [];

        const size = 1.0;
        const geo = new THREE.BoxGeometry(size, size, size);

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, this.materials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const dice = {
                mesh: mesh,
                value: 1,
                targetVal: 1,
                isRolling: false,
                currentPos: new THREE.Vector3(0, 0.5, 0),
                targetPos: new THREE.Vector3(0, 0.5, 0),
                startRot: new THREE.Quaternion(),
                targetRot: new THREE.Quaternion(),
                bounceTime: 0,
                held: false // 快艇模式锁定标记
            };

            this.scene.add(mesh);
            this.dices.push(dice);
        }

        this.arrangeDices(false);
    }

    /**
     * 静态排列骰子位置
     */
    arrangeDices(animate = false) {
        const count = this.dices.length;
        const spacing = 1.6;

        this.dices.forEach((d, idx) => {
            let x = 0;
            let z = 0;

            if (count === 1) {
                x = 0; z = 0;
            } else if (count === 2) {
                x = (idx - 0.5) * spacing;
                z = 0;
            } else if (count === 3) {
                // 三角形或单行
                x = (idx - 1) * spacing;
                z = 0;
            } else if (count === 4) {
                // 2x2
                x = (idx % 2 - 0.5) * spacing;
                z = (Math.floor(idx / 2) - 0.5) * spacing;
            } else if (count === 5) {
                // 梅花5点分布
                if (idx === 4) {
                    x = 0; z = 0;
                } else {
                    x = (idx % 2 - 0.5) * spacing * 1.4;
                    z = (Math.floor(idx / 2) - 0.5) * spacing * 1.4;
                }
            } else if (count === 6) {
                // 2行3列
                x = (idx % 3 - 1) * spacing;
                z = (Math.floor(idx / 3) - 0.5) * spacing * 1.2;
            }

            d.targetPos.set(x, 0.5, z);
            if (!animate) {
                d.mesh.position.copy(d.targetPos);
            }
        });
    }

    /**
     * 掷骰子动画入口
     * @param {Array<number>} values 目标点数数组，例如 [3, 5, 6]
     * @param {Array<boolean>} holdMask 快艇模式下的锁定保留标记数组 [false, true, false...]
     * @param {Function} onComplete 动画完成回调
     */
    roll(values, holdMask = null, onComplete = null) {
        if (this.animating) {
            // 如果上一次投掷动画尚未完全结束，立即将其平稳收敛并结算旧回调，杜绝状态死锁
            this.dices.forEach(d => {
                d.isRolling = false;
                d.mesh.position.copy(d.targetPos);
                if (d.finalQuat) d.mesh.quaternion.copy(d.finalQuat);
            });
            if (this.onRollComplete) {
                const oldCb = this.onRollComplete;
                this.onRollComplete = null;
                try { oldCb(this.dices.map(d => d.value)); } catch (e) { console.error(e); }
            }
            this.animating = false;
        }
        this.animating = true;
        this.onRollComplete = onComplete;

        if (values.length !== this.dices.length) {
            this.setDiceCount(values.length);
        }

        this.arrangeDices(false);

        // 触发摇骰音效
        if (window.soundEngine) {
            window.soundEngine.playShake();
        }

        const now = performance.now();
        const duration = 1400; // 动画时长 1.4s

        this.dices.forEach((dice, i) => {
            const isHeld = holdMask && holdMask[i];
            dice.held = isHeld;

            if (isHeld) {
                // 被锁定的骰子不参与重掷动画，仅在原地微光
                return;
            }

            dice.isRolling = true;
            dice.targetVal = values[i];
            dice.value = values[i];

            // 初始随机高处散开
            const angle = (i / this.dices.length) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 1.5 + Math.random() * 1.5;
            dice.mesh.position.set(Math.cos(angle) * dist, 6.0 + Math.random() * 2, Math.sin(angle) * dist);

            // 随机剧烈旋转速度
            dice.spinSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 45,
                (Math.random() - 0.5) * 45,
                (Math.random() - 0.5) * 45
            );

            // 最终落地的随机偏角，让每次停驻更生动
            const randAngle = (Math.random() - 0.5) * 0.6;
            dice.finalQuat = this.getTargetQuaternion(dice.targetVal, randAngle);

            dice.startTime = now;
            dice.duration = duration + (Math.random() - 0.5) * 200;
            dice.bounces = 0;
        });

        // 定时触发落地碰撞声
        setTimeout(() => {
            if (window.soundEngine) {
                window.soundEngine.playDiceHit(0.35, 420);
            }
        }, 550);
        setTimeout(() => {
            if (window.soundEngine) {
                window.soundEngine.playDiceHit(0.18, 500);
            }
        }, 900);
    }

    /**
     * 骰盅升降动画（吹牛/骰宝）
     */
    animateCup(action, onDone = null) {
        if (!this.cup) {
            if (onDone) onDone();
            return;
        }

        this.cup.visible = true;
        const startY = this.cup.position.y;
        let targetY = 0;

        if (action === 'cover') {
            // 盖下
            this.cup.position.set(0, 7, 0);
            targetY = 0;
        } else if (action === 'lift') {
            // 揭开
            this.cup.position.set(0, 0, 0);
            targetY = 7;
        } else if (action === 'peek') {
            // 偷瞄半掀开
            this.cup.position.set(0, 0, 0);
            targetY = 2.2;
        }

        const startT = performance.now();
        const dur = 400;

        const step = (t) => {
            const p = Math.min((t - startT) / dur, 1.0);
            const ease = 1 - Math.pow(1 - p, 3);
            this.cup.position.y = startY + (targetY - startY) * ease;

            if (p < 1.0) {
                requestAnimationFrame(step);
            } else {
                if (action === 'lift') {
                    this.cup.visible = false;
                }
                if (onDone) onDone();
            }
        };
        requestAnimationFrame(step);
    }

    /**
     * 主渲染循环
     */
    animate(time) {
        requestAnimationFrame(this.animate);

        let anyRolling = false;

        this.dices.forEach((d) => {
            if (!d.isRolling) return;
            anyRolling = true;

            const elapsed = time - d.startTime;
            const progress = Math.min(elapsed / d.duration, 1.0);

            if (progress < 0.75) {
                // 前半段：自由落体弹跳 + 剧烈翻滚
                const fallProgress = progress / 0.75;
                // 模拟抛物线和反弹
                const bounce = Math.abs(Math.sin(fallProgress * Math.PI * 2.5)) * Math.pow(1 - fallProgress, 1.5) * 4;
                d.mesh.position.y = 0.5 + bounce;

                // 水平移向目标点
                d.mesh.position.x = THREE.MathUtils.lerp(d.mesh.position.x, d.targetPos.x, 0.08);
                d.mesh.position.z = THREE.MathUtils.lerp(d.mesh.position.z, d.targetPos.z, 0.08);

                // 自由旋转
                d.mesh.rotation.x += d.spinSpeed.x * 0.02;
                d.mesh.rotation.y += d.spinSpeed.y * 0.02;
                d.mesh.rotation.z += d.spinSpeed.z * 0.02;
            } else {
                // 后半段：逐渐对齐目标四元数并稳定在桌面
                const alignProgress = (progress - 0.75) / 0.25;
                const easeOut = 1 - Math.pow(1 - alignProgress, 2);

                d.mesh.position.lerp(d.targetPos, 0.15);
                d.mesh.position.y = 0.5 + Math.sin((1 - alignProgress) * Math.PI) * 0.15;
                d.mesh.quaternion.slerp(d.finalQuat, 0.22);
            }

            if (progress >= 1.0) {
                d.isRolling = false;
                d.mesh.position.copy(d.targetPos);
                d.mesh.quaternion.copy(d.finalQuat);
            }
        });

        // 动画完全结束时的回调分发
        if (this.animating && !anyRolling) {
            this.animating = false;
            if (this.onRollComplete) {
                const cb = this.onRollComplete;
                this.onRollComplete = null;
                cb(this.dices.map(d => d.value));
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.container || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

window.Dice3DEngine = Dice3DEngine;
