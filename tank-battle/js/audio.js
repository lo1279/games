/**
 * 坦克大战 - 8-Bit 复古音效合成器 (Web Audio API)
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * 玩家射击声音
   */
  playShoot() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  /**
   * 子弹击中铁墙/反弹叮当金属音
   */
  playHitSteel() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  /**
   * 击中砖块轻微爆破音
   */
  playHitBrick() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  /**
   * 坦克摧毁大型轰鸣爆炸音
   */
  playExplosion() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    // 白噪波层
    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.45);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  /**
   * 拾取道具奖赏音
   */
  playPowerup() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const notes = [330, 440, 550, 660, 880];
    const step = 0.05;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * step);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime + idx * step);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (idx + 1) * step);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * step);
      osc.stop(this.ctx.currentTime + (idx + 1) * step);
    });
  }

  /**
   * 关卡开场音乐乐句 (经典 8-bit 开场小调)
   */
  playLevelStart() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    // 经典开场前奏音符频率序列
    const melody = [
      { f: 261.63, d: 0.12 }, // C4
      { f: 329.63, d: 0.12 }, // E4
      { f: 392.00, d: 0.12 }, // G4
      { f: 523.25, d: 0.20 }, // C5
      { f: 392.00, d: 0.12 }, // G4
      { f: 523.25, d: 0.35 }  // C5
    ];

    let t = this.ctx.currentTime;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + note.d);

      t += note.d * 1.05;
    });
  }

  /**
   * 游戏失败/基地被毁音效
   */
  playGameOver() {
    if (this.muted) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    const notes = [440, 415.3, 392, 349.2, 311.1, 261.6];
    let t = this.ctx.currentTime;
    notes.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.18);
      t += 0.18;
    });
  }
}

// 全局单例
const soundEngine = new SoundEngine();
