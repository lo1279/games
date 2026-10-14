// pages/games/three-kingdoms-slg/tech/index.js
/**
 * 🏛️ 太学府·科技树（对齐 Web renderCityTech / researchTech）
 * 复用 engine/city.js 的 TECH_CONFIG / TECH_DISTRICTS / techUpgradeState / aggregateTechBuffs
 */

const {
  TECH_CONFIG, TECH_DISTRICTS, techUpgradeState, aggregateTechBuffs
} = require('../engine/city.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');
const { resIcon } = require('../slg-common.js');

function costText(cost) {
  if (!cost) return '';
  // 注意：不可用「箭头函数 + 参数数组解构」的写法（即参数位置直接写方括号解构）。
  // 小程序编译器会把它转成 @babel/runtime/helpers/arrayWithHoles，运行时无此模块 → 页面崩。
  // 统一改用 Object.keys + 下标取值，彻底规避 babel helper 依赖。
  return Object.keys(cost).map(k => `${resIcon(k)}${cost[k]}`).join('  ');
}

Page({
  data: {
    districts: [],
    buffs: { researched: 0, maxed: 0, total: 0, force: 0, intel: 0, command: 0, speed: 0 },
    palaceLevel: 1
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const districts = TECH_DISTRICTS.map(d => ({
      id: d.id,
      name: d.name,
      desc: d.desc,
      icon: d.icon,
      techs: Object.values(TECH_CONFIG)
        .filter(t => t.category === d.id)
        .map(t => {
          const st = techUpgradeState(t, state);
          return {
            id: t.id,
            name: t.name,
            icon: t.icon,
            sub: t.arm ? `兵种·${t.arm}` : (t.camp ? `阵营·${t.camp}` : '全军'),
            maxLevel: t.maxLevel,
            desc: t.desc,
            effect: t.effect(st.level),
            level: st.level,
            status: st.status,
            palaceReq: st.palaceReq,
            costText: costText(st.cost),
            canResearch: st.status === 'ready'
          };
        })
    }));
    this.setData({
      districts,
      buffs: aggregateTechBuffs(state),
      palaceLevel: (state.buildings && state.buildings.palace) || 1
    });
  },

  researchTech(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const cfg = TECH_CONFIG[id];
    if (!cfg) return;
    const st = techUpgradeState(cfg, state);
    if (st.status === 'locked') {
      wx.showToast({ title: `需君王殿 Lv.${st.palaceReq}`, icon: 'none' });
      return;
    }
    if (st.status === 'max') {
      wx.showToast({ title: '已达最高等级', icon: 'none' });
      return;
    }
    if (!st.canAfford) {
      wx.showToast({ title: '资源不足', icon: 'none' });
      return;
    }
    // 避免 for..of + 数组解构：会被"增强编译"转成 require('@babel/runtime/helpers/arrayWithHoles') 而小程序无此依赖
    Object.keys(st.cost).forEach((k) => {
      state.resources[k] = (state.resources[k] || 0) - st.cost[k];
    });
    state.techLevels[id] = (state.techLevels[id] || 0) + 1;
    saveGameState(state);
    wx.showToast({ title: `${cfg.name} → Lv.${state.techLevels[id]}`, icon: 'success' });
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this.refresh();
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
