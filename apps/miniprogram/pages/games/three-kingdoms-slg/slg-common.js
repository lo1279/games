// pages/games/three-kingdoms-slg/slg-common.js
/**
 * 三国志·战略版 小程序端共享工具
 *  - 立绘路径推导（与 Web 版「立绘优先、emoji 兜底」行为一致）
 *  - 资源图标映射
 *  - 战斗结果统一写入「战报中心」(report.js)
 *  - 视图数据净化：viewLogs / toView（setData 前的强制关口）
 */

const { getGeneralBaseId } = require('./data/generals.js');
const { makeReport, appendReport } = require('./engine/report.js');
const { saveGameState } = require('./engine/storage.js');

const RES_ICON = {
  gold: '👑', copper: '🪙', wood: '🌲', iron: '⛏️', stone: '🪨',
  grain: '🌾', reserveSoldiers: '🛡️', challengeOrders: '🎫'
};

/** 资源 key -> 展示图标 */
function resIcon(key) {
  return RES_ICON[key] || '📦';
}

/**
 * 推导武将立绘路径（压缩后的 jpg，与源 png 同名）。
 * @param {object} hero 武将对象（owned 或 base 均可，依赖 getGeneralBaseId）
 * @param {string} [prefix] 相对页面所在目录的资源前缀；子页用 '../assets/generals/'，大厅用 'assets/generals/'
 * @returns {string} 如 '../assets/generals/gen_liu_bei.jpg'，推导不出则空串
 */
function portraitPath(hero, prefix) {
  const baseId = getGeneralBaseId(hero);
  if (!baseId) return '';
  const p = prefix || '../assets/generals/';
  return `${p}${baseId}.jpg`;
}

/**
 * 把一场战斗结果写入战报中心并落盘。
 * @param {object} state 游戏状态（会被就地修改并 save）
 * @param {object} opts { category, title, isVictory, summary, logs, stars, extra }
 */
function recordBattle(state, opts) {
  const rep = makeReport(opts);
  appendReport(state, rep);
  saveGameState(state);
  return rep;
}

// ============================================================
// 视图数据净化（setData 前的强制关口）
// ============================================================

/** 单场战斗下发给视图层的日志条数上限（与 report.js 的 MAX_PVE_LOGS 对齐） */
const MAX_VIEW_LOGS = 30;

/**
 * 把 simulateBattle 的原始 logs 转成视图层可直接渲染的纯字符串数组。
 *
 * ⚠️ 为什么必须转（2026-10-14 真机事故根因）：
 * 原始日志的形态是 `{ round, text, type, meta }`，其中 meta.actor / meta.target
 * 是「战斗内武将对象」，它们挂着 buffs / myTeam / oppTeam 且**互为引用成环**：
 *   logs[i].meta.actor.buffs.myTeam[0].buffs.oppTeam[0] … 回到 logs[i].meta.actor
 * 这份对象一旦进 setData，基础库序列化时会无限递归，真机抛
 *   RangeError: Maximum call stack size exceeded
 * 且堆栈全在基础库内部（WASubContext），**没有一条业务帧**，极难定位。
 * 视图只渲染 `l.text`，所以这里只取文本，彻底断掉所有对象引用。
 *
 * @param {Array} logs simulateBattle 的 report.logs，或已经是字符串数组
 * @param {string} [fallbackText] 日志为空时的兜底文案
 * @returns {string[]} 纯字符串数组
 */
function viewLogs(logs, fallbackText) {
  const out = [];
  if (Array.isArray(logs)) {
    const limit = Math.min(logs.length, MAX_VIEW_LOGS);
    for (let i = 0; i < limit; i++) {
      const l = logs[i];
      if (typeof l === 'string') out.push(l);
      else if (l && typeof l.text === 'string') out.push(l.text);
      else if (l != null) out.push(String(l));
    }
  }
  if (out.length === 0 && fallbackText) return [fallbackText];
  return out;
}

/**
 * 循环安全的深拷贝，专供 setData 下发视图层。
 *
 * 与 JSON.parse(JSON.stringify(x)) 的差别：
 *  - 遇循环引用**不抛错**，而是切断该死链并把环路打到控制台，便于定位源头；
 *    而 JSON 方案会抛 TypeError，若在 catch 里回退原对象，等于把带环对象喂给
 *    setData —— 正是栈溢出的成因（原 cloneForView 的写法有这个隐患）。
 *  - 同时断开「同一对象出现在多个路径」的共享引用（如 troops[].heroes[] 与
 *    ownedGenerals[] 是同一批对象），让视图层拿到互不干扰的独立副本。
 *
 * 实现要点：用「路径回溯」判定环（进入 add、退出 delete），**不能用全局
 * 已访问集合**——多条业务数据复用同一个对象属于 DAG 复用而非环，全局去重会误杀。
 *
 * @param {*} input 待下发数据
 * @returns {*} 净化后的纯数据
 */
function toView(input) {
  const path = new Set();
  const cut = [];

  const walk = (node, depth, trail) => {
    if (node === null || typeof node !== 'object') return node;
    if (path.has(node)) {
      cut.push(trail.slice(-6).join('.'));
      return undefined;
    }
    // 非循环但异常深的结构同样是栈溢出隐患，超过阈值直接丢弃
    if (depth > 20) {
      cut.push(trail.slice(-6).join('.') + ' (>20层)');
      return undefined;
    }
    path.add(node);
    let out;
    if (Array.isArray(node)) {
      out = [];
      for (let i = 0; i < node.length; i++) {
        const v = walk(node[i], depth + 1, trail.concat('[' + i + ']'));
        if (v !== undefined) out.push(v);
      }
    } else if (node instanceof Date) {
      out = node;
    } else {
      out = {};
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = walk(node[keys[i]], depth + 1, trail.concat(k));
        if (v !== undefined) out[k] = v;
      }
    }
    path.delete(node);
    return out;
  };

  const result = walk(input, 0, []);
  if (cut.length) {
    console.warn('[SLG] setData 载荷存在循环引用或过深结构，已切断:', cut.slice(0, 5).join(' | '));
  }
  return result;
}

module.exports = {
  resIcon,
  portraitPath,
  recordBattle,
  RES_ICON,
  viewLogs,
  toView,
  MAX_VIEW_LOGS
};
