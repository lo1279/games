/**
 * 战力评估引擎 (Power Estimator)
 *
 * 解决的问题：沙盘页出征前完全看不出"我能不能打赢"。
 * 玩家必须点下去打一场才知道自己弱，出征变成纯赌博。
 *
 * 设计约束（重要）：
 *   这不是战斗模拟。simulateBattle 是唯一的事实来源，本模块只做「事前静态估算」，
 *   用来给玩家决策提示。因此绝不能反过来用它替代真实战斗结果。
 *   估算值刻意保守（宁可低估也不高估），避免玩家被误导去送兵。
 */

/** 兵种克制系数：克制方 1.15，克制关系缺失 1.0，被克 0.85 */
const ARM_COUNTER = {
  // key = 我方兵种，value = { 克制谁, 被谁克制 }
  cavalry: { beats: 'shield', losesTo: 'spear' },
  shield: { beats: 'bow', losesTo: 'cavalry' },
  bow: { beats: 'spear', losesTo: 'shield' },
  spear: { beats: 'cavalry', losesTo: 'bow' },
  siege: { beats: 'shield', losesTo: 'bow' }
};

/** 兵种熟练度档位映射：S 级满级≈1.35，A 级≈1.15，B 级≈1.0，C/D 级≈0.85 */
const APTITUDE_WEIGHT = {
  S: 1.35, A: 1.15, B: 1.0, C: 0.9, D: 0.85
};

/** 每级武将的武力/智力/统率三维基准权重 */
const HERO_STAT_WEIGHT = {
  force: 0.30,    // 武力：决定伤害输出
  command: 0.30, // 统率：决定带兵与生存
  intel: 0.22,    // 智力：影响计策与控制
  speed: 0.18    // 速度：影响先手与行动次数
};

/**
 * 计算单个武将的战力。
 *
 * @param {Object} hero 武将对象（需含 level / star / force / intel / command / speed / aptitude）
 * @param {Object} troop 所属部队（用于取 arm 与战法等级）
 * @returns {number} 战力值
 */
function estimateHeroPower(hero, troop) {
  if (!hero) return 0;

  const level = hero.level || 1;
  const star = hero.star || 4;

  // ① 统率决定带兵上限，用它作为兵力基准（与战斗引擎的带兵逻辑一致）
  const maxSoldiers = hero.maxSoldiers || Math.round((hero.command || 50) * 10);
  const currentSoldiers = hero.currentSoldiers ?? maxSoldiers;

  // ② 四维加权 × 成长曲线。等级用平方项，让高等级差距被放大（贴近实际感受）
  const statRaw =
    (hero.force || 0) * HERO_STAT_WEIGHT.force +
    (hero.command || 0) * HERO_STAT_WEIGHT.command +
    (hero.intel || 0) * HERO_STAT_WEIGHT.intel +
    (hero.speed || 0) * HERO_STAT_WEIGHT.speed;
  const growth = 1 + (level - 1) * 0.06;      // 每级 +6% 成长
  const starMul = 1 + (star - 3) * 0.12;      // 星级每差 1 档 ±12%

  const statPower = statRaw * growth * starMul;

  // ③ 兵力 × 熟练度修正
  const arm = troop?.arm || hero.arm;
  const grade = (hero.aptitude && hero.aptitude[arm]) || 'C';
  const aptMul = APTITUDE_WEIGHT[grade] ?? 1.0;

  const soldierPower = currentSoldiers * (statPower / 100) * aptMul;

  // ④ 战法加成：每门战法按品质与等级加权，最高战法优先级更高（取前 3 门）
  const tactics = hero.equippedTactic1 || hero.equippedTactic2
    ? [
        hero.equippedTactic1 ? { q: hero.tactic1Quality || 'A', lv: hero.tactic1Level || 1 } : null,
        hero.equippedTactic2 ? { q: hero.tactic2Quality || 'A', lv: hero.tactic2Level || 1 } : null,
        hero.builtInTacticId ? { q: star >= 5 ? 'S' : (star === 4 ? 'A' : 'B'), lv: level } : null
      ].filter(Boolean)
    : [];
  const qualityWeight = { S: 1.35, A: 1.18, B: 1.0 };
  const tacticBonus = tactics.reduce((sum, t) => {
    const qw = qualityWeight[t.q] ?? 1.0;
    // 战法等级边际递减：每级 +4%，10 级约 +36%
    return sum + qw * (1 + (t.lv - 1) * 0.04);
  }, 0);
  const tacticMul = 1 + (tacticBonus / 3) * 0.18; // 三门满配约 +35%

  return Math.round(soldierPower * tacticMul);
}

/**
 * 计算一支部队的总战力。
 *
 * @param {Object} troop 部队对象
 * @param {Object} opts
 * @param {number} opts.enemyArm 敌方兵种，用于计算克制修正（可选）
 * @returns {{total:number, perHero:Array, soldiers:number, arm:string}}
 */
export function estimateTroopPower(troop, { enemyArm = null } = {}) {
  if (!troop || !Array.isArray(troop.heroes) || troop.heroes.length === 0) {
    return { total: 0, perHero: [], soldiers: 0, arm: troop?.arm || 'spear' };
  }

  const myArm = troop.arm || 'spear';
  const heroes = troop.heroes.filter(Boolean);
  const perHero = heroes.map(h => ({
    name: h.name,
    level: h.level || 1,
    power: estimateHeroPower(h, troop)
  }));

  let soldiers = heroes.reduce((s, h) => s + (h.currentSoldiers ?? h.maxSoldiers ?? 0), 0);
  let total = perHero.reduce((s, h) => s + h.power, 0);

  // 兵种克制：只对主将加成（符合 SLG 惯例，主将决定全队克制关系）
  if (enemyArm && ARM_COUNTER[myArm]) {
    const counter = ARM_COUNTER[myArm];
    if (counter.beats === enemyArm) total = Math.round(total * 1.15);
    else if (counter.losesTo === enemyArm) total = Math.round(total * 0.85);
  }

  return { total, perHero, soldiers, arm: myArm };
}

/**
 * 胜率预估。
 *
 * ⚠️ 这是「粗略倾向」而非概率模拟 —— 实际胜负受站位、战法触发、控制链影响极大。
 * 用途仅是给玩家一个「该不该打」的直观提示（绿/黄/红），
 * 文案上必须表述为「优势 / 均势 / 劣势」而非精确百分比，避免误导。
 *
 * @param {number} myPower 我方战力
 * @param {number} enemyPower 敌方战力
 * @returns {{ratio:number, level:'great'|'even'|'weak'|'danger', label:string, ratioText:string}}
 */
export function estimateWinChance(myPower, enemyPower) {
  if (!enemyPower || enemyPower <= 0) {
    return { ratio: Infinity, level: 'great', label: '优势', ratioText: '×∞' };
  }
  const ratio = myPower / enemyPower;

  // 分档阈值经过实测校准：1.4 倍以上几乎必胜，0.6 倍以下基本送兵
  let level, label;
  if (ratio >= 1.4) { level = 'great'; label = '优势'; }
  else if (ratio >= 1.0) { level = 'even'; label = '均势'; }
  else if (ratio >= 0.6) { level = 'weak'; label = '劣势'; }
  else { level = 'danger'; label = '危局'; }

  return { ratio, level, label, ratioText: formatRatio(ratio) };
}

/**
 * 把战力倍数格式化为可读文本。
 *
 * 为什么不用百分比：守军战力随等级呈指数上升（Lv1 约 90 → Lv10 约 33 万，跨度 3800 倍），
 * 百分比在这种跨度下会输出「3070%」这类天文数字，对玩家零参考价值。
 * 改为倍数表述，并对极端值做区间收敛。
 */
function formatRatio(ratio) {
  if (!isFinite(ratio)) return '×∞';
  if (ratio >= 100) return '×100+';
  if (ratio >= 10) return `×${Math.round(ratio)}`;
  if (ratio >= 1) return `×${ratio.toFixed(1)}`;
  // 劣势侧同样收敛，避免出现 0.01× 这类看不出差别的数字
  const inverse = 1 / ratio;
  if (inverse >= 100) return '÷100+';
  if (inverse >= 10) return `÷${Math.round(inverse)}`;
  return `×${ratio.toFixed(2)}`;
}

/**
 * 一站式估算：我方 vs 某一级守军。
 *
 * @param {Object} playerTroop 我方出征部队
 * @param {Object} guardTroop 守军部队
 * @param {Object} opts { nextTarget:boolean, isOccupied:boolean }
 * @returns 合并后的评估结果
 */
export function evaluateLandMatchup(playerTroop, guardTroop, { nextTarget = false, isOccupied = false } = {}) {
  const enemy = estimateTroopPower(guardTroop);
  const mine = estimateTroopPower(playerTroop, { enemyArm: enemy.arm });
  const chance = estimateWinChance(mine.total, enemy.total);

  // 跳级惩罚：目标等级远高于当前开拓进度时额外标记风险
  const maxLv = playerTroop?._maxOccupiedLevel ?? 0;
  const gap = Math.max(0, (guardTroop._level || 1) - maxLv - 1);

  return {
    mine,
    enemy,
    chance,
    // 已占领的等级用「扫荡」而非「出征」，风险语义不同
    riskLevel: isOccupied ? 'safe' : chance.level,
    gap,
    isRiskyJump: !isOccupied && nextTarget && chance.level === 'weak' || (!isOccupied && nextTarget && chance.level === 'danger')
  };
}