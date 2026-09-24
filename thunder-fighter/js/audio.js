/**
 * 音频管理器 (Sound Effects Engine)
 * 使用 Web Audio API 纯原生代码实时合成科幻音效，无任何外部音频文件依赖
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 0.35;
        this.initialized = false;
        this.lastLaserTime = 0;
        this.lastHeavyLaserTime = 0;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.ctx = new AudioContext();
            this.initialized = true;
        }
    }

    // 确保在用户交互后 AudioContext 处于 running 状态
    ensureResume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    // 基础播放封装
    _playTone(fn) {
        if (this.muted) return;
        this.ensureResume();
        if (!this.ctx) return;
        try {
            fn(this.ctx);
        } catch (e) {
            console.warn('Audio playback error', e);
        }
    }

    // 1. 普通激光射击音效 (带 70ms 节流)
    playLaser() {
        const now = performance.now();
        if (now - this.lastLaserTime < 70) return;
        this.lastLaserTime = now;

        this._playTone(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        });
    }

    // 2. 高阶武器/暴走激光束射击 (带 80ms 节流)
    playHeavyLaser() {
        const now = performance.now();
        if (now - this.lastHeavyLaserTime < 80) return;
        this.lastHeavyLaserTime = now;

        this._playTone(ctx => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'square';
            osc2.type = 'sawtooth';

            osc1.frequency.setValueAtTime(520, ctx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
            osc2.frequency.setValueAtTime(740, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18);

            gain.gain.setValueAtTime(this.masterVolume * 0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.18);
            osc2.stop(ctx.currentTime + 0.18);
        });
    }

    // 3. 导弹发射呼啸声
    playMissile() {
        this._playTone(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(260, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(680, ctx.currentTime + 0.15);
            osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.28);

            gain.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.28);
        });
    }

    // 4. 小型爆炸音效
    playExplosionSmall() {
        this._playTone(ctx => {
            const bufferSize = ctx.sampleRate * 0.25;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(this.masterVolume * 0.6, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noise.start();
        });
    }

    // 5. 巨型 Boss / 重型爆炸声
    playExplosionLarge() {
        this._playTone(ctx => {
            const bufferSize = ctx.sampleRate * 0.8;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, ctx.currentTime);
            filter.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.8);

            // 加入震颤低频振荡器
            const subOsc = ctx.createOscillator();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(90, ctx.currentTime);
            subOsc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.8);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(this.masterVolume * 0.9, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

            noise.connect(filter);
            filter.connect(gain);
            subOsc.connect(gain);
            gain.connect(ctx.destination);

            noise.start();
            subOsc.start();
            subOsc.stop(ctx.currentTime + 0.8);
        });
    }

    // 6. 拾取水晶 (清脆音)
    playPickupCrystal() {
        this._playTone(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(987, ctx.currentTime); // B5
            osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.05); // E6

            gain.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        });
    }

    // 7. 拾取武器升级 (Power Up 辉煌音)
    playPowerUp() {
        this._playTone(ctx => {
            const notes = [440, 554, 659, 880, 1108]; // A4, C#5, E5, A5, C#6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const startTime = ctx.currentTime + idx * 0.05;

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(this.masterVolume * 0.4, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.12);
            });
        });
    }

    // 8. 释放核弹 / EMP 必杀技
    playBomb() {
        this._playTone(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.2);

            gain.gain.setValueAtTime(this.masterVolume * 1.0, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 1.2);
            this.playExplosionLarge();
        });
    }

    // 9. Boss 预警红光警报
    playWarning() {
        this._playTone(ctx => {
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const t = ctx.currentTime + i * 0.28;

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, t);
                osc.frequency.linearRampToValueAtTime(450, t + 0.2);

                gain.gain.setValueAtTime(this.masterVolume * 0.5, t);
                gain.gain.linearRampToValueAtTime(0.01, t + 0.22);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + 0.22);
            }
        });
    }

    // 10. 护盾受击反弹嗡鸣
    playShieldHit() {
        this._playTone(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(this.masterVolume * 0.45, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        });
    }
}

window.sounds = new SoundEngine();
