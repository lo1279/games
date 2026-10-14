import type { Partner, Child, FamilyState, GameState, Talent } from '../types/game';

// 候选伴侣人选库
export const CANDIDATE_PARTNERS: Omit<Partner, 'favorability' | 'isMarried'>[] = [
  {
    id: 'partner_waner',
    name: '林婉儿',
    identity: '青梅竹马 / 温婉知己',
    avatar: '🌸',
    annualBonusDesc: '相濡以沫，家庭温馨幸福，每年快乐 +8，体质 +2',
    reqAttr: { charm: 20 },
  },
  {
    id: 'partner_muyun',
    name: '苏慕云',
    identity: '创投女王 / 华尔街合伙人',
    avatar: '💼',
    annualBonusDesc: '坐拥庞大商脉，每年为你提供绝佳投资内幕，财富 +5，理财收益额外提升',
    reqAttr: { intelligence: 40, wealth: 30 },
  },
  {
    id: 'partner_luoxue',
    name: '白洛雪',
    identity: '名门望族唯一掌上明珠',
    avatar: '👑',
    annualBonusDesc: '豪门贵气庇护，逢凶化吉，每年家境声望提升，气运 +6',
    reqAttr: { charm: 45, wealth: 50 },
  },
  {
    id: 'partner_ningbing',
    name: '萧凝冰',
    identity: '隐世古武宗门亲传 / 冰魄仙子',
    avatar: '❄️',
    annualBonusDesc: '传授双修吐纳心法，每年灵根 +5，体质 +5，突破天劫成功率大增',
    reqAttr: { spiritualRoot: 30, strength: 30 },
  },
];

// 默认家族状态初始化
export function createDefaultFamilyState(generation: number = 1): FamilyState {
  return {
    partner: null,
    children: [],
    familyPrestige: generation > 1 ? 50 * generation : 10,
    generation,
  };
}

// 提升伴侣好感度（送礼/约会互动）
export function interactWithPartner(
  family: FamilyState,
  cash: number
): { success: boolean; newFamily: FamilyState; cashSpent: number; error?: string } {
  if (!family.partner) {
    return { success: false, newFamily: family, cashSpent: 0, error: '当前尚未确立恋爱对象！' };
  }

  const cost = 2; // 约会消费 2 万元
  if (cash < cost) {
    return { success: false, newFamily: family, cashSpent: 0, error: '资金不足以筹备浪漫约会！需 2 万元现金' };
  }

  const newFavor = Math.min(100, family.partner.favorability + 15);
  const updatedPartner: Partner = {
    ...family.partner,
    favorability: newFavor,
  };

  return {
    success: true,
    newFamily: {
      ...family,
      partner: updatedPartner,
    },
    cashSpent: cost,
  };
}

// 向伴侣求婚
export function proposeToPartner(
  family: FamilyState,
  cash: number
): { success: boolean; newFamily: FamilyState; cashSpent: number; error?: string } {
  if (!family.partner) {
    return { success: false, newFamily: family, cashSpent: 0, error: '尚未遇到意中人！' };
  }
  if (family.partner.isMarried) {
    return { success: false, newFamily: family, cashSpent: 0, error: '你们已经结为连理，恩爱如初！' };
  }
  if (family.partner.favorability < 60) {
    return { success: false, newFamily: family, cashSpent: 0, error: `好感度不足(${family.partner.favorability}/60)，对方觉得进展太快了！` };
  }

  const weddingCost = 10; // 婚礼花费 10 万元
  if (cash < weddingCost) {
    return { success: false, newFamily: family, cashSpent: 0, error: `举办体面婚礼需要 ${weddingCost} 万元资金！` };
  }

  const updatedPartner: Partner = {
    ...family.partner,
    isMarried: true,
    favorability: 100,
  };

  return {
    success: true,
    newFamily: {
      ...family,
      partner: updatedPartner,
      familyPrestige: family.familyPrestige + 30,
    },
    cashSpent: weddingCost,
  };
}

// 孕育/诞生新子女
export function giveBirthToChild(
  family: FamilyState,
  childName: string,
  inheritedTalent?: Talent
): { success: boolean; newFamily: FamilyState; error?: string } {
  if (!family.partner || !family.partner.isMarried) {
    return { success: false, newFamily: family, error: '需先与伴侣喜结连理方可诞下子嗣！' };
  }
  if (family.children.length >= 3) {
    return { success: false, newFamily: family, error: '儿女绕膝已达上限（最多 3 位子女）！' };
  }

  const gender: '男' | '女' = Math.random() > 0.5 ? '男' : '女';
  const defaultNames = gender === '男' ? ['陈子昂', '陈星宇', '陈逸飞'] : ['陈念慈', '陈诗韵', '陈若曦'];
  const name = childName.trim() || defaultNames[family.children.length % defaultNames.length];

  const newChild: Child = {
    id: `child_${Date.now()}`,
    name,
    gender,
    age: 0,
    educationTrend: 'science',
    talentInherited: inheritedTalent,
    potential: Math.floor(60 + Math.random() * 35),
  };

  return {
    success: true,
    newFamily: {
      ...family,
      children: [...family.children, newChild],
      familyPrestige: family.familyPrestige + 20,
    },
  };
}

// 每年伴侣与子女发展年结算
export function settleYearlyFamily(state: GameState): {
  updatedFamily: FamilyState;
  news: string[];
  statBonuses: Partial<Record<string, number>>;
} {
  const family = { ...state.family };
  const news: string[] = [];
  const statBonuses: Record<string, number> = {};

  // 1. 伴侣加成
  if (family.partner && family.partner.isMarried) {
    if (family.partner.id === 'partner_waner') {
      statBonuses.happiness = (statBonuses.happiness || 0) + 8;
      statBonuses.strength = (statBonuses.strength || 0) + 2;
    } else if (family.partner.id === 'partner_muyun') {
      statBonuses.wealth = (statBonuses.wealth || 0) + 6;
      news.push(`💼 伴侣苏慕云引荐顶尖风投人脉，你的商业与财富稳步扩张。`);
    } else if (family.partner.id === 'partner_luoxue') {
      statBonuses.luck = (statBonuses.luck || 0) + 6;
      statBonuses.charm = (statBonuses.charm || 0) + 4;
    } else if (family.partner.id === 'partner_ningbing') {
      statBonuses.spiritualRoot = (statBonuses.spiritualRoot || 0) + 5;
      statBonuses.strength = (statBonuses.strength || 0) + 5;
      news.push(`❄️ 萧凝冰与你月下运转周天玄功，体内灵根与经脉愈发澄澈！`);
    }
  }

  // 2. 子女岁数递增与成长
  const updatedChildren = family.children.map((c) => {
    const nextAge = c.age + 1;
    if (nextAge === 18) {
      news.push(`🎓 子女【${c.name}】已长大成人，自名校毕业，准备光耀门楣！`);
    }
    return { ...c, age: nextAge };
  });
  family.children = updatedChildren;

  return {
    updatedFamily: family,
    news,
    statBonuses,
  };
}

// 终局【家族世代继承】：将第一代财富、房产、声望与核心天赋遗传给子女，开启二代人生
export function createInheritedGame(parentState: GameState, chosenChild: Child): {
  inheritedTalent: Talent | null;
  startingCash: number;
  startingWealthAttr: number;
  generation: number;
} {
  // 继承 30% 家族现金遗产
  const startingCash = Math.round((parentState.assets?.cash || 0) * 0.3 * 10) / 10;
  // 继承名门家境属性
  const startingWealthAttr = Math.min(80, Math.floor(parentState.attrs.wealth * 0.4) + 15);
  // 继承的核心天赋
  const inheritedTalent = chosenChild.talentInherited || parentState.selectedTalents[0] || null;

  return {
    inheritedTalent,
    startingCash,
    startingWealthAttr,
    generation: parentState.family.generation + 1,
  };
}
