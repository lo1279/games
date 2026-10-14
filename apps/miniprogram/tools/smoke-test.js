/**
 * 冒烟测试：用 Node 模拟 wx API，验证大厅核心逻辑
 * 运行：node miniprogram/tools/smoke-test.js
 * 说明：仅覆盖纯逻辑（筛选/排序/收藏/统计），不涉及视图层
 */
const fs = require('fs');
const path = require('path');

// ===== 模拟小程序存储 =====
const store = {};
global.wx = {
  getStorageSync: (k) => (store[k] === undefined ? '' : store[k]),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  showToast: () => {},
  navigateTo: () => {},
  vibrateShort: () => {},
  getWindowInfo: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 20, safeArea: { bottom: 812 } }),
  getSystemInfoSync: () => ({ windowWidth: 375, screenHeight: 812, statusBarHeight: 20, safeArea: { bottom: 812 } })
};

const { GAMES_DATA, CATEGORIES, StorageManager } = require('../utils/games-data.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}

console.log('\n=== 1. 数据完整性 ===');
assert(GAMES_DATA.length === 10, `游戏总数为 10（实际 ${GAMES_DATA.length}）`);
assert(CATEGORIES.some(c => c.id === 'fav'), '分类包含「我的收藏」');
const playable = GAMES_DATA.filter(g => g.playable);
assert(playable.length === 3, `已开放 3 款（实际 ${playable.length}）`);
playable.forEach(g => {
  assert(!!g.route && g.route.startsWith('/'), `可玩游戏「${g.title}」有合法 route`);
});

console.log('\n=== 2. 必填字段完整性 ===');
const required = ['id', 'title', 'englishTitle', 'category', 'categoryLabel', 'icon', 'accentColor', 'summary', 'controls', 'features'];
const ids = new Set();
GAMES_DATA.forEach(g => {
  const missing = required.filter(f => g[f] === undefined || g[f] === null || g[f] === '');
  assert(missing.length === 0, `「${g.title}」字段完整${missing.length ? '，缺失: ' + missing : ''}`);
  assert(!ids.has(g.id), `id「${g.id}」唯一`);
  ids.add(g.id);
  assert(Array.isArray(g.features) && g.features.length > 0, `「${g.title}」有特色列表`);
});

console.log('\n=== 3. 存储管理器 ===');
StorageManager.setFavorites([]);
assert(StorageManager.getFavorites().length === 0, '初始收藏为空');
assert(StorageManager.toggleFavorite('tetris') === true, '收藏 tetris 返回 true');
assert(StorageManager.isFavorite('tetris') === true, 'tetris 处于已收藏');
assert(StorageManager.toggleFavorite('tetris') === false, '再次切换取消收藏');
assert(StorageManager.isFavorite('tetris') === false, 'tetris 已取消收藏');

console.log('\n=== 4. 游玩统计 ===');
StorageManager.recordPlay('minesweeper');
StorageManager.recordPlay('minesweeper');
StorageManager.recordPlay('tetris');
assert(StorageManager.getTotalPlays() === 3, '累计游玩 3 次');
const stats = StorageManager.getStats();
assert(stats.minesweeper.plays === 2, '扫雷记录 2 次');
assert(stats.tetris.plays === 1, '方块记录 1 次');
assert(stats.tetris.lastPlayed > 0, '方块有 lastPlayed 时间戳');

console.log('\n=== 5. 分类与搜索（复刻页面内筛选逻辑）===');
function filter({ cat = 'all', kw = '', sort = 'default' } = {}) {
  let list = GAMES_DATA.slice();
  if (cat === 'fav') {
    const f = StorageManager.getFavorites();
    list = list.filter(g => f.indexOf(g.id) !== -1);
  } else if (cat !== 'all') {
    list = list.filter(g => g.category === cat);
  }
  if (kw) {
    const k = kw.trim().toLowerCase();
    list = list.filter(g => [g.title, g.englishTitle].concat(g.tags).join(' ').toLowerCase().indexOf(k) !== -1);
  }
  if (sort === 'popular') list.sort((a, b) => ((stats[b.id] || {}).plays || 0) - ((stats[a.id] || {}).plays || 0));
  else if (sort === 'recent') list.sort((a, b) => ((stats[b.id] || {}).lastPlayed || 0) - ((stats[a.id] || {}).lastPlayed || 0));
  else if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  return list;
}

assert(filter().length === 10, '「全部」返回 10 款');
assert(filter({ cat: 'strategy' }).length === 4, `「策略卡牌」4 款（实际 ${filter({ cat: 'strategy' }).length}）`);
assert(filter({ cat: 'arcade' }).length === 2, `「街机复古」2 款（实际 ${filter({ cat: 'arcade' }).length}）`);
assert(filter({ kw: '扫雷' }).length === 1, '中文搜索「扫雷」命中 1 款');
assert(filter({ kw: 'tetris' }).length === 1, '英文搜索 tetris 命中 1 款');
assert(filter({ kw: '不存在的游戏xyz' }).length === 0, '无匹配时返回 0 款');

const popular = filter({ sort: 'popular' });
assert(popular[0].id === 'minesweeper', '游玩最多排序，扫雷排第一');
const titleSort = filter({ sort: 'title' });
assert(titleSort.length === 10 && titleSort[0].title.length > 0, '名称排序返回完整结果');

console.log('\n=== 6. 收藏筛选 ===');
StorageManager.setFavorites(['tetris', 'super-mario']);
const favList = filter({ cat: 'fav' });
assert(favList.length === 2, '收藏筛选返回 2 款');
StorageManager.setFavorites([]);
assert(filter({ cat: 'fav' }).length === 0, '清空收藏后筛选为空');

console.log('\n=== 7. WXML 语法粗检（标签配平）===');
// WXML 路径基于小程序工程根解析，而非进程 cwd，
// 这样从仓库根或miniprogram/ 内执行都能正常工作
const MP_ROOT = path.resolve(__dirname, '..');
function checkWxml(file) {
  const abs = path.resolve(MP_ROOT, file);
  if (!fs.existsSync(abs)) {
    assert(false, `${file} 不存在（找不到 ${abs}）`);
    return;
  }
  const src = fs.readFileSync(abs, 'utf8');
  const opens = (src.match(/<view/g) || []).length;
  const closes = (src.match(/<\/view>/g) || []).length;
  assert(opens === closes, `${path.basename(path.dirname(file))}/${path.basename(file)} view 标签配平 (${opens}开/${closes}闭)`);
}
checkWxml('pages/index/index.wxml');
checkWxml('pages/about/index.wxml');
checkWxml('pages/games/minesweeper/index.wxml');
checkWxml('pages/games/tetris/index.wxml');

// 读取扫雷页三件套源码，供后续各组断言使用
const MS_DIR = 'pages/games/minesweeper/';
const msWxml = fs.readFileSync(path.resolve(MP_ROOT, MS_DIR + 'index.wxml'), 'utf8');
const msWxss = fs.readFileSync(path.resolve(MP_ROOT, MS_DIR + 'index.wxss'), 'utf8');
const msJs = fs.readFileSync(path.resolve(MP_ROOT, MS_DIR + 'index.js'), 'utf8');

// 去掉注释后再匹配，避免注释里的关键字造成误判
const stripComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
const msWxmlCode = stripComment(msWxml);
const msWxssCode = stripComment(msWxss);

console.log('\n=== 7b. 俄罗斯方块页渲染方案（Canvas）===');
const TET_DIR = 'pages/games/tetris/';
const tetWxml = fs.readFileSync(path.resolve(MP_ROOT, TET_DIR + 'index.wxml'), 'utf8');
const tetWxmlCode = stripComment(tetWxml);
assert(/<canvas[\s\S]*?type="2d"/.test(tetWxmlCode), '使用 canvas type="2d"');
assert(/bindtouchstart="onTouchStart"/.test(tetWxmlCode), '棋盘 canvas 绑定 touchstart');
assert(/bindtouchmove="onTouchMove"/.test(tetWxmlCode), '棋盘 canvas 绑定 touchmove');
assert(/bindtouchend="onTouchEnd"/.test(tetWxmlCode), '棋盘 canvas 绑定 touchend');
assert(/id="boardCanvas"/.test(tetWxmlCode), '主棋盘 canvas id=boardCanvas');
assert(/id="nextCanvas"/.test(tetWxmlCode), '下一个预览 canvas 存在');
assert(/id="holdCanvas"/.test(tetWxmlCode), '暂存预览 canvas 存在');
// 事件绑定完整性：WXML 中声明的事件必须有对应处理函数
const tetEvs = [...new Set([...tetWxmlCode.matchAll(/bind(?:tap|touchstart|touchmove|touchend|touchcancel)="(\w+)"/g)].map((m) => m[1]))];
const tetJs = fs.readFileSync(path.resolve(MP_ROOT, TET_DIR + 'index.js'), 'utf8');
const tetMissing = tetEvs.filter((e) => !new RegExp('(^|\\s|\\.)' + e + '\\s*\\(').test(tetJs));
assert(tetMissing.length === 0, `俄罗斯方块事件均有处理函数${tetMissing.length ? '，缺失: ' + tetMissing.join(', ') : ''}`);

console.log('\n=== 7c. 坦克大战页渲染方案（Canvas）===');
checkWxml('pages/games/tank-battle/index.wxml');
const TANK_DIR = 'pages/games/tank-battle/';
const tankWxml = fs.readFileSync(path.resolve(MP_ROOT, TANK_DIR + 'index.wxml'), 'utf8');
const tankWxmlCode = stripComment(tankWxml);
assert(/<canvas[\s\S]*?type="2d"/.test(tankWxmlCode), '使用 canvas type="2d"');
assert(/id="boardCanvas"/.test(tankWxmlCode), '主战场 canvas id=boardCanvas');
assert(/data-dir="up"/.test(tankWxmlCode), '方向盘含 上');
assert(/data-dir="down"/.test(tankWxmlCode), '方向盘含 下');
assert(/data-dir="left"/.test(tankWxmlCode), '方向盘含 左');
assert(/data-dir="right"/.test(tankWxmlCode), '方向盘含 右');
const tankEvs = [...new Set([...tankWxmlCode.matchAll(/bind(?:tap|touchstart|touchmove|touchend|touchcancel)="(\w+)"/g)].map((m) => m[1]))];
const tankJs = fs.readFileSync(path.resolve(MP_ROOT, TANK_DIR + 'index.js'), 'utf8');
const tankMissing = tankEvs.filter((e) => !new RegExp('(^|\\s|\\.)' + e + '\\s*\\(').test(tankJs));
assert(tankMissing.length === 0, `坦克大战事件均有处理函数${tankMissing.length ? '，缺失: ' + tankMissing.join(', ') : ''}`);
assert(/setInterval\(\(\) => this\.tick\(\)/.test(tankJs), '使用 setInterval 驱动实时 tick 循环');
assert(/this\.game\.setMoveDir\(dir\)/.test(tankJs), 'tick 中将按住方向注入逻辑层');

/**
 * 第 8 组：扫雷页渲染方案（Canvas 化）
 *
 * 背景：扫雷页原用 scroll-view + WXML 格子实现，连续三轮出现布局失效
 * （顶穿出屏 / 双向滚动不生效 / 末行被裁切），根因是 scroll-view 在
 * flex 容器中的高度计算与滚动行为在小程序里不可控，且难以静态验证。
 * 现改为 canvas 一次性绘制 + 自实现 touch 拖动，彻底移除 scroll-view。
 */
console.log('\n=== 8. 扫雷页渲染方案（Canvas）===');
assert(!/<scroll-view/.test(msWxmlCode), 'WXML 已移除 scroll-view');
assert(!/bindlongpress/.test(msWxmlCode), 'WXML 已移除 bindlongpress（长按改由 touch 计时实现）');
assert(/<canvas[\s\S]*?type="2d"/.test(msWxmlCode), '使用 canvas type="2d"');
assert(/bindtouchstart="onTouchStart"/.test(msWxmlCode), 'canvas 绑定 touchstart');
assert(/bindtouchmove="onTouchMove"/.test(msWxmlCode), 'canvas 绑定 touchmove（拖动）');
assert(/bindtouchend="onTouchEnd"/.test(msWxmlCode), 'canvas 绑定 touchend');
// 旧方案的痕迹必须清除干净
assert(!/\bsyncGrid\b/.test(msJs), 'JS 已移除 syncGrid（改用 drawBoard）');
assert(!/needScrollX|needScrollY/.test(msJs), 'JS 已移除双向滚动标记');
assert(!/scrollResetToken/.test(msJs), 'JS 已移除 scrollResetToken');
assert(!/\.cell\b/.test(msWxssCode), 'WXSS 已移除 .cell 样式（改由 canvas 绘制）');
assert(!/\.board-grid/.test(msWxssCode), 'WXSS 已移除 .board-grid');
assert(!/\.scroll-hint/.test(msWxssCode), 'WXSS 已移除 .scroll-hint');

/**
 * 第 9 组：npm 依赖降级防护
 */
console.log('\n=== 9. npm 依赖降级防护 ===');
const cloudSrc = fs.readFileSync(path.resolve(MP_ROOT, 'utils/cloud.js'), 'utf8');
const cloudCode = stripComment(cloudSrc);
assert(/try\s*\{[\s\S]*require\(['"]@tencent-ai\/workbuddy-cloud-sdk/.test(cloudCode),
  'SDK 被包在 try 块内加载（顶层裸 require 会导致白屏）');
assert(/isCloudAvailable/.test(cloudCode), 'cloud.js 导出 isCloudAvailable 供页面判空');
const cloudCallSites = (msJs.match(/cloud\.database/g) || []).length;
const guardCount = (msJs.match(/if\s*\(!isCloudAvailable\)/g) || []).length;
assert(cloudCallSites === 0 || guardCount >= cloudCallSites,
  `扫雷页 ${cloudCallSites} 处云调用均有判空保护（检测到 ${guardCount} 处）`);
let degraded = null;
try {
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (req) {
    if (req.includes('workbuddy-cloud-sdk')) throw new Error('module is not defined');
    return origLoad.apply(this, arguments);
  };
  global.wx = global.wx || {};
  const r = require(path.resolve(MP_ROOT, 'utils/cloud.js'));
  degraded = { cloud: r.cloud, available: r.isCloudAvailable, hasConfig: !!r.PUBLIC_CONFIG };
  Module._load = origLoad;
} catch (e) {
  degraded = { error: e.message };
}
assert(degraded && !degraded.error, `未构建 npm 时 cloud.js 不抛错（${degraded && degraded.error ? degraded.error : '正常返回'}）`);
assert(degraded && degraded.cloud === null, '未构建 npm 时 cloud 为 null');
assert(degraded && degraded.hasConfig === true, '降级时仍保留 PUBLIC_CONFIG');

/**
 * 第 10 组：扫雷功能与 Web 版对齐（防功能回退）
 */
console.log('\n=== 10. 扫雷功能与 Web 版对齐（防回退）===');
assert(/theme:\s*'modern'/.test(msJs), '支持现代主题（默认）');
assert(/classic/.test(msJs), '支持经典主题');
assert(/loadTheme\(\)/.test(msJs), '启动时读取已保存的主题');
assert(/toggleTheme\(\)/.test(msJs), '提供主题切换方法');
assert(/wx\.setStorageSync\(THEME_KEY/.test(msJs), '主题选择持久化到本地');
assert(/container theme-\{\{theme\}\}/.test(msWxmlCode), 'WXML 根节点绑定主题 class');
assert(/bindtap="toggleTheme"/.test(msWxmlCode), '工具栏有主题切换按钮');
assert(/NUM_COLORS/.test(msJs), 'canvas 绘制含 8 档数字配色');
assert(/item\.adjacentMines - 1/.test(msJs), '数字颜色按相邻雷数索引');

/**
 * 第 11 组：Canvas 拖动查看其他区域
 *
 * 背景：用户诉求「做成上下左右移动显示其他区域格子」。
 * 高级难度 30 行超出可视高度，需要能拖动查看下方内容。
 */
console.log('\n=== 11. Canvas 拖动查看其他区域 ===');
assert(/offsetRow/.test(msJs), '维护拖动偏移 offsetRow');
assert(/maxOffsetRow/.test(msJs), '计算最大偏移 maxOffsetRow');
assert(/Math\.min\(this\.data\.maxOffsetRow/.test(msJs), '偏移被上限约束（末行一定可达）');
assert(/Math\.max\(0, Math\.min/.test(msJs), '偏移被下限约束（不会越界）');
assert(/touchMoved/.test(msJs), '区分点击与拖动（移动阈值判定）');
assert(/cell \/ 2/.test(msJs), '拖动阈值 = 半个格子');
assert(/longPressTimer/.test(msJs), '实现长按插旗（setTimeout 300ms）');
assert(/clearTimeout\(this\.longPressTimer\)/.test(msJs), '拖动时取消长按计时');
assert(/clearTimeout\(this\.longPressTimer\)[\s\S]*?if\s*\(this\.touchMoved \|\| this\.longPressFired\)/.test(msJs),
  'touchend 区分拖动/长按/点击三种情形');
// 触摸坐标必须用相对 canvas 的 x/y，不能用 clientX 混算
assert(/const x = t\.x/.test(msJs) && /const y = t\.y/.test(msJs), '点击坐标使用相对 canvas 的 x/y');

/**
 * 第 13 组：Canvas 绘制正确性
 */
console.log('\n=== 12. Canvas 绘制正确性 ===');
assert(/setupCanvas\(\)/.test(msJs), '提供 setupCanvas 初始化');
assert(/onReady\(\)/.test(msJs), '在 onReady 初始化（canvas 节点需布局完成后才可取）');
assert(/pixelRatio/.test(msJs), '按 devicePixelRatio 放大保证清晰度');
assert(/ctx\.scale\(dpr, dpr\)/.test(msJs), 'ctx 按 dpr 缩放');
assert(/ctx\.clearRect/.test(msJs), '每帧先 clearRect 重绘');
assert(/offset \+ visibleRows|offsetRow \+ visibleRows/.test(msJs), '按偏移裁剪绘制行范围');
assert(/endRow/.test(msJs), '结束行受总行数限制');
assert(/boardBottom/.test(msJs), '棋盘底部绘制边界线（明确告知是否还有格子）');
assert(/calcCellSize/.test(msJs), '按列数计算格子尺寸');
assert(/MIN_CELL = (\d+)/.test(msJs), '定义了最小可点格子尺寸');

/**
 * 第 14 组：移动端双按钮模式栏（与 PC 网页版一致）
 *
 * 完全同步 PC 网页版（web-hall/minesweeper）：底部 .mobile-mode-bar
 * 提供「挖掘模式 / 插旗模式」两个按钮，点击直接设定模式；
 * 同时保留长按格子快捷插旗（PC 网页版同样支持长按 350ms 插旗）。
 */
console.log('\n=== 13. 移动端双按钮模式栏（与 PC 一致）===');
assert(/class="mobile-mode-bar"/.test(msWxmlCode), '存在 .mobile-mode-bar（PC 移动端模式栏）');
const modeBtnCount = (msWxmlCode.match(/mobile-mode-btn/g) || []).length;
assert(modeBtnCount === 2, `模式栏含 2 个按钮（挖掘/插旗，实际 ${modeBtnCount} 个）`);
assert(/data-mode="REVEAL"/.test(msWxmlCode), '存在「挖掘模式」按钮 data-mode="REVEAL"');
assert(/data-mode="FLAG"/.test(msWxmlCode), '存在「插旗模式」按钮 data-mode="FLAG"');
assert(/bindtap="setTouchMode"/.test(msWxmlCode), '两个按钮均绑定 setTouchMode');
// setTouchMode 从 data-mode 读取并设定模式
assert(/setTouchMode\(e\)\s*\{/.test(msJs), 'setTouchMode 接收 event 参数');
assert(/currentTarget\.dataset\.mode/.test(msJs), 'setTouchMode 读取 data-mode');
assert(/mode !== 'REVEAL' && mode !== 'FLAG'/.test(msJs), 'setTouchMode 校验合法模式值');
// 激活态：当前模式按钮高亮（class active）
assert(/touchMode === 'REVEAL' \? 'active'/.test(msWxmlCode), '挖掘模式按钮随状态高亮');
assert(/touchMode === 'FLAG' \? 'active'/.test(msWxmlCode), '插旗模式按钮随状态高亮');
assert(/mobile-mode-btn\.active\.reveal-mode/.test(msWxssCode), '挖掘激活态样式（蓝）');
assert(/mobile-mode-btn\.active\.flag-mode/.test(msWxssCode), '插旗激活态样式（红）');
// 长按插旗仍保留
assert(/longPressTimer/.test(msJs), '保留长按快捷插旗');
// 旧单按钮死代码必须清除
assert(!/switchTouchMode/.test(msJs), '已移除 switchTouchMode（改回 PC 双按钮）');
assert(!/onCellTap\(/.test(msJs), '已删除 onCellTap（canvas 方案下为死代码）');
assert(!/onCellLongPress\(/.test(msJs), '已删除 onCellLongPress（同上）');

/**
 * 第 14 组：canvas 尺寸循环依赖防护（曾导致格子完全不可见）
 *
 * 根因：WXML 内联 `style="width:{{canvasW}}px"`，而 canvasW 又来自读取
 * canvas 自身尺寸 —— 循环依赖。canvasW 初值 0 → canvas 恒为 0×0 → 格子全不可见。
 *
 * 正确做法：canvas 尺寸交给 CSS（100% 撑满父容器），
 * JS 只测量 **父容器 .board-area** 得到可视区尺寸。
 */
console.log('\n=== 14. canvas 尺寸循环依赖防护 ===');
assert(!/style="width:\s*\{\{canvasW\}\}/.test(msWxmlCode), 'canvas 未内联 canvasW 尺寸（避免循环依赖）');
assert(!/style="height:\s*\{\{canvasH\}\}/.test(msWxmlCode), 'canvas 未内联 canvasH 尺寸');
assert(/\.board-canvas\s*\{[^}]*width:\s*100%/.test(msWxssCode), '.board-canvas 用 CSS width:100% 撑满父容器');
assert(/\.board-canvas\s*\{[^}]*height:\s*100%/.test(msWxssCode), '.board-canvas 用 CSS height:100%');
// 尺寸必须来自父容器测量
assert(/select\('\.board-container'\)/.test(msJs), 'JS 测量父容器 .board-container 得到可视区尺寸');
assert(/boundingClientRect/.test(msJs), '通过 boundingClientRect 获取可视区尺寸');
assert(/initCanvasSurface/.test(msJs), '提供 initCanvasSurface 按可视区初始化画布');
assert(/canvas\.width = areaW \* dpr/.test(msJs), '画布位图宽 = 可视宽 × dpr');
assert(/canvas\.height = areaH \* dpr/.test(msJs), '画布位图高 = 可视高 × dpr');
// 画布尺寸必须有兜底值，避免为 0
assert(/areaW = Math\.floor\(area\.width\) \|\| 320/.test(msJs), '可视宽有兜底值（不会为 0）');
assert(/areaH = Math\.floor\(area\.height\) \|\| 320/.test(msJs), '可视高有兜底值（不会为 0）');

/**
 * 第 13 组：布局防顶穿（模式栏必须可见）
 */
console.log('\n=== 15. 布局防顶穿（模式栏必须可见）===');
assert(/\.container\s*\{[^}]*height:\s*100vh/.test(msWxssCode), '.container 使用 100vh 确定高度');
assert(/\.board-container\s*\{[^}]*flex:\s*1/.test(msWxssCode), '.board-container 使用 flex:1');
assert(/\.board-container\s*\{[^}]*height:\s*0/.test(msWxssCode), '.board-container 使用 height:0');
assert(/\.board-container\s*\{[^}]*min-height:\s*0/.test(msWxssCode), '.board-container 使用 min-height:0');
assert(/\.board-container\s*\{[^}]*overflow:\s*hidden/.test(msWxssCode), '.board-container 溢出隐藏（canvas 固定尺寸）');
['toolbar', 'hud-panel', 'mobile-mode-bar', 'footer-tips'].forEach((cls) => {
  // 注意：正则不能跨行匹配，故先抽出该类的样式块再判断 flex-shrink
  const m = msWxssCode.match(new RegExp('\\.' + cls + '\\s*\\{([^}]*)\\}'));
  const has = !!m && /flex-shrink:\s*0/.test(m[1]);
  assert(has, `.${cls} 设置 flex-shrink:0（不被顶出屏幕）`);
});

/**
 * 第 16 组：事件绑定完整性
 */
console.log('\n=== 16. 事件绑定完整性 ===');
const evs = [...new Set([...msWxmlCode.matchAll(/bind(?:tap|longpress|input|change|confirm|touchstart|touchmove|touchend|touchcancel)="(\w+)"/g)].map((m) => m[1]))];
const missingEv = evs.filter((e) => !new RegExp('(^|\\s)' + e + '\\s*\\(').test(msJs));
assert(evs.length > 0, `共解析到 ${evs.length} 个事件绑定`);
assert(missingEv.length === 0, `全部事件均有对应处理函数${missingEv.length ? '，缺失: ' + missingEv.join(', ') : ''}`);

/**
 * 第 17 组：PC 分段布局与屏幕适配（完全同步 web-hall/minesweeper）
 *
 * 布局自上而下五段，与 PC 网页版一致：
 *   工具栏 → HUD 仪表盘 → 棋盘 → 移动端模式栏 → 底部说明
 * 棋盘用 flex:1 吃掉剩余空间；LED 数码管 + 笑脸还原 PC 观感。
 */
console.log('\n=== 17. PC 分段布局与屏幕适配 ===');
['toolbar', 'hud-panel', 'board-container', 'mobile-mode-bar', 'footer-tips'].forEach((sec) => {
  assert(msWxmlCode.indexOf(`class="${sec}"`) !== -1 || msWxmlCode.indexOf(` ${sec}"`) !== -1,
    `存在分区 .${sec}`);
});
// 顺序必须是 工具栏 → HUD → 棋盘 → 模式栏 → 底部说明
const idx = (c) => msWxmlCode.indexOf(`class="${c}"`);
assert(idx('toolbar') < idx('hud-panel'), '顺序：工具栏在 HUD 之上');
assert(idx('hud-panel') < idx('board-container'), '顺序：HUD 在棋盘之上');
assert(idx('board-container') < idx('mobile-mode-bar'), '顺序：棋盘在模式栏之上');
assert(idx('mobile-mode-bar') < idx('footer-tips'), '顺序：模式栏在底部说明之上');
// HUD 含 LED 数码管与笑脸（还原 PC 仪表盘）
assert(/led-display/.test(msWxmlCode), 'HUD 含 LED 数码管 .led-display');
assert(/smiley-btn/.test(msWxmlCode), 'HUD 含笑脸重置按钮 .smiley-btn');
assert(/\.led-display\s*\{[^}]*color:\s*#ef4444/.test(msWxssCode), '现代主题 LED 为红色');
assert(/\.theme-classic \.led-display\s*\{[^}]*color:\s*#ff0000/.test(msWxssCode), '经典主题 LED 为红色');
// 棋盘水平居中绘制
assert(/originX = Math\.max\(0, Math\.floor\(\(viewW - boardW\) \/ 2\)\)/.test(msJs),
  '棋盘水平居中绘制');
// 格子尺寸按屏宽适配
assert(/byWidth = Math\.floor\(\(viewW - FRAME\) \/ cols\)/.test(msJs),
  '格子尺寸按可视区宽度均分');
assert(/IDEAL_CELL = 42/.test(msJs), '格子视觉上限 42px');
assert(/FRAME = 8/.test(msJs), '棋盘外框占位已计入尺寸计算');

/**
 * 第 18 组：入口去重（同一功能只保留一处入口）
 *
 * 背景：曾出现「纪录」在顶部与底部各有一个按钮，以及 HUD 难度小字也绑定了
 * showRecordsModal（点难度却打开纪录，语义不符）。此处固化唯一入口约束。
 */
console.log('\n=== 18. 功能入口去重 ===');
const countEvent = (name) => (msWxmlCode.match(new RegExp('bind(?:tap|change)="' + name + '"', 'g')) || []).length;
assert(countEvent('showRecordsModal') === 1,
  `「纪录」入口唯一（实际 ${countEvent('showRecordsModal')} 处）`);
assert(countEvent('resetGame') === 1,
  `「重开」入口唯一（PC 仅笑脸按钮，实际 ${countEvent('resetGame')} 处）`);
assert(countEvent('setTouchMode') === 2,
  `两个模式按钮均绑定 setTouchMode（实际 ${countEvent('setTouchMode')} 处）`);
assert(countEvent('onDifficultyChange') === 1,
  `「难度切换」入口唯一（实际 ${countEvent('onDifficultyChange')} 处）`);
// 「纪录」入口唯一由 showRecordsModal===1 保证；此处仅确认图标存在
const trophyCount = (msWxmlCode.match(/🏆/g) || []).length;
assert(trophyCount >= 1, `「🏆」图标存在（工具栏按钮 + 弹窗标题，共 ${trophyCount} 处）`);

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========\n`);
process.exit(fail > 0 ? 1 : 0);