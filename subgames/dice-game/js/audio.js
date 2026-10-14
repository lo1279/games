/**
 * 音频引擎 (Web Audio API)
 * 纯程序化合成音效，无需下载外部音频文件，极速加载且 100% 可用。
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.hasUserInteracted = false;
        this.init();
    }

    init() {
        // 用户首次手势交互时激活 AudioContext 并开启触觉振动许可
        const resumeAudio = () => {
            this.hasUserInteracted = true;
            this.ensureContext();
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
            window.removeEventListener('touchend', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);
        window.addEventListener('touchend', resumeAudio);

        // 针对微信小程序 web-view 与微信内置浏览器的自动预热
        if (typeof window.WeixinJSBridge !== 'undefined') {
            try {
                window.WeixinJSBridge.invoke('getNetworkType', {}, () => {
                    this.hasUserInteracted = true;
                    this.ensureContext();
                });
            } catch (e) {}
        } else {
            document.addEventListener('WeixinJSBridgeReady', () => {
                this.hasUserInteracted = true;
                this.ensureContext();
            }, false);
        }
    }

    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    /**
     * 手机真机触感振动反馈 (Haptic Feedback)
     * 支持 Android、各类移动浏览器及微信端环境；不支持或未产生用户手势时静默跳过
     */
    triggerHaptic(type = 'click') {
        if (!this.enabled || !this.hasUserInteracted) return;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                switch (type) {
                    case 'shake':
                        navigator.vibrate([15, 20, 15]); // 摇晃微震颤
                        break;
                    case 'hit':
                        navigator.vibrate(22);           // 落地坚硬撞击清脆短顿挫
                        break;
                    case 'win':
                        navigator.vibrate([30, 45, 35, 55]); // 中奖节奏震颤
                        break;
                    case 'click':
                        navigator.vibrate(10);           // 触控按键微反馈
                        break;
                }
            } catch (e) {
                // 忽略非受控环境震动权限异常
            }
        }
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
        this.triggerHaptic('shake');
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
     * 摇晃微撞击触发器
     */
    triggerWoodHit(time, volume, pitch) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(pitch, time);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, time + 0.02);

            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(time);
            osc.stop(time + 0.03);
        } catch (e) {
            // 忽略音频调度边缘时序异常
        }
    }

    /**
     * 骰子撞击桌面声 (双层复合音色：表面坚硬撞击 + 木质/呢绒深层共振)
     * @param {number} intensity 碰撞强度 0.1 ~ 1.0 (根据下落瞬时速度计算)
     */
    playDiceHit(intensity = 0.5) {
        if (!this.enabled) return;
        this.triggerHaptic('hit');
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const volume = Math.min(Math.max(intensity * 0.4, 0.08), 0.45);
        const pitch = 380 + Math.random() * 80;

        // 1. 高频清脆击打层 (模拟坚硬树脂骰子与桌面表层的接触)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(pitch * 2.2, now);
        snapOsc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + 0.025);

        snapGain.gain.setValueAtTime(volume * 0.7, now);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(now);
        snapOsc.stop(now + 0.035);

        // 2. 低频木质/托盘共振层 (模拟托盘木质空腔共鸣)
        const resOsc = ctx.createOscillator();
        const resGain = ctx.createGain();
        const resFilter = ctx.createBiquadFilter();

        resOsc.type = 'sine';
        resOsc.frequency.setValueAtTime(pitch, now);
        resOsc.frequency.exponentialRampToValueAtTime(pitch * 0.35, now + 0.05);

        resFilter.type = 'lowpass';
        resFilter.frequency.setValueAtTime(800, now);

        resGain.gain.setValueAtTime(volume, now);
        resGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

        resOsc.connect(resFilter);
        resFilter.connect(resGain);
        resGain.connect(ctx.destination);

        resOsc.start(now);
        resOsc.stop(now + 0.07);
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
        this.triggerHaptic('win');
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
        this.triggerHaptic('click');
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
