// pages/index/index.js
Page({
  data: {
    // 游戏 H5 访问地址
    // 部署上线前请替换为您自己的 HTTPS 域名，或开发调试阶段使用本地/局域网/内网穿透链接
    gameUrl: 'https://your-domain.com/tetris/index.html'
  },

  onLoad(options) {
    // 支持通过小程序启动参数动态传入指定 url
    if (options && options.url) {
      this.setData({
        gameUrl: decodeURIComponent(options.url)
      });
    }
  },

  onWebLoad() {
    console.log('游戏页面加载完成');
  },

  onWebError(e) {
    console.error('游戏页面加载失败:', e.detail);
    wx.showToast({
      title: '游戏加载失败，请检查网络或域名配置',
      icon: 'none',
      duration: 3000
    });
  },

  onWebMessage(e) {
    console.log('收到来自游戏网页的消息:', e.detail);
  },

  // 微信好友转发分享
  onShareAppMessage() {
    return {
      title: '🎮 俄罗斯方块霓虹版 - 快来挑战高分！',
      path: '/pages/index/index'
    };
  },

  // 微信朋友圈分享
  onShareTimeline() {
    return {
      title: '🎮 经典俄罗斯方块 · 霓虹版'
    };
  }
});
