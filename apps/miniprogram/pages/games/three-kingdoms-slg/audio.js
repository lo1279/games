// pages/games/three-kingdoms-slg/audio.js
/**
 * 🔊 音效管理器（对齐 Web audio.js 的程序化音效意图）
 *
 * 小程序无 Web Audio API，改为使用 wx.createInnerAudioContext 播放预置音频文件。
 * 资源位于本分包 assets/sfx/<name>.mp3；若文件未提供，则静默降级（不报错、不打断游戏）。
 * 接入方式：const { playSfx } = require('../../audio.js'); playSfx('win');
 */

const SFX = {
  win: 'assets/sfx/win.mp3',
  lose: 'assets/sfx/lose.mp3',
  click: 'assets/sfx/click.mp3',
  upgrade: 'assets/sfx/upgrade.mp3',
  draw: 'assets/sfx/draw.mp3'
};

let _ctx = null;

function playSfx(name) {
  const src = SFX[name];
  if (!src) return;
  try {
    if (!_ctx) _ctx = wx.createInnerAudioContext();
    // 每次播放前重置 src（小程序音频实例复用需重设）
    _ctx.src = src;
    _ctx.play();
    _ctx.onError(() => { /* 文件缺失或不可播放：静默降级 */ });
  } catch (e) {
    /* 无音频环境：忽略 */
  }
}

module.exports = { playSfx, SFX };
