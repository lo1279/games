// pages/games/three-kingdoms-slg/sandbox/index.js
/**
 * ⚔️ 自由对战沙盘（对齐 Web renderSandbox / applySandboxPreset / launchSandboxBattle）
 * 编辑「演习假想敌」并与之对战；复用 state.customEnemyTroop
 */

const { GENERALS_DATA } = require('../data/generals.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');
const { simulateBattle } = require('../engine/battle.js');
const { portraitPath, recordBattle, viewLogs } = require('../slg-common.js');

function buildEnemyHero(generalId, level, soldiers, t1, t2) {
  const base = GENERALS_DATA.find(g => g.id === generalId);
  if (!base) return null;
  return {
    ...base,
    id: generalId,
    name: base.name,
    level: level || 50,
    currentSoldiers: soldiers || 10000,
    maxSoldiers: soldiers || 10000,
    builtInTacticId: base.builtInTacticId,
    equippedTactic1: t1 || null,
    equippedTactic2: t2 || null
  };
}

function decorate(g) {
  return { ...g, portrait: portraitPath(g, '../assets/generals/') };
}

Page({
  data: {
    enemy: null,
    enemyHeroes: [],
    showPicker: false,
    pickerList: [],
    editingSlot: 0,
    showBattleModal: false,
    battleResult: { victory: false, logs: [] }
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const enemy = state.customEnemyTroop;
    const heroes = (enemy.heroes || []).map(h => decorate(buildEnemyHero(h.generalId, h.level, h.currentSoldiers, h.tactic1Id, h.tactic2Id)));
    this.setData({ enemy, enemyHeroes: heroes });
  },

  openPicker(e) {
    const slot = parseInt(e.currentTarget.dataset.slot, 10);
    const list = GENERALS_DATA.map(decorate);
    this.setData({ showPicker: true, pickerList: list, editingSlot: slot });
  },

  closePicker() { this.setData({ showPicker: false }); },

  pickGeneral(e) {
    const gid = e.currentTarget.dataset.gid;
    const slot = this.data.editingSlot;
    const state = loadGameState();
    const heroes = state.customEnemyTroop.heroes;
    const def = heroes[slot] || {};
    heroes[slot] = {
      generalId: gid,
      level: def.level || 50,
      currentSoldiers: def.currentSoldiers || 10000,
      maxSoldiers: def.currentSoldiers || 10000,
      tactic1Id: def.tactic1Id || null,
      tactic2Id: def.tactic2Id || null
    };
    saveGameState(state);
    this.setData({ showPicker: false });
    this.refresh();
  },

  launchSandbox() {
    const state = loadGameState();
    const playerTroop = state.troops[state.currentTroopIndex] || state.troops[0];
    if (!playerTroop || !playerTroop.heroes || playerTroop.heroes.length === 0) {
      wx.showToast({ title: '请先在【军团】配置出征将领', icon: 'none' });
      return;
    }
    const enemyTroop = {
      name: state.customEnemyTroop.name || '演习假想敌',
      arm: state.customEnemyTroop.arm || 'spear',
      heroes: (state.customEnemyTroop.heroes || []).map(h => buildEnemyHero(h.generalId, h.level, h.currentSoldiers, h.tactic1Id, h.tactic2Id)).filter(Boolean)
    };
    if (enemyTroop.heroes.length === 0) {
      wx.showToast({ title: '假想敌阵容为空', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '演习推演中...' });
    setTimeout(() => {
      wx.hideLoading();
      const report = simulateBattle(playerTroop, enemyTroop);
      const isWin = report.summary.winner === 'player';
      const battleLogs = report.logs || [];
      recordBattle(state, {
        category: 'sandbox',
        title: `自由演习 · ${enemyTroop.name}`,
        isVictory: isWin,
        summary: isWin ? '演习大获全胜！' : '演习败北',
        logs: battleLogs || ['演习推演完成']
      });
      // battleLogs 是引擎原始日志（meta 内含自引用武将对象），必须转纯字符串再下发
      this.setData({
        battleResult: { victory: isWin, logs: viewLogs(battleLogs, '演习推演完成') },
        showBattleModal: true
      });
      try { wx.vibrateShort({ type: isWin ? 'heavy' : 'light' }); } catch (err) {}
    }, 350);
  },

  closeBattleModal() { this.setData({ showBattleModal: false }); },

  // 立绘加载失败 → 回退 emoji 兜底（与 Web 版「立绘优先、emoji 兜底」一致）
  onImgErr(e) {
    const list = e.currentTarget.dataset.list;
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    if (!list || isNaN(idx)) return;
    const key = `${list}[${idx}].failed`;
    this.setData({ [key]: true });
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
