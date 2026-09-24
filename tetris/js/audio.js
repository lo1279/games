/**
 * Web Audio API 音效合成引擎
 * 无需外部音频资源，纯算法生成街机风格复古/电子音效
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
    }

    /**
     * 初始化 AudioContext（需在用户首次交互时唤醒）
     */
    init() {
        if (!this.initialized) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
                this.initialized = true;
            }
        } else if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * 切换静音状态
     */
    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    /**
     * 播放单音调声音
     */
    playTone(freq, type = 'square', duration = 0.08, gainVal = 0.1) {
        if (this.muted || !this.ctx) return;
        this.init();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio play error:', e);
        }
    }

    /**
     * 方块左右微移
     */
    playMove() {
        this.playTone(320, 'sine', 0.04, 0.05);
    }

    /**
     * 方块旋转
     */
    playRotate() {
        if (this.muted || !this.ctx) return;
        this.init();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.07);

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.07);
        } catch (e) {}
    }

    /**
     * 硬降（落地锁定）
     */
    playDrop() {
        if (this.muted || !this.ctx) return;
        this.init();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
    }

    /**
     * 消除行（根据行数播放多段琶音）
     */
    playClear(lines) {
        if (this.muted || !this.ctx) return;
        this.init();

        const notes = lines === 4 
            ? [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 (Tetris!)
            : [440, 554.37, 659.25].slice(0, lines + 1);

        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, lines === 4 ? 'square' : 'triangle', 0.12, 0.12);
            }, idx * 60);
        });
    }

    /**
     * 等级升级
     */
    playLevelUp() {
        if (this.muted || !this.ctx) return;
        this.init();

        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.15, 0.15);
            }, idx * 80);
        });
    }

    /**
     * 游戏结束
     */
    playGameOver() {
        if (this.muted || !this.ctx) return;
        this.init();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(350, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.6);

            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.6);
        } catch (e) {}
    }

    /**
     * 暂存方块音效
     */
    playHold() {
        this.playTone(587.33, 'triangle', 0.08, 0.08); // D5
    }
}

export const sound = new SoundEngine();
