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
    heroNames: ['司马懿', '荀彧', '荀攸', '贾诩', '郭嘉', '程昱'],
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
    heroNames: ['张辽', '徐晃', '张郃', '乐进', '于禁'],
    desc: '五子良将大圆满！使我军全体武力、速度提升 15 点，会心暴击率提升 4%！',
    statBonus: { force: 15, speed: 15 },
    effect: {
      critRateBonus: 0.04
    }
  },
  {
    id: 'bond_hu_chen',
    name: '江表虎臣',
    requiredCount: 3,
    heroNames: ['太史慈', '甘宁', '周泰', '凌统', '程普', '黄盖', '韩当', '蒋钦', '徐盛'],
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
    heroNames: ['周瑜', '陆逊', '吕蒙', '鲁肃', '陆抗'],
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
  },
  {
    id: 'bond_nan_man',
    name: '南蛮之乱',
    requiredCount: 3,
    heroNames: ['孟获', '祝融夫人', '兀突骨'],
    desc: '使我军全体武力提升 20 点，受到兵刃伤害降低 8%！野性难驯！',
    statBonus: { force: 20 },
    effect: {
      bladeDmgReduction: 0.08
    }
  },
  {
    id: 'bond_he_bei',
    name: '河北庭柱',
    requiredCount: 2,
    heroNames: ['颜良', '文丑', '张郃'],
    desc: '使我军全体武力、统率各提升 14 点，河北猛将撼阵！',
    statBonus: { force: 14, command: 14 },
    effect: {}
  },
  {
    id: 'bond_jiang_dong',
    name: '江东之英',
    requiredCount: 3,
    heroNames: ['孙坚', '孙策', '孙权', '孙尚香'],
    desc: '父子兄妹同心！使我军全体武力与统率各提升 15 点，强化攻防韧性！',
    statBonus: { force: 15, command: 15 },
    effect: {}
  },
  {
    id: 'bond_guo_se_tian_xiang',
    name: '国色天香',
    requiredCount: 3,
    heroNames: ['大乔', '小乔', '貂蝉', '甄姬'],
    desc: '绝代佳人！使我军全体速度提升 15 点，受到的所有伤害降低 6%！',
    statBonus: { speed: 15 },
    effect: {
      damageReduction: 0.06
    }
  },
  {
    id: 'bond_luan_shi_hong_yan',
    name: '乱世红颜',
    requiredCount: 3,
    heroNames: ['蔡文姬', '张春华', '王元姬', '吕玲绮'],
    desc: '红颜傲骨！使我军全体统率提升 16 点，受到男性武将的伤害降低 10%！',
    statBonus: { command: 16 },
    effect: {
      maleDmgReduction: 0.10
    }
  },
  {
    id: 'bond_shuang_xiong_po_zhen',
    name: '双雄破阵',
    requiredCount: 2,
    heroNames: ['关兴', '张苞'],
    desc: '二代名将义气凌云！关兴张苞同时上阵时，武力提升 15 点，战斗前 2 回合获得 2 次【抵御】！',
    statBonus: { force: 15 },
    effect: {
      prepShield: { count: 2, duration: 2 }
    }
  },
  {
    id: 'bond_hu_wei',
    name: '虎卫神威',
    requiredCount: 3,
    heroNames: ['曹操', '典韦', '许褚'],
    desc: '曹魏禁卫军之魂！使我军全体武力提升 15 点，受到兵刃伤害降低 12%！',
    statBonus: { force: 15 },
    effect: {
      bladeDmgReduction: 0.12
    }
  },
  {
    id: 'bond_lao_dang',
    name: '老当益壮',
    requiredCount: 3,
    heroNames: ['黄忠', '严颜', '黄盖', '程普'],
    desc: '烈士暮年壮心不已！使我军全体统率提升 21 点，受到暴击伤害降低 15%！',
    statBonus: { command: 21 },
    effect: {
      critDmgReduction: 0.15
    }
  },
  {
    id: 'bond_san_zu',
    name: '三足鼎立',
    requiredCount: 3,
    heroNames: ['刘备', '曹操', '孙权'],
    desc: '三皇聚首鼎立天下！战斗前 2 回合，使我军全体造成的伤害提升 16%，受到的伤害降低 16%！',
    statBonus: { force: 10, intel: 10, command: 10, speed: 10 },
    effect: {
      firstTwoRoundsDmgBonus: 0.16,
      firstTwoRoundsDmgReduction: 0.16
    }
  },
  {
    id: 'bond_xi_liang',
    name: '西凉霸雄',
    requiredCount: 2,
    heroNames: ['马超', '马云禄'],
    desc: '西凉锦马骁骑！使我军全体武力、速度各提升 15 点，战斗前 2 回合获得【必中】！',
    statBonus: { force: 15, speed: 15 },
    effect: {
      trueStrike: 2
    }
  },
  {
    id: 'bond_huang_jin',
    name: '黄巾之乱',
    requiredCount: 2,
    heroNames: ['张角', '张宝'],
    desc: '苍天已死黄天当立！使我军全体武力与智力各提升 12 点！',
    statBonus: { force: 12, intel: 12 },
    effect: {}
  },
  {
    id: 'bond_wei_zong',
    name: '曹魏宗族',
    requiredCount: 3,
    heroNames: ['曹操', '曹仁', '夏侯惇', '夏侯渊', '曹彰'],
    desc: '诸夏侯曹宗族血脉！使我军全体统率提升 16 点，战斗前 2 回合受到的兵刃伤害降低 8%！',
    statBonus: { command: 16 },
    effect: {
      bladeDmgReduction: 0.08
    }
  },
  {
    id: 'bond_chi_bi',
    name: '赤壁之战',
    requiredCount: 3,
    heroNames: ['周瑜', '诸葛亮', '黄盖'],
    desc: '谈笑间樯橹灰飞烟灭！使我军全体速度提升 15 点，主将谋略伤害提升 10%！',
    statBonus: { speed: 15 },
    effect: {
      leaderTacticalDmgBonus: 0.10
    }
  },
  {
    id: 'bond_guan_men',
    name: '将门虎女',
    requiredCount: 3,
    heroNames: ['关羽', '关银屏', '关平', '关兴'],
    desc: '武圣家风英烈辈出！使我军全体武力提升 15 点，造成的兵刃伤害提升 5%！',
    statBonus: { force: 15 },
    effect: {
      bladeDmgBonus: 0.05
    }
  }
];

/**
 * 依据队伍武将名字列表，检测激活的所有缘分羁绊
 * @param {Array<string>} heroNames 武将姓名数组
 * @returns {Array<Object>} 激活的缘分列表
 */
export function checkActiveBonds(heroNames) {
  if (!heroNames || heroNames.length < 2) return [];
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

