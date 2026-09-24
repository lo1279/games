/**
 * 掷骰子游戏总控制器 (App Entry)
 */
document.addEventListener('DOMContentLoaded', () => {
    // 实例化 3D 物理渲染引擎
    const diceEngine = new Dice3DEngine('dice-viewport');

    // 状态管理
    const state = window.gameState;

    // 各游戏模式实例
    const sicbo = new SicBoGame(diceEngine, state);
    const liar = new LiarDiceGame(diceEngine, state);
    const yahtzee = new YahtzeeGame(diceEngine, state);
    const free = new FreeDiceGame(diceEngine, state);

    // 默认模式
    let currentMode = 'sicbo';

    // 界面元素绑定
    const chipsEl = document.getElementById('user-chips');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const reliefBtn = document.getElementById('relief-btn');
    const helpModal = document.getElementById('help-modal');
    const helpBtn = document.getElementById('help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');

    // 筹码显示同步
    const updateChipsDisplay = (chips) => {
        if (chipsEl) chipsEl.textContent = chips.toLocaleString();
    };
    updateChipsDisplay(state.chips);
    state.on('chips', updateChipsDisplay);

    // 声音状态同步
    const updateSoundUI = (enabled) => {
        if (soundToggleBtn) {
            soundToggleBtn.innerHTML = enabled 
                ? `<span class="text-emerald-400">🔊 音效开</span>` 
                : `<span class="text-slate-500">🔇 静音中</span>`;
        }
    };
    updateSoundUI(state.data.soundEnabled);

    soundToggleBtn.onclick = () => {
        const enabled = state.toggleSound();
        updateSoundUI(enabled);
    };

    // 救济金领取
    reliefBtn.onclick = () => {
        const added = state.claimRelief();
        if (added > 0) {
            if (window.soundEngine) window.soundEngine.playWin();
            alert(`🎉 成功领取救济金 ${added} 筹码！祝您好运连连！`);
        } else {
            alert('当前筹码大于等于 50，尚不能领取救济金哦！尽情游戏吧！');
        }
    };

    // 规则说明弹窗
    helpBtn.onclick = () => {
        helpModal.classList.remove('hidden');
        if (window.soundEngine) window.soundEngine.playClick();
    };
    closeHelpBtn.onclick = () => {
        helpModal.classList.add('hidden');
    };
    helpModal.onclick = (e) => {
        if (e.target === helpModal) helpModal.classList.add('hidden');
    };

    // 模式切换 Tab
    const modeTabs = document.querySelectorAll('.mode-tab');
    const modePanels = document.querySelectorAll('.mode-panel');

    const switchMode = (mode) => {
        currentMode = mode;

        // 样式切换
        modeTabs.forEach(tab => {
            if (tab.dataset.mode === mode) {
                tab.className = 'mode-tab px-4 py-2 font-bold text-sm rounded-lg bg-amber-500 text-slate-950 shadow-md transition-all';
            } else {
                tab.className = 'mode-tab px-4 py-2 font-medium text-sm rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all';
            }
        });

        // 面板显示隐藏
        modePanels.forEach(panel => {
            if (panel.id === `panel-${mode}`) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });

        // 针对不同模式重置 3D 渲染台面
        if (diceEngine.cup) {
            diceEngine.cup.visible = false;
        }

        if (mode === 'sicbo') {
            diceEngine.setDiceCount(3);
            sicbo.initUI();
        } else if (mode === 'liar') {
            diceEngine.setDiceCount(5);
            liar.initUI();
            liar.startNewGame();
        } else if (mode === 'yahtzee') {
            diceEngine.setDiceCount(5);
            yahtzee.startNewGame();
        } else if (mode === 'free') {
            diceEngine.setDiceCount(free.diceCount);
        }

        if (window.soundEngine) window.soundEngine.playClick();
    };

    modeTabs.forEach(tab => {
        tab.onclick = () => switchMode(tab.dataset.mode);
    });

    // 绑定骰宝操作按钮
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.onclick = () => sicbo.setSelectedChip(parseInt(btn.dataset.val));
    });
    document.querySelectorAll('[data-bet]').forEach(cell => {
        cell.onclick = () => sicbo.placeBet(cell.dataset.bet);
    });
    document.getElementById('sicbo-clear-btn').onclick = () => sicbo.clearBets();
    document.getElementById('sicbo-repeat-btn').onclick = () => sicbo.repeatBets();
    document.getElementById('sicbo-roll-btn').onclick = () => sicbo.roll();

    // 绑定吹牛操作按钮
    document.getElementById('liar-start-btn').onclick = () => liar.startNewGame();
    document.getElementById('liar-restart-btn').onclick = () => liar.startNewGame();
    document.getElementById('liar-call-btn').onclick = () => liar.playerCall();
    document.getElementById('liar-open-btn').onclick = () => liar.playerOpen();

    // 绑定快艇操作按钮
    document.getElementById('yahtzee-roll-btn').onclick = () => yahtzee.roll();
    document.getElementById('yahtzee-new-game-btn').onclick = () => yahtzee.startNewGame();

    // 绑定自由掷骰按钮
    document.getElementById('free-roll-btn').onclick = () => free.roll();

    // 初始进入骰宝模式
    switchMode('sicbo');
});
