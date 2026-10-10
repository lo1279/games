/**
 * app.js - 小程序入口
 * 说明：个人主体小程序无法使用 web-view 组件内嵌 H5，
 * 因此大厅与游戏均以原生 WXML/WXSS/JS 重写，不依赖任何网页容器。
 */

// 大厅本地存储键名集中管理，避免各处硬编码字符串拼写错误
const STORAGE_KEYS = {
  FAVORITES: 'hub_favorites',   // 收藏的游戏 id 数组
  STATS: 'hub_stats',           // { [gameId]: { plays, lastPlayed } }
  PLAYS_TOTAL: 'hub_plays_total' // 累计游玩次数
};

App({
  globalData: {
    storageKeys: STORAGE_KEYS
  },

  onLaunch() {
    // 冷启动时初始化存储结构，保证后续读取无需做空值兜底
    if (!wx.getStorageSync(STORAGE_KEYS.FAVORITES)) {
      wx.setStorageSync(STORAGE_KEYS.FAVORITES, []);
    }
    if (!wx.getStorageSync(STORAGE_KEYS.STATS)) {
      wx.setStorageSync(STORAGE_KEYS.STATS, {});
    }
    if (wx.getStorageSync(STORAGE_KEYS.PLAYS_TOTAL) === '') {
      wx.setStorageSync(STORAGE_KEYS.PLAYS_TOTAL, 0);
    }

    // 读取用户系统信息，供各页面计算安全区与屏幕宽度
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData.systemInfo = info;
      this.globalData.statusBarHeight = info.statusBarHeight || 20;
      this.globalData.safeAreaBottom = info.screenHeight
        ? info.screenHeight - (info.safeArea ? info.safeArea.bottom : info.screenHeight)
        : 0;
    } catch (e) {
      this.globalData.systemInfo = { windowWidth: 375, windowHeight: 667 };
      this.globalData.statusBarHeight = 20;
      this.globalData.safeAreaBottom = 0;
    }
  }
});