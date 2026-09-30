/**
 * 三国志·战略版 - 官方原版武将缘分羁绊数据库 (Bonds)
 * 严格对齐原版游戏：桃园结义、五虎上将、西蜀之智、乱世三仙、五谋臣、五子良将、江表虎臣、四大都督、国之栋梁等
 */

export const BONDS_DATA = [
  {
    id: 'bond_tao_yuan',
    name: '桃园结义',
    requiredCount: 3,
    heroNames: ['刘备', '关羽', '张飞'],
    desc: '战斗第 6 回合，使我军全体获得 2 次抵御(免疫伤害)；全军统率提升 15 点。',
    statBonus: { command: 15 },
    effect: {
      roundShield: { round: 6, count: 2, duration: 2 }
    }
  },
  {
    id: 'bond_wu_hu',
    name: '五虎上将',
    requiredCount: 3,
    heroNames: ['关羽', '张飞', '赵云', '马超', '黄忠'],
    desc: '使我军全体武力、统率提升 10 点，并使全体会心暴击几率提升 8%！',
    statBonus: { force: 10, command: 10 },
    effect: {
      critRateBonus: 0.08
    }
  },
  {
    id: 'bond_shu_zhi',
    name: '西蜀之智',
    requiredCount: 3,
    heroNames: ['诸葛亮', '庞统', '法正', '徐庶'],
    desc: '使我军全体智力提升 14 点，战斗前 2 回合获得 2 次抵御！',
    statBonus: { intel: 14 },
    effect: {
      prepShield: { count: 2, duration: 2 }
    }
  },
  {
    id: 'bond_san_xian',
    name: '乱世三仙',
    requiredCount: 3,
    heroNames: ['张角', '于吉', '左慈'],
    desc: '使我军全体统率提升 20 点，全军规避几率提升 10%！',
    statBonus: { command: 20 },
    effect: {
      evasionBonus: 0.10
    }
  },
  {
    id: 'bond_wu_mou',
    name: '曹魏五谋臣',
    requiredCount: 3,
    heroNames: ['司马懿', '贾诩', '郭嘉', '程昱'],
    desc: '使我军全体智力提升 12 点，谋略奇谋暴击几率提升 4.5%，且战斗前 2 回合获得先攻！',
    statBonus: { intel: 12 },
    effect: {
      firstStrike: 2,
      tacticalCritBonus: 0.045
    }
  },
  {
    id: 'bond_wu_zi',
    name: '五子良将',
    requiredCount: 3,
    heroNames: ['张辽', '张郃', '乐进'],
    desc: '使我军全体武力、速度提升 14 点，强化突击与连携输出！',
    statBonus: { force: 14, speed: 14 },
    effect: {
      speedBonus: 14
    }
  },
  {
    id: 'bond_hu_chen',
    name: '江表虎臣',
    requiredCount: 3,
    heroNames: ['太史慈', '甘宁', '周泰', '凌统'],
    desc: '使我军全体统率提升 20 点，自身暴击会心几率提升 5%！',
    statBonus: { command: 20 },
    effect: {
      critRateBonus: 0.05
    }
  },
  {
    id: 'bond_du_du',
    name: '四大都督',
    requiredCount: 3,
    heroNames: ['周瑜', '陆逊', '吕蒙', '鲁肃'],
    desc: '使我军全体速度提升 16 点，主动战法造成的谋略伤害提升 6%！',
    statBonus: { speed: 16 },
    effect: {
      activeTacticalDmgBonus: 0.06
    }
  },
  {
    id: 'bond_guo_zhi_dong_liang',
    name: '国之栋梁',
    requiredCount: 3,
    heroNames: ['诸葛亮', '司马懿', '周瑜'],
    desc: '使我军全体智力提升 12 点，受到谋略伤害降低 5%，前 2 回合获得先攻！',
    statBonus: { intel: 12 },
    effect: {
      firstStrike: 2,
      tacticalDmgReduction: 0.05
    }
  },
  {
    id: 'bond_tai_shi_dong_luan',
    name: '太师动乱',
    requiredCount: 3,
    heroNames: ['吕布', '董卓', '貂蝉'],
    desc: '使我军全体武力提升 25 点，主将第 1 回合获得群攻与先攻！',
    statBonus: { force: 25 },
    effect: {
      leaderSplash: true,
      leaderFirstStrike: true
    }
  }
];

/**
 * 依据队伍武将名字列表，检测激活的所有缘分羁绊
 * @param {Array<string>} heroNames 武将姓名数组
 * @returns {Array<Object>} 激活的缘分列表
 */
export function checkActiveBonds(heroNames) {
  if (!heroNames || heroNames.length < 3) return [];
  const activeBonds = [];

  BONDS_DATA.forEach(bond => {
    const matchedCount = bond.heroNames.filter(name => heroNames.includes(name)).length;
    if (matchedCount >= bond.requiredCount) {
      activeBonds.push(bond);
    }
  });

  return activeBonds;
}

/**
 * 获取某个指定武将所属的所有缘分羁绊
 * @param {string} heroName 武将姓名
 * @returns {Array<Object>} 所属缘分列表
 */
export function getBondsForHero(heroName) {
  if (!heroName) return [];
  return BONDS_DATA.filter(bond => bond.heroNames.includes(heroName));
}

