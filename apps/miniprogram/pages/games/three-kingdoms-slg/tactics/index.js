// pages/games/three-kingdoms-slg/tactics/index.js
/**
 * 🎴 战法系统（对齐 Web renderTacticsUpgrade / renderEventTactics / openEquipTacticModal）
 *  - 已研习战法升级（铜币）
 *  - 事件战法兑换（满足 reqGenerals 且未兑换）
 *  - 装配战法到拥有武将（equippedTactic1/2）
 */

const { TACTICS_DATA, EVENT_TACTICS_DATA, TACTIC_UPGRADE_COSTS, getHeroInheritTacticId } = require('../data/tactics.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');
const { portraitPath } = require('../slg-common.js');

const TACTIC_MAP = Object.fromEntries(TACTICS_DATA.map(t => [t.id, t]));

Page({
  data: {
    tab: 'owned',
    ownedList: [],
    codexList: [],
    eventList: [],
    showEquip: false,
    equipTacticId: '',
    ownedGenerals: []
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const ownedTactics = state.ownedTactics || [];
    const tacticLevels = state.tacticLevels || {};

    const ownedList = ownedTactics.map(id => {
      const t = TACTIC_MAP[id];
      if (!t) return null;
      const lv = tacticLevels[id] || 1;
      const nextCost = TACTIC_UPGRADE_COSTS[lv];
      return { ...t, level: lv, nextCost: nextCost || 0, canUpgrade: !!nextCost && (state.resources.copper || 0) >= nextCost };
    }).filter(Boolean);

    const codexList = TACTICS_DATA.map(t => ({ ...t, owned: ownedTactics.includes(t.id) }));

    const ownedNames = new Set((state.ownedGenerals || []).map(g => g.name));
    const eventList = EVENT_TACTICS_DATA.map(e => {
      const done = (state.completedEvents || []).includes(e.id);
      const canExchange = !done && e.reqGenerals.every(r => ownedNames.has(r.name));
      // WXML 的 {{}} 只支持取值/三元/逻辑运算，不支持方法调用与箭头函数，
      // 因此需求武将名必须在 JS 侧拼成字符串，模板里只取字段。
      const reqText = (e.reqGenerals || []).map(r => r.name).join('、') || '无';
      return { ...e, done, canExchange, reqText };
    });

    const ownedGenerals = (state.ownedGenerals || []).map(g => ({ id: g.id, name: g.name, avatar: g.avatar, portrait: portraitPath(g, '../assets/generals/'), star: g.star }));

    this.setData({ ownedList, codexList, eventList, ownedGenerals, copper: state.resources.copper || 0 });
  },

  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },

  upgradeTactic(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const lv = (state.tacticLevels && state.tacticLevels[id]) || 1;
    const cost = TACTIC_UPGRADE_COSTS[lv];
    if (!cost) { wx.showToast({ title: '已满级', icon: 'none' }); return; }
    if ((state.resources.copper || 0) < cost) { wx.showToast({ title: '铜币不足', icon: 'none' }); return; }
    state.resources.copper -= cost;
    state.tacticLevels[id] = lv + 1;
    saveGameState(state);
    wx.showToast({ title: `战法升 Lv.${lv + 1}`, icon: 'success' });
    this.refresh();
  },

  exchangeEvent(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const ev = EVENT_TACTICS_DATA.find(x => x.id === id);
    if (!ev) return;
    if ((state.completedEvents || []).includes(id)) return;
    const ownedNames = new Set((state.ownedGenerals || []).map(g => g.name));
    if (!ev.reqGenerals.every(r => ownedNames.has(r.name))) { wx.showToast({ title: '缺少 required 武将', icon: 'none' }); return; }
    state.completedEvents = state.completedEvents || [];
    state.completedEvents.push(id);
    state.ownedTactics = Array.from(new Set([...(state.ownedTactics || []), ev.tacticId]));
    saveGameState(state);
    wx.showToast({ title: `习得事件战法！`, icon: 'success' });
    this.refresh();
  },

  openEquip(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showEquip: true, equipTacticId: id });
  },
  closeEquip() { this.setData({ showEquip: false }); },

  equipTo(e) {
    const gid = e.currentTarget.dataset.gid;
    const slot = parseInt(e.currentTarget.dataset.slot, 10);
    const tid = this.data.equipTacticId;
    const state = loadGameState();
    const hero = (state.ownedGenerals || []).find(g => g.id === gid);
    if (!hero) return;
    if (slot === 1) hero.equippedTactic1 = tid; else hero.equippedTactic2 = tid;
    saveGameState(state);
    this.setData({ showEquip: false });
    wx.showToast({ title: `已装配到${hero.name}`, icon: 'success' });
    this.refresh();
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
