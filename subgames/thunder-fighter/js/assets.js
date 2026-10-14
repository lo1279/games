/**
 * 游戏资源加载与受击蒙版生成器 (Asset Manager & Hit-Flash Sprite Engine)
 * 管理玩家战机、暴走形态、僚机、各型敌机及史诗 Boss 高清贴图
 * 并自动利用离屏 Canvas 动态生成高亮受击白色蒙版图
 */

class AssetManager {
    constructor() {
        this.images = {};
        this.flashImages = {};
        this.loadedCount = 0;
        this.totalCount = 0;
        this.isReady = false;

        const version = '?v=' + Date.now();
        this.manifest = {
            'player': 'assets/images/player.png' + version,
            'player_rage': 'assets/images/player_rage.png' + version,
            'wingman': 'assets/images/wingman.png' + version,
            'enemy_scout': 'assets/images/enemy_scout.png' + version,
            'enemy_cruiser': 'assets/images/enemy_cruiser.png' + version,
            'enemy_gunship': 'assets/images/enemy_gunship.png' + version,
            'enemy_kamikaze': 'assets/images/enemy_kamikaze.png' + version,
            'boss': 'assets/images/boss.png' + version
        };

        this.init();
    }

    init() {
        const keys = Object.keys(this.manifest);
        this.totalCount = keys.length;

        keys.forEach(key => {
            const img = new Image();
            img.src = this.manifest[key];

            img.onload = () => {
                this.images[key] = img;
                // 动态在内存离屏 Canvas 中提取 Alpha 通道，生成纯白受击闪光帧
                this.flashImages[key] = this.createWhiteFlashSprite(img);
                this.loadedCount++;
                if (this.loadedCount >= this.totalCount) {
                    this.isReady = true;
                    console.log('雷霆战机全部 8 张高清机体贴图加载完成！');
                }
            };

            img.onerror = (err) => {
                console.warn(`贴图 [${key}] 加载失败或未放置，自动启用矢量回退绘制:`, err);
                this.loadedCount++;
                if (this.loadedCount >= this.totalCount) {
                    this.isReady = true;
                }
            };
        });
    }

    // 利用离屏 Canvas 将图像非透明像素染色为高亮白色，实现绝佳打击受击反馈
    createWhiteFlashSprite(img) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return img;

            ctx.drawImage(img, 0, 0);
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, img.width, img.height);
            return canvas;
        } catch (e) {
            console.warn('生成受击闪白离屏画布失败:', e);
            return img;
        }
    }

    getImage(key, isFlash = false) {
        if (isFlash && this.flashImages[key]) {
            return this.flashImages[key];
        }
        return this.images[key] || null;
    }

    isLoaded(key) {
        return !!this.images[key];
    }
}

window.assets = new AssetManager();
