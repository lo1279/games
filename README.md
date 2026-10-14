# 🎮 星云电竞·综合游戏大厅 (Game Hub Arcade)

一个聚合 **10 款前端小游戏** 的本地 / 云端游戏大厅，采用暗黑赛博 + 玻璃拟态（Glassmorphism）电竞设计，开箱即玩。

> **产品命名说明**
> - 网页大厅与云端发布版统称为「综合游戏大厅」；窗口标题为「星云电竞·综合游戏大厅」。
> - 云端应用名：`综合游戏大厅`；分享链接见文末「云端应用」。

---

## 🌟 大厅核心特性

1. **集中聚合与沉浸游玩**
   - **剧场模式 (Arcade Theater)**：在大厅内全屏沉浸畅玩，支持全屏切换、即时重新开始、操作指南快捷查看、Esc 一键返回大厅；
   - **独立标签页模式 (New Tab)**：一键在独立浏览器标签页运行任意游戏。
2. **分类与即时检索**
   - 支持按 **全部 / 休闲益智 / 策略卡牌 / 动作射击 / 街机复古 / 我的收藏** 筛选；
   - 实时模糊搜索（中英文游戏名、玩法标签、核心特色）；
   - 按推荐、游玩热度、最近游玩、名称排序。
3. **本地状态持久化 (LocalStorage)**
   - 自动记录每款游戏的游玩次数与上次游玩时间；
   - 一键收藏（爱心）并在专属收藏标签页展示。
4. **0 依赖一键启动 + 智能防端口冲突**
   - `launch_hall.bat` 无需安装 Node.js / Python；
   - **自动端口探测 (Auto Port Hunting)**：从 `8080` 起，遇占用自动顺延至 `8081`~`8099`；
   - 亦支持双击 `index.html` 离线运行（详见「本地运行」）。

---

## 🕹️ 收录游戏清单

| 游戏名称 | 类型 | 目录 | 技术形态 | 核心特色 |
| :--- | :--- | :--- | :--- | :--- |
| **🎲 3D 骰王争霸** | 休闲益智 / 3D 物理 | `dice-game/` | 纯静态 | Three.js 物理投掷，骰宝/大话骰/快艇/随心掷骰四合一 |
| **💣 经典扫雷** | 休闲益智 / 经典 | `minesweeper/` | 纯静态 | 现代/经典双主题、初/中/高/自定义难度、本地排行榜 |
| **⚡ 万神纪元：诸神对决** | 策略卡牌 / 肉鸽爬塔 | `mythology-deckbuilder/` | Vite + React 19 | 多神话阵营、牌组构建、遗物神器、回合制对战 |
| **🛡️ 经典坦克大战** | 动作射击 / FC 怀旧 | `tank-battle/` | 纯静态 | 红白机手感、守护老鹰基地、重炮升级、CRT 扫描线滤镜 |
| **🕹️ 霓虹俄罗斯方块** | 街机复古 / 消除 | `tetris/` | 纯静态 | 赛博霓虹、Hold 暂存、幽灵方块、连击消行倍率 |
| **🏯 三国志·鼎立战略版** | 策略卡牌 / 战役 | `three-kingdoms-slg/` | 纯静态 | 历史战役演义、演武试炼、战法体系与兵种克制（115 张素材） |
| **🛡️ 三国志·群英塔防** | 策略塔防 | `three-kingdoms-td/` | Vite + React 19 | 蜀魏吴武将布防、大招技能、兵种相克 |
| **🚀 雷霆战机** | 动作射击 / 弹幕 | `thunder-fighter/` | 纯静态 | 弹幕射击、僚机副武器、暴走过载、巨型 BOSS |
| **✨ 人生模拟器 · 轮回录** | 模拟养成 / 肉鸽 | `life-simulator/` | Vite + React | 功德神殿局外升级、商海创业、婚育传承、D20 奇遇检定 |
| **🍄 超级马里奥兄弟** | 街机复古 / 平台跳跃 | `super-mario/` | 纯静态 | 复刻 FC World 1-1~1-4 四关完整挑战 |

> **技术形态区分**
> - **纯静态（7 款）**：直接打开 `index.html` 即玩，无依赖、无构建。
> - **Vite 工程（3 款）**：`mythology-deckbuilder` / `three-kingdoms-td` / `life-simulator`，需 `npm install` + `npm run build` 生成 `dist/` 后方可运行/发布。

---

## 🗂️ 项目结构全景（三端产物）

本仓库同一份代码，面向三种交付形态，目录各司其职、互不干扰：

| 形态 | 目录 | 用途 |
| :--- | :--- | :--- |
| ① 网页大厅（源码） | `apps/web-hall/` | 大厅源码（`index.html` / `css/` / `js/`），你日常改代码的地方 |
| ② 网页发布版（构建产物） | `dist/` | 由 `tools/build.sh` 生成，云端发布的真正产物（gitignore） |
| ③ 微信小程序 | `apps/miniprogram/` | 独立小程序工程，走小程序面板发布 |

```
d:\ai项目\games\
├── apps/                          # 应用层（可独立开发 / 发布）
│   ├── web-hall/                  # 🌐 网页大厅【源码】
│   │   ├── index.html             # 大厅主入口（窗口标题：星云电竞·综合游戏大厅）
│   │   ├── css/hall.css           # 大厅核心样式（暗黑赛博/玻璃拟态/响应式栅格）
│   │   ├── js/
│   │   │   ├── hall.js            # 大厅逻辑（GAMES_DATA 游戏注册 / 剧场模式 / 持久化）
│   │   │   ├── mobile-controls.js # 移动端虚拟按键（游戏共用的 _shared 资源见下）
│   │   │   └── server.ps1         # PowerShell 本地服务器（自动端口探测 8080~8099）
│   │   └── launch_hall.bat        # 一键启动器
│   └── miniprogram/               # 📱 微信小程序工程（独立开发与上传发布）
│       ├── app.js / app.json / app.wxss
│       ├── pages/games/           # 已收口：扫雷 / 坦克 / 俄罗斯方块
│       └── utils/
├── subgames/                      # 🎮 子游戏库（游戏组件）
│   ├── _shared/                   # 游戏共用资源（单一来源，零重复）
│   │   ├── css/mobile-game.css
│   │   └── js/mobile-controls.js
│   ├── dice-game/                 # 🎲 3D 骰王争霸（纯静态）
│   ├── minesweeper/               # 💣 经典扫雷（纯静态）
│   ├── tank-battle/               # 🛡️ 坦克大战（纯静态）
│   ├── tetris/                    # 🕹️ 霓虹俄罗斯方块（纯静态）
│   ├── thunder-fighter/           # 🚀 雷霆战机（纯静态）
│   ├── super-mario/               # 🍄 超级马里奥（纯静态）
│   ├── three-kingdoms-slg/        # 🏯 三国鼎立战略版（纯静态）
│   ├── mythology-deckbuilder/     # ⚡ 万神纪元·诸神对决（Vite + React 19）
│   ├── three-kingdoms-td/         # 🛡️ 三国群英塔防（Vite + React 19）
│   └── life-simulator/            # ✨ 人生模拟器·轮回录（Vite + React）
├── dist/                          # 🚀 网页发布版（tools/build.sh 生成，gitignore）
├── tools/
│   ├── build.sh                   # 把 apps/web-hall + subgames 构建为 dist/ 发布目录
│   └── smoke-test.js              # 发布前冒烟测试
├── package.json                   # 根脚本聚合（build / serve / test）
├── .gitignore
├── README.md                      # 本文件
└── apps/miniprogram/README_MINIPROGRAM.md
```

> Vite 三游戏的 `dist/` 已 **gitignore**（标准做法：构建产物不入库，发布前本地 `npm run build` 重生，见「开发规范」）。

---

## 🚀 本地运行

### 方式 1：一键启动（推荐）
双击 **`apps/web-hall/launch_hall.bat`** → 启动 `apps/web-hall/js/server.ps1` 本地服务器 → 自动呼出浏览器进入大厅（自动端口探测 8080~8099）。

### 方式 2：双击 `index.html`
- **纯静态游戏**（7 款）：可直接离线运行。
- **Vite 三游戏**：依赖构建产物 `dist/` 与 ES module，**建议先用方式 1 的本地服务器**，或先构建后再打开（见下）。

---

## 🛠️ 本地开发（Vite 三游戏）

三个 Vite 工程各自独立，根目录仅有聚合脚本用的 `package.json`，需分别操作：

```bash
cd subgames/mythology-deckbuilder   # 或 three-kingdoms-td / life-simulator
npm install
npm run dev       # 本地开发预览（Vite dev server）
npm run build     # 产出 dist/（发布前必须执行）
npm run lint      # oxlint 静态检查（life-simulator / mythology-deckbuilder 支持）
```

> ⚠️ **发布前务必先对三个 Vite 游戏执行 `npm run build`**，否则 `dist/` 拷贝到的是空/旧 `dist/`，线上对应游戏会白屏。

---

## ☁️ 发布到云端（网页版）

1. 对 3 个 Vite 游戏执行 `npm run build`，生成各自 `dist/`（位于 `subgames/<name>/dist/`）。
2. 运行构建脚本，生成发布目录 `dist/`：
   ```bash
   bash tools/build.sh
   ```
   脚本行为：
   - 复制大厅源码骨架（`apps/web-hall/` 的 `index.html` / `css/` / `js/`）→ `dist/`；
   - 复制 `subgames/*`（10 款游戏 + `_shared/` 共用资源）；
   - 把 Vite 三游戏的 `subgames/<name>/dist/` 复制为 `dist/<name>/game/`，并改写 `hall.js` / `index.html` 中 `../../subgames/` → 扁平化、`<name>/dist/` → `<name>/game/` 的引用；
   - 复制 7 个纯静态游戏整目录。
3. 对助手说「发布游戏大厅」，选择 **`dist/`** 目录即可生成分享链接。

> **为什么单独用 `dist/` 而非根目录发布？**
> 根目录混有小程序配置（`apps/miniprogram/` 的 `project.config.json` / `app.json` 等），云端发布工具会把整个目录误判为小程序工程，从而拿不到网页分享链接。脚本把网页必需文件（`apps/web-hall/` + `subgames/`）抽到独立的 `dist/`，小程序文件留在 `apps/miniprogram/`，互不干扰。
>
> **Vite 产物为何重命名为 `game/`？**
> 云端发布工具会自动排除名为 `dist` / `build` / `out` 的目录，首次发布时三个 Vite 游戏全部 404。改为 `game/`（相对路径引用）即可正常加载。

---

## 📱 微信小程序版

`miniprogram/` 是独立小程序工程（`pages/` 含扫雷、坦克、俄罗斯方块）。用微信开发者工具打开即可预览；发布走小程序应用面板（预览面板右上角 **Share → 发布小程序**），与网页发布互不影响。

---

## 📦 云端应用

| 项目 | 内容 |
| :--- | :--- |
| 应用名 | 综合游戏大厅 |
| App ID | `wbapp_e4AAf18vVSyi8IVkeuxBLN` |
| 分享链接 | https://sanguo-slg-53583.app.workbuddy.host/ |
| 管理入口 | 设置 → 数据管理 → 发布的应用 |

> 该链接最初发布「三国SLG战棋」单游戏，后改为发布 `web-hall/` 的「综合游戏大厅」；每次发布均为**覆盖式**（同一条链接、同一个 App ID）。

---

## 🧩 开发规范 / 仓库约定

### Monorepo 治理策略（apps / subgames / dist 分层，单一源码）

标准 Monorepo 分层：`apps/`（可独立发布的应用）+ `subgames/`（子游戏库 / 共享包）+ `dist/`（构建产物）+ `tools/`（构建工具）。

| 治理项 | 决策 | 说明 |
| :--- | :--- | :--- |
| ① 网页大厅源码 vs 发布产物 | **`apps/web-hall/` = 源码（受 git 管理）；`dist/` = gitignore 构建产物** | 开发者只维护 `apps/web-hall/` 的 `index.html`/`css/`/`js/`；`dist/` 由 `tools/build.sh` 每次重生成，**勿手动改**。 |
| ② `apps/miniprogram/` 单一小程序源 | **统一收口到 `apps/miniprogram/`；禁止各游戏内再建独立小程序工程** | `apps/miniprogram/` 是唯一小程序源码；已清理 `minesweeper/miniprogram/`、`thunder-fighter/wechat-miniprogram/` 冗余独立工程。 |
| ③ 消除重复维护陷阱 | **源码在库、构建产物不入库** | 开发者只维护源码；网页发布产物 `dist/`、Vite 三游戏 `dist/` 均 gitignore，构建时重生。游戏共用资源抽到 `subgames/_shared/`，单一来源、零重复。 |

- **依赖与生成物不入库**：`node_modules/`、 `dist/`（构建产物）、 Vite 三游戏 `dist/`（构建重生）、`.workbuddy/`、 `.wbapp_*.genie` 均已 gitignore；`git` 仅跟踪源文件与资源。
- **Vite 三游戏的 `dist/` 已 gitignore**（标准 Monorepo 治理：构建产物不入库）。发布网页前**必须**对三个 Vite 游戏执行 `npm run build` 生成 `dist/`，`build.sh` 才会拷贝；若缺失，脚本会跳过并告警，对应游戏线上白屏。
- **`apps/web-hall/` 是网页大厅唯一源**：`dist/` 为生成物，勿手动修改（改源码后重跑 `build.sh`）。
- **小程序单一源**：所有小程序页面/逻辑只存在于 `apps/miniprogram/`（`pages/games/*` + `utils/*`）；**禁止**在 `subgames/<name>/` 内再建 `miniprogram/`、`wechat-miniprogram/` 独立工程。
- **共享资源单一源**：游戏的移动端样式/虚拟按键在 `subgames/_shared/`，各游戏以 `../_shared/...` 引用，勿在各游戏内复制一份。
- **新增游戏**：在 `subgames/<name>/` 放置 `index.html` 与资源；在 `apps/web-hall/js/hall.js` 的 `GAMES_DATA` 数组登记一项（`title` + `path`：`../../subgames/<name>/index.html`，Vite 游戏用 `../../subgames/<name>/dist/index.html`）；若引用共享资源，统一用 `../_shared/`。
- **命名约定**：窗口标题「星云电竞·综合游戏大厅」；云端应用名「综合游戏大厅」。

---

## ⚠️ 已知事项 / 待办

- **命名尚未完全统一**：README / `apps/web-hall/index.html` / `.genie` 三处略有差异（如「星云电竞游戏大厅」「综合游戏大厅」），建议后续统一。
- **`.genie` 本地标记已陈旧**：根目录 `.genie` 的 `localDir` 已过时，云端当前实为由 `dist/` 发布的「综合游戏大厅」。**以云端「发布的应用」面板为准，勿依赖本地 `.genie` 内容。**
- **小程序收口（已清理）**：治理中已删除 `minesweeper/miniprogram/` 与 `thunder-fighter/wechat-miniprogram/`（雷霆战机暂不出小程序版；如后续需要，按 `apps/miniprogram/` 原生移植模板重建）。当前统一小程序 `apps/miniprogram/` 仅含扫雷 / 坦克 / 俄罗斯方块。
- **外部分发规模**：`dist/` 由构建生成，纯静态游戏为主，Vite 三游戏经 `game/` 内联后体积可控。
- **根目录残留空壳 `miniprogram/`**：迁移时因 IDE/文件监视器占用（`Device or resource busy`）未能删除，目录为空、无害（git 不跟踪空目录、不被任何脚本引用）；IDE 释放句柄后可手动删除。
