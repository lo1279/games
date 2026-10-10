# 星云电竞 · 游戏大厅（微信小程序版）

原生微信小程序实现的游戏聚合大厅。本目录同时保留了原有 Web 版大厅（`index.html`），
两套并存互不影响：Web 版继续双击 `index.html` / `launch_hall.bat` 使用，小程序版用开发者工具导入本目录。

---

## ⚠️ 重要前提：为什么是全原生重写

本小程序账号为 **个人主体**。微信官方明确规定：

> 小程序内嵌网页（`web-view`）能力暂不开放给个人类型账号。

即个人主体无法配置业务域名，`web-view` 内嵌 H5 的方案**不可用**。
因此大厅与游戏均以 WXML / WXSS / 原生 JS 重写，不依赖任何网页容器。
若未来升级为企业主体并完成 ICP 备案域名，可重新评估 web-view 方案。

---

## 🚀 导入运行

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择 **导入项目**
   - **目录**：`D:\ai项目\games`
   - **AppID**：`wxc4a594dbf45190a1`（已在 `project.config.json` 配置）
3. 点击 **编译** 即可在模拟器中体验；**预览** 生成二维码在手机微信中打开

> `project.config.json` 的 `packOptions.ignore` 已排除全部 Web 游戏源码目录，
> 打包时不会把几十 MB 的 React 构建产物带进去。

---

## 📁 小程序工程结构

```text
D:\ai项目\games\
├── app.js                      # 小程序入口，初始化本地存储结构与系统信息
├── app.json                    # 页面路由与窗口配置
├── app.wxss                    # 全局样式与设计令牌
├── sitemap.json                # 索引规则
├── project.config.json         # 工程配置（已配置 appid 与打包排除项）
│
├── pages/
│   ├── index/                  # 🏠 大厅首页：卡片网格 / 分类 / 搜索 / 排序 / 收藏
│   │   ├── index.js            #    筛选排序逻辑 + 存储读取
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── games/
│   │   └── minesweeper/        # 💣 经典扫雷（原生重写，已开放）
│   │       ├── index.js        #    页面逻辑，算法在 utils/minesweeper.js
│   │       ├── index.wxml
│   │       ├── index.wxss
│   │       └── index.json
│   └── about/                  # ℹ️ 关于页：移植边界与待移植清单
│       ├── index.js
│       ├── index.wxml
│       ├── index.wxss
│       └── index.json
│
├── utils/
│   ├── games-data.js           # 10 款游戏元数据 + 收藏/统计存储管理器
│   └── minesweeper.js          # 扫雷核心算法（与视图解耦）
│
└── tools/
    └── smoke-test.js           # 逻辑冒烟测试（node tools/smoke-test.js）
```

---

## 🎮 移植进度

| 游戏 | 类型 | 小程序内状态 |
| :--- | :--- | :--- |
| 💣 经典扫雷 | 休闲益智 | 🟢 **已开放** |
| ⚔️ 三国志·鼎立战略版 | 策略卡牌 | 🚧 移植中 |
| ✨ 人生模拟器 · 轮回录 | 模拟养成 | 🚧 移植中 |
| 🎲 3D 骰王争霸 | 休闲益智 | 🚧 移植中 |
| ⚡ 万神纪元：诸神对决 | 策略卡牌 | 🚧 移植中 |
| 🛡️ 经典坦克大战 | 动作射击 | 🚧 移植中 |
| 🏯 三国志·群英塔防 | 策略塔防 | 🚧 移植中 |
| 🕹️ 霓虹俄罗斯方块 | 街机复古 | 🚧 移植中 |
| 🚀 雷霆战机 | 动作射击 | 🚧 移植中 |
| 🍄 超级马里奥兄弟 | 街机复古 | 🚧 移植中 |

未移植的游戏在大厅卡片上显示「🚧 移植中」角标，点击给出提示，不会跳转到空白页。

---

## ✅ 已实现功能

**大厅首页**
- 顶部统计徽章：收录款数 / 可玩款数 / 累计游玩次数
- Hero 区 +「🎲 试试手气」随机进入可玩游戏
- 6 个分类 Tab：全部 / 休闲益智 / 策略卡牌 / 动作射击 / 街机复古 / 我的收藏
- 实时模糊搜索：覆盖中文标题、英文标题、玩法标签
- 4 种排序：默认推荐 / 游玩最多 / 最近游玩 / 名称排序
- 卡片收藏（❤️），「我的收藏」Tab 专门展示
- 游戏详情弹窗：简介、操作指引、核心特色、收藏状态

**经典扫雷**
- 初中高三档难度（9×9 / 16×16 / 30×16）
- 手机触屏双模操作：挖掘 ⛏️ / 插旗 🚩 切换，长按快捷标记
- 和弦（Chord）快速展开
- 本地最佳成绩排行榜
- 震动反馈（`wx.vibrateShort` / `wx.vibrateLong`）

**数据持久化**
- 全部走 `wx.setStorageSync`，纯本地存储，不上传服务器
- 收藏、游玩次数、最近游玩时间、扫雷纪录均本地保存

---

## 🧪 逻辑自测

```bash
node tools/smoke-test.js
```

覆盖数据完整性、字段校验、收藏切换、游玩统计、分类筛选、关键词搜索、4 种排序、
WXML 标签配平，共 56 项断言。

---

## ➕ 新增一款游戏的移植流程

1. 在 `utils/games-data.js` 的 `GAMES_DATA` 中追加元数据，`playable: false`
2. 在 `pages/games/` 下新建目录，编写四件套（`.js` / `.json` / `.wxml` / `.wxss`）
3. 在 `app.json` 的 `pages` 数组中注册路由
4. 把元数据的 `playable` 改为 `true`，并填写 `route`
5. 在 `project.config.json` 的 `packOptions.ignore` 中移除该Web 源码目录的排除项

---

## 🔗 与 Web 版的关系

Web 版大厅（`index.html` + `css/hall.css` + `js/hall.js`）**保持原样可用**，
仍可通过双击 `index.html` 或 `launch_hall.bat` 启动，两套共享同一批游戏源码，互不干扰。