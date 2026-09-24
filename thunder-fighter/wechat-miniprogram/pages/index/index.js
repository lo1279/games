// 雷霆战机小程序主页面逻辑
Page({
  data: {
    // 部署说明：
    // 1. 本地测试：开启微信开发者工具【详情-本地设置-不校验合法域名、web-view(业务域名)】，将此处换为您电脑的局域网IP（如 http://192.168.1.5:8080/index.html）
    // 2. 正式上线：将游戏前端文件夹上传至腾讯云开发(CloudBase)静态网站托管、GitHub Pages 或自己的 HTTPS 域名，在此处填入即可
    gameUrl: 'http://127.0.0.1:8080/index.html'
  },

  onLoad(options) {
    if (options && options.url) {
      this.setData({ gameUrl: decodeURIComponent(options.url) });
    }
  },

  // 接收来自 H5 游戏的通信消息 (如战功分享、震动触发等)
  onMessage(e) {
    console.log('收到游戏端消息：', e.detail);
    if (e.detail && e.detail.data) {
      const msgs = e.detail.data;
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.action === 'vibrate') {
        wx.vibrateShort({ type: 'heavy' });
      }
    }
  },

  onLoadSuccess() {
    console.log('雷霆战机游戏页面加载成功');
  },

  onLoadError(e) {
    console.error('雷霆战机游戏加载失败，请检查 gameUrl 配置或本地静态服务器是否启动：', e);
  },

  // 用户点击右上角转发分享战功
  onShareAppMessage() {
    return {
      title: '我在《雷霆战机》中激战太空，快来挑战我的最高战功！',
      path: '/pages/index/index'
    };
  }
});
