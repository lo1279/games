/**
 * 策略益智·快艇骰子 (Yahtzee / 游艇)
 * 5 颗骰子，每轮可重掷 3 次并自由锁定骰子，13 项组合计分表。
 */
class YahtzeeGame {
    constructor(diceEngine, state) {
        this.diceEngine = diceEngine;
        this.state = state;

        this.diceValues = [1, 1, 1, 1, 1];
        this.held = [false, false, false, false, false];
        this.rollsLeft = 3;
        this.currentRound = 1;
        this.scores = {}; // { ones: 3, yahtzee: 50, ... }
        this.isRolling = false;

        this.categories = [
            { id: 'ones', name: '一点 (Ones)', section: 'upper' },
            { id: 'twos', name: '二点 (Twos)', section: 'upper' },
            { id: 'threes', name: '三点 (Threes)', section: 'upper' },
            { id: 'fours', name: '四点 (Fours)', section: 'upper' },
            { id: 'fives', name: '五点 (Fives)', section: 'upper' },
            { id: 'sixes', name: '六点 (Sixes)', section: 'upper' },
            { id: 'three_kind', name: '三条 (3 of a Kind)', section: 'lower' },
            { id: 'four_kind', name: '四条 (4 of a Kind)', section: 'lower' },
            { id: 'full_house', name: '葫芦 (Full House - 25分)', section: 'lower' },
            { id: 'small_straight', name: '小顺 (Small Straight - 30分)', section: 'lower' },
            { id: 'large_straight', name: '大顺 (Large Straight - 40分)', section: 'lower' },
            { id: 'yahtzee', name: '快艇 (Yahtzee - 50分)', section: 'lower' },
            { id: 'chance', name: '机会 (Chance)', section: 'lower' }
        ];

        this.initUI();
    }

    initUI() {
        this.renderScoreTable();
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const el = document.getElementById('yahtzee-best-score');
        if (el) {
            el.textContent = this.state.data.yahtzeeBestScore || 0;
        }
    }

    startNewGame() {
        this.scores = {};
        this.currentRound = 1;
        this.rollsLeft = 3;
        this.held = [false, false, false, false, false];
        this.diceValues = [1, 2, 3, 4, 5];

        this.diceEngine.setDiceCount(5);
        this.diceEngine.roll(this.diceValues, null, () => {});

        this.renderScoreTable();
        this.renderHoldDices();
        this.updateRollButton();
        this.updateTotalScores();

        document.getElementById('yahtzee-info-banner').textContent = '新游戏开始！点击【掷骰子】开始第 1 轮。';
    }

    renderHoldDices() {
        const container = document.getElementById('yahtzee-hold-container');
        if (!container) return;
        container.innerHTML = '';

        this.diceValues.forEach((val, idx) => {
            const btn = document.createElement('button');
            const isHeld = this.held[idx];
            btn.className = `w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-lg transition-all duration-200 border-2 shadow-md ${
                isHeld 
                    ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400 scale-105' 
                    : 'bg-slate-800 text-slate-100 border-slate-600 hover:border-slate-400'
            }`;
            btn.innerHTML = `<span>${val}</span><span class="text-[9px] uppercase tracking-wider -mt-1 font-normal">${isHeld ? '已锁定' : '点击锁定'}</span>`;
            
            btn.onclick = () => {
                if (this.rollsLeft === 3 || this.rollsLeft === 0 || this.isRolling) return;
                this.held[idx] = !this.held[idx];
                if (window.soundEngine) window.soundEngine.playClick();
                this.renderHoldDices();
            };

            container.appendChild(btn);
        });
    }

    roll() {
        if (this.rollsLeft <= 0 || this.isRolling) return;

        // 如果当前 5 颗骰子全部被锁定，提示用户无需空掷
        if (this.rollsLeft < 3 && this.held.every(h => h)) {
            alert('5 颗骰子均已被锁定！请取消部分骰子的锁定后再重掷，或直接在右侧表格中选定记分。');
            return;
        }

        this.isRolling = true;
        this.rollsLeft--;
        this.updateRollButton();

        // 随机未锁定的骰子
        const nextVals = [...this.diceValues];
        for (let i = 0; i < 5; i++) {
            if (!this.held[i]) {
                nextVals[i] = Math.floor(Math.random() * 6) + 1;
            }
        }
        this.diceValues = nextVals;

        this.diceEngine.roll(this.diceValues, this.held, () => {
            this.isRolling = false;
            this.renderHoldDices();
            this.updateRollButton();
            this.previewAvailableScores();

            const banner = document.getElementById('yahtzee-info-banner');
            if (this.rollsLeft > 0) {
                banner.textContent = `第 ${this.currentRound}/13 轮: 剩余 ${this.rollsLeft} 次重掷机会。可点击骰子锁定，或在右侧表格确认记分！`;
            } else {
                banner.textContent = `第 ${this.currentRound}/13 轮: 重掷次数已用完，请在右侧表格中挑选一个计分项记分！`;
            }
        });
    }

    updateRollButton() {
        const btn = document.getElementById('yahtzee-roll-btn');
        if (!btn) return;
        btn.disabled = this.rollsLeft <= 0 || this.isRolling;
        btn.textContent = `掷骰子 (剩余 ${this.rollsLeft} 次)`;
    }

    calculateScore(catId, values) {
        const sum = values.reduce((a, b) => a + b, 0);
        const counts = [0, 0, 0, 0, 0, 0, 0];
        values.forEach(v => counts[v]++);

        switch (catId) {
            case 'ones': return counts[1] * 1;
            case 'twos': return counts[2] * 2;
            case 'threes': return counts[3] * 3;
            case 'fours': return counts[4] * 4;
            case 'fives': return counts[5] * 5;
            case 'sixes': return counts[6] * 6;

            case 'three_kind':
                return counts.some(c => c >= 3) ? sum : 0;

            case 'four_kind':
                return counts.some(c => c >= 4) ? sum : 0;

            case 'full_house':
                const has3 = counts.some(c => c === 3);
                const has2 = counts.some(c => c === 2);
                const isYahtzee = counts.some(c => c === 5);
                return (has3 && has2) || isYahtzee ? 25 : 0;

            case 'small_straight': {
                const unique = Array.from(new Set(values)).sort();
                const str = unique.join('');
                if (str.includes('1234') || str.includes('2345') || str.includes('3456')) return 30;
                return 0;
            }

            case 'large_straight': {
                const unique = Array.from(new Set(values)).sort();
                const str = unique.join('');
                if (str === '12345' || str === '23456') return 40;
                return 0;
            }

            case 'yahtzee':
                return counts.some(c => c === 5) ? 50 : 0;

            case 'chance':
                return sum;

            default:
                return 0;
        }
    }

    renderScoreTable() {
        const tbody = document.getElementById('yahtzee-score-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.categories.forEach(cat => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 text-xs hover:bg-slate-800/40 transition-colors';

            const tdName = document.createElement('td');
            tdName.className = 'py-1.5 px-3 text-slate-300 font-medium';
            tdName.textContent = cat.name;

            const tdScore = document.createElement('td');
            tdScore.className = 'py-1.5 px-3 text-right font-bold';

            if (this.scores[cat.id] !== undefined) {
                // 已记分
                tdScore.className += ' text-emerald-400';
                tdScore.textContent = this.scores[cat.id];
            } else {
                // 未记分
                tdScore.className += ' text-slate-600 cursor-pointer yahtzee-preview-cell';
                tdScore.dataset.catId = cat.id;
                tdScore.textContent = '-';

                tdScore.onclick = () => this.commitScore(cat.id);
                tdName.onclick = () => this.commitScore(cat.id);
            }

            tr.appendChild(tdName);
            tr.appendChild(tdScore);
            tbody.appendChild(tr);
        });

        this.updateTotalScores();
    }

    previewAvailableScores() {
        document.querySelectorAll('.yahtzee-preview-cell').forEach(cell => {
            const catId = cell.dataset.catId;
            const potential = this.calculateScore(catId, this.diceValues);
            cell.textContent = potential;
            if (potential > 0) {
                cell.className = 'py-1.5 px-3 text-right font-bold text-amber-300 hover:text-emerald-300 hover:scale-110 cursor-pointer yahtzee-preview-cell transition-all';
            } else {
                cell.className = 'py-1.5 px-3 text-right font-medium text-slate-500 hover:text-slate-300 cursor-pointer yahtzee-preview-cell';
            }
        });
    }

    commitScore(catId) {
        if (this.scores[catId] !== undefined) return;
        if (this.rollsLeft === 3) {
            alert('请先掷骰子后再选择记分！');
            return;
        }

        const score = this.calculateScore(catId, this.diceValues);
        this.scores[catId] = score;

        if (window.soundEngine) {
            if (score > 0) window.soundEngine.playWin();
            else window.soundEngine.playLose();
        }

        this.renderScoreTable();

        // 检查游戏是否结束 (13轮全满)
        const recordedCount = Object.keys(this.scores).length;
        if (recordedCount >= 13) {
            this.finishGame();
        } else {
            // 进入下一轮
            this.currentRound++;
            this.rollsLeft = 3;
            this.held = [false, false, false, false, false];
            this.renderScoreTable();
            this.renderHoldDices();
            this.updateRollButton();
            document.getElementById('yahtzee-info-banner').textContent = `进入第 ${this.currentRound}/13 轮，点击【掷骰子】开始！`;
        }
    }

    updateTotalScores() {
        let upperSum = 0;
        ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].forEach(id => {
            if (this.scores[id] !== undefined) upperSum += this.scores[id];
        });

        const bonus = upperSum >= 63 ? 35 : 0;

        let lowerSum = 0;
        ['three_kind', 'four_kind', 'full_house', 'small_straight', 'large_straight', 'yahtzee', 'chance'].forEach(id => {
            if (this.scores[id] !== undefined) lowerSum += this.scores[id];
        });

        const grandTotal = upperSum + bonus + lowerSum;

        const upperEl = document.getElementById('yahtzee-upper-total');
        const bonusEl = document.getElementById('yahtzee-bonus');
        const grandEl = document.getElementById('yahtzee-grand-total');

        if (upperEl) upperEl.textContent = `${upperSum} / 63`;
        if (bonusEl) bonusEl.textContent = `+${bonus}`;
        if (grandEl) grandEl.textContent = grandTotal;

        return grandTotal;
    }

    finishGame() {
        const finalScore = this.updateTotalScores();
        this.state.updateYahtzeeBest(finalScore);
        this.updateStatsDisplay();

        let rank = '海港学徒';
        if (finalScore >= 300) rank = '快艇传说 👑';
        else if (finalScore >= 240) rank = '黄金船长 ⚓';
        else if (finalScore >= 180) rank = '资深水手 🚢';

        alert(`🎉 恭喜完成整场快艇骰子！\n最终总分：${finalScore} 分！\n获得段位：${rank}`);
        document.getElementById('yahtzee-info-banner').textContent = `游戏结束！最终得分：${finalScore} 分 (${rank})，点击新游戏再次挑战！`;
    }
}

window.YahtzeeGame = YahtzeeGame;
