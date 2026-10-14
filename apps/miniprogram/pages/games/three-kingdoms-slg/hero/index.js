// pages/games/three-kingdoms-slg/hero/index.js
/**
 * 🔼 武将养成（对齐 Web promoteHero / inheritTacticFromHero / sellHero）
 *  - 升星（红度）：消耗铜币提升 redStars，四项属性 +5
 *  - 传承：消耗该武将，将其自带战法收入战法库
 *  - 出售：转化为铜币
 */

const { loadGameState, saveGameState } = require('../engine/storage.js');
const { portraitPath } = require('../slg-common.js');

function decorate(g) {
  return { ...g, portrait: portraitPath(g, '../assets/generals/'), maxRed: g.star || 5 };
}

Page({
  data: {
    heroes: [],
    copper: 0
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const heroes = (state.ownedGenerals || []).map(decorate);
    this.setData({ heroes, copper: state.resources.copper || 0 });
  },

  promoteHero(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const hero = (state.ownedGenerals || []).find(g => g.id === id);
    if (!hero) return;
    const red = hero.redStars || 0;
    const maxRed = hero.star || 5;
    if (red >= maxRed) { wx.showToast({ title: `已达${maxRed}红上限`, icon: 'none' }); return; }
    const cost = (red + 1) * 800;
    if ((state.resources.copper || 0) < cost) { wx.showToast({ title: '铜币不足', icon: 'none' }); return; }
    state.resources.copper -= cost;
    hero.redStars = red + 1;
    hero.force = (hero.force || 50) + 5;
    hero.intel = (hero.intel || 50) + 5;
    hero.command = (hero.command || 50) + 5;
    hero.speed = (hero.speed || 50) + 5;
    saveGameState(state);
    wx.showToast({ title: `升星至 ${hero.redStars} 红`, icon: 'success' });
    this.refresh();
  },

  inheritHero(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const hero = (state.ownedGenerals || []).find(g => g.id === id);
    if (!hero) return;
    const tid = hero.builtInTacticId;
    if (!tid) { wx.showToast({ title: '该武将无自带战法', icon: 'none' }); return; }
    wx.showModal({
      title: '战法传承',
      content: `将【${hero.name}】传承，使其自带战法入库后该武将被消耗，确定？`,
      success: (res) => {
        if (!res.confirm) return;
        state.ownedTactics = Array.from(new Set([...(state.ownedTactics || []), tid]));
        state.tacticLevels = state.tacticLevels || {};
        if (!state.tacticLevels[tid]) state.tacticLevels[tid] = 1;
        state.ownedGenerals = (state.ownedGenerals || []).filter(g => g.id !== id);
        saveGameState(state);
        wx.showToast({ title: '传承成功，战法入库', icon: 'success' });
        this.refresh();
      }
    });
  },

  sellHero(e) {
    const id = e.currentTarget.dataset.id;
    const state = loadGameState();
    const hero = (state.ownedGenerals || []).find(g => g.id === id);
    if (!hero) return;
    const gain = (hero.star || 3) * 500 + (hero.redStars || 0) * 200;
    wx.showModal({
      title: '出售武将',
      content: `出售【${hero.name}】可获得 🪙${gain} 铜币，确定？`,
      success: (res) => {
        if (!res.confirm) return;
        state.resources.copper = (state.resources.copper || 0) + gain;
        state.ownedGenerals = (state.ownedGenerals || []).filter(g => g.id !== id);
        saveGameState(state);
        wx.showToast({ title: `出售 +🪙${gain}`, icon: 'success' });
        this.refresh();
      }
    });
  },

  onImgErr(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    if (!isNaN(idx)) this.setData({ [`heroes[${idx}].failed`]: true });
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
