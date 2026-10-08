import type { DiceChallenge, DiceResult, GameState } from '../types/game';

// 奇遇与渡劫挑战事件题库 (扩充至 12 款传奇剧本，覆盖商战、救灾、学术、外交、探险、灵修等全流派)
export const ADVENTURE_CHALLENGES: DiceChallenge[] = [
  // 1. 凡俗与商战豪赌：古玩街赌石
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

  // 2. 现代义勇危机：勇斗恶徒
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

  // 3. 抢险救援：特大山洪泥石流
  {
    id: 'dice_flood_rescue',
    title: '特大山洪泥石流驾舟抢渡救援',
    description: '特大暴雨引发山洪暴发，下游村落被滔天浊浪围困，孤岛上有数名孩童呼救！你戴上头盔驾驶冲锋舟逆流而上！',
    category: 'crisis',
    targetDC: 13,
    checkAttr: 'strength',
    attrScale: 0.2,
    successReward: {
      logText: '【惊涛抢渡】冒着湍急漩涡与滚石，你精准驾舟往返抢运，全员安全转移！防汛指挥部为你记特等功！',
      statChanges: { strength: 15, charm: 15, luck: 10 },
      tagsGained: ['抗洪卫士'],
    },
    criticalSuccessReward: {
      logText: '【奇迹救生！】在巨浪拍碎船舷的危急时刻，你徒手固定缆绳力挽狂澜，拯救整村老幼，感动全国！',
      statChanges: { strength: 30, charm: 35, luck: 25 },
      tagsGained: ['人间守护者'],
    },
    failurePenalty: {
      logText: '【被卷入暗流】船体被巨木撞翻，你呛水并受轻度挫伤，好在后续救援队及时赶到脱险。',
      statChanges: { strength: -10, happiness: -10 },
    },
  },

  // 4. 水下寻宝：澜沧江茶马古道沉船
  {
    id: 'dice_shipwreck_treasure',
    title: '澜沧江茶马古道水下沉船秘宝',
    description: '大旱枯水期，澜沧江峡谷暗礁浮出一艘明代沉船残骸，传说载有进贡名贵瓷器与黄金。潜水勘探凶险万分！',
    category: 'adventure',
    targetDC: 14,
    checkAttr: 'luck',
    attrScale: 0.25,
    successReward: {
      logText: '【打捞告捷】避开江底潜流，你成功起获数箱保存完好的明代官窑霁蓝釉瓷器与古金条！',
      cashReward: 250,
      statChanges: { wealth: 20, luck: 15 },
      tagsGained: ['寻龙摸金'],
    },
    criticalSuccessReward: {
      logText: '【惊世重宝！】水底暗舱内赫然封存着失传数百年的传国青铜古玺与极品夜明珠，轰动世界文博界！',
      cashReward: 800,
      statChanges: { wealth: 45, luck: 30, charm: 15 },
      tagsGained: ['奇珍鉴藏宗师'],
    },
    failurePenalty: {
      logText: '【暗流脱险】水底水草缠绕氧气管，你果断割绳脱身浮出水面，设备报废空手而归。',
      statChanges: { wealth: -5, happiness: -10 },
    },
  },

  // 5. 商海博弈：华尔街做空狙击战
  {
    id: 'dice_short_squeeze',
    title: '商海绝杀 · 华尔街做空狙击战',
    description: '跨国做空机构联合黑公关恶意做空本土硬科技龙头，你洞察到底层财务破绽，决定调度资金发起史诗级逼空决战！',
    category: 'business_gamble',
    targetDC: 15,
    checkAttr: 'intelligence',
    attrScale: 0.18,
    successReward: {
      logText: '【史诗级逼空】多空交战决胜盘！做空巨头爆仓斩仓，天量买盘拉出涨停，你一役成名赚取巨额收益！',
      cashReward: 400,
      statChanges: { wealth: 25, intelligence: 15 },
      tagsGained: ['商海狙击手'],
    },
    criticalSuccessReward: {
      logText: '【血洗华尔街！】你全盘识破对手暗盘陷阱，反手吞并对手全部底仓，全球财经头条称你为东方投资传奇！',
      cashReward: 1200,
      statChanges: { wealth: 50, intelligence: 25, charm: 20 },
      tagsGained: ['传奇资本鳄鱼'],
    },
    failurePenalty: {
      logText: '【被对手暗算】国际大鳄临时追加恶意卖单，你的持仓被震荡洗盘亏损出局。',
      statChanges: { wealth: -15, happiness: -15 },
    },
  },

  // 6. 公关演说：反垄断跨国听证会
  {
    id: 'dice_diplomacy_antitrust',
    title: '跨国世纪反垄断听证会闭门辩护',
    description: '面对九国反垄断调查官与竞争对手的刁钻围剿，你代表集团在听证会上发表最终公开辩护！',
    category: 'diplomacy',
    targetDC: 15,
    checkAttr: 'charm',
    attrScale: 0.2,
    successReward: {
      logText: '【雄辩滔滔】你引经据典，以无懈可击的商业愿景与技术普惠逻辑征服全场，全票通过合规豁免！',
      statChanges: { charm: 25, wealth: 20, happiness: 15 },
      tagsGained: ['破壁纵横家'],
    },
    criticalSuccessReward: {
      logText: '【全球领袖风采！】你的演说被联合国贸发组织收录为经典范式，竞争对手心服口服主动撤诉寻求结盟！',
      statChanges: { charm: 45, wealth: 35, happiness: 25 },
      tagsGained: ['全球领袖风范'],
    },
    failurePenalty: {
      logText: '【听证受阻】面对多国条款陷阱，你虽据理力争但仍被处以暂缓经营审查令。',
      statChanges: { charm: -5, happiness: -15 },
    },
  },

  // 7. 前沿学术：室温超导突破攻关
  {
    id: 'dice_superconductor_breakthrough',
    title: '前沿实验室临界超导参数攻关',
    description: '低温强磁场实验室中，新型复合晶格在极限压力下突现电阻归零征兆！必须在数十个激变参数中精准微调高频退火曲线！',
    category: 'science',
    targetDC: 16,
    checkAttr: 'intelligence',
    attrScale: 0.2,
    successReward: {
      logText: '【突破物理壁垒！】晶格常数完美锁定，室温常压超导在你的操作下成功复现，《Nature》连夜加印特刊！',
      statChanges: { intelligence: 30, wealth: 20, happiness: 20 },
      tagsGained: ['大国重器奠基人'],
    },
    criticalSuccessReward: {
      logText: '【物理奇点降临！】超导临界温度突破极限，全球能源与量子算力发生革命，诺贝尔物理学奖为你虚席以待！',
      statChanges: { intelligence: 55, wealth: 40, luck: 25, happiness: 30 },
      tagsGained: ['时代破壁者'],
    },
    failurePenalty: {
      logText: '【临界相变坍塌】微观晶格在降温瞬间碎裂，核心高温探针烧损，科研攻关遗憾止步。',
      statChanges: { intelligence: -5, happiness: -15 },
    },
  },

  // 8. 医道仁心：罕见疫情分子靶向破译
  {
    id: 'dice_pandemic_cure',
    title: '突发罕见疫情生化分子靶向破译',
    description: '未知烈性呼吸道变异株蔓延，重症率高企。你带领生物医学团队在 P4 实验室日夜轮班，推演小分子靶向药结构式！',
    category: 'science',
    targetDC: 15,
    checkAttr: 'intelligence',
    attrScale: 0.22,
    successReward: {
      logText: '【药到病除】你成功筛选出纳摩尔级高亲和力靶向分子，临床试验治愈率超 98%，疫情被彻底阻断！',
      statChanges: { intelligence: 25, charm: 20, happiness: 20 },
      tagsGained: ['苍生大医'],
    },
    criticalSuccessReward: {
      logText: '【大医精诚！】你不仅合成了广谱特效药，更将专利无偿公开普惠全球，挽救千万苍生，万民铭记！',
      statChanges: { intelligence: 45, charm: 45, luck: 25, happiness: 30 },
      tagsGained: ['仁心济世药王'],
    },
    failurePenalty: {
      logText: '【动物模型失灵】合成前体分子在活体代谢中迅速降解，团队连续鏖战数日身心俱疲。',
      statChanges: { strength: -8, happiness: -15 },
    },
  },

  // 9. 华夏文工：故宫国宝残卷揭裱
  {
    id: 'dice_cultural_restoration',
    title: '故宫受损绝世残卷神级揭裱',
    description: '千年前唐宋书画残卷因水浸霉变脆弱不堪，稍有不慎便将化为齑粉。国家文博院急邀你施展独门古法揭裱接笔神技！',
    category: 'heritage',
    targetDC: 14,
    checkAttr: 'intelligence',
    attrScale: 0.2,
    successReward: {
      logText: '【天衣无缝】你屏气凝神，以微米级刀法逐层剥离霉斑并精准补绢，国宝重焕千年前的璀璨墨韵！',
      statChanges: { intelligence: 20, charm: 15, happiness: 15 },
      tagsGained: ['国宝守护神'],
    },
    criticalSuccessReward: {
      logText: '【妙手偶得！】在揭开底层托纸时，你竟意外发现卷轴夹层中暗藏的失传东晋王羲之墨宝真迹，惊艳当代！',
      statChanges: { intelligence: 35, charm: 30, luck: 20, happiness: 25 },
      tagsGained: ['天工神匠'],
    },
    failurePenalty: {
      logText: '【微有瑕疵】由于古绢氧化严重，拼接边缘出现微小墨色色差，你深感抱憾。',
      statChanges: { happiness: -10 },
    },
  },

  // 10. 灵气复苏：终南山隐秘古修洞府
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

  // 11. 玄门奇境：深海归墟龙宫大阵
  {
    id: 'dice_deepsea_dragon_palace',
    title: '深海归墟远古水府定海大阵',
    description: '万米海底大洋断裂带灵气暴涌，远古琉璃水府洞开，水行精气滔天咆哮，唯有道心通灵者方能平定水脉！',
    category: 'cultivation',
    targetDC: 18,
    checkAttr: 'spiritualRoot',
    attrScale: 0.25,
    successReward: {
      logText: '【御水成阵】你掌心引动四海水脉，降服狂暴暗流，水府石门洞开，获赠深海龙髓与定海奇珍！',
      statChanges: { spiritualRoot: 35, strength: 25, luck: 15 },
      tagsGained: ['沧海龙君'],
    },
    criticalSuccessReward: {
      logText: '【万水朝宗！】上古真龙遗蜕化作本命龙魂融入你的丹田，你举手投足号令汪洋江海，威仪盖世！',
      statChanges: { spiritualRoot: 65, strength: 45, charm: 25, luck: 30 },
      tagsGained: ['真龙天子'],
    },
    failurePenalty: {
      logText: '【深海重压】万米高压罡风震伤脏腑，你只得祭出保命灵符狼狈遁出海面。',
      statChanges: { strength: -15, spiritualRoot: -10, happiness: -20 },
    },
  },

  // 12. 修真终极大考：九九归一紫霄神雷劫
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

// 检查某个年龄是否有概率触发奇遇掷骰挑战 (支持多人生流派平滑匹配)
export function checkRandomDiceAdventure(state: GameState): DiceChallenge | null {
  const hasTag = (tag: string) => state.tags.includes(tag);

  // 1. 修仙飞升雷劫 (年龄>=45岁，灵根>=60，尚未羽化)
  if (
    state.age >= 45 &&
    (state.attrs.spiritualRoot || 0) >= 60 &&
    !hasTag('羽化登仙') &&
    Math.random() < 0.25
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_heavenly_tribulation') || null;
  }

  // 2. 深海归墟龙宫水府 (年龄>=35岁，灵根>=45)
  if (
    state.age >= 35 &&
    (state.attrs.spiritualRoot || 0) >= 45 &&
    !hasTag('沧海龙君') &&
    Math.random() < 0.2
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_deepsea_dragon_palace') || null;
  }

  // 3. 终南山古洞府仙缘 (年龄>=25岁，灵根>=25)
  if (
    state.age >= 25 &&
    (state.attrs.spiritualRoot || 0) >= 25 &&
    !hasTag('洞府传人') &&
    Math.random() < 0.18
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_ancient_cave') || null;
  }

  // 4. 室温超导科技攻关 (年龄 25~60，智力>=50)
  if (
    state.age >= 25 &&
    state.age <= 60 &&
    state.attrs.intelligence >= 50 &&
    !hasTag('大国重器奠基人') &&
    Math.random() < 0.15
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_superconductor_breakthrough') || null;
  }

  // 5. 华尔街做空狙击战 (年龄 24~65，家境>=35 且 智力>=30)
  if (
    state.age >= 24 &&
    state.age <= 65 &&
    state.attrs.wealth >= 35 &&
    state.attrs.intelligence >= 30 &&
    !hasTag('商海狙击手') &&
    Math.random() < 0.15
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_short_squeeze') || null;
  }

  // 6. 跨国反垄断听证会辩护 (年龄 28~65，魅力>=35 且 家境>=30)
  if (
    state.age >= 28 &&
    state.age <= 65 &&
    state.attrs.charm >= 35 &&
    state.attrs.wealth >= 30 &&
    !hasTag('破壁纵横家') &&
    Math.random() < 0.14
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_diplomacy_antitrust') || null;
  }

  // 7. 罕见疫情生化靶向药攻关 (年龄 26~65，智力>=40)
  if (
    state.age >= 26 &&
    state.age <= 65 &&
    state.attrs.intelligence >= 40 &&
    !hasTag('苍生大医') &&
    Math.random() < 0.14
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_pandemic_cure') || null;
  }

  // 8. 故宫国宝残卷神级揭裱 (年龄 22~70，智力>=30)
  if (
    state.age >= 22 &&
    state.age <= 70 &&
    state.attrs.intelligence >= 30 &&
    !hasTag('国宝守护神') &&
    Math.random() < 0.14
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_cultural_restoration') || null;
  }

  // 9. 澜沧江茶马古道沉船探秘 (年龄 20~60，运气>=30 或 家境>=20)
  if (
    state.age >= 20 &&
    state.age <= 60 &&
    (state.attrs.luck >= 30 || state.attrs.wealth >= 20) &&
    !hasTag('寻龙摸金') &&
    Math.random() < 0.15
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_shipwreck_treasure') || null;
  }

  // 10. 特大山洪泥石流抢渡救灾 (年龄 18~55，体魄>=25)
  if (
    state.age >= 18 &&
    state.age <= 55 &&
    state.attrs.strength >= 25 &&
    !hasTag('抗洪卫士') &&
    Math.random() < 0.14
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_flood_rescue') || null;
  }

  // 11. 古玩赌石捡漏 (年龄>=20，家境>=15)
  if (
    state.age >= 20 &&
    state.attrs.wealth >= 15 &&
    !hasTag('点石成金') &&
    Math.random() < 0.15
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_antique_gamble') || null;
  }

  // 12. 见义勇为勇斗恶徒 (年龄 16~50，体魄>=15)
  if (
    state.age >= 16 &&
    state.age <= 50 &&
    state.attrs.strength >= 15 &&
    !hasTag('英雄模范') &&
    Math.random() < 0.13
  ) {
    return ADVENTURE_CHALLENGES.find((c) => c.id === 'dice_heroic_rescue') || null;
  }

  return null;
}
