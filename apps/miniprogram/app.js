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
  },

  /**
   * 全局错误兜底（诊断用）。
   * 小程序默认只在控制台打一行裸错误，运行期异常（含栈溢出）常看不到出自哪个页面，
   * 这里统一打全栈，定位问题时可一眼看到 weapp:/// 的具体文件与行号。
   */
  onError(err) {
    const stack = (err && err.stack) || String(err || '');
    console.error('[全局错误] 未捕获异常:', stack);

    // 栈溢出专项提示：堆栈全在基础库内部（WASubContext）且没有业务帧时，
    // 几乎都是「setData 载荷里有循环引用」。现场给方向，省掉一轮盲目排查。
    // 已知唯一来源：simulateBattle 的原始 logs（meta 里的武将对象 buffs/myTeam/oppTeam 互相引用成环）。
    if (stack.indexOf('Maximum call stack size exceeded') >= 0) {
      console.error(
        '[全局错误] ☝️ 这是「视图数据循环引用」的典型表现，不是死循环代码。\n' +
        '  · 战斗日志必须用 slg-common.js 的 viewLogs() 转成纯字符串再 setData；\n' +
        '  · 其余引擎对象下发前用 toView() 净化；\n' +
        '  · 本地自检：在 apps/miniprogram 执行 npm run check（含运行时实测）。'
      );
    }
  },

  /** 未处理的 Promise 拒绝（云同步等异步流程失败会走这里） */
  onUnhandledRejection(res) {
    console.warn('[全局错误] 未处理的 Promise 拒绝:', (res && res.reason) || res);
  }
});