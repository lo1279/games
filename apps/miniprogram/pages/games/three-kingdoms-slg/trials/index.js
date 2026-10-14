// pages/games/three-kingdoms-slg/trials/index.js
/**
 * 🗡️ 演武·通天试炼阁（对齐 Web renderTrials / launchTrialBattle）
 * 复用 data/campaigns.js 的 TRIALS_DATA；胜利推进 state.trialFloor
 */

const { TRIALS_DATA } = require('../data/campaigns.js');
const { GENERALS_DATA } = require('../data/generals.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');
const { simulateBattle } = require('../engine/battle.js');
const { recordBattle, viewLogs } = require('../slg-common.js');

Page({
  data: {
    floors: [],
    currentFloor: 1,
    showBattleModal: false,
    battleResult: { victory: false, logs: [] }
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const cur = state.trialFloor || 1;
    const floors = TRIALS_DATA.map((f, i) => ({
      floor: f.floor,
      title: f.title,
      arm: f.arm,
      leadName: f.leadName,
      difficulty: f.difficulty,
      hint: f.hint,
      status: f.floor < cur ? 'cleared' : (f.floor === cur ? 'current' : 'locked'),
      heroCount: (f.heroes || []).length
    }));
    this.setData({ floors, currentFloor: cur });
  },

  launchTrial(e) {
    const floor = parseInt(e.currentTarget.dataset.floor, 10);
    const state = loadGameState();
    if (floor > (state.trialFloor || 1)) {
      wx.showToast({ title: '请先通关前置层数', icon: 'none' });
      return;
    }
    const def = TRIALS_DATA[floor - 1];
    if (!def) return;
    const playerTroop = state.troops[state.currentTroopIndex] || state.troops[0];
    if (!playerTroop || !playerTroop.heroes || playerTroop.heroes.length === 0) {
      wx.showToast({ title: '请先在【军团】配置出征将领', icon: 'none' });
      return;
    }
    const soldiers = 6000 + floor * 500;
    const enemyTroop = {
      name: def.title,
      arm: def.arm,
      heroes: def.heroes.map(h => {
        const base = GENERALS_DATA.find(g => g.id === h.id || g.name === h.name);
        return {
          ...h,
          aptitude: (base && base.aptitude) || { cavalry: 'A', shield: 'A', bow: 'A', spear: 'A', siege: 'B' },
          currentSoldiers: soldiers,
          maxSoldiers: soldiers
        };
      })
    };

    wx.showLoading({ title: '演武推演中...' });
    setTimeout(() => {
      wx.hideLoading();
      const report = simulateBattle(playerTroop, enemyTroop, {
        tacticLevels: state.tacticLevels || {},
        techLevels: state.techLevels || {}
      });
      const isWin = report.summary.winner === 'player';
      const battleLogs = report.logs || [];
      if (isWin && floor === (state.trialFloor || 1)) {
        state.trialFloor = floor + 1;
        saveGameState(state);
        this.refresh();
      }
      recordBattle(state, {
        category: 'trial',
        title: `演武第${floor}层 · ${def.leadName}`,
        isVictory: isWin,
        summary: isWin ? `通关演武第${floor}层！` : `演武第${floor}层受挫`,
        logs: battleLogs || ['演武推演完成']
      });
      // battleLogs 是引擎原始日志（meta 内含自引用武将对象），必须转纯字符串再下发
      this.setData({
        battleResult: { victory: isWin, logs: viewLogs(battleLogs, '演武推演完成') },
        showBattleModal: true
      });
      try { wx.vibrateShort({ type: isWin ? 'heavy' : 'light' }); } catch (err) {}
    }, 350);
  },

  closeBattleModal() { this.setData({ showBattleModal: false }); },
  back() { wx.navigateBack({ delta: 1 }); }
});
