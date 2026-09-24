/**
 * 聚会博弈·吹牛大话骰 (Liar's Dice)
 * 玩家 vs 智能 AI，带万能1点规则、概率推断与心理博弈。
 */
class LiarDiceGame {
    constructor(diceEngine, state) {
        this.diceEngine = diceEngine;
        this.state = state;

        this.playerDices = [];
        this.aiDices = [];
        this.currentCall = null; // { count: 3, value: 4, caller: 'player' | 'ai' }
        this.isOneWild = true;   // 1点是否为万能点（未叫过1前为万能）
        this.currentTurn = 'player';
        this.roundActive = false;
        this.betAmount = 100;

        this.initUI();
    }

    initUI() {
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const stats = this.state.data.liarStats;
        const el = document.getElementById('liar-stats');
        if (el) {
            el.innerHTML = `胜场: <span class="text-emerald-400 font-bold">${stats.wins}</span> | 负场: <span class="text-rose-400 font-bold">${stats.losses}</span> | 连胜: <span class="text-yellow-400 font-bold">${stats.currentStreak}</span> (最高: ${stats.bestStreak})`;
        }
    }

    startNewGame() {
        if (this.state.chips < this.betAmount) {
            alert('筹码不足 100，无法开启吹牛对决！请领取救济筹码。');
            return;
        }

        this.state.spendChips(this.betAmount);
        this.roundActive = true;
        this.isOneWild = true;
        this.currentCall = null;
        this.currentTurn = 'player';

        // 双方摇出各自 5 颗骰子
        this.playerDices = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1).sort();
        this.aiDices = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1).sort();

        // 3D 渲染台面展示玩家的骰子，并在其上方放置骰盅动画
        this.diceEngine.setDiceCount(5);
        this.diceEngine.roll(this.playerDices, null, () => {
            // 落地后盖上骰盅动效
            this.diceEngine.animateCup('cover');
        });

        // 界面重置
        this.renderPlayerHand(true);
        this.renderAiHand(false);
        this.updateCallUI();
        this.logMessage(`对决开始！双方各持 5 颗骰子，底注 100 筹码。当前 1 点为【万能点】。请玩家先叫！`, 'info');

        const bidControls = document.getElementById('liar-bid-controls');
        if (bidControls) bidControls.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('liar-start-btn').classList.add('hidden');
        document.getElementById('liar-restart-btn').classList.remove('hidden');
    }

    renderPlayerHand(visible = true) {
        const container = document.getElementById('liar-player-hand');
        if (!container) return;
        container.innerHTML = '';

        this.playerDices.forEach(val => {
            const diceEl = document.createElement('div');
            diceEl.className = 'w-10 h-10 bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg flex items-center justify-center font-black text-xl shadow-md';
            if (val === 1) diceEl.className += ' text-rose-600';
            diceEl.textContent = visible ? val : '?';
            container.appendChild(diceEl);
        });
    }

    renderAiHand(revealed = false) {
        const container = document.getElementById('liar-ai-hand');
        if (!container) return;
        container.innerHTML = '';

        this.aiDices.forEach(val => {
            const diceEl = document.createElement('div');
            diceEl.className = 'w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl shadow-md ';
            if (revealed) {
                diceEl.className += 'bg-slate-100 text-slate-900 border-2 border-slate-300';
                if (val === 1) diceEl.className += ' text-rose-600';
                diceEl.textContent = val;
            } else {
                diceEl.className += 'bg-slate-800 text-slate-500 border-2 border-dashed border-slate-600';
                diceEl.textContent = '？';
            }
            container.appendChild(diceEl);
        });
    }

    updateCallUI() {
        const countSelect = document.getElementById('liar-call-count');
        const valSelect = document.getElementById('liar-call-val');
        const openBtn = document.getElementById('liar-open-btn');

        if (!this.roundActive) return;

        // 如果还没有叫过，不能开别人
        openBtn.disabled = !this.currentCall;

        // 更新选择器的最小合理范围
        if (this.currentCall) {
            // 当前有人叫了
            const curC = this.currentCall.count;
            const curV = this.currentCall.value;
            // 默认选大一级
            if (curV === 6) {
                countSelect.value = Math.min(10, curC + 1);
                valSelect.value = 2;
            } else {
                countSelect.value = curC;
                valSelect.value = curV + 1;
            }
        } else {
            countSelect.value = 2;
            valSelect.value = 2;
        }

        const banner = document.getElementById('liar-current-call-banner');
        if (banner) {
            if (this.currentCall) {
                const wildStr = this.isOneWild ? '(1点为万能)' : '(已叫1点，已无万能)';
                banner.innerHTML = `当前叫骰: <span class="text-amber-400 font-extrabold text-base">${this.currentCall.caller === 'player' ? '你' : 'AI'} 叫了 [ ${this.currentCall.count} 个 ${this.currentCall.value} ]</span> <span class="text-xs text-slate-400 ml-2">${wildStr}</span>`;
            } else {
                banner.innerHTML = '等待首次叫骰...';
            }
        }
    }

    playerCall() {
        if (!this.roundActive || this.currentTurn !== 'player') return;

        const count = parseInt(document.getElementById('liar-call-count').value);
        const val = parseInt(document.getElementById('liar-call-val').value);

        // 校验叫骰是否合法
        if (this.currentCall) {
            const curC = this.currentCall.count;
            const curV = this.currentCall.value;
            const isValid = (count > curC) || (count === curC && val > curV);
            if (!isValid) {
                alert(`叫骰不合法！必须大于当前的 [${curC}个${curV}] (个数更多，或者个数相同但点数更大)`);
                return;
            }
        }

        if (val === 1 && this.isOneWild) {
            this.isOneWild = false;
            this.logMessage(`玩家叫了 1 点！【万能 1 点规则失效】，后续 1 点仅算作 1 本身！`, 'warn');
        }

        this.currentCall = { count, value: val, caller: 'player' };
        if (window.soundEngine) window.soundEngine.playClick();

        this.logMessage(`你叫了: 【 ${count} 个 ${val} 】`, 'player');
        this.updateCallUI();

        // 轮到 AI
        this.currentTurn = 'ai';
        this.setPlayerControlsEnabled(false);
        setTimeout(() => this.aiTurn(), 1200);
    }

    aiTurn() {
        if (!this.roundActive) return;

        const call = this.currentCall;
        const curC = call.count;
        const curV = call.value;

        // AI 评估自己手里的对应点数数量
        let aiOwnCount = 0;
        this.aiDices.forEach(v => {
            if (v === curV || (this.isOneWild && v === 1)) {
                aiOwnCount++;
            }
        });

        // 对方还有 5 颗未知骰子
        // 单个骰子命中概率：若 1 算万能则 p = 2/6 = 1/3；否则 p = 1/6
        const p = this.isOneWild && curV !== 1 ? (1 / 3) : (1 / 6);
        const expectedInPlayer = 5 * p; // 期望大约 1.67 或 0.83 个
        const totalExpected = aiOwnCount + expectedInPlayer;

        // 质疑判定阈值：如果叫的个数超出预期较大，或者总数达到 6 个以上且自己很少，AI 决定开！
        const shouldChallenge = (curC > totalExpected + 1.3) || (curC >= 6 && aiOwnCount <= 1) || (curC >= 8);

        if (shouldChallenge) {
            this.logMessage(`AI 沉思片刻，眼神凌厉：“我不信你有那么多！【开你！】”`, 'ai');
            setTimeout(() => this.resolveOpen('ai'), 800);
            return;
        }

        // 否则 AI 进行加叫
        let nextC = curC;
        let nextV = curV + 1;

        if (nextV > 6) {
            nextC = curC + 1;
            // 找 AI 自己手里数量最多的点数加叫
            const freq = [0, 0, 0, 0, 0, 0, 0];
            this.aiDices.forEach(v => freq[v]++);
            let bestV = 2;
            let maxF = -1;
            for (let v = 2; v <= 6; v++) {
                if (freq[v] > maxF) {
                    maxF = freq[v];
                    bestV = v;
                }
            }
            nextV = bestV;
        }

        // 极小概率心理诈唬
        if (Math.random() < 0.2 && nextV < 6) {
            nextV = Math.floor(Math.random() * (6 - nextV + 1)) + nextV;
        }

        if (nextV === 1 && this.isOneWild) {
            this.isOneWild = false;
            this.logMessage(`AI 叫了 1 点！【万能 1 点规则失效】！`, 'warn');
        }

        this.currentCall = { count: nextC, value: nextV, caller: 'ai' };
        this.logMessage(`AI 喊道：“我跟！【 ${nextC} 个 ${nextV} 】”`, 'ai');
        if (window.soundEngine) window.soundEngine.playClick();

        this.currentTurn = 'player';
        this.setPlayerControlsEnabled(true);
        this.updateCallUI();
    }

    playerOpen() {
        if (!this.roundActive || this.currentTurn !== 'player' || !this.currentCall) return;
        this.logMessage(`你拍桌大喊：“胡说！【开你！】”`, 'player');
        this.setPlayerControlsEnabled(false);
        setTimeout(() => this.resolveOpen('player'), 600);
    }

    resolveOpen(opener) {
        this.roundActive = false;
        const call = this.currentCall;
        const targetV = call.value;
        const targetC = call.count;

        // 升起骰盅
        this.diceEngine.animateCup('lift');

        // 公开双方手牌
        this.renderAiHand(true);

        // 统计实际命中总数
        let actualCount = 0;
        const allDices = [...this.playerDices, ...this.aiDices];
        allDices.forEach(v => {
            if (v === targetV || (this.isOneWild && v === 1)) {
                actualCount++;
            }
        });

        const isBluff = actualCount < targetC; // 叫的人吹牛了？
        let winner = '';

        if (opener === 'player') {
            // 玩家开 AI
            if (isBluff) {
                winner = 'player';
                this.logMessage(`全场清点：实际只有 ${actualCount} 个 ${targetV} (叫了 ${targetC} 个)！AI 吹牛被抓个正着！`, 'win');
            } else {
                winner = 'ai';
                this.logMessage(`全场清点：共有 ${actualCount} 个 ${targetV} (叫了 ${targetC} 个)！AI 并没有吹牛，你抓错了！`, 'lose');
            }
        } else {
            // AI 开 玩家
            if (isBluff) {
                winner = 'ai';
                this.logMessage(`全场清点：实际只有 ${actualCount} 个 ${targetV} (叫了 ${targetC} 个)！你被 AI 识破了！`, 'lose');
            } else {
                winner = 'player';
                this.logMessage(`全场清点：共有 ${actualCount} 个 ${targetV} (叫了 ${targetC} 个)！你的手牌实打实，反杀 AI！`, 'win');
            }
        }

        // 结算
        if (winner === 'player') {
            const reward = this.betAmount * 2;
            this.state.addChips(reward);
            this.state.recordLiarResult(true);
            if (window.soundEngine) window.soundEngine.playWin();
            this.showBanner(`🎉 恭喜你赢得对决！获得 ${reward} 筹码！`, true);
        } else {
            this.state.recordLiarResult(false);
            if (window.soundEngine) window.soundEngine.playLose();
            this.showBanner(`💀 本局惜败，筹码被 AI 赢走！`, false);
        }

        this.updateStatsDisplay();
        const bidControls = document.getElementById('liar-bid-controls');
        if (bidControls) bidControls.classList.add('opacity-50', 'pointer-events-none');
    }

    setPlayerControlsEnabled(enabled) {
        const box = document.getElementById('liar-bid-controls');
        if (box) {
            if (enabled) {
                box.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                box.classList.add('opacity-50', 'pointer-events-none');
            }
        }
    }

    logMessage(text, type = 'info') {
        const logBox = document.getElementById('liar-dialog-log');
        if (!logBox) return;

        const row = document.createElement('div');
        row.className = 'text-xs leading-relaxed py-1 border-b border-slate-800/60 ';

        if (type === 'player') {
            row.className += 'text-cyan-300 font-semibold';
        } else if (type === 'ai') {
            row.className += 'text-amber-300 font-semibold';
        } else if (type === 'warn') {
            row.className += 'text-rose-400 font-bold';
        } else if (type === 'win') {
            row.className += 'text-emerald-300 font-bold';
        } else if (type === 'lose') {
            row.className += 'text-rose-400 font-bold';
        } else {
            row.className += 'text-slate-400';
        }

        row.textContent = text;
        logBox.appendChild(row);
        logBox.scrollTop = logBox.scrollHeight;
    }

    showBanner(msg, isWin) {
        const banner = document.getElementById('liar-result-banner');
        if (!banner) return;
        banner.textContent = msg;
        banner.className = `p-3 rounded-lg text-center font-bold text-sm transition-all duration-300 ${isWin ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'}`;
    }
}

window.LiarDiceGame = LiarDiceGame;
