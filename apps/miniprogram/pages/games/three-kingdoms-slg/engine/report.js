/**
 * 战报全书 · 统一数据层
 *
 * 全局唯一的战报分类定义 + 战报裁剪 + 入库规则。
 * 单机四类战斗（开拓 / 战役 / 演武 / 演习）与联网天梯共用同一套结构，
 * 因此战报全书可以统一分类、统一筛选、跨端同步（随 player_saves 整包上云）。
 *
 * 为什么要裁剪：simulateBattle 的原始 logs 每条都挂着 meta 里的完整武将对象
 * （含全部属性、战法、战斗内临时状态），单场可达 50~110KB。战报要进存档并
 * 随每次存档动作同步到云端，不裁剪会让存档迅速膨胀到不可用。
 */

/**
 * 战报分类。
 * ⚠️ id 一旦上线不可改（会与已有存档里的 category 字段脱钩）。
 * color 用于筛选条与卡片左侧色条；icon 仅用于文案，渲染时不用 emoji 走 SVG。
 */
const REPORT_CATEGORIES = [
  { id: 'pioneer', name: '开拓', desc: '沙盘资源地出征', color: '#059669' },
  { id: 'campaign', name: '战役', desc: '征战·经典战役', color: '#dc2626' },
  { id: 'trial', name: '演武', desc: '征战·演武通天阁', color: '#7c3aed' },
  { id: 'sandbox', name: '演习', desc: '征战·假想敌沙盒', color: '#0891b2' },
  { id: 'ladder', name: '天梯', desc: '排位赛玩家对战', color: '#ca8a04' },
];

const CATEGORY_MAP = new Map(REPORT_CATEGORIES.map((c) => [c.id, c]));

/** 取分类定义；未知/历史缺失的 id 一律归入「战役」而不是丢弃战报 */
function categoryOf(id) {
  return CATEGORY_MAP.get(id) || CATEGORY_MAP.get('campaign');
}

/** HTML 转义：战报标题会拼进 innerHTML，兜底防止特殊字符破坏结构 */
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * 取战报标题。
 * 兼容旧存档：本功能上线前战报用的是 tileName 字段且没有 category，
 * 直接读 title 会让老战报显示成空白。
 * @param {object} rep 战报条目
 * @returns {string} 标题
 */
function reportTitle(rep) {
  return (rep && (rep.title || rep.tileName)) || '未知战事';
}

/**
 * 取战报主标题（用于列表卡片与详情弹窗标题）。
 *
 * 天梯战报统一显示为「天梯对战」，对手信息交给副标题 / 详情单独承载。
 * 否则会出现「曹操 vs 曹操」这种重复：早期存档的天梯战报 title 里已含对手名，
 * 再拼一次 `vs 对手名` 就重了。
 * @param {object} rep 战报条目
 * @returns {string} 标题
 */
function reportHeadline(rep) {
  if (categoryOf(rep && rep.category).id === 'ladder') return '天梯对战';
  return reportTitle(rep);
}

/**
 * 取战报时间文本。旧存档只有 HH:MM:SS，新存档有完整日期时间。
 * @param {object} rep 战报条目
 * @returns {string} 时间文本
 */
function reportTime(rep) {
  if (rep && rep.time) return rep.time;
  if (rep && rep.ts) return new Date(rep.ts).toLocaleString();
  return '—';
}

// ============ 体积预算 ============

/** 单机战斗每份战报保留的日志条数（战报详情的可读性下限） */
const MAX_PVE_LOGS = 30;
/** 天梯战报保留的日志条数（对战更有复盘价值，给更多） */
const MAX_LADDER_LOGS = 120;
/** 存档中最多保留的战报份数（超出后从最旧的开始丢） */
const MAX_REPORTS = 40;

/**
 * 把战斗原始结果裁剪为「可存储形态」。
 *
 * ① summary 保留完整（结算数字全在里面，且体积小）；
 * ② 日志只保留 { round, type, text } —— text 已是完整可读文本，
 *    meta 里的武将对象只增体积不提供额外信息；
 * ③ buffs/myTeam/oppTeam 是循环引用源头，直接 JSON.stringify 会抛错，必须断；
 * ④ seen 必须按当前路径回溯（进入 add、退出 delete），不能用全局集合：
 *    多条日志会复用同一个武将对象（DAG 复用而非环），全局去重会把它误判成环而丢弃。
 *
 * @param {object} summary simulateBattle 的 summary
 * @param {Array} logs simulateBattle 的 logs
 * @param {number} [maxLogs] 保留的日志条数上限
 * @returns {{summary:object, logs:Array}}
 */
function compactReport(summary, logs, maxLogs = MAX_PVE_LOGS) {
  const walk = (o, path) => {
    if (o === null || typeof o !== 'object') return o;
    if (path.has(o)) return undefined;
    path.add(o);
    let out;
    if (Array.isArray(o)) {
      out = o.map((v) => walk(v, path));
    } else {
      out = {};
      for (const k of Object.keys(o)) {
        if (k === 'buffs' || k === 'myTeam' || k === 'oppTeam' || k === 'meta') continue;
        out[k] = walk(o[k], path);
      }
    }
    path.delete(o);
    return out;
  };
  const list = Array.isArray(logs) ? logs.slice(0, maxLogs) : [];
  return {
    summary: walk(summary || {}, new Set()),
    logs: list.map((l) => ({ round: l.round, type: l.type, text: l.text })),
  };
}

/**
 * 构造一份战报条目（统一字段口径，避免各调用点各写各的）。
 * @param {object} opts
 * @param {string} opts.category 分类 id（REPORT_CATEGORIES 之一）
 * @param {string} opts.title 标题，如「战棋沙盘 · 苍翠林场(Lv.3)」
 * @param {boolean} opts.isVictory 是否胜利
 * @param {object} opts.summary 原始 summary
 * @param {Array} opts.logs 原始 logs
 * @param {number} [opts.stars] 战役星级（仅战役有）
 * @param {object} [opts.extra] 额外字段（如天梯的对手名与积分变化）
 * @returns {object} 战报条目
 */
function makeReport({ category, title, isVictory, summary, logs, stars = null, extra = null }) {
  const maxLogs = category === 'ladder' ? MAX_LADDER_LOGS : MAX_PVE_LOGS;
  const compact = compactReport(summary, logs, maxLogs);
  return {
    id: `rep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    category,
    title,
    ts: Date.now(),
    time: new Date().toLocaleString(),
    isVictory: !!isVictory,
    stars,
    summary: compact.summary,
    logs: compact.logs,
    ...(extra || {}),
  };
}

/**
 * 把战报插入存档头部并裁剪总数。
 * @param {object} state 游戏存档（直接修改）
 * @param {object} report makeReport 的产物
 * @returns {object} 入库的 report（便于调用方继续使用）
 */
function appendReport(state, report) {
  if (!Array.isArray(state.battleReports)) state.battleReports = [];
  state.battleReports.unshift(report);
  // 超额时从尾部丢弃最旧的
  while (state.battleReports.length > MAX_REPORTS) state.battleReports.pop();
  return report;
}

module.exports = Object.assign(module.exports || {}, {
  REPORT_CATEGORIES,
  MAX_PVE_LOGS,
  MAX_LADDER_LOGS,
  MAX_REPORTS,
  categoryOf,
  escHtml,
  reportTitle,
  reportHeadline,
  reportTime,
  compactReport,
  makeReport,
  appendReport
});
