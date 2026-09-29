import type { DiceChallenge, DiceResult, GameState } from '../types/game';

// 奇遇与渡劫挑战事件题库
export const ADVENTURE_CHALLENGES: DiceChallenge[] = [
  // 1. 凡俗与商战豪赌
  {
    id: 'dice_antique_gamble',
    title: '古玩街绝世赌石捡漏',
    description: '潘家园地摊上出现了一块表面布满青苔的古拙原石，周围行家疑窦丛生。你观察良久，决定动用眼力与直觉下注！',
    category: 'business_gamble',
    targetDC: 14,
    checkAttr: 'intelligence',
    attrScale: 0.15,
    successReward: {
      logText: '【赌石大捷】一刀切下，满堂皆绿！原石内赫然开出极品玻璃种翡翠，当场被买家溢价收购！',
      cashReward: 200,
      statChanges: { wealth: 15, happiness: 10 },
      tagsGained: ['点石成金'],
    },
    criticalSuccessReward: {
      logText: '【传奇大暴击！】原石内不仅开出帝王绿，内部更嵌有千年温润古玉，引发全国收藏界轰动，估值暴涨！',
      cashReward: 800,
      statChanges: { wealth: 35, luck: 20, happiness: 20 },
      tagsGained: ['天下第一藏家'],
    },
    failurePenalty: {
      logText: '【看走眼了】切开后内部全是干枯白砂，你损失了这笔重金，引来围观众人唏嘘。',
      statChanges: { happiness: -10, wealth: -5 },
    },
  },

  // 2. 现代义勇危机
  {
    id: 'dice_heroic_rescue',
    title: '险境勇斗劫匪解救人质',
    description: '银行外突发持凶恶徒行凶，一名无辜孩童被逼至死角，命悬一线！生死关头，你挺身而出！',
    category: 'crisis',
    targetDC: 12,
    checkAttr: 'strength',
    attrScale: 0.2,
    successReward: {
      logText: '【见义勇为】你身手敏捷，一记扫堂腿精准夺下凶器并将恶徒制服，被授予见义勇为模范！',
      statChanges: { charm: 12, happiness: 15, luck: 10 },
      tagsGained: ['英雄模范'],
    },
    criticalSuccessReward: {
      logText: '【神勇无双！】你如天神降临，以极其干脆利落的擒拿将恶徒降服，全程被市民拍下登顶全网热搜第一！',
      statChanges: { charm: 30, happiness: 25, luck: 20 },
      tagsGained: ['国民大英雄'],
    },
    failurePenalty: {
      logText: '【负伤挂彩】搏斗中你不慎被锐器划伤，送医缝合数针，好在孩子化险为夷。',
      statChanges: { strength: -8, happiness: -5 },
    },
  },

  // 3. 灵气复苏：上古仙府秘境探宝
  {
    id: 'dice_ancient_cave',
    title: '终南山隐秘洞府得道机缘',
    description: '暴雨后终南山深处崩裂出一座灵光缭绕的汉代古修洞府，结界符文闪烁，正在呼唤有缘人破阵！',
    category: 'adventure',
    targetDC: 16,
    checkAttr: 'spiritualRoot',
    attrScale: 0.25,
    successReward: {
      logText: '【破阵得宝】你双手掐诀，体内灵气与结界产生玄妙共鸣，成功破开封印，拾得九转金丹与古修真卷！',
      statChanges: { spiritualRoot: 25, strength: 20, intelligence: 15 },
      tagsGained: ['洞府传人'],
    },
    criticalSuccessReward: {
      logText: '【天命归真！】整座古仙洞府彻底认你为主，仙泉洗髓伐骨，你肉身蜕变无垢道体，道行暴涨百年！',
      statChanges: { spiritualRoot: 50, strength: 40, intelligence: 30, luck: 25 },
      tagsGained: ['在世谪仙'],
    },
    failurePenalty: {
      logText: '【反噬震退】洞府禁制过于刚烈，你被护山雷光震飞数米，经脉隐隐作痛。',
      statChanges: { strength: -10, happiness: -10 },
    },
  },

  // 4. 修真终极大考：渡九重天劫雷劫
  {
    id: 'dice_heavenly_tribulation',
    title: '逆天抗鼎 · 九九归一紫霄神雷劫',
    description: '虚空乌云压顶，九道灭世神雷酝酿待发。此劫若过，褪去凡躯羽化登仙；若败，灰飞烟灭！',
    category: 'cultivation',
    targetDC: 20,
    checkAttr: 'spiritualRoot',
    attrScale: 0.2,
    successReward: {
      logText: '【引雷铸体 · 成功渡劫！】雷光散尽，祥云万道，你硬抗九道灭世劫雷，金丹化元婴，登顶凡间极境！',
      statChanges: { spiritualRoot: 30, strength: 30, happiness: 30 },
      tagsGained: ['真仙渡劫', '羽化登仙'],
    },
    criticalSuccessReward: {
      logText: '【逆乱阴阳 · 吞噬天劫！】你竟张口吞下整团劫云雷暴，化为九转神雷金丹，震碎虚空，三界同贺！',
      statChanges: { spiritualRoot: 60, strength: 60, charm: 30, luck: 30 },
      tagsGained: ['万古仙帝', '羽化登仙'],
    },
    failurePenalty: {
      logText: '【道体龟裂】神雷天威难以力抗，你的肉身遭受重创，险些道消身陨，只得燃烧本命精血遁逃。',
      statChanges: { strength: -25, spiritualRoot: -15, happiness: -20 },
      isDead: false,
    },
  },
];

// 执行 D20 骰子掷点运算
export function rollD20Check(
  challenge: DiceChallenge,
  attrs: GameState['attrs']
): DiceResult {
  const rawRoll = Math.floor(Math.random() * 20) + 1; // 1 ~ 20
  const attrVal = (attrs[challenge.checkAttr] as number) || 0;
  const attrBonus = Math.floor(attrVal * challenge.attrScale);
  const totalScore = rawRoll + attrBonus;

  const isCriticalSuccess = rawRoll === 20;
  const isCriticalFumble = rawRoll === 1;

  let isSuccess = false;
  if (isCriticalSuccess) {
    isSuccess = true;
  } else if (isCriticalFumble) {
    isSuccess = false;
  } else {
    isSuccess = totalScore >= challenge.targetDC;
  }

  return {
    rawRoll,
    attrBonus,
    totalScore,
    isCriticalSuccess,
    isCriticalFumble,
    isSuccess,
  };
}

// 检查某个年龄是否有概率触发奇遇掷骰挑战
export function checkRandomDiceAdventure(state: GameState): DiceChallenge | null {
  // 修仙渡劫特殊触发（若拥有灵根且年龄>=45岁，且尚未渡劫）
  if (
    state.age >= 45 &&
    (state.attrs.spiritualRoot || 0) >= 60 &&
    !state.tags.includes('羽化登仙') &&
    Math.random() < 0.25
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_heavenly_tribulation') || null;
  }

  // 终南山古洞府机缘（年龄>=28岁，灵根>=30）
  if (
    state.age >= 28 &&
    (state.attrs.spiritualRoot || 0) >= 30 &&
    !state.tags.includes('洞府传人') &&
    Math.random() < 0.18
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_ancient_cave') || null;
  }

  // 古玩赌石捡漏（成年后，财富>=20）
  if (
    state.age >= 20 &&
    state.attrs.wealth >= 20 &&
    !state.tags.includes('点石成金') &&
    Math.random() < 0.15
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_antique_gamble') || null;
  }

  // 见义勇为（16~50岁之间）
  if (
    state.age >= 16 &&
    state.age <= 50 &&
    !state.tags.includes('英雄模范') &&
    Math.random() < 0.12
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_heroic_rescue') || null;
  }

  return null;
}
