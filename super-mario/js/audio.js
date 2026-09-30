/**
 * 🎮 超级马里奥兄弟 - Web Audio 8-Bit 经典音效合成器
 * 纯原生 Web Audio API，无需外部音频资源，零延迟响应
 */

class MarioAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (err) {
        // 安全忽略
      }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.bgmPlaying) {
      this.stopBGM();
      this.bgmPlaying = true; // 保持状态标记以便解禁时恢复
    } else if (!this.muted && this.bgmPlaying) {
      this.startBGM();
    }
    return this.muted;
  }

  // 1. 小马里奥跳跃音效 (短促高音滑音)
  playJumpSmall() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // 2. 大马里奥跳跃音效 (厚重滑音)
  playJumpSuper() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'square';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.22);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // 3. 吃金币音效 (经典叮咚双音)
  playCoin() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 4. 踩敌人音效 (钝击踏步)
  playStomp() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 5. 顶砖块触顶音效 (方波短促低震)
  playBump() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 6. 砖块击碎音效 (噪波爆炸)
  playBreakBlock() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
  }

  // 7. 蘑菇钻出音效 (快速上行琶音)
  playPowerupAppears() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [330, 392, 659, 523, 587, 784];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.04;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    });
  }

  // 8. 变大进化音效 (经典的阶梯琶音)
  playPowerup() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const freqs = [330, 392, 659, 523, 587, 784, 659, 784, 987, 880, 1046, 1318];
    const now = this.ctx.currentTime;
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.045;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    });
  }

  // 9. 管道进出音效 (低频管道滑动声)
  playPipe() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const freqs = [180, 200, 220, 240, 260, 240, 200, 160];
    const now = this.ctx.currentTime;
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    });
  }

  // 10. 踢飞龟壳音效
  playKick() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  // 11. 马里奥死亡旋律
  playDie() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.stopBGM();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 500, d: 0.12 },
      { f: 400, d: 0.12 },
      { f: 300, d: 0.12 },
      { f: 200, d: 0.35 }
    ];

    let offset = 0;
    notes.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + offset;
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + note.d + 0.02);
      offset += note.d + 0.04;
    });
  }

  // 12. 踩旗杆通关胜利旋律
  playStageClear() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.stopBGM();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 392, d: 0.12 }, // G4
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.5, d: 0.25 }, // C6
      { f: 1318.5, d: 0.35 }  // E6
    ];

    let offset = 0;
    notes.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + offset;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, t);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + note.d + 0.02);
      offset += note.d + 0.03;
    });
  }

  // 13. 经典地表 BGM 循环生成器 (8-Bit 经典旋律小节)
  startBGM() {
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    if (this.muted) return;

    const playThemeLoop = () => {
      if (!this.bgmPlaying || this.muted) return;
      this.ensureContext();
      if (!this.ctx) return;

      const tempo = 0.11; // 每个八分音符的基准节拍时间
      const melody = [
        // 第一小节：经典的 E E - E - C E - G ---
        { f: 659.25, d: 1 }, { f: 659.25, d: 1 }, { f: 0, d: 1 }, { f: 659.25, d: 1 },
        { f: 0, d: 1 }, { f: 523.25, d: 1 }, { f: 659.25, d: 1 }, { f: 0, d: 1 },
        { f: 783.99, d: 2 }, { f: 0, d: 2 }, { f: 392.00, d: 2 }, { f: 0, d: 2 },
        // 第二小节：C - - G - - E - - A - B - Bb A
        { f: 523.25, d: 1.5 }, { f: 0, d: 0.5 }, { f: 392.00, d: 1.5 }, { f: 0, d: 0.5 },
        { f: 329.63, d: 1.5 }, { f: 0, d: 0.5 }, { f: 440.00, d: 1 }, { f: 493.88, d: 1 },
        { f: 466.16, d: 1 }, { f: 440.00, d: 1.5 }, { f: 0, d: 0.5 }
      ];

      const now = this.ctx.currentTime;
      let totalTime = 0;

      melody.forEach(item => {
        const dur = item.d * tempo;
        if (item.f > 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(item.f, now + totalTime);
          gain.gain.setValueAtTime(0.06, now + totalTime);
          gain.gain.exponentialRampToValueAtTime(0.005, now + totalTime + dur * 0.9);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + totalTime);
          osc.stop(now + totalTime + dur * 0.95);
        }
        totalTime += dur;
      });

      this.bgmTimer = setTimeout(() => {
        if (this.bgmPlaying) {
          playThemeLoop();
        }
      }, (totalTime + 0.2) * 1000);
    };

    playThemeLoop();
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

window.marioAudio = new MarioAudio();
