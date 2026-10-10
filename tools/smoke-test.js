/**
 * 冒烟测试：用 Node 模拟 wx API，验证大厅核心逻辑
 * 运行：node tools/smoke-test.js
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
assert(playable.length === 1, `已开放 1 款（实际 ${playable.length}）`);
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
function checkWxml(file) {
  const src = fs.readFileSync(file, 'utf8');
  const opens = (src.match(/<view/g) || []).length;
  const closes = (src.match(/<\/view>/g) || []).length;
  assert(opens === closes, `${path.basename(path.dirname(file))}/${path.basename(file)} view 标签配平 (${opens}开/${closes}闭)`);
}
checkWxml('pages/index/index.wxml');
checkWxml('pages/about/index.wxml');
checkWxml('pages/games/minesweeper/index.wxml');

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========\n`);
process.exit(fail > 0 ? 1 : 0);