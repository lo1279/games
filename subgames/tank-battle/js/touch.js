/**
 * 坦克大战 - 移动端多点触控与虚拟掌机控制器
 * 支持滑动十字盘 (D-Pad)、多点触控隔离、连发与触控震动反馈
 */
class TouchController {
  constructor(game = null) {
    this._game = game;
    this.dpadTouchId = null;
    this.fireTouchId = null;
    this.rapidFireTouchId = null;
    this.rapidFireInterval = null;

    // 当前触控方向 (null 或 CONFIG.DIR 枚举)
    this.currentDirection = null;

    this.dpadEl = document.getElementById('dpad');
    this.fireBtn = document.getElementById('touchFireBtn');
    this.rapidFireBtn = document.getElementById('touchRapidBtn');

    // 震动支持检测
    this.canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.wakeLock = null;

    this.init();
  }

  get game() {
    return this._game || window.game;
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {}
    }
  }

  vibrate(ms = 15) {
    if (this.canVibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  }

  init() {
    if (!this.dpadEl || !this.fireBtn) return;

    // 全局阻止移动端橡皮筋回弹与页面缩放
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.arcade-container') || e.target.closest('.touch-controls')) {
        e.preventDefault();
      }
    }, { passive: false });

    this.initDPad();
    this.initFireButtons();
    this.initSystemButtons();
  }

  /**
   * 初始化虚拟滑动十字盘 (D-Pad)
   */
  initDPad() {
    const handleTouch = (touch) => {
      const rect = this.dpadEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      // 中心死区 (12px 内不触发，避免静止时误触)
      if (dist < 12) {
        this.clearDirection();
        return;
      }

      // 计算极角弧度与角度 (-180° 到 180°)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      let dir = null;

      if (angle >= -135 && angle < -45) {
        dir = CONFIG.DIR.UP;
      } else if (angle >= -45 && angle < 45) {
        dir = CONFIG.DIR.RIGHT;
      } else if (angle >= 45 && angle < 135) {
        dir = CONFIG.DIR.DOWN;
      } else {
        dir = CONFIG.DIR.LEFT;
      }

      this.setDirection(dir);
    };

    // 触摸开始
    this.dpadEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      soundEngine.init();
      soundEngine.resume();
      this.requestWakeLock();

      if (this.dpadTouchId === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.dpadTouchId = touch.identifier;
        handleTouch(touch);
        this.vibrate(10);
      }
    }, { passive: false });

    // 全局触摸滑动追踪 (即使手指滑出 D-Pad 圆形边缘依然持续响应变向)
    window.addEventListener('touchmove', (e) => {
      if (this.dpadTouchId === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.dpadTouchId) {
          handleTouch(e.touches[i]);
          break;
        }
      }
    }, { passive: false });

    // 全局触摸抬起与取消
    const endTouch = (e) => {
      if (this.dpadTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.dpadTouchId) {
          this.dpadTouchId = null;
          this.clearDirection();
          break;
        }
      }
    };

    window.addEventListener('touchend', endTouch, { passive: false });
    window.addEventListener('touchcancel', endTouch, { passive: false });
  }

  setDirection(dir) {
    if (this.currentDirection === dir) return;
    this.clearDirection();

    this.currentDirection = dir;
    if (!this.game) return;

    // 同步映射到游戏引擎按键系统
    if (dir === CONFIG.DIR.UP) {
      this.game.keys['ArrowUp'] = true;
    } else if (dir === CONFIG.DIR.DOWN) {
      this.game.keys['ArrowDown'] = true;
    } else if (dir === CONFIG.DIR.LEFT) {
      this.game.keys['ArrowLeft'] = true;
    } else if (dir === CONFIG.DIR.RIGHT) {
      this.game.keys['ArrowRight'] = true;
    }

    // 更新十字盘 UI 高亮状态
    this.updateDpadVisual(dir);
  }

  clearDirection() {
    this.currentDirection = null;
    if (!this.game) return;

    this.game.keys['ArrowUp'] = false;
    this.game.keys['ArrowDown'] = false;
    this.game.keys['ArrowLeft'] = false;
    this.game.keys['ArrowRight'] = false;

    this.updateDpadVisual(null);
  }

  updateDpadVisual(activeDir) {
    const btns = this.dpadEl.querySelectorAll('.d-arrow');
    btns.forEach(btn => {
      const dirAttr = parseInt(btn.dataset.dir, 10);
      if (dirAttr === activeDir) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * 初始化主开火与连发辅助按键
   */
  initFireButtons() {
    // 1. 单发主开火键 (A 键)
    const handleFireStart = (e) => {
      e.preventDefault();
      soundEngine.init();
      soundEngine.resume();
      this.requestWakeLock();

      if (this.game) {
        if (this.game.state === this.game.STATE.TITLE || this.game.state === this.game.STATE.GAME_OVER) {
          this.game.startNewGame();
        } else {
          this.game.playerShoot();
          this.vibrate(15);
        }
      }
      this.fireBtn.classList.add('active');
    };

    const handleFireEnd = (e) => {
      e.preventDefault();
      this.fireBtn.classList.remove('active');
    };

    this.fireBtn.addEventListener('touchstart', handleFireStart, { passive: false });
    this.fireBtn.addEventListener('touchend', handleFireEnd, { passive: false });
    this.fireBtn.addEventListener('touchcancel', handleFireEnd, { passive: false });
    this.fireBtn.addEventListener('mousedown', handleFireStart);
    this.fireBtn.addEventListener('mouseup', handleFireEnd);

    // 2. 极速连发键 (B 键) - 按住自动高频开火
    if (this.rapidFireBtn) {
      const handleRapidStart = (e) => {
        e.preventDefault();
        soundEngine.init();
        soundEngine.resume();
        this.requestWakeLock();

        if (this.game) {
          if (this.game.state === this.game.STATE.TITLE || this.game.state === this.game.STATE.GAME_OVER) {
            this.game.startNewGame();
          } else {
            this.game.playerShoot();
            this.vibrate(15);
            if (!this.rapidFireInterval) {
              this.rapidFireInterval = setInterval(() => {
                if (this.game && this.game.state === this.game.STATE.PLAYING) {
                  this.game.playerShoot();
                }
              }, 160);
            }
          }
        }
        this.rapidFireBtn.classList.add('active');
      };

      const handleRapidEnd = (e) => {
        e.preventDefault();
        if (this.rapidFireInterval) {
          clearInterval(this.rapidFireInterval);
          this.rapidFireInterval = null;
        }
        this.rapidFireBtn.classList.remove('active');
      };

      this.rapidFireBtn.addEventListener('touchstart', handleRapidStart, { passive: false });
      this.rapidFireBtn.addEventListener('touchend', handleRapidEnd, { passive: false });
      this.rapidFireBtn.addEventListener('touchcancel', handleRapidEnd, { passive: false });
      this.rapidFireBtn.addEventListener('mousedown', handleRapidStart);
      this.rapidFireBtn.addEventListener('mouseup', handleRapidEnd);
    }
  }

  /**
   * 初始化功能按键 (暂停、重开、静音)
   */
  initSystemButtons() {
    const bindBtn = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.vibrate(10);
          callback();
        }, { passive: false });
        el.addEventListener('click', (e) => {
          callback();
        });
      }
    };

    // 暂停
    bindBtn('mobilePauseBtn', () => {
      if (!this.game) return;
      if (this.game.state === this.game.STATE.PLAYING) {
        this.game.state = this.game.STATE.PAUSED;
      } else if (this.game.state === this.game.STATE.PAUSED) {
        this.game.state = this.game.STATE.PLAYING;
      }
    });

    // 重新开始
    bindBtn('mobileRestartBtn', () => {
      if (this.game) this.game.startNewGame();
    });

    // 静音
    bindBtn('mobileMuteBtn', () => {
      const isMuted = soundEngine.toggleMute();
      this.game.updateMuteUI(isMuted);
      const mBtn = document.getElementById('mobileMuteBtn');
      if (mBtn) mBtn.innerText = isMuted ? '🔇' : '🔊';
    });
  }
}
