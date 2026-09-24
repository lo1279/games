/**
 * 全局状态管理与本地持久化
 */
class GameState {
    constructor() {
        this.STORAGE_KEY = 'dice_game_state_v1';
        this.listeners = new Map();
        
        const defaultState = {
            chips: 1000,
            soundEnabled: true,
            totalRolls: 0,
            sicboHistory: [], // 历史开奖: [{ values: [1,2,3], sum: 6, isBig: false, isTriple: false }]
            sicboStats: { wins: 0, losses: 0, totalWon: 0 },
            yahtzeeBestScore: 0,
            liarStats: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 }
        };

        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.data = Object.assign(defaultState, JSON.parse(saved));
            } catch (e) {
                this.data = defaultState;
            }
        } else {
            this.data = defaultState;
        }

        // 同步声音状态
        if (window.soundEngine) {
            window.soundEngine.enabled = this.data.soundEnabled;
        }
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save state to localStorage', e);
        }
        this.emit('change', this.data);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, payload) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(payload));
        }
    }

    get chips() {
        return this.data.chips;
    }

    addChips(amount) {
        this.data.chips += Math.floor(amount);
        this.save();
        this.emit('chips', this.data.chips);
    }

    spendChips(amount) {
        const cost = Math.floor(amount);
        if (this.data.chips >= cost) {
            this.data.chips -= cost;
            this.save();
            this.emit('chips', this.data.chips);
            return true;
        }
        return false;
    }

    claimRelief() {
        if (this.data.chips < 50) {
            this.data.chips += 500;
            this.save();
            this.emit('chips', this.data.chips);
            return 500;
        }
        return 0;
    }

    toggleSound() {
        this.data.soundEnabled = !this.data.soundEnabled;
        if (window.soundEngine) {
            window.soundEngine.enabled = this.data.soundEnabled;
        }
        this.save();
        this.emit('sound', this.data.soundEnabled);
        return this.data.soundEnabled;
    }

    addSicboHistory(record) {
        this.data.sicboHistory.unshift(record);
        if (this.data.sicboHistory.length > 50) {
            this.data.sicboHistory.pop();
        }
        this.data.totalRolls++;
        this.save();
        this.emit('sicboHistory', this.data.sicboHistory);
    }

    updateYahtzeeBest(score) {
        if (score > this.data.yahtzeeBestScore) {
            this.data.yahtzeeBestScore = score;
            this.save();
            this.emit('yahtzeeBest', score);
        }
    }

    recordLiarResult(win) {
        if (win) {
            this.data.liarStats.wins++;
            this.data.liarStats.currentStreak++;
            if (this.data.liarStats.currentStreak > this.data.liarStats.bestStreak) {
                this.data.liarStats.bestStreak = this.data.liarStats.currentStreak;
            }
        } else {
            this.data.liarStats.losses++;
            this.data.liarStats.currentStreak = 0;
        }
        this.save();
        this.emit('liarStats', this.data.liarStats);
    }
}

window.gameState = new GameState();
