# 📱 微信小程序部署与手机端集成指南

本项目已完成**移动端优先（Mobile First）**与**微信环境**的深度适配，支持全面屏安全区、手势防缩放、吸底操作栏以及动态 3D 相机自适应。

以下为您提供将本作部署到微信小程序的最标准、最高效实施方案：

---

## 🚀 推荐部署方案：通过小程序 `<web-view>` 容器一键内嵌

利用微信小程序原生提供的 `<web-view>` 组件，可以直接以原生体验全屏加载本 HTML5 3D 游戏，**无需重构 3D 引擎，亦无需办理繁琐的版号/文网文资质**。

### 第一步：将游戏部署到静态服务器 / 云存储
将 `D:\ai项目\games\dice-game/` 目录下的所有文件上传至您的任意静态托管服务（如腾讯云 COS、阿里云 OSS、Vercel 或自己的宝塔服务器），并配置 HTTPS。例如访问地址为：
`https://game.yourdomain.com/dice-game/index.html`

---

### 第二步：在微信小程序项目中集成

1. **配置 `app.json`**：
   在小程序的 `app.json` 中注册游戏页面：
   ```json
   {
     "pages": [
       "pages/game/game"
     ],
     "window": {
       "navigationBarBackgroundColor": "#0b0f19",
       "navigationBarTitleText": "3D 骰王争霸",
       "navigationBarTextStyle": "white",
       "navigationStyle": "custom"
     }
   }
   ```
   *(注：设置 `"navigationStyle": "custom"` 可实现沉浸式全屏，游戏自带的顶部栏和底部安全区已完美适配刘海屏)*

2. **创建 `pages/game/game.wxml`**：
   ```xml
   <web-view src="https://game.yourdomain.com/dice-game/index.html"></web-view>
   ```

3. **创建 `pages/game/game.js`**：
   ```javascript
   Page({
     data: {},
     onShareAppMessage() {
       return {
         title: '🎲 来和我切磋两把！3D 骰王争霸',
         path: '/pages/game/game'
       };
     }
   });
   ```

4. **在微信公众平台配置业务域名**：
   登录 [微信公众平台](https://mp.weixin.qq.com/) -> 【开发管理】 -> 【开发设置】 -> 【业务域名】，将 `game.yourdomain.com` 添加进去，并下载校验文件放置于服务器根目录即可。

---

## 🛠️ 本地调试与微信开发者工具预览

在正式上线前，您可以在**微信开发者工具**中进行免域名校验测试：
1. 打开微信开发者工具，导入您的小程序项目。
2. 点击右上角【详情】 -> 【本地设置】。
3. 勾选 **“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”**。
4. 即可直接在开发者工具中以 iPhone 14/15 模式实时预览与畅玩！

---

## 🌟 移动端与小程序适配亮点

1. **防缩放与防菜单**：已内置 `user-scalable=no` 与 `-webkit-touch-callout: none`，长按绝不弹窗，双击绝不误放大。
2. **大拇指黄金热区**：骰宝筹码与摇骰大按钮全面吸底（Sticky Bottom），单手操作自如。
3. **自适应 3D 视野**：在 375px~430px 的各类手机竖屏下，Three.js 相机自动拉伸视野，骰盘完整居中展现。
4. **全面屏安全区**：底部自动避开 iPhone 虚拟横条（Home Indicator），不发生按键遮挡。
