/**
 * 🎮 超级马里奥兄弟 - 移动端触控控制器 (Touch Controls)
 */

window.addEventListener('DOMContentLoaded', () => {
  const btnUp = document.getElementById('btnUp');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnDown = document.getElementById('btnDown');
  const btnJump = document.getElementById('btnJump');
  const btnRun = document.getElementById('btnRun');
  const btnPause = document.getElementById('btnPause');
  const btnMute = document.getElementById('btnMute');
  const btnRestart = document.getElementById('btnRestart');

  function bindTouch(element, onDown, onUp) {
    if (!element) return;

    element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.marioAudio.ensureContext();
      onDown();
    }, { passive: false });

    element.addEventListener('touchend', (e) => {
      e.preventDefault();
      onUp();
    }, { passive: false });

    element.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      onUp();
    }, { passive: false });

    // 鼠标模拟
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      window.marioAudio.ensureContext();
      onDown();
    });

    element.addEventListener('mouseup', (e) => {
      e.preventDefault();
      onUp();
    });

    element.addEventListener('mouseleave', () => {
      onUp();
    });
  }

  // 绑定方向与操作 (支持 D-Pad 上键跳跃)
  const triggerJumpStart = () => {
    if (window.marioGame) {
      if (window.marioGame.gameState === 'TITLE' || window.marioGame.gameState === 'GAME_OVER') {
        window.marioGame.startNewGame();
      } else {
        window.marioGame.input.jump = true;
      }
    }
  };
  const triggerJumpEnd = () => {
    if (window.marioGame) window.marioGame.input.jump = false;
  };

  bindTouch(btnUp, triggerJumpStart, triggerJumpEnd);
  bindTouch(btnJump, triggerJumpStart, triggerJumpEnd);

  bindTouch(btnLeft, 
    () => { if (window.marioGame) window.marioGame.input.left = true; },
    () => { if (window.marioGame) window.marioGame.input.left = false; }
  );

  bindTouch(btnRight, 
    () => { if (window.marioGame) window.marioGame.input.right = true; },
    () => { if (window.marioGame) window.marioGame.input.right = false; }
  );

  bindTouch(btnDown, 
    () => { if (window.marioGame) window.marioGame.input.down = true; },
    () => { if (window.marioGame) window.marioGame.input.down = false; }
  );

  bindTouch(btnRun, 
    () => { if (window.marioGame) window.marioGame.input.runHeld = true; },
    () => { if (window.marioGame) window.marioGame.input.runHeld = false; }
  );

  // 点击画布本身也可在 Title 画面启动游戏
  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.addEventListener('click', () => {
      window.marioAudio.ensureContext();
      if (window.marioGame && (window.marioGame.gameState === 'TITLE' || window.marioGame.gameState === 'GAME_OVER')) {
        window.marioGame.startNewGame();
      }
    });
  }

  // 安全更新复古按钮内容，保留 DOM 标签与排版样式
  function setBtnState(btn, icon, text) {
    if (!btn) return;
    const iconEl = btn.querySelector('.btn-icon');
    const txtEl = btn.querySelector('.btn-txt');
    if (iconEl && txtEl) {
      iconEl.textContent = icon;
      txtEl.textContent = text;
    } else {
      btn.textContent = `${icon} ${text}`;
    }
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (!window.marioGame) return;
      if (window.marioGame.gameState === 'PLAYING') {
        window.marioGame.gameState = 'PAUSED';
        window.marioAudio.stopBGM();
        setBtnState(btnPause, '▶', 'RESUME');
      } else if (window.marioGame.gameState === 'PAUSED') {
        window.marioGame.gameState = 'PLAYING';
        window.marioAudio.startBGM();
        setBtnState(btnPause, '⏸', 'PAUSE');
      }
    });
  }

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      const isMuted = window.marioAudio.toggleMute();
      setBtnState(btnMute, isMuted ? '🔇' : '🔊', isMuted ? 'MUTED' : 'AUDIO');
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (window.marioGame) {
        window.marioGame.startNewGame();
      }
    });
  }
});
