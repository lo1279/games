/**
 * 三国志·战略版 - 点将招募系统 (Gacha Engine)
 * 真实还原原版三战概率：5星 5.6%、4星 36.0%、3星 58.4%
 * 核心机制：5星内部划分【大核心锁卡 (12%极低权重)】与【普通橙将 (88%普橙权重)】
 * 30 抽必出 5 星大保底、5 抽必出 4 星良将小保底
 */

import { GENERALS_DATA } from '../data/generals.js';

export const GACHA_CONFIG = {
  goldSingleCost: 198,
  goldFiveCost: 948,
  copperSingleCost: 300,
  copperTenCost: 2700,
  hardPityFiveStar: 30, // 广州灵犀官方正统：30抽必出5星名将大保底
  hardPityFourStar: 5,  // 广州灵犀官方正统：5抽必出4星良将小保底
  coreRateInFiveStar: 12 // 5星出货时，大核心稀有神将出现率仅为 12% (综合全池单抽率约 0.67%)
};

// 🌟 三战原版大核心名将（三皇与各阵营顶流核心神将）
export const CORE_FIVE_STAR_IDS = new Set([
  'gen_liu_bei',     // 刘备 (三皇)
  'gen_zhu_ge_liang',// 诸葛亮 (蜀智核)
  'gen_guan_yu',     // 关羽 (武圣)
  'gen_zhao_yun',    // 赵云 (一身是胆)
  'gen_zhang_fei',   // 张飞 (五虎核)
  'gen_cao_cao',     // 曹操 (三皇·魏武帝)
  'gen_si_ma_yi',    // 司马懿 (太尉盾核)
  'gen_zhang_liao',  // 张辽 (爆头骑核)
  'gen_sun_quan',    // 孙权 (三皇·孙十万)
  'gen_lu_xun',      // 陆逊 (嘟嘟都督核)
  'gen_zhou_yu',     // 周瑜 (神火核)
  'gen_lv_bu',       // 吕布 (天下无双)
  'gen_zuo_ci',      // 左慈 (三仙规避核)
  'gen_jiang_wei',   // 姜维 (麒麟弓核)
  'gen_wei_yan',     // 魏延 (瞬发核)
  'gen_zhou_tai',    // 周泰 (吴骑/虎臣核)
  'gen_jia_xu'       // 贾诩 (魏法骑/五谋臣核)
]);

/**
 * 依据三战核心卡极低概率抽取 5 星名将
 */
function pickFiveStarGeneral(fiveStars) {
  const coreGenerals = fiveStars.filter(g => CORE_FIVE_STAR_IDS.has(g.id));
  const normalGenerals = fiveStars.filter(g => !CORE_FIVE_STAR_IDS.has(g.id));

  // 12% 概率产出大核心神将，88% 产出普通 5 星
  const isCoreRoll = (Math.random() * 100 < GACHA_CONFIG.coreRateInFiveStar);

  let selectedGen;
  let isCore = false;

  if (isCoreRoll && coreGenerals.length > 0) {
    selectedGen = coreGenerals[Math.floor(Math.random() * coreGenerals.length)];
    isCore = true;
  } else if (normalGenerals.length > 0) {
    selectedGen = normalGenerals[Math.floor(Math.random() * normalGenerals.length)];
    isCore = false;
  } else {
    selectedGen = fiveStars[Math.floor(Math.random() * fiveStars.length)];
    isCore = CORE_FIVE_STAR_IDS.has(selectedGen.id);
  }

  return {
    ...selectedGen,
    isCore
  };
}

export function pullGeneral(poolType = 'famous', pityFiveCounter = 0, pityFourCounter = 0) {
  const isFamous = (poolType === 'famous');
  const fiveStars = GENERALS_DATA.filter(g => g.star === 5);
  const fourStars = GENERALS_DATA.filter(g => g.star === 4);

  // 1. 触发 5 星大保底判定 (第 30 抽必出 5 星橙卡)
  if (isFamous && pityFiveCounter >= GACHA_CONFIG.hardPityFiveStar - 1) {
    const gen = pickFiveStarGeneral(fiveStars);
    return { general: gen, isFivePity: true, resetFivePity: true, resetFourPity: true, isCore: gen.isCore };
  }

  // 2. 触发 4 星小保底判定 (连续 4 抽未出紫橙，第 5 抽必出 4 星紫卡或 5 星橙卡)
  if (isFamous && pityFourCounter >= GACHA_CONFIG.hardPityFourStar - 1) {
    // 按 5.6% / (5.6% + 36.0%) = 13.5% 出 5 星，86.5% 出 4 星
    const isPityFive = (Math.random() * 100 < 13.5);
    if (isPityFive) {
      const gen = pickFiveStarGeneral(fiveStars);
      return { general: gen, isFivePity: false, resetFivePity: true, resetFourPity: true, isCore: gen.isCore };
    } else {
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen, isCore: false }, isFourPity: true, resetFivePity: false, resetFourPity: true, isCore: false };
    }
  }

  const roll = Math.random() * 100;

  if (isFamous) {
    // 广州灵犀官方正统公示概率：5星 5.6%, 4星 36.0%, 3星 58.4%
    if (roll < 5.6) {
      const gen = pickFiveStarGeneral(fiveStars);
      return { general: gen, isFivePity: false, resetFivePity: true, resetFourPity: true, isCore: gen.isCore };
    } else if (roll < 41.6) { // 5.6 + 36.0 = 41.6
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen, isCore: false }, isFourPity: false, resetFivePity: false, resetFourPity: true, isCore: false };
    } else {
      // 3星随军良将 (58.4%)
      const gen = createThreeStarGeneral();
      return { general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false, isCore: false };
    }
  } else {
    // 广州灵犀官方正统铜币良将池概率：4星 0.5% (极罕见), 3星 50.0%, 2星/杂兵 49.5%
    if (roll < 0.5) {
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen, isCore: false }, isFivePity: false, resetFivePity: false, resetFourPity: true, isCore: false };
    } else {
      const gen = createThreeStarGeneral();
      return { general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false, isCore: false };
    }
  }
}

function createThreeStarGeneral() {
  const threeStarNames = [
    { name: '宋宪', camp: 'qun', title: '吕布健将', avatar: '🏹' },
    { name: '成廉', camp: 'qun', title: '八健将之一', avatar: '🗡️' },
    { name: '卞喜', camp: 'qun', title: '流星飞锤', avatar: '🔨' },
    { name: '刘禅', camp: 'shu', title: '安乐公', avatar: '🐥' },
    { name: '曹休', camp: 'wei', title: '千里驹', avatar: '🐎' },
    { name: '孙静', camp: 'wu', title: '江东宿卫', avatar: '🛡️' }
  ];
  const t = threeStarNames[Math.floor(Math.random() * threeStarNames.length)];
  return {
    id: `gen_3s_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: t.name,
    camp: t.camp,
    star: 3,
    cost: 3,
    title: t.title,
    avatar: t.avatar,
    avatarBg: '#475569',
    force: 65,
    forceGrowth: 1.2,
    intel: 60,
    intelGrowth: 1.1,
    command: 65,
    commandGrowth: 1.2,
    speed: 50,
    speedGrowth: 0.9,
    aptitude: { cavalry: 'B', shield: 'B', bow: 'B', spear: 'B', siege: 'B' },
    builtInTacticId: 'tac_fen_fa',
    bio: '随军宿将，可用作演练传承战法或强化进阶。'
  };
}
