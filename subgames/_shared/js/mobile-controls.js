/* ============================================================================
 * mobile-controls.js — 手机端虚拟手柄桥
 * 依赖：各游戏 index.html 在引入本文件「之前」设置 window.MOBILE_CONTROLS_CONFIG
 * 作用：把屏幕上的虚拟按键，转换成游戏已监听的 window keydown/keyup 事件，
 *       从而让只用键盘操作的游戏（俄罗斯方块、超级马里奥等）在手机上可玩。
 * 仅触屏设备（coarse pointer）激活；桌面端保持原键盘操作。
 * ========================================================================== */
(function () {
  'use strict';

  var cfg = window.MOBILE_CONTROLS_CONFIG;
  if (!cfg) return; // 没有配置则不挂载任何东西

  // 仅在触屏设备激活
  var isTouch = ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) return;

  // 方向键默认映射
  var DPAD_CODES = cfg.dpadCodes || {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'
  };
  var DPAD_LABELS = { up: '▲', down: '▼', left: '◀', right: '▶' };

  // code -> {key, keyCode}，覆盖常见游戏按键
  var KEY_MAP = {
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40],
    ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    Space: [' ', 32], Enter: ['Enter', 13],
    KeyA: ['a', 65], KeyD: ['d', 68], KeyS: ['s', 83], KeyW: ['w', 87],
    KeyZ: ['z', 90], KeyX: ['x', 88], KeyK: ['k', 75], KeyJ: ['j', 74],
    KeyP: ['p', 80], KeyR: ['r', 82], KeyC: ['c', 67], KeyM: ['m', 77],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16]
  };

  function resolve(code) {
    if (!code) return ['', 0];
    if (KEY_MAP[code]) return KEY_MAP[code];
    // 兜底：key 用 code 本身，keyCode 置 0
    return [code, 0];
  }

  function fire(type, code) {
    var r = resolve(code);
    var evt;
    try {
      evt = new KeyboardEvent(type, {
        code: code,
        key: r[0],
        keyCode: r[1],
        which: r[1],
        bubbles: true,
        cancelable: true
      });
    } catch (e) {
      // 极旧环境兜底
      evt = document.createEvent('KeyboardEvent');
      evt.initKeyboardEvent(type, true, true, window, r[0], 0, '', false);
    }
    window.dispatchEvent(evt);
  }

  function press(code) { fire('keydown', code); }
  function release(code) { fire('keyup', code); }

  // ---- 构建 DOM ----
  var root = document.createElement('div');
  root.className = 'mc-root';

  // 方向键
  var dpad = document.createElement('div');
  dpad.className = 'mc-dpad';
  var dpadDirs = cfg.dpad || [];
  dpadDirs.forEach(function (dir) {
    if (!DPAD_CODES[dir]) return;
    var b = document.createElement('div');
    b.className = 'mc-btn mc-' + dir;
    b.textContent = DPAD_LABELS[dir] || dir;
    bindButton(b, DPAD_CODES[dir]);
    dpad.appendChild(b);
  });

  // 动作按钮
  var actions = document.createElement('div');
  actions.className = 'mc-actions';
  (cfg.buttons || []).forEach(function (btn) {
    var b = document.createElement('div');
    b.className = 'mc-btn' + (btn.label && btn.label.length > 1 ? ' mc-text' : '');
    b.textContent = btn.label || '●';
    if (btn.title) b.title = btn.title;
    bindButton(b, btn.code, btn.repeat);
    actions.appendChild(b);
  });

  root.appendChild(dpad);
  root.appendChild(actions);
  document.body.appendChild(root);

  function bindButton(el, code, repeat) {
    if (!code) return;
    var active = false;
    function down(e) {
      e.preventDefault();
      if (active) return;
      active = true;
      press(code);
      el.classList.add('mc-active');
    }
    function up(e) {
      if (e) e.preventDefault();
      if (!active) return;
      active = false;
      release(code);
      el.classList.remove('mc-active');
    }
    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointerup', up, { passive: false });
    el.addEventListener('pointercancel', up, { passive: false });
    el.addEventListener('pointerleave', up, { passive: false });
    // 防止长按选中 / 右键菜单
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // 阻止手柄区域的页面滚动/缩放
  root.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // 暴露给调试
  window.__mobileControls = { root: root, press: press, release: release };
})();
