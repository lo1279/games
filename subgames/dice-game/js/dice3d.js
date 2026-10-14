/**
 * 3D 骰子物理渲染引擎 (Three.js) - 真实物理与高质感圆角清漆渲染系统
 * 特性：
 * 1. 算法细分圆角长方体（RoundedBoxGeometry），消除生硬纸盒直角，呈现高光倒角。
 * 2. MeshPhysicalMaterial 物理材质：Clearcoat 清漆保护层、次表面微散射与通透感。
 * 3. 真实点数内凹雕刻 (Indented Pips)：Bump 贴图立体深度，瓷釉填漆质感。
 * 4. 程序化 Studio HDRI 全景环境反射 (scene.environment)。
 * 5. 多级弹跳动力学衰减、实时速度感应碰撞发声与落地阻尼微晃 (Settling Wobble)。
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
        this.scene.background = new THREE.Color(0x0a1017); // 深邃雅致夜空底色

        // 相机
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        this.updateCameraResponsive(width, height);

        // 渲染器 (启用色彩空间转换与软阴影)
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        // 手机端 DPR 限制在 1.75 内，在保证视网膜视效的同时大幅降低 GPU 功耗与发热
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (THREE.ACESFilmicToneMapping) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.15;
        }
        this.container.appendChild(this.renderer.domElement);

        // WebGL 移动端上下文丢失与恢复防御 (针对微信切出后台与锁屏回收)
        this.isContextLost = false;
        this.paused = false;
        this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.isContextLost = true;
            console.warn('WebGL context lost, pausing render loop...');
        }, false);
        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored, reloading scene shaders and textures...');
            this.isContextLost = false;
            this.materials = this.createDiceMaterials();
            this.setupEnvironment();
            this.onResize();
        }, false);

        // 手机端可见性监听：切出微信/切入后台时暂停动画循环，节约手机电量
        document.addEventListener('visibilitychange', () => {
            this.paused = document.hidden;
        });

        // 创建程序化 Studio 环境反射贴图
        this.setupEnvironment();

        // 高级灯光系统
        this.setupLights();

        // 桌面/托盘
        this.setupTable();

        // 骰盅模型
        this.setupCup();

        // 骰子物理材质与内凹法线贴图缓存
        this.materials = this.createDiceMaterials();

        // 几何体缓存 (细分圆角长方体)
        this.diceGeometry = this.createRoundedBoxGeometry(1.0, 0.14, 12);

        // 窗口与精准容器尺寸监听 (ResizeObserver 适配键盘弹出与微信工具栏伸缩)
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onResize(), 150);
        });
        if (window.ResizeObserver && this.container) {
            this.resizeObserver = new ResizeObserver(() => this.onResize());
            this.resizeObserver.observe(this.container);
        }

        // 启动主渲染循环
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    /**
     * 程序化生成 Studio 柔光箱全景环境反射图 (360度)，赋予清漆层真实的空间流动高光
     */
    setupEnvironment() {
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 512;
        envCanvas.height = 256;
        const ctx = envCanvas.getContext('2d');

        // 上半球天顶柔光微暖渐变，下半球暗调沉稳
        const skyGrad = ctx.createLinearGradient(0, 0, 0, envCanvas.height);
        skyGrad.addColorStop(0, '#eaf2ff');
        skyGrad.addColorStop(0.35, '#c8d6e5');
        skyGrad.addColorStop(0.5, '#404e5a');
        skyGrad.addColorStop(0.55, '#19222c');
        skyGrad.addColorStop(1, '#0b0f14');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, envCanvas.width, envCanvas.height);

        // 绘制顶部主柔光箱条纹 (模拟影棚顶光柔光屏反射)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(160, 20, 192, 50);

        // 绘制侧面轮廓辅助柔光箱条带
        ctx.fillStyle = 'rgba(255, 245, 230, 0.6)';
        ctx.fillRect(40, 70, 70, 45);
        ctx.fillStyle = 'rgba(210, 235, 255, 0.5)';
        ctx.fillRect(400, 70, 70, 45);

        const envTexture = new THREE.CanvasTexture(envCanvas);
        envTexture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = envTexture;
    }

    setupLights() {
        // 全局基础漫射光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        this.scene.add(ambientLight);

        // 主打光 SpotLight：投射柔和阴影，勾勒骰子顶部高光
        const spotLight = new THREE.SpotLight(0xfffaed, 1.4);
        spotLight.position.set(4.5, 13.5, 7.5);
        spotLight.angle = Math.PI / 4.2;
        spotLight.penumbra = 0.6;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.camera.near = 4;
        spotLight.shadow.camera.far = 25;
        spotLight.shadow.bias = -0.0005;
        this.scene.add(spotLight);

        // 侧向轮廓光源：蓝白冷光，增强骰子立体圆角边缘边缘光 (Rim Light)
        const rimLight = new THREE.DirectionalLight(0x9cc3e8, 0.6);
        rimLight.position.set(-6, 7, -6);
        this.scene.add(rimLight);

        // 正前侧微暖填补光
        const frontLight = new THREE.DirectionalLight(0xffeedd, 0.35);
        frontLight.position.set(0, 4, 10);
        this.scene.add(frontLight);
    }

    setupTable() {
        // 赌场高级绿呢绒台面圆形托盘 (Casino Felt Mat)
        const tableGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.4, 64);
        const tableMat = new THREE.MeshStandardMaterial({
            color: 0x0f4c3a, // 经典英式深墨绿
            roughness: 0.88,
            metalness: 0.08
        });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.y = -0.2;
        table.receiveShadow = true;
        this.scene.add(table);

        // 托盘金色外框
        const rimGeo = new THREE.TorusGeometry(5.2, 0.22, 16, 64);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // 贵金属金黄
            roughness: 0.32,
            metalness: 0.85
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
        cupGroup.visible = false;
        this.scene.add(cupGroup);
        this.cup = cupGroup;
    }

    /**
     * 高精度细分圆角长方体算法 (保持 BoxGeometry 6组材质面 UV 映射完全不变)
     * @param {number} size 立方体边长
     * @param {number} radius 圆角半径
     * @param {number} smoothness 细分段数
     */
    createRoundedBoxGeometry(size = 1.0, radius = 0.14, smoothness = 12) {
        const box = new THREE.BoxGeometry(size, size, size, smoothness, smoothness, smoothness);
        const pos = box.attributes.position;
        const v = new THREE.Vector3();
        const half = size / 2;
        const inner = half - radius;

        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);

            // 将顶点 clamp 到内核心长方体内
            const cx = Math.max(-inner, Math.min(inner, v.x));
            const cy = Math.max(-inner, Math.min(inner, v.y));
            const cz = Math.max(-inner, Math.min(inner, v.z));

            // 从内核心沿径向扩展 radius 距离
            const dx = v.x - cx;
            const dy = v.y - cy;
            const dz = v.z - cz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 0) {
                v.x = cx + (dx / dist) * radius;
                v.y = cy + (dy / dist) * radius;
                v.z = cz + (dz / dist) * radius;
            }
            pos.setXYZ(i, v.x, v.y, v.z);
        }

        box.computeVertexNormals();
        return box;
    }

    /**
     * 拟真象牙树脂质感 + 内凹雕刻喷漆纹理 (Diffuse Map)
     * 以及对应的凹陷法线贴图 (Bump Map)
     */
    createDiceFaceCanvas(value) {
        const size = 512; // 提升贴图分辨率为 512x512，雕刻细节极为精细
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Bump 贴图画布 (黑白深度图：浅色平坦，深色凹陷)
        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = size;
        bumpCanvas.height = size;
        const bCtx = bumpCanvas.getContext('2d');

        // 1. 颜色贴图：高档象牙树脂温润微黄底色
        const ivoryGrad = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.72);
        ivoryGrad.addColorStop(0, '#fdfcf9');
        ivoryGrad.addColorStop(0.7, '#f6f3eb');
        ivoryGrad.addColorStop(1, '#ede8dc');
        ctx.fillStyle = ivoryGrad;
        ctx.fillRect(0, 0, size, size);

        // 2. Bump 底色为纯白色（代表基底平面最高）
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(0, 0, size, size);

        // 点数色彩与尺寸
        const rRed = '#b81414';    // 中国传统朱砂/宝石红
        const cBlue = '#13284f';   // 深邃靛青曜黑蓝

        // 绘制内凹圆坑的通用函数
        const drawIndentedDot = (cx, cy, r, color) => {
            // --- A. 颜色贴图绘制 ---
            ctx.save();

            // 1. 凹槽外边缘高光斜面圈 (Bevel Ring: 模拟打孔边缘微细圆角反光)
            ctx.beginPath();
            ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.fill();

            // 2. 凹槽内壁深阴影 (Inner Rim Shadow: 表现孔深)
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            const holeShadow = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
            holeShadow.addColorStop(0, color);
            holeShadow.addColorStop(0.78, color);
            holeShadow.addColorStop(1.0, '#000000');
            ctx.fillStyle = holeShadow;
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;
            ctx.fill();
            ctx.restore();

            // 3. 漆水光亮内反光倒影 (微水珠滴胶透镜效果)
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.32, 0, Math.PI * 2);
            const specGrad = ctx.createRadialGradient(
                cx - r * 0.28, cy - r * 0.28, 0,
                cx - r * 0.28, cy - r * 0.28, r * 0.32
            );
            specGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
            specGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
            ctx.fillStyle = specGrad;
            ctx.fill();
            ctx.restore();

            // --- B. Bump 深度贴图绘制 ---
            bCtx.save();
            // 边缘平缓过渡至底部深凹
            const bumpGrad = bCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.08);
            bumpGrad.addColorStop(0, '#2b2b2b');   // 底部最深
            bumpGrad.addColorStop(0.85, '#555555');
            bumpGrad.addColorStop(1.0, '#ffffff');  // 边缘恢复最高基准面
            bCtx.beginPath();
            bCtx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
            bCtx.fillStyle = bumpGrad;
            bCtx.fill();
            bCtx.restore();
        };

        const c = size / 2;
        const q1 = size * 0.28;
        const q3 = size * 0.72;
        const dotR = 42; // 点数半径

        switch (value) {
            case 1:
                drawIndentedDot(c, c, 76, rRed); // 1点超大朱砂红心
                break;
            case 2:
                drawIndentedDot(q1, q1, dotR, cBlue);
                drawIndentedDot(q3, q3, dotR, cBlue);
                break;
            case 3:
                drawIndentedDot(q1, q1, dotR, cBlue);
                drawIndentedDot(c, c, dotR, cBlue);
                drawIndentedDot(q3, q3, dotR, cBlue);
                break;
            case 4:
                drawIndentedDot(q1, q1, dotR, rRed);
                drawIndentedDot(q3, q1, dotR, rRed);
                drawIndentedDot(q1, q3, dotR, rRed);
                drawIndentedDot(q3, q3, dotR, rRed);
                break;
            case 5:
                drawIndentedDot(q1, q1, dotR, cBlue);
                drawIndentedDot(q3, q1, dotR, cBlue);
                drawIndentedDot(c, c, dotR, rRed); // 中心红
                drawIndentedDot(q1, q3, dotR, cBlue);
                drawIndentedDot(q3, q3, dotR, cBlue);
                break;
            case 6:
                drawIndentedDot(q1, size * 0.22, dotR, cBlue);
                drawIndentedDot(q1, c, dotR, cBlue);
                drawIndentedDot(q1, size * 0.78, dotR, cBlue);
                drawIndentedDot(q3, size * 0.22, dotR, cBlue);
                drawIndentedDot(q3, c, dotR, cBlue);
                drawIndentedDot(q3, size * 0.78, dotR, cBlue);
                break;
        }

        return { colorCanvas, bumpCanvas };
    }

    /**
     * 生成 6 个面的物理清漆材质 (MeshPhysicalMaterial)
     */
    createDiceMaterials() {
        const colorTextures = [];
        const bumpTextures = [];

        for (let i = 1; i <= 6; i++) {
            const { colorCanvas, bumpCanvas } = this.createDiceFaceCanvas(i);

            const cTex = new THREE.CanvasTexture(colorCanvas);
            cTex.anisotropy = 4;
            colorTextures[i] = cTex;

            const bTex = new THREE.CanvasTexture(bumpCanvas);
            bTex.anisotropy = 4;
            bumpTextures[i] = bTex;
        }

        const buildPhysicalMat = (val) => {
            return new THREE.MeshPhysicalMaterial({
                map: colorTextures[val],
                bumpMap: bumpTextures[val],
                bumpScale: 0.035,           // 恰到好处的凹陷深度
                roughness: 0.16,            // 树脂基底细腻微光
                metalness: 0.02,            // 非金属介质
                clearcoat: 0.96,            // 高清透明清漆层 (汽车漆/钢琴漆高光质感)
                clearcoatRoughness: 0.06,   // 清漆极其平滑亮丽
                reflectivity: 0.75          // 环境反射率
            });
        };

        // Three.js BoxGeometry 6个面的索引规则：
        // 0: +X (Right) -> 3
        // 1: -X (Left)  -> 4
        // 2: +Y (Top)   -> 1
        // 3: -Y (Bottom)-> 6
        // 4: +Z (Front) -> 2
        // 5: -Z (Back)  -> 5
        return [
            buildPhysicalMat(3),
            buildPhysicalMat(4),
            buildPhysicalMat(1),
            buildPhysicalMat(6),
            buildPhysicalMat(2),
            buildPhysicalMat(5)
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

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.diceGeometry, this.materials);
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
                held: false
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
                x = (idx - 1) * spacing;
                z = 0;
            } else if (count === 4) {
                x = (idx % 2 - 0.5) * spacing;
                z = (Math.floor(idx / 2) - 0.5) * spacing;
            } else if (count === 5) {
                if (idx === 4) {
                    x = 0; z = 0;
                } else {
                    x = (idx % 2 - 0.5) * spacing * 1.4;
                    z = (Math.floor(idx / 2) - 0.5) * spacing * 1.4;
                }
            } else if (count === 6) {
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
     * 掷骰子动画入口 - 刚体多段弹跳物理积分与碰撞发声联动
     */
    roll(values, holdMask = null, onComplete = null) {
        if (this.animating) {
            // 快速连续投掷保护：立即平稳结算上一轮，杜绝卡死
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
        const duration = 1450; // 动画时长约 1.45s

        this.dices.forEach((dice, i) => {
            const isHeld = holdMask && holdMask[i];
            dice.held = isHeld;

            if (isHeld) {
                return;
            }

            dice.isRolling = true;
            dice.targetVal = values[i];
            dice.value = values[i];

            // 初始从高空随机离散位置下落
            const angle = (i / this.dices.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
            const dist = 1.3 + Math.random() * 1.4;
            const startX = Math.cos(angle) * dist;
            const startZ = Math.sin(angle) * dist;
            const startY = 6.2 + Math.random() * 1.8;

            dice.startPos = new THREE.Vector3(startX, startY, startZ);
            dice.mesh.position.copy(dice.startPos);

            // 剧烈初始翻滚角速度 (弧度/秒)
            dice.spinSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 48,
                (Math.random() - 0.5) * 48,
                (Math.random() - 0.5) * 48
            );

            // 落地时的微随机偏角
            const randAngle = (Math.random() - 0.5) * 0.55;
            dice.finalQuat = this.getTargetQuaternion(dice.targetVal, randAngle);

            dice.startTime = now;
            dice.duration = duration + (Math.random() - 0.5) * 150;

            // 弹跳声效触发计数器
            dice.hitTriggered = [false, false, false];
        });
    }

    /**
     * 骰盅升降动画（吹牛/骰宝）
     */
    animateCup(action, onDone = null) {
        if (!this.cup) {
            if (onDone) onDone();
            return;
        }

        const wasVisible = this.cup.visible;
        this.cup.visible = true;

        let startY = this.cup.position.y;
        let targetY = 0;

        if (action === 'cover') {
            // 如果原本不可见或已经完全揭开，从上方降落；如果正在偷瞄中，直接从当前高度扣回桌面
            if (!wasVisible || startY >= 6.0) {
                this.cup.position.set(0, 7, 0);
                startY = 7;
            }
            targetY = 0;
        } else if (action === 'lift') {
            // 揭开骰盅升入高空
            targetY = 7;
        } else if (action === 'peek') {
            // 半掀开偷瞄 (升起到 2.2)
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
     * 主渲染循环 - 动力学积分、撞击声效精准触发与落地停驻微颤 (Settling Wobble)
     */
    animate(time) {
        requestAnimationFrame(this.animate);

        // 手机后台节电或 WebGL 上下文丢失时跳过渲染计算
        if (this.isContextLost || this.paused) {
            return;
        }

        let anyRolling = false;

        this.dices.forEach((d) => {
            if (!d.isRolling) return;
            anyRolling = true;

            const elapsed = time - d.startTime;
            const progress = Math.min(elapsed / d.duration, 1.0);

            // 阶段一：前 70% 时间为下落自由落体与多次反弹
            if (progress < 0.70) {
                const subP = progress / 0.70; // 0 ~ 1

                // 物理反弹曲线模拟：3 段能量衰减弹跳
                // 弹跳节点：
                // 0 ~ 0.45: 第一次主下落冲击 (大弹跳)
                // 0.45 ~ 0.75: 第二次弹跳 (中弹跳)
                // 0.75 ~ 1.0: 第三次微弹跳 (微弹跳)
                let height = 0;
                if (subP < 0.45) {
                    const p1 = subP / 0.45;
                    // 重力加速下落: h = 1 - p1^2
                    height = (1 - p1 * p1) * (d.startPos.y - 0.5);

                    // 接近地面瞬间触发第 1 次重撞击音效
                    if (p1 > 0.88 && !d.hitTriggered[0]) {
                        d.hitTriggered[0] = true;
                        if (window.soundEngine) {
                            window.soundEngine.playDiceHit(0.95);
                        }
                    }
                } else if (subP < 0.75) {
                    const p2 = (subP - 0.45) / 0.30;
                    // 正弦抛物线反弹
                    height = Math.sin(p2 * Math.PI) * 1.45;

                    // 触地触发第 2 次碰撞音效
                    if (p2 > 0.88 && !d.hitTriggered[1]) {
                        d.hitTriggered[1] = true;
                        if (window.soundEngine) {
                            window.soundEngine.playDiceHit(0.48);
                        }
                    }
                } else {
                    const p3 = (subP - 0.75) / 0.25;
                    height = Math.sin(p3 * Math.PI) * 0.42;

                    // 触地触发第 3 次轻微触台音效
                    if (p3 > 0.88 && !d.hitTriggered[2]) {
                        d.hitTriggered[2] = true;
                        if (window.soundEngine) {
                            window.soundEngine.playDiceHit(0.22);
                        }
                    }
                }

                d.mesh.position.y = 0.5 + Math.max(0, height);

                // 水平位置向目标点阻尼平滑滑动
                const horizontalEase = 1 - Math.pow(1 - subP, 2.2);
                d.mesh.position.x = THREE.MathUtils.lerp(d.startPos.x, d.targetPos.x, horizontalEase);
                d.mesh.position.z = THREE.MathUtils.lerp(d.startPos.z, d.targetPos.z, horizontalEase);

                // 自由旋转 (角速度随能量逐渐轻微衰减)
                const spinDecay = 1 - subP * 0.4;
                d.mesh.rotation.x += d.spinSpeed.x * 0.016 * spinDecay;
                d.mesh.rotation.y += d.spinSpeed.y * 0.016 * spinDecay;
                d.mesh.rotation.z += d.spinSpeed.z * 0.016 * spinDecay;
            }
            // 阶段二：70% ~ 100% 阶段，平滑吸附到目标朝向并带有阻尼微晃 (Settling Wobble)
            else {
                const alignProgress = (progress - 0.70) / 0.30; // 0 ~ 1

                // 位置迅速归位至桌面台面
                d.mesh.position.lerp(d.targetPos, 0.22);

                // 阻尼微晃衰减函数 (Damped Harmonic Oscillation)
                // 模拟落地后骰子角速度在软呢绒上的微弱颤动收敛
                const wobbleDecay = Math.exp(-alignProgress * 5.0);
                const wobbleAngle = Math.sin(alignProgress * Math.PI * 4.0) * wobbleDecay * 0.12;

                d.mesh.position.y = 0.5 + Math.abs(wobbleAngle) * 0.1;

                // 四元数球形插值对齐最终目标朝向
                d.mesh.quaternion.slerp(d.finalQuat, 0.24);

                // 叠加微弱阻尼晃动
                if (alignProgress < 0.9) {
                    d.mesh.rotateX(wobbleAngle * 0.5);
                    d.mesh.rotateZ(wobbleAngle * 0.5);
                }
            }

            // 动画完成收敛
            if (progress >= 1.0) {
                d.isRolling = false;
                d.mesh.position.copy(d.targetPos);
                d.mesh.quaternion.copy(d.finalQuat);
            }
        });

        // 全部骰子滚动完成时的回调触发
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

    updateCameraResponsive(width, height) {
        if (!this.camera) return;
        const aspect = width / height;
        this.camera.aspect = aspect;

        // 优化相机视距与视场角，让精致的圆角倒角高光与内凹雕刻细节更具视觉冲击力
        if (width < 450) {
            this.camera.fov = 48;
            this.camera.position.set(0, 8.8, 10.5);
        } else if (width < 640) {
            this.camera.fov = 42;
            this.camera.position.set(0, 8.2, 9.8);
        } else {
            this.camera.fov = 36;
            this.camera.position.set(0, 7.6, 9.0);
        }
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();
    }

    onResize() {
        if (!this.container || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.updateCameraResponsive(width, height);
        this.renderer.setSize(width, height);
    }
}

window.Dice3DEngine = Dice3DEngine;

