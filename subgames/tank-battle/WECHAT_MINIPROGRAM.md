# 坦克大战 (Tank Battle) - 微信小程序部署与接入指南

本工程已完成**手机端自适应排版、防误触、多点触控滑动十字摇杆（D-Pad）与 A/B 开火按键**的全面适配，可完美运行于手机浏览器、微信内嵌网页以及微信小程序中。

---

## 方案 A：微信小程序 `web-view` 内嵌上线（推荐，最快最稳妥）

微信小程序的 `<web-view>` 组件是一个可以用来承载网页的容器。游戏原生的 HTML5 Canvas、Web Audio API 8-Bit 复古音效与触摸手势均能在 `<web-view>` 中以 100% 性能与体验运行。

### 1. 准备静态资源托管
将 `D:\ai项目\games\tank-battle` 内的所有文件上传到任意支持 HTTPS 的静态云存储或服务器，例如：
- 微信云开发（静态网站托管，开箱即用，无需配置域名白名单）
- 腾讯云 COS / 阿里云 OSS
- 自有服务器 Nginx（开启 HTTPS）
- Vercel / Cloudflare Pages / Netlify

假设您的访问地址为：`https://games.yourdomain.com/tank-battle/index.html`

### 2. 配置微信小程序业务域名
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)；
2. 进入 **【开发管理】 $\rightarrow$ 【开发设置】 $\rightarrow$ 【业务域名】**；
3. 将您的域名（如 `games.yourdomain.com`）添加为业务域名（下载校验文件放置在域名根目录下验证即可）。
> **注**：如果在微信开发者工具中本地测试，可直接在开发者工具右上角勾选：**【详情】 $\rightarrow$ 【本地设置】 $\rightarrow$ 【不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书】**，无需配置即可即刻调试！

### 3. 小程序端页面代码接入

#### 页面结构 (`pages/tank/tank.wxml`)
```html
<view class="game-container">
  <web-view src="https://games.yourdomain.com/tank-battle/index.html" bindmessage="onMessage"></web-view>
</view>
```

#### 页面样式 (`pages/tank/tank.wxss`)
```css
page {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  background-color: #0d1117;
  overflow: hidden;
}

.game-container {
  width: 100%;
  height: 100%;
}
```

#### 页面逻辑 (`pages/tank/tank.js`)
```javascript
Page({
  data: {},
  onLoad(options) {
    // 页面加载，可设置小程序常亮保持屏幕不锁屏
    if (wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: true });
    }
  },
  onShareAppMessage() {
    return {
      title: '快来跟我一起守卫老鹰！经典FC坦克大战手机版',
      path: '/pages/tank/tank'
    };
  }
});
```

---

## 方案 B：微信小游戏（Native MiniGame）说明

微信小游戏运行于独立于浏览器 DOM 的纯 JavaScript 虚拟机（V8/JSCore），无原生 DOM 树（`document`、`div` 等）。
若后续需发布为纯微信小游戏：
- 游戏主逻辑（`tank.js`、`player.js`、`enemy.js`、`map.js`、`bullet.js`、`levels.js`）完全采用面向对象标准 JavaScript 编写，**与平台完全解耦**。
- 只需将 `index.html` 的 DOM 渲染与触控换成微信小游戏的 `wx.createCanvas()`、`wx.onTouchStart` 与 `wx.createInnerAudioContext()` 即可完成底层映射。

---

## 📱 手机端适配特性一览

1. **自适应视口**：不论是刘海屏、灵动岛、折叠屏还是安卓全面屏，战场画布均根据屏幕宽度等比撑满居中，保证 1:1 像素精度。
2. **多点触控与滑动转向**：
   - 彻底解决移动端触控互斥问题，左手拇指按住滑动变向，右手拇指可同时狂点开火；
   - 十字盘支持 360 度滑动无缝切换上下左右。
3. **掌机级双键**：
   - **A 键**：经典单发精准点射；
   - **B 键**：极速自动连发辅助（按住即可持续高速轰击）。
4. **触控震动反馈**：调用原生 Haptic 震动，开火与受击打击感十足。
5. **顶部紧凑 HUD**：手机端自动将侧边栏折叠为横向单行顶部状态栏，关卡、得分、命数、待击毁敌军一览无遗。
