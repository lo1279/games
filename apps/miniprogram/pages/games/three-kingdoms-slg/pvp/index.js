// pages/games/three-kingdoms-slg/pvp/index.js
/**
 * 🏆 排位赛（对齐 Web pvpUI / 天梯）
 *  云端优先：挂载出战队伍 + 匹配对手 + 提交战报；
 *  本地降级：无云端 SDK 时提供「演练赛」体验，并记录为天梯战报。
 */

const cloud = require('../engine/cloud.js');
const { GENERALS_DATA } = require('../data/generals.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');
const { simulateBattle } = require('../engine/battle.js');
const { recordBattle, portraitPath, viewLogs } = require('../slg-common.js');

function resolveFormation(form) {
  if (!form || !form.heroes || !form.heroes.length) return null;
  const heroes = form.heroes.map(h => {
    if (h.builtInTacticId || h.force) return h;
    const base = GENERALS_DATA.find(g => g.id === (h.generalId || h.id));
    if (!base) return null;
    return {
      ...base, id: base.id, name: base.name, level: h.level || base.level || 50,
      currentSoldiers: h.currentSoldiers || 8000, maxSoldiers: h.currentSoldiers || 8000,
      builtInTacticId: base.builtInTacticId,
      equippedTactic1: h.tactic1Id || h.equippedTactic1 || null,
      equippedTactic2: h.tactic2Id || h.equippedTactic2 || null
    };
  }).filter(Boolean);
  return { name: form.name || '对手', arm: form.arm || 'spear', heroes };
}

const LOCAL_BOARD = [
  { nickname: '江东小霸王', tier: 'gold', points: 1820, power: 42100 },
  { nickname: '卧龙雏凤', tier: 'gold', points: 1755, power: 40800 },
  { nickname: '魏武挥鞭', tier: 'silver', points: 1640, power: 38600 },
  { nickname: '百战黄忠', tier: 'silver', points: 1510, power: 35900 },
  { nickname: '常山赵子龙', tier: 'bronze', points: 1380, power: 33000 }
];

Page({
  data: {
    cloudAvailable: false,
    modeLabel: '检测中...',
    board: [],
    myRank: null,
    posted: false,
    showResult: false,
    result: { victory: false, oppName: '', logs: [] }
  },

  onShow() { this.refresh(); },

  async refresh() {
    const available = !!(cloud.isCloudAvailable && cloud.isCloudAvailable());
    let board = [];
    let myRank = null;
    if (available) {
      const r = await cloud.getRankedBoard(20);
      board = (r.data || []).map(p => ({ nickname: p.nickname, tier: p.tier, points: p.points, power: p.power }));
      const me = await cloud.getMyRank();
      myRank = me.data || null;
    } else {
      board = LOCAL_BOARD;
    }
    const state = loadGameState();
    this.setData({
      cloudAvailable: available,
      modeLabel: available ? '云端排位赛' : '演练模式（未连接云端）',
      board,
      myRank,
      posted: state.postedTroopIndex != null
    });
  },

  async togglePost() {
    const state = loadGameState();
    if (this.data.cloudAvailable) {
      if (state.postedTroopIndex != null) {
        await cloud.unpostFormation();
        state.postedTroopIndex = null;
      } else {
        state.postedTroopIndex = state.currentTroopIndex;
        await cloud.postFormation(state, state.currentTroopIndex);
      }
      saveGameState(state);
      wx.showToast({ title: state.postedTroopIndex != null ? '已挂载出战队伍' : '已撤下队伍', icon: 'none' });
      this.refresh();
    } else {
      state.postedTroopIndex = state.postedTroopIndex != null ? null : state.currentTroopIndex;
      saveGameState(state);
      this.setData({ posted: state.postedTroopIndex != null });
      wx.showToast({ title: state.postedTroopIndex != null ? '演练：队伍已上阵' : '演练：已下阵', icon: 'none' });
    }
  },

  async findMatch() {
    const state = loadGameState();
    const playerTroop = state.troops[state.currentTroopIndex] || state.troops[0];
    if (!playerTroop || !playerTroop.heroes || playerTroop.heroes.length === 0) {
      wx.showToast({ title: '请先在【军团】配置出征将领', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '匹配对手中...' });
    let enemyFormation = null;
    let oppName = '演练假想敌';
    if (this.data.cloudAvailable) {
      const tier = (this.data.myRank && this.data.myRank.tier) || 'bronze';
      const r = await cloud.findRankedOpponent(tier);
      if (r.data && r.data.posted_formation) {
        enemyFormation = resolveFormation(r.data.posted_formation);
        oppName = r.data.nickname || oppName;
      }
    }
    if (!enemyFormation) {
      // 本地降级：用预设强敌
      enemyFormation = resolveFormation({
        name: '演练·天王神武军', arm: 'spear',
        heroes: [
          { generalId: 'gen_zhu_ge_liang', level: 50, currentSoldiers: 10000 },
          { generalId: 'gen_liu_bei', level: 50, currentSoldiers: 10000 },
          { generalId: 'gen_guan_yu', level: 50, currentSoldiers: 10000 }
        ]
      });
    }
    setTimeout(async () => {
      wx.hideLoading();
      const report = simulateBattle(playerTroop, enemyFormation);
      const isWin = report.summary.winner === 'player';
      const battleLogs = report.logs || [];
      recordBattle(state, {
        category: 'ladder',
        title: `排位赛 · VS ${oppName}`,
        isVictory: isWin,
        summary: isWin ? `战胜 ${oppName}！` : `不敌 ${oppName}`,
        logs: battleLogs || ['排位推演完成']
      });
      // 演练模式更新本地战绩
      if (!this.data.cloudAvailable) {
        const p = { wins: (state._localWins || 0) + (isWin ? 1 : 0), losses: (state._localLosses || 0) + (isWin ? 0 : 1) };
        state._localWins = p.wins; state._localLosses = p.losses;
        saveGameState(state);
      }
      // battleLogs 是引擎原始日志（meta 内含自引用武将对象），必须转纯字符串再下发
      this.setData({
        showResult: true,
        result: { victory: isWin, oppName, logs: viewLogs(battleLogs, '排位推演完成') }
      });
      try { wx.vibrateShort({ type: isWin ? 'heavy' : 'light' }); } catch (e) {}
    }, 400);
  },

  closeResult() { this.setData({ showResult: false }); },
  back() { wx.navigateBack({ delta: 1 }); }
});
