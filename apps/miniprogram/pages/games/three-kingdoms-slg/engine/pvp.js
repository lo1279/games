/**
 * 排位赛（天梯）数据工具
 *
 * 排位赛与单机玩法的根本差别：**对战双方都被标准化**。
 * 武将等级一律 50 级（满级）、战法一律 10 级（满级）、兵力一律 10000，
 * 但**武将星级、卡池阵容、兵种、阵营/羁绊、战法种类与品质保持玩家原样**。
 * 因此胜负取决于「抽卡深度 + 阵容搭配 + 随机种子」，养成投入不构成优势。
 *
 * 纯函数、无 DOM 依赖，可在 Node 无头运行（便于与 battle.js 一起做服务端裁决）。
 */

const { GENERAL_APTITUDE_MODIFIERS } = require("../data/generals.js");
const { TACTICS_DATA } = require("../data/tactics.js");

// ============ 标准化常量 ============

/** 对战统一武将等级（游戏满级） */
const RANKED_LEVEL = 50;
/** 对战统一战法等级（游戏满级） */
const RANKED_TACTIC_LEVEL = 10;
/** 对战统一每将兵力 */
const RANKED_SOLDIERS = 10000;

/** 新玩家初始积分（落在「初入茅庐 0–60」区间内） */
const INITIAL_POINTS = 30;
/** 积分下限（连败归零后停扣，天然形成新手保护） */
const MIN_POINTS = 0;

// ============ 段位体系（9 阶） ============

/**
 * 段位定义。
 * ⚠️ 区间边界必须与数据库生成列 profiles.tier 的 CASE 表达式保持一致，
 *    两处任一改动都要同步，否则会出现「前端显示 X 段、榜单却排 Y 段」。
 * emblem 为徽章纹章标识，供 UI 渲染对应 SVG。
 */
const TIER_LIST = [
  { key: 'novice',      name: '初入茅庐', min: 0,  max: 60,       emblem: 'sprig',     fill: '#F1EFE8', stroke: '#888780', ink: '#5F5E5A' },
  { key: 'rising',      name: '崭露头角', min: 60, max: 130,      emblem: 'sprout',    fill: '#EAF3DE', stroke: '#639922', ink: '#3B6D11' },
  { key: 'outstanding', name: '脱颖而出', min: 130, max: 200,     emblem: 'pillars',   fill: '#E1F5EE', stroke: '#1D9E75', ink: '#0F6E56' },
  { key: 'renowned',    name: '声名鹊起', min: 200, max: 270,    emblem: 'sonar',     fill: '#E6F1FB', stroke: '#378ADD', ink: '#185FA5' },
  { key: 'thunder',     name: '如雷贯耳', min: 270, max: 340,    emblem: 'bolt',      fill: '#EEEDFE', stroke: '#7F77DD', ink: '#534AB7' },
  { key: 'famous',      name: '名震八方', min: 340, max: 400,    emblem: 'radiant',   fill: '#FAEEDA', stroke: '#BA7517', ink: '#854F0B' },
  { key: 'mighty',      name: '威震四海', min: 400, max: 450,    emblem: 'waves',     fill: '#F5C4B3', stroke: '#993C1D', ink: '#712B13' },
  { key: 'worldwide',   name: '举世闻名', min: 450, max: 500,    emblem: 'globe',     fill: '#EF9F27', stroke: '#854F0B', ink: '#412402' },
  { key: 'eternal',     name: '震古烁今', min: 500, max: Infinity, emblem: 'starburst', fill: '#3C3489', stroke: '#FAC775', ink: '#FAC775' },
];

const TIER_MAP = new Map(TIER_LIST.map((t) => [t.key, t]));

/** 按积分取段位定义（与数据库生成列同规则） */
function tierOf(points) {
  const p = Number(points) || 0;
  return TIER_LIST.find((t) => p >= t.min && p < t.max) || TIER_LIST[TIER_LIST.length - 1];
}

/** 按段位 key 取定义；未知 key 兜底最低段 */
function tierByKey(key) {
  return TIER_MAP.get(key) || TIER_LIST[0];
}

/** 距离下一段位还差多少分；已是最高段返回 null（震古烁今无上限） */
function pointsToNextTier(points) {
  const t = tierOf(points);
  if (t.max === Infinity) return null;
  return Math.max(0, t.max - (Number(points) || 0));
}

// ============ 阵型快照与标准化 ============

/**
 * 从存档抽取一支部队的原始快照（保留玩家真实等级与战法等级）。
 * @param {object} state 游戏存档
 * @param {number} [troopIndex] 指定军团；缺省用驻防/当前选中军团
 * @returns {object|null} { arm, name, heroes, tacticLevels }
 */
function buildFormation(state, troopIndex) {
  if (!state || !Array.isArray(state.troops)) return null;
  const idx = (troopIndex != null) ? troopIndex : (state.currentTroopIndex || 0);
  const t = state.troops[idx];
  if (!t) return null;
  return {
    arm: t.arm,
    name: t.name,
    heroes: (t.heroes || []).map((h) => ({ ...h })),
    tacticLevels: { ...(state.tacticLevels || {}) },
  };
}

/**
 * 单个武将标准化：50 级、战法 10 级、兵力 10000。
 * 用展开复制而非白名单挑选——battle.js 读取的字段较多（含 aptitude / growth / camp / avatar），
 * 白名单漏字段会让战斗内部读到 undefined 而算错属性。
 * @param {object} h 原始武将对象
 * @returns {object} 标准化后的新对象
 */
function normalizeHero(h) {
  const o = { ...h };
  o.level = RANKED_LEVEL;
  delete o.exp;
  // 必须清掉 builtInTacticLevel：battle.js 里自带战法优先读它，
  // 留着就会绕过统一的 10 级，导致双方战法等级不对称。
  delete o.builtInTacticLevel;
  // tacticLevel 是对所有战法的统一覆盖（battle.js: heroData.tacticLevel || ...）
  o.tacticLevel = RANKED_TACTIC_LEVEL;
  o.currentSoldiers = RANKED_SOLDIERS;
  o.maxSoldiers = RANKED_SOLDIERS;
  return o;
}

/**
 * 把阵型标准化为「排位赛标准阵型」——对战双方与校验重算全部使用此快照。
 * @param {object} formation buildFormation 的输出
 * @returns {object|null} 标准化阵型；无武将时返回 null
 */
function normalizeForRanked(formation) {
  if (!formation || !Array.isArray(formation.heroes) || formation.heroes.length === 0) return null;
  const heroes = formation.heroes.map(normalizeHero);
  // 只把「本阵型实际用到的战法」写入等级表，避免把 TACTICS_DATA 全量塞进 JSONB
  const used = new Set();
  heroes.forEach((h) => {
    [h.builtInTacticId, h.equippedTactic1, h.equippedTactic2].forEach((id) => { if (id) used.add(id); });
  });
  const tacticLevels = {};
  used.forEach((id) => { tacticLevels[id] = RANKED_TACTIC_LEVEL; });
  return { ...formation, heroes, tacticLevels };
}

/**
 * 生成玩家「挂载出战队伍」用的标准阵型快照。
 * @param {object} state 游戏存档
 * @param {number} [troopIndex] 指定军团；缺省用当前出征军团
 * @returns {object|null}
 */
function buildPostedFormation(state, troopIndex) {
  return normalizeForRanked(buildFormation(state, troopIndex));
}

// ============ 排位赛战力（仅展示用） ============

const TAC_MAP = new Map(TACTICS_DATA.map((t) => [t.id, t]));
const TAC_POWER = { S: 1400, A: 900, B: 520, C: 260 };

/**
 * 计算排位赛战力——必须基于「标准化后（50 级 / 战法 10 级）」的阵型，
 * 这样显示的战力与真正对战时的强度一致，段位才有参考意义。
 * 纯启发式、单调递增，不参与任何战斗结算。
 * @param {object} formation 标准化阵型
 * @returns {number} 战力整数
 */
function computeRankedPower(formation) {
  if (!formation || !Array.isArray(formation.heroes) || formation.heroes.length === 0) return 0;
  const arm = formation.arm;
  const d = RANKED_LEVEL - 1;
  let total = 0;

  formation.heroes.forEach((h) => {
    const aptGrade = (h.aptitude || {})[arm] || 'C';
    const apt = GENERAL_APTITUDE_MODIFIERS[aptGrade] != null ? GENERAL_APTITUDE_MODIFIERS[aptGrade] : 1;
    const attr =
      ((h.force || 0) + (h.forceGrowth || 0) * d) +
      ((h.intel || 0) + (h.intelGrowth || 0) * d) +
      ((h.command || 0) + (h.commandGrowth || 0) * d) +
      ((h.speed || 0) + (h.speedGrowth || 0) * d);
    const star = h.star || 4;
    total += attr * apt * (0.9 + star * 0.12) + star * 300;
  });

  // 战法：按「实际用到的战法」去重计分，同一阵法在一队内只算一次（与 battle.js 排重规则一致）
  const used = new Set();
  formation.heroes.forEach((h) => {
    [h.builtInTacticId, h.equippedTactic1, h.equippedTactic2].forEach((id) => {
      if (!id) return;
      const t = TAC_MAP.get(id);
      used.add(t ? `${id}|${t.quality}` : `${id}|A`);
    });
  });
  used.forEach((k) => {
    const q = k.split('|')[1];
    total += TAC_POWER[q] != null ? TAC_POWER[q] : 400;
  });

  // 每上阵 1 名武将给一份基础编制分（阵容深度奖励）
  total += formation.heroes.length * 500;
  return Math.round(total);
}

module.exports = Object.assign(module.exports || {}, {
  RANKED_LEVEL,
  RANKED_TACTIC_LEVEL,
  RANKED_SOLDIERS,
  INITIAL_POINTS,
  MIN_POINTS,
  TIER_LIST,
  tierOf,
  tierByKey,
  pointsToNextTier,
  buildFormation,
  normalizeForRanked,
  buildPostedFormation,
  computeRankedPower
});
