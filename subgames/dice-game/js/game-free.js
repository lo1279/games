/**
 * 休闲实用·自由掷骰 (Free Roll)
 * 支持 1 ~ 6 颗骰子任意调节，点数总和统计与概率参考。
 */
class FreeDiceGame {
    constructor(diceEngine, state) {
        this.diceEngine = diceEngine;
        this.state = state;
        this.diceCount = 2;
        this.isRolling = false;

        this.initUI();
    }

    initUI() {
        const countBtns = document.querySelectorAll('.free-count-btn');
        countBtns.forEach(btn => {
            btn.onclick = () => {
                if (this.isRolling) return;
                const count = parseInt(btn.dataset.count);
                this.setCount(count);
            };
        });
    }

    setCount(count) {
        this.diceCount = count;
        document.querySelectorAll('.free-count-btn').forEach(btn => {
            if (parseInt(btn.dataset.count) === count) {
                btn.className = 'free-count-btn px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs ring-2 ring-amber-300';
            } else {
                btn.className = 'free-count-btn px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700';
            }
        });

        this.diceEngine.setDiceCount(count);
        if (window.soundEngine) window.soundEngine.playClick();
    }

    roll() {
        if (this.isRolling) return;
        this.isRolling = true;

        const btn = document.getElementById('free-roll-btn');
        if (btn) btn.disabled = true;

        const values = Array.from({ length: this.diceCount }, () => Math.floor(Math.random() * 6) + 1);

        this.diceEngine.roll(values, null, () => {
            this.isRolling = false;
            if (btn) btn.disabled = false;

            const sum = values.reduce((a, b) => a + b, 0);
            const max = Math.max(...values);
            const min = Math.min(...values);

            const resultEl = document.getElementById('free-result-text');
            if (resultEl) {
                resultEl.innerHTML = `点数详情: <span class="text-amber-400 font-bold">[ ${values.join(', ')} ]</span> | 总和: <span class="text-emerald-400 font-extrabold text-xl">${sum}</span> (最高 ${max} / 最低 ${min})`;
            }

            if (window.soundEngine) {
                if (values.every(v => v === values[0]) && values.length > 1) {
                    // 全同点数（豹子）彩蛋
                    window.soundEngine.playWin();
                    alert(`🌟 罕见幸运！掷出了全同豹子：全部为 ${values[0]} 点！`);
                }
            }
        });
    }
}

window.FreeDiceGame = FreeDiceGame;
