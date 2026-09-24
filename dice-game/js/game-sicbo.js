/**
 * 经典娱乐·骰宝 (Sic Bo / 押大小)
 */
class SicBoGame {
    constructor(diceEngine, state) {
        this.diceEngine = diceEngine;
        this.state = state;

        // 当前选中的下注筹码面额
        this.selectedChip = 50;

        // 当前台面下注数据: { [betKey]: amount }
        this.bets = {};
        this.lastBets = {};
        this.isRolling = false;

        // 赔率表定义
        this.payoutRates = {
            'small': 1,       // 小 (4-10点，围骰通吃) 1:1
            'big': 1,         // 大 (11-17点，围骰通吃) 1:1
            'odd': 1,         // 单 1:1
            'even': 1,        // 双 1:1
            'any_triple': 24, // 全围/豹子 1:24
            'sum_4': 50,      // 4点 1:50
            'sum_5': 20,      // 5点 1:20
            'sum_6': 15,      // 6点 1:15
            'sum_7': 12,      // 7点 1:12
            'sum_8': 8,       // 8点 1:8
            'sum_9': 6,       // 9点 1:6
            'sum_10': 6,      // 10点 1:6
            'sum_11': 6,      // 11点 1:6
            'sum_12': 6,      // 12点 1:6
            'sum_13': 8,      // 13点 1:8
            'sum_14': 12,     // 14点 1:12
            'sum_15': 15,     // 15点 1:15
            'sum_16': 20,     // 16点 1:20
            'sum_17': 50       // 17点 1:50
        };

        this.initUI();
    }

    initUI() {
        this.renderRoadMap();
        this.updateTotalBetDisplay();
    }

    setSelectedChip(amount) {
        this.selectedChip = amount;
        document.querySelectorAll('.chip-btn').forEach(btn => {
            if (parseInt(btn.dataset.val) === amount) {
                btn.classList.add('ring-2', 'ring-yellow-400', 'scale-105');
            } else {
                btn.classList.remove('ring-2', 'ring-yellow-400', 'scale-105');
            }
        });
        if (window.soundEngine) window.soundEngine.playClick();
    }

    placeBet(betKey) {
        if (this.isRolling) return;

        const cost = this.selectedChip;
        if (this.state.chips < this.getTotalBet() + cost) {
            alert('筹码余额不足！可点击右上角领取救济筹码。');
            return;
        }

        this.bets[betKey] = (this.bets[betKey] || 0) + cost;
        if (window.soundEngine) window.soundEngine.playChipBet();

        this.updateBetBadges();
        this.updateTotalBetDisplay();
    }

    clearBets() {
        if (this.isRolling) return;
        this.bets = {};
        this.updateBetBadges();
        this.updateTotalBetDisplay();
        if (window.soundEngine) window.soundEngine.playClick();
    }

    repeatBets() {
        if (this.isRolling) return;
        const total = Object.values(this.lastBets).reduce((a, b) => a + b, 0);
        if (total === 0) return;
        if (this.state.chips < total) {
            alert('筹码余额不足以重复上一局下注！');
            return;
        }
        this.clearBets();
        this.bets = Object.assign({}, this.lastBets);
        this.updateBetBadges();
        this.updateTotalBetDisplay();
        if (window.soundEngine) window.soundEngine.playChipBet();
    }

    getTotalBet() {
        return Object.values(this.bets).reduce((a, b) => a + b, 0);
    }

    updateTotalBetDisplay() {
        const el = document.getElementById('sicbo-total-bet');
        if (el) {
            el.textContent = this.getTotalBet();
        }
    }

    updateBetBadges() {
        document.querySelectorAll('[data-bet]').forEach(cell => {
            const key = cell.dataset.bet;
            let badge = cell.querySelector('.bet-badge');
            const amount = this.bets[key] || 0;

            if (amount > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'bet-badge absolute top-1 right-1 bg-yellow-500 text-slate-950 font-bold text-xs px-1.5 py-0.5 rounded-full shadow-md animate-bounce';
                    cell.appendChild(badge);
                }
                badge.textContent = amount;
                cell.classList.add('border-yellow-400', 'bg-yellow-950/30');
            } else {
                if (badge) badge.remove();
                cell.classList.remove('border-yellow-400', 'bg-yellow-950/30');
            }
        });
    }

    roll() {
        if (this.isRolling) return;
        const totalBet = this.getTotalBet();
        if (totalBet === 0) {
            alert('请先在桌面上选择区域下注！');
            return;
        }

        if (!this.state.spendChips(totalBet)) {
            alert('筹码扣除失败，余额不足！');
            return;
        }

        this.isRolling = true;
        this.lastBets = Object.assign({}, this.bets);
        document.getElementById('sicbo-roll-btn').disabled = true;

        // 随机产生 3 个骰子点数 1~6
        const v1 = Math.floor(Math.random() * 6) + 1;
        const v2 = Math.floor(Math.random() * 6) + 1;
        const v3 = Math.floor(Math.random() * 6) + 1;
        const results = [v1, v2, v3];

        this.diceEngine.roll(results, null, () => {
            this.handleRollComplete(results);
        });
    }

    handleRollComplete(results) {
        this.isRolling = false;
        document.getElementById('sicbo-roll-btn').disabled = false;

        const sum = results[0] + results[1] + results[2];
        const isTriple = (results[0] === results[1] && results[1] === results[2]);
        const isBig = sum >= 11 && sum <= 17 && !isTriple;
        const isSmall = sum >= 4 && sum <= 10 && !isTriple;
        const isOdd = sum % 2 === 1;
        const isEven = sum % 2 === 0;

        // 记录路单历史
        const record = {
            values: results,
            sum: sum,
            isBig: isBig,
            isSmall: isSmall,
            isTriple: isTriple
        };
        this.state.addSicboHistory(record);
        this.renderRoadMap();

        // 结算判定
        let totalWin = 0;
        const winningKeys = [];

        // 大小
        if (isBig && this.bets['big']) {
            winningKeys.push('big');
            totalWin += this.bets['big'] * 2; // 本金 + 利润
        }
        if (isSmall && this.bets['small']) {
            winningKeys.push('small');
            totalWin += this.bets['small'] * 2;
        }

        // 单双 (围骰/豹子庄家通吃)
        if (!isTriple && isOdd && this.bets['odd']) {
            winningKeys.push('odd');
            totalWin += this.bets['odd'] * 2;
        }
        if (!isTriple && isEven && this.bets['even']) {
            winningKeys.push('even');
            totalWin += this.bets['even'] * 2;
        }

        // 全围/豹子
        if (isTriple && this.bets['any_triple']) {
            winningKeys.push('any_triple');
            totalWin += this.bets['any_triple'] * (this.payoutRates['any_triple'] + 1);
        }

        // 具体点数
        const sumKey = `sum_${sum}`;
        if (this.bets[sumKey]) {
            winningKeys.push(sumKey);
            totalWin += this.bets[sumKey] * (this.payoutRates[sumKey] + 1);
        }

        // 高亮赢赏区域
        winningKeys.forEach(k => {
            const el = document.querySelector(`[data-bet="${k}"]`);
            if (el) {
                el.classList.add('ring-4', 'ring-emerald-400', 'bg-emerald-900/60');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-emerald-400', 'bg-emerald-900/60');
                }, 2500);
            }
        });

        // 资金返还与播报
        if (totalWin > 0) {
            this.state.addChips(totalWin);
            if (window.soundEngine) window.soundEngine.playWin();
            this.showResultBanner(`恭喜大赢！投掷出 ${results.join('+')}=${sum} 点 (${isTriple ? '全围豹子!' : (isBig ? '大' : '小')})，赢得 ${totalWin} 筹码！`, true);
        } else {
            if (window.soundEngine) window.soundEngine.playLose();
            this.showResultBanner(`开出 ${results.join('+')}=${sum} 点 (${isTriple ? '全围豹子!' : (isBig ? '大' : '小')})，本局未中奖，继续加油！`, false);
        }

        // 清空当期桌面下注
        this.bets = {};
        this.updateBetBadges();
        this.updateTotalBetDisplay();
    }

    showResultBanner(msg, isWin) {
        const banner = document.getElementById('sicbo-result-banner');
        if (!banner) return;
        banner.textContent = msg;
        banner.className = `mt-3 p-3 rounded-lg text-center font-bold text-sm transition-all duration-300 ${isWin ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'}`;
    }

    renderRoadMap() {
        const container = document.getElementById('sicbo-roadmap');
        if (!container) return;
        container.innerHTML = '';

        const history = this.state.data.sicboHistory.slice(0, 16);
        if (history.length === 0) {
            container.innerHTML = '<span class="text-xs text-slate-500 py-1">暂无开奖记录</span>';
            return;
        }

        history.forEach(item => {
            const badge = document.createElement('div');
            badge.className = 'w-7 h-7 rounded-full flex flex-col items-center justify-center text-[10px] font-black shadow-inner flex-shrink-0 ';
            if (item.isTriple) {
                badge.className += 'bg-purple-600 text-white ring-2 ring-purple-300 animate-pulse';
                badge.innerHTML = `<span>豹</span>`;
            } else if (item.isBig) {
                badge.className += 'bg-rose-600 text-white';
                badge.innerHTML = `<span>大</span><span class="text-[8px] leading-none">${item.sum}</span>`;
            } else {
                badge.className += 'bg-blue-600 text-white';
                badge.innerHTML = `<span>小</span><span class="text-[8px] leading-none">${item.sum}</span>`;
            }
            container.appendChild(badge);
        });
    }
}

window.SicBoGame = SicBoGame;
