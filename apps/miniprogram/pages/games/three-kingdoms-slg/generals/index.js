// pages/games/three-kingdoms-slg/generals/index.js
/**
 * 📖 武将图鉴（对齐 Web renderGenerals + generalFilter）
 * 全量 115 武将，支持阵营/星级/兵种筛选与名称搜索
 */

const { GENERALS_DATA } = require('../data/generals.js');
const { portraitPath } = require('../slg-common.js');

const CAMPS = [
  { key: 'all', name: '全部' },
  { key: 'wei', name: '魏' },
  { key: 'shu', name: '蜀' },
  { key: 'wu', name: '吴' },
  { key: 'qun', name: '群' }
];
const STARS = [
  { key: 0, name: '全部' },
  { key: 5, name: '5★' },
  { key: 4, name: '4★' },
  { key: 3, name: '3★' }
];

function decorate(g) {
  return { ...g, portrait: portraitPath(g, '../assets/generals/') };
}

Page({
  data: {
    all: [],
    list: [],
    camps: CAMPS,
    stars: STARS,
    campIdx: 0,
    starIdx: 0,
    keyword: '',
    showDetail: false,
    detail: null
  },

  onLoad() {
    const all = GENERALS_DATA.map(decorate);
    this.setData({ all, list: all });
  },

  onCamp(e) {
    this.setData({ campIdx: parseInt(e.currentTarget.dataset.idx, 10) });
    this.applyFilter();
  },
  onStar(e) {
    this.setData({ starIdx: parseInt(e.currentTarget.dataset.idx, 10) });
    this.applyFilter();
  },
  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  applyFilter() {
    const camp = this.data.camps[this.data.campIdx].key;
    const star = this.data.stars[this.data.starIdx].key;
    const kw = (this.data.keyword || '').trim();
    const list = this.data.all.filter(g => {
      if (camp !== 'all' && g.camp !== camp) return false;
      if (star !== 0 && g.star !== star) return false;
      if (kw && !(g.name || '').includes(kw)) return false;
      return true;
    });
    this.setData({ list });
  },

  showDetail(e) {
    const id = e.currentTarget.dataset.id;
    const g = this.data.all.find(x => x.id === id);
    if (g) this.setData({ showDetail: true, detail: g });
  },
  closeDetail() { this.setData({ showDetail: false }); },

  // 立绘加载失败回退 emoji 兜底
  onImgErr(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    if (isNaN(idx)) return;
    this.setData({ [`list[${idx}].failed`]: true });
  },
  onImgErrDetail() {
    this.setData({ 'detail.failed': true });
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
