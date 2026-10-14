/**
 * 三国志·战略版 - Web Audio 程序化拟真声效引擎 (Procedural Audio)
 * 纯算法实时合成战鼓轰鸣、号角集结、刀剑交错、战法烈焰与胜利金戈声
 *
 * ★ 五星名将揭晓的仪式感音效组（金光炸裂 / 放射光柱 / 金屑迸射 / 屏幕冲击）
 *   全部为实时合成，不依赖任何外部音频文件。
 *   各音效按时间轴分层编排，由 main.js 的翻牌逻辑在对应时刻触发。
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    // 复用的混响卷积节点，避免每出一次五星光爆都重新构建脉冲响应
    this.reverbNode = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * 构建（或复用）混响节点。
   * 程序化生成指数衰减噪声作为脉冲响应，让金光音效带出殿宇般的空间混响尾。
   * 懒加载：首次调用时才生成，之后整个会话复用。
   */
  ensureReverb() {
    this.init();
    if (!this.ctx || this.reverbNode) return this.reverbNode;

    const dur = 1.8;
    const rate = this.ctx.sampleRate;
    const len = Math.floor(dur * rate);
    const ir = this.ctx.createBuffer(2, len, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // 前 10ms 留白模拟预延迟，之后按指数衰减的噪声
        const decay = Math.pow(1 - i / len, 2.6);
        data[i] = (Math.random() * 2 - 1) * decay * (i < rate * 0.01 ? 0.1 : 1);
      }
    }

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = ir;
    return this.reverbNode;
  }

  /**
   * 生成一枚带包络的振荡器音符。
   * 抽离出来供下面的特效音效复用，避免每个音效重复样板代码。
   * @param {object} o - freq 起始频率 / freqEnd 结束频率 / delay 延迟秒
   * @param {number} t0 - 基准时间
   * @param {string} type - 波形
   * @param {number} peak - 峰值音量
   * @param {number} dur - 持续秒数
   * @param {number} attack - 起音秒数
   */
  blip(o, t0, type, peak, dur, attack = 0.008) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = t0 + (o.delay || 0);

    osc.type = type;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + dur);
    }

    // 指数起音比线性起音更自然，避免"啪"的突变感
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playDrum() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playSwordClash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playSkillCast() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playVictoryHorn() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  playGoldChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.1);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  // 🌟 抽卡出金专属震撼华美金戈和弦 (五星名将降临)
  playGachaGold() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // 大三和弦加高八度
    chords.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    });
  }

  // 💜 抽卡出紫专属灵动紫霞琴音 (四星良将降临)
  playGachaPurple() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [440.00, 554.37, 659.25, 880.00];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  // 🃏 卡牌 3D 翻开轻快破空/纸牌脆响
  playCardFlip() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  // ============================================================
  // ★ 五星名将揭晓 · 四层仪式感音效组
  // 由 main.js 翻牌编排按 0ms / 180ms / 300ms / 450ms 分层触发
  // ============================================================

  /**
   * 第①层 金光炸裂 —— 出五星瞬间的强光爆音。
   * 构成：低频"轰"底 + 高频"闪" + 上行五声音阶琶音 + 混响尾。
   * @param {boolean} isCore - 核心名将额外叠加一层低八度重音
   */
  playGoldBurst(isCore = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t0 = this.ctx.currentTime;
    const reverb = this.ensureReverb();
    if (reverb) {
      const wet = this.ctx.createGain();
      wet.gain.value = 0.32;
      wet.connect(this.ctx.destination);
      reverb.connect(wet);
    }

    // 低频轰底：方波快速下滑，模拟能量爆发
    this.blip({ freq: 220, freqEnd: 45 }, t0, 'sine', 0.5, 0.5);
    // 高频闪：极短的高频噪声感方波，制造"亮光"瞬间
    this.blip({ freq: 3200, freqEnd: 1400 }, t0, 'square', 0.12, 0.09);
    // 上行五声音阶琶音（C5-D5-E5-G5-A5），古风宫调感
    [523.25, 587.33, 659.25, 783.99, 880.00].forEach((f, i) => {
      this.blip({ freq: f, delay: 0.03 + i * 0.045 }, t0, 'triangle', 0.3, 0.5);
    });

    // 核心名将：叠一记低八度重音，强调"霸业"分量
    if (isCore) {
      this.blip({ freq: 110, freqEnd: 55 }, t0 + 0.02, 'triangle', 0.45, 0.9);
      this.blip({ freq: 261.63, delay: 0.16 }, t0, 'sine', 0.28, 1.1);
    }

    // 把琶音声部送入混响，营造殿宇空间尾音
    if (reverb) {
      const send = this.ctx.createGain();
      send.gain.value = 0.4;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      osc.connect(g);
      g.connect(reverb);
      osc.start(t0);
      osc.stop(t0 + 1.5);
    }
  }

  /**
   * 第②层 放射光柱 —— 铜锣一记，承接金光炸裂。
   * 用两个略微失谐的方波叠加产生金属钟体的拍频感。
   */
  playGoldRay() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t0 = this.ctx.currentTime;
    // 失谐双音 → 拍频，模拟铜锣厚度
    this.blip({ freq: 296, freqEnd: 288 }, t0, 'square', 0.16, 1.4);
    this.blip({ freq: 592, freqEnd: 578 }, t0, 'triangle', 0.12, 1.2);
    // 高频泛音点缀，让光芒更"亮"
    this.blip({ freq: 1480, freqEnd: 1180 }, t0, 'sine', 0.08, 0.7);
  }

  /**
   * 第③层 金屑迸射 —— 细碎高频的金粉闪烁。
   * 多枚随机高频短音，间隔不规则，模拟颗粒感。
   */
  playGoldSparkle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 7; i++) {
      // 频率在 1800~5200 随机，模拟不规则闪光
      const f = 1800 + Math.random() * 3400;
      this.blip(
        { freq: f, freqEnd: f * 0.75, delay: Math.random() * 0.42 },
        t0,
        'sine',
        0.055 + Math.random() * 0.04,
        0.09 + Math.random() * 0.14
      );
    }
  }

  /**
   * 第④层 屏幕冲击 —— 浮层震动的低频体感音。
   * 核心名将额外加一层更重的次低频。
   */
  playScreenImpact(isCore = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t0 = this.ctx.currentTime;
    this.blip({ freq: 90, freqEnd: 32 }, t0, 'sine', isCore ? 0.55 : 0.4, 0.7, 0.02);

    if (isCore) {
      this.blip({ freq: 60, freqEnd: 26 }, t0 + 0.03, 'sine', 0.5, 1.1, 0.03);
      // 核心专属：叠一记金属大钟长鸣
      this.blip({ freq: 196, freqEnd: 190 }, t0 + 0.05, 'triangle', 0.2, 1.8, 0.04);
    }
  }

  /**
   * 💜 四星紫卡揭晓 —— 简化版仪式音（无低频冲击与粒子感）
   * @param {boolean} isCore - 紫卡暂无核心概念，预留参数
   */
  playPurpleBurst(isCore = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t0 = this.ctx.currentTime;
    this.blip({ freq: 180, freqEnd: 50 }, t0, 'sine', 0.32, 0.4);
    // 紫霞琴音：柔和的 A4-C5-E5-A5
    [440.00, 523.25, 659.25, 880.00].forEach((f, i) => {
      this.blip({ freq: f, delay: 0.05 + i * 0.06 }, t0, 'sine', 0.24, 0.7);
    });
  }
}

export const sound = new SoundEngine();
