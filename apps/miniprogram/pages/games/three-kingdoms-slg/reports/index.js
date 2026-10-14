// pages/games/three-kingdoms-slg/reports/index.js
/**
 * 📜 战报中心（对齐 Web renderReports / openBattleDetailModal）
 * 读取 state.battleReports（由 slg-common.recordBattle 写入）
 */

const { REPORT_CATEGORIES } = require('../engine/report.js');
const { loadGameState } = require('../engine/storage.js');

Page({
  data: {
    cats: [],
    activeCat: 'all',
    list: [],
    showDetail: false,
    detail: null
  },

  onLoad() {
    const cats = [{ id: 'all', name: '全部', color: '#caa85a' }, ...REPORT_CATEGORIES];
    this.setData({ cats });
  },

  onShow() { this.refresh(); },

  refresh() {
    const state = loadGameState();
    const all = state.battleReports || [];
    const list = this.data.activeCat === 'all'
      ? all
      : all.filter(r => (r.category || 'campaign') === this.data.activeCat);
    this.setData({ list });
  },

  switchCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.id });
    this.refresh();
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(r => r.id === id);
    if (item) this.setData({ showDetail: true, detail: item });
  },
  closeDetail() { this.setData({ showDetail: false }); },

  back() { wx.navigateBack({ delta: 1 }); }
});
