/**
 * pages/index/index.js - 游戏大厅首页
 *
 * 原生重写自 Web 版 index.html + js/hall.js。
 * 关键差异：
 *   1. localStorage -> wx.getStorageSync / wx.setStorageSync
 *   2. iframe 沉浸剧场 -> wx.navigateTo 跳转独立页面
 *   3. HTML 事件绑定 -> bindtap / bindinput 事件绑定
 */
const { GAMES_DATA, CATEGORIES, StorageManager } = require('../../utils/games-data.js');

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: 'all',
    searchKeyword: '',
    sortMode: 'default',
    sortOptions: [
      { value: 'default', label: '默认推荐' },
      { value: 'popular', label: '游玩最多' },
      { value: 'recent', label: '最近游玩' },
      { value: 'title', label: '名称排序' }
    ],
    sortIndex: 0,
    games: [],
    totalGames: GAMES_DATA.length,
    totalPlays: 0,
    playableCount: GAMES_DATA.filter(g => g.playable).length,
    // 详情弹窗
    showDetail: false,
    detailGame: null
  },

  onLoad() {
    this.applyFilter();
  },

  onShow() {
    // 从游戏页返回时刷新统计与收藏状态
    this.applyFilter();
  },

  /**
   * 统一的筛选 + 排序入口
   * 避免分类切换、搜索、排序三处重复维护过滤逻辑
   */
  applyFilter() {
    const { activeCategory, searchKeyword, sortMode } = this.data;
    const keyword = searchKeyword.trim().toLowerCase();
    const stats = StorageManager.getStats();

    let list = GAMES_DATA.slice();

    // 分类筛选
    if (activeCategory === 'fav') {
      const favs = StorageManager.getFavorites();
      list = list.filter(g => favs.indexOf(g.id) !== -1);
    } else if (activeCategory !== 'all') {
      list = list.filter(g => g.category === activeCategory);
    }

    // 关键词模糊搜索：覆盖中文标题、英文标题、标签
    if (keyword) {
      list = list.filter(g => {
        const haystack = [g.title, g.englishTitle].concat(g.tags).join(' ').toLowerCase();
        return haystack.indexOf(keyword) !== -1;
      });
    }

    // 排序
    if (sortMode === 'popular') {
      list.sort((a, b) => {
        const pa = (stats[a.id] && stats[a.id].plays) || 0;
        const pb = (stats[b.id] && stats[b.id].plays) || 0;
        return pb - pa;
      });
    } else if (sortMode === 'recent') {
      list.sort((a, b) => {
        const ta = (stats[a.id] && stats[a.id].lastPlayed) || 0;
        const tb = (stats[b.id] && stats[b.id].lastPlayed) || 0;
        return tb - ta;
      });
    } else if (sortMode === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
    }

    // 附加运行时状态：收藏标记与游玩次数
    const favs = StorageManager.getFavorites();
    const decorated = list.map(g => ({
      ...g,
      isFavorite: favs.indexOf(g.id) !== -1,
      playCount: (stats[g.id] && stats[g.id].plays) || 0
    }));

    this.setData({
      games: decorated,
      totalPlays: StorageManager.getTotalPlays()
    });
  },

  /** 切换分类 Tab */
  onCategoryChange(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.activeCategory) return;
    this.setData({ activeCategory: id }, () => this.applyFilter());
  },

  /** 搜索输入 */
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => this.applyFilter());
  },

  /** 清空搜索 */
  onSearchClear() {
    this.setData({ searchKeyword: '' }, () => this.applyFilter());
  },

  /** 切换排序方式 */
  onSortChange(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    this.setData({
      sortIndex: idx,
      sortMode: this.data.sortOptions[idx].value
    }, () => this.applyFilter());
  },

  /** 随机挑一款（仅在可玩的游戏中挑选，避免跳到未移植的占位卡片） */
  onRandomPlay() {
    const playable = GAMES_DATA.filter(g => g.playable);
    if (playable.length === 0) {
      wx.showToast({ title: '暂无已移植游戏', icon: 'none' });
      return;
    }
    const pick = playable[Math.floor(Math.random() * playable.length)];
    this.launchGame(pick.id);
  },

  /** 打开游戏详情弹窗 */
  onGameTap(e) {
    const id = e.currentTarget.dataset.id;
    const game = GAMES_DATA.find(g => g.id === id);
    if (!game) return;

    if (!game.playable) {
      wx.showToast({
        title: '该游戏正在移植中，敬请期待',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const favs = StorageManager.getFavorites();
    this.setData({
      showDetail: true,
      detailGame: {
        ...game,
        isFavorite: favs.indexOf(game.id) !== -1,
        playCount: (StorageManager.getStats()[game.id] || {}).plays || 0
      }
    });
  },

  /** 关闭详情弹窗 */
  onDetailClose() {
    this.setData({ showDetail: false });
  },

  /** 阻止弹窗内部冒泡，避免点击内容时关闭弹窗 */
  noop() {},

  /**
   * 进入游戏：记录游玩统计后跳转
   * 统计先写后跳，保证即使页面跳转异常也不丢记录
   */
  launchGame(id) {
    const game = GAMES_DATA.find(g => g.id === id);
    if (!game || !game.playable || !game.route) return;

    StorageManager.recordPlay(id);
    wx.navigateTo({
      url: game.route,
      fail: () => {
        wx.showToast({ title: '页面打开失败', icon: 'none' });
      }
    });
  },

  /** 从详情弹窗底部按钮进入 */
  onDetailPlay() {
    const game = this.data.detailGame;
    if (!game) return;
    this.setData({ showDetail: false }, () => this.launchGame(game.id));
  },

  /** 切换收藏 */
  onToggleFavorite(e) {
    const id = e.currentTarget.dataset.id;
    const nowFavorite = StorageManager.toggleFavorite(id);

    wx.showToast({
      title: nowFavorite ? '已加入收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    });

    this.applyFilter();

    // 若详情弹窗正在展示该游戏，同步刷新其收藏状态
    const detail = this.data.detailGame;
    if (detail && detail.id === id) {
      this.setData({ 'detailGame.isFavorite': nowFavorite });
    }
  }
});