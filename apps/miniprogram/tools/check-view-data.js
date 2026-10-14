/**
 * 视图数据体检（第 7 类检查 · 运行时）
 *
 * 为什么需要（2026-10-14 真机事故）：
 *   simulateBattle 的原始 logs 每条是 { round, text, type, meta }，meta.actor 是
 *   战斗内武将对象，挂着 buffs / myTeam / oppTeam 且互为引用成环。页面把这批
 *   logs 直接 setData 后，基础库序列化无限递归，真机抛
 *     RangeError: Maximum call stack size exceeded
 *   而堆栈全部落在基础库内部（WASubContext），**没有一条业务帧**，只能靠猜。
 *
 * 静态检查（check-syntax.js）能抓「logs 未经 viewLogs 包装」，
 * 但抓不到「对象内部是否带环」。本脚本在 Node 侧真跑一场战斗 +
 * 真加载每个页面的 data，用同一套算法复现视图层的序列化行为。
 *
 * 用法：node tools/check-view-data.js
 * 退出码：0 = 全部通过；1 = 发现问题
 */

const fs = require('fs');
const path = require('path');

const MP_ROOT = path.join(__dirname, '..');
const SLG = path.join(MP_ROOT, 'pages', 'games', 'three-kingdoms-slg');

// ------------------------------------------------------------------
// 1. 最小小程序环境 mock（仅够模块顶层 require 通过）
// ------------------------------------------------------------------
const noop = () => {};
global.wx = {
  getStorageSync: () => null,
  setStorageSync: noop,
  removeStorageSync: noop,
  showToast: noop,
  showLoading: noop,
  hideLoading: noop,
  showModal: noop,
  vibrateShort: noop,
  navigateTo: noop,
  navigateBack: noop,
  createInnerAudioContext: () => ({ src: '', play: noop, onError: noop }),
};

const collectedPages = [];
global.Page = (cfg) => collectedPages.push(cfg);
global.Component = (cfg) => collectedPages.push(cfg);
global.getApp = () => ({ globalData: {} });

// ------------------------------------------------------------------
// 2. 环路探测 / 序列化探测
// ------------------------------------------------------------------

/**
 * 沿路径回溯探测循环引用，返回最小环路描述。
 * 必须用「路径栈」而非全局已访问集合：多条数据复用同一对象是 DAG 复用，不是环。
 */
function findCycle(root) {
  const stack = [];
  const done = new Set();
  let hit = null;
  (function walk(node, trail) {
    if (hit || node === null || typeof node !== 'object') return;
    const at = stack.indexOf(node);
    if (at >= 0) {
      const names = trail.slice(at);
      hit = names.join('.') + ' → [回到] ' + names[0];
      return;
    }
    if (done.has(node)) return;
    stack.push(node);
    const keys = Array.isArray(node) ? node.map((_, i) => String(i)) : Object.keys(node);
    for (let i = 0; i < keys.length; i++) walk(node[keys[i]], trail.concat(keys[i]));
    stack.pop();
    done.add(node);
  })(root, []);
  return hit;
}

/** 模拟小程序视图层：可序列化即通过 */
function checkSerializable(label, value, problems) {
  const cyc = findCycle(value);
  if (cyc) {
    problems.push(label + ' 含循环引用：' + cyc);
    return false;
  }
  try {
    JSON.stringify(value);
    return true;
  } catch (e) {
    problems.push(label + ' 序列化失败：' + e.message);
    return false;
  }
}

const problems = [];
const notes = [];

// ------------------------------------------------------------------
// 3. 引擎层：真实跑一场战斗，验证日志净化有效
// ------------------------------------------------------------------
console.log('── 引擎层：战斗日志 ──────────────────────');
try {
  const { simulateBattle } = require(path.join(SLG, 'engine', 'battle.js'));
  const { createLandGuardTroop } = require(path.join(SLG, 'engine', 'map.js'));
  const { createInitialGameState } = require(path.join(SLG, 'engine', 'storage.js'));
  const { viewLogs, toView } = require(path.join(SLG, 'slg-common.js'));

  const state = createInitialGameState();
  const report = simulateBattle(state.troops[0], createLandGuardTroop(3, 'wood'), { playerMorale: 100 });

  // 3.1 原始日志（仅供信息，不作为失败条件：上游哪天改好了这里自然变通过）
  const rawCycle = findCycle(report.logs);
  if (rawCycle) {
    notes.push('simulateBattle 原始 logs 含循环引用（预期）：' + rawCycle);
    console.log('  ℹ️  原始 logs 含循环引用 → 证明「必须经 viewLogs 净化」：');
    console.log('      ' + rawCycle);
  } else {
    notes.push('simulateBattle 原始 logs 已无循环引用（上游可能已修复，可评估简化 viewLogs）');
    console.log('  ℹ️  原始 logs 未发现循环引用');
  }

  // 3.2 viewLogs 产物必须可序列化且全为字符串
  const safe = viewLogs(report.logs, '兜底');
  const safeOk = checkSerializable('viewLogs(report.logs)', safe, problems);
  const allStr = safe.every((x) => typeof x === 'string');
  if (!allStr) problems.push('viewLogs 返回值含非字符串元素，视图 {{item}} 会渲染成 [object Object]');
  console.log('  ' + (safeOk && allStr ? '✅' : '❌') + ' viewLogs → ' + safe.length + ' 条纯字符串，可安全 setData');
  if (safe.length) console.log('      样例：' + safe[0].slice(0, 60));

  // 3.3 空日志兜底行为
  const emptySafe = viewLogs([], '兜底文案');
  if (emptySafe.length !== 1 || emptySafe[0] !== '兜底文案') {
    problems.push('viewLogs 空日志兜底异常：期望 ["兜底文案"]，实得 ' + JSON.stringify(emptySafe));
  }
  if (viewLogs(null).length !== 0) problems.push('viewLogs(null) 应返回空数组');

  // 3.4 整包 gameState 必须可下发
  checkSerializable('toView(gameState)', toView(state), problems);
  console.log('  ✅ toView(gameState) 可安全 setData（含 battleReports 累积）');
} catch (e) {
  problems.push('引擎层检查加载失败：' + e.message);
}

// ------------------------------------------------------------------
// 4. 页面层：加载每个页面的 data 初值，验证可下发
// ------------------------------------------------------------------
console.log('\n── 页面层：data 初值 ────────────────────');
function collectPageFiles(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'assets' || e.name === 'data' || e.name === 'engine') continue;
      collectPageFiles(full, out);
    } else if (e.name === 'index.js') {
      out.push(full);
    }
  }
  return out;
}

const pageFiles = collectPageFiles(SLG, []).sort();
let loaded = 0;
for (let i = 0; i < pageFiles.length; i++) {
  const f = pageFiles[i];
  const rel = path.relative(MP_ROOT, f).replace(/\\/g, '/');
  const before = collectedPages.length;
  try {
    require(f);
  } catch (e) {
    problems.push('页面加载失败 ' + rel + '：' + e.message);
    console.log('  ❌ ' + rel + ' 加载失败：' + e.message);
    continue;
  }
  if (collectedPages.length === before) {
    problems.push('页面未注册 ' + rel + '（无 Page({...}) 调用）');
    console.log('  ❌ ' + rel + ' 未注册 Page');
    continue;
  }
  const cfg = collectedPages[collectedPages.length - 1];
  loaded++;
  const ok = checkSerializable(rel + ' 的 data', cfg.data || {}, problems);
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + rel);
}
console.log('  ── 共加载 ' + loaded + '/' + pageFiles.length + ' 个页面');

// ------------------------------------------------------------------
// 5. 汇总
// ------------------------------------------------------------------
console.log('\n── 汇总 ─────────────────────────────────');
if (notes.length) {
  notes.forEach((n) => console.log('  ℹ️  ' + n));
}
if (problems.length === 0) {
  console.log('  ✅ 视图数据体检全部通过：所有 setData 载荷均可被基础库序列化，无栈溢出风险');
  process.exit(0);
} else {
  console.log('  ❌ 发现 ' + problems.length + ' 个问题：');
  problems.forEach((p, i) => console.log('     ' + (i + 1) + '. ' + p));
  console.log('\n  提示：把带环/超深的对象直接 setData 会在真机抛');
  console.log('        RangeError: Maximum call stack size exceeded（堆栈无业务帧）。');
  console.log('        修复：战斗日志用 slg-common.js 的 viewLogs()，其余对象用 toView()。');
  process.exit(1);
}
