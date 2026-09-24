/**
 * 音频引擎 (Web Audio API)
 * 纯程序化合成音效，无需下载外部音频文件，极速加载且 100% 可用。
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.init();
    }

    init() {
        // 用户首次交互时激活 AudioContext
        const resumeAudio = () => {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);
    }

    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * 摇骰盅声：快速密集的碰撞颗粒与内壁摩擦
     */
    playShake() {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const duration = 0.8;
        const now = ctx.currentTime;

        // 生成白噪声并使用带通滤波模拟骰盅内壁连续摩擦震荡
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.linearRampToValueAtTime(1400, now + duration * 0.5);
        filter.frequency.linearRampToValueAtTime(600, now + duration);
        filter.Q.value = 3.0;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + duration);

        // 穿插数次木质小撞击模拟多骰子碰撞
        for (let i = 0; i < 7; i++) {
            const hitTime = now + 0.08 * i + Math.random() * 0.05;
            this.triggerWoodHit(hitTime, 0.08 + Math.random() * 0.06, 350 + Math.random() * 300);
        }
    }

    /**
     * 骰子撞击桌面声 (木质/桌布拟真碰撞)
     */
    playDiceHit(volume = 0.25, pitch = 400) {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        this.triggerWoodHit(ctx.currentTime, volume, pitch);
    }

    triggerWoodHit(time, volume = 0.2, freq = 450) {
        const ctx = this.ctx;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.04);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, time);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.06);
    }

    /**
     * 筹码投掷/下注清脆敲击声
     */
    playChipBet() {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
    }

    /**
     * 胜利/获得奖金音效 (清脆大三和弦琶音)
     */
    playWin() {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const noteTime = now + idx * 0.09;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.001, noteTime);
            gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(noteTime);
            osc.stop(noteTime + 0.36);
        });
    }

    /**
     * 遗憾/失败提示音 (低沉小二度)
     */
    playLose() {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(146.83, now + 0.25); // A3 -> D3

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 点击通用按键音效
     */
    playClick() {
        if (!this.enabled) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.03);
    }
}

window.soundEngine = new SoundEngine();
