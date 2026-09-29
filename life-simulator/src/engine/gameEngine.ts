import type { Attributes, AttributeKey, GameState, LifeLog, Talent, LogType, LifeDecision, DiceResult } from '../types/game';
import { TALENTS_POOL } from '../data/talents';
import { EVENTS_POOL } from '../data/events';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import { createDefaultAssets, settleYearlyFinances } from './marketEngine';
import { loadKarmaState } from './karmaEngine';
import { createDefaultFamilyState, settleYearlyFamily } from './familyEngine';
import { checkRandomDiceAdventure } from './adventureEngine';

const ACHIEVEMENTS_STORAGE_KEY = 'life_simulator_unlocked_achievements';

// 安全兼容微信小程序与普通浏览器存储
export function loadSavedAchievements(): string[] {
  try {
    // 微信小程序环境兼容
    const wxObj = typeof window !== 'undefined' ? (window as unknown as { wx?: { getStorageSync?: (k: string) => unknown } }).wx : undefined;
    if (wxObj?.getStorageSync) {
      const data = wxObj.getStorageSync(ACHIEVEMENTS_STORAGE_KEY);
      if (Array.isArray(data)) return data as string[];
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // 忽略异常
  }
  return [];
}

// 缓存已解锁成就到本地（同时支持 H5 与微信小程序）
export function saveAchievements(ids: string[]): void {
  try {
    const wxObj = typeof window !== 'undefined' ? (window as unknown as { wx?: { setStorageSync?: (k: string, v: unknown) => void } }).wx : undefined;
    if (wxObj?.setStorageSync) {
      wxObj.setStorageSync(ACHIEVEMENTS_STORAGE_KEY, ids);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {
    // 忽略异常
  }
}

// 从天赋池抽取随机 10 个天赋（带保底与稀有度权重，包含已解锁神级专属天赋）
export function drawRandomTalents(): Talent[] {
  const karma = loadKarmaState();
  const unlockedDivine = karma.upgrades.unlockedDivineTalents || [];

  // 基础天赋池 + 仅包含玩家已解锁的神级专属天赋
  const pool = TALENTS_POOL.filter((t) => {
    if (t.id.startsWith('divine_')) {
      return unlockedDivine.includes(t.id);
    }
    return true;
  });

  // 洗牌
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10);
}

// 创建全新游戏初始化状态（支持家族世代继承参数）
export function createNewGame(
  existingAchievements?: string[],
  inheritedOptions?: {
    inheritedTalent?: Talent | null;
    startingCash?: number;
    startingWealthAttr?: number;
    generation?: number;
  }
): GameState {
  const preservedAchievements = existingAchievements ?? loadSavedAchievements();
  const karma = loadKarmaState();
  const generation = inheritedOptions?.generation || 1;

  const baseWealth = (inheritedOptions?.startingWealthAttr ?? 0) + karma.upgrades.goldSpoonLevel * 10;
  const initialAssets = createDefaultAssets(karma.upgrades.goldSpoonLevel, baseWealth);
  if (inheritedOptions?.startingCash) {
    initialAssets.cash += inheritedOptions.startingCash;
  }

  const baseTalents = drawRandomTalents();
  const preselectedTalents: Talent[] = [];
  if (inheritedOptions?.inheritedTalent) {
    preselectedTalents.push(inheritedOptions.inheritedTalent);
    if (!baseTalents.some((t) => t.id === inheritedOptions.inheritedTalent!.id)) {
      baseTalents.unshift(inheritedOptions.inheritedTalent);
    }
  }

  return {
    phase: 'talent',
    age: 0,
    gender: Math.random() > 0.5 ? '男' : '女',
    name: '李逍遥',
    isDead: false,
    deathReason: '',
    career: '学生',
    education: '未上学',
    attrs: {
      charm: 0,
      intelligence: 0,
      strength: 0,
      wealth: baseWealth,
      happiness: 50,
      luck: 50,
      spiritualRoot: 0,
    },
    selectedTalents: preselectedTalents,
    allTalentsPool: baseTalents,
    tags: generation > 1 ? [`名门世家第${generation}代`] : [],
    logs: [],
    currentDecision: null,
    autoPlay: false,
    playSpeedMs: 1000,
    achievements: ALL_ACHIEVEMENTS,
    unlockedAchievementIds: preservedAchievements,
    assets: initialAssets,
    family: createDefaultFamilyState(generation),
    currentChallenge: null,
  };
}

// 属性 Clamp 保证在合理阈值
export function clampAttrs(attrs: Attributes): Attributes {
  return {
    charm: Math.max(0, Math.min(200, Math.round(attrs.charm))),
    intelligence: Math.max(0, Math.min(200, Math.round(attrs.intelligence))),
    strength: Math.max(0, Math.min(200, Math.round(attrs.strength))),
    wealth: Math.max(0, Math.min(200, Math.round(attrs.wealth))),
    happiness: Math.max(0, Math.min(100, Math.round(attrs.happiness))),
    luck: Math.max(0, Math.min(100, Math.round(attrs.luck))),
    spiritualRoot: attrs.spiritualRoot ? Math.max(0, Math.min(100, Math.round(attrs.spiritualRoot))) : 0,
  };
}

// 检查并解锁人生成就
export function checkAchievements(state: GameState): { updatedUnlocked: string[]; newAchievements: string[] } {
  const unlocked = new Set(state.unlockedAchievementIds);
  const newlyUnlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  };

  check('ach_century', state.age >= 100);
  check('ach_immortal', state.tags.includes('羽化登仙'));
  check('ach_billionaire', state.attrs.wealth >= 100);
  check('ach_scholar', state.attrs.intelligence >= 100);
  check('ach_superstar', state.attrs.charm >= 100);
  check('ach_iron_body', state.attrs.strength >= 100);
  check('ach_peaceful', state.age >= 80 && state.attrs.happiness >= 85);
  check('ach_early_fall', state.isDead && state.age < 18);
  check('ach_luckiest', state.attrs.luck >= 90);
  check('ach_startup_legend', state.tags.includes('商海弄潮儿') || state.tags.includes('投资神话'));
  check('ach_high_exam', state.tags.includes('高考状元'));

  const updatedList = Array.from(unlocked);
  if (newlyUnlocked.length > 0) {
    saveAchievements(updatedList);
  }

  return {
    updatedUnlocked: updatedList,
    newAchievements: newlyUnlocked,
  };
}

// 完成天赋选择，进入加点阶段
export function applyTalentSelection(state: GameState, selected: Talent[]): GameState {
  return {
    ...state,
    selectedTalents: selected,
    phase: 'alloc',
  };
}

// 完成加点，开始 0 岁推演
export function startLifeWithAttributes(
  state: GameState,
  allocated: { charm: number; intelligence: number; strength: number; wealth: number },
  name: string,
  gender: '男' | '女'
): GameState {
  // 合并基础点数 + 天赋增益
  let combined: Attributes = {
    charm: allocated.charm,
    intelligence: allocated.intelligence,
    strength: allocated.strength,
    wealth: allocated.wealth,
    happiness: 50,
    luck: 50,
    spiritualRoot: 0,
  };

  const initialTags: string[] = [];

  state.selectedTalents.forEach((talent) => {
    initialTags.push(talent.name);
    if (talent.statBonus) {
      (Object.keys(talent.statBonus) as (keyof Attributes)[]).forEach((key) => {
        combined[key] = (combined[key] || 0) + (talent.statBonus?.[key] || 0);
      });
    }
  });

  combined = clampAttrs(combined);
  // 出生生命力兜底：体质至少为 5，快乐至少为 10，避免因极端加点瞬间夭折
  combined.strength = Math.max(5, combined.strength);
  combined.happiness = Math.max(10, combined.happiness);

  const initialLog: LifeLog = {
    id: `log_0_${Date.now()}`,
    age: 0,
    content: `${name} 出生了，是一个健康活泼的${gender}孩。伴随着一声啼哭，波澜壮阔的人生正式拉开序幕！`,
    type: 'milestone',
  };

  const nextState: GameState = {
    ...state,
    name,
    gender,
    phase: 'playing',
    age: 0,
    attrs: combined,
    tags: initialTags,
    logs: [initialLog],
  };

  const { updatedUnlocked } = checkAchievements(nextState);
  nextState.unlockedAchievementIds = updatedUnlocked;

  return nextState;
}

// 执行“下一年”年轮演进
export function advanceOneYear(state: GameState): GameState {
  if (state.isDead || state.phase !== 'playing') {
    return state;
  }

  const nextAge = state.age + 1;
  let currentAttrs = { ...state.attrs };
  let isDead = false;
  let deathReason = '';
  const newTags = [...state.tags];

  const isCultivator = state.tags.includes('羽化登仙') || state.tags.includes('金丹大道');

  // 1. 判定死亡事件
  // 极端体质耗尽 (<=0)
  if (currentAttrs.strength <= 0) {
    isDead = true;
    deathReason = '因身体机能彻底衰竭、重疾难愈，遗憾离世。';
  } else if (currentAttrs.happiness <= 0) {
    isDead = true;
    deathReason = '因长期极度抑郁崩溃、万念俱灰，心力交瘁而终。';
  } else if (nextAge >= 75) {
    // 高龄自然衰老概率判定
    if (isCultivator) {
      // 修仙者享有超凡寿元，120 岁前不受凡人寿元限制
      if (nextAge >= 120 && !state.tags.includes('羽化登仙')) {
        const cultivatorRoll = Math.random() * 100;
        if (cultivatorRoll < 20) {
          isDead = true;
          deathReason = `仙道漫漫，寿元大限已至，在灵气氤氲中坐化道消，享年 ${nextAge} 岁。`;
        }
      }
    } else {
      // 凡人自然寿命曲线
      let deathRate = 5;
      if (nextAge < 90) {
        deathRate = Math.min(65, Math.max(5, (nextAge - 70) * 3.5 - (currentAttrs.strength * 0.2) - (currentAttrs.luck * 0.1)));
      } else if (nextAge < 100) {
        deathRate = Math.min(85, Math.max(30, (nextAge - 85) * 6 - (currentAttrs.strength * 0.15)));
      } else if (nextAge < 108) {
        deathRate = Math.min(95, Math.max(60, (nextAge - 98) * 12));
      } else {
        // 凡人 108 岁以上必定安详圆满辞世
        deathRate = 100;
      }

      const roll = Math.random() * 100;
      if (roll < deathRate) {
        isDead = true;
        deathReason = nextAge >= 100
          ? `历经一整个世纪的世事沧桑，福寿全归，在子孙环伺中安详仙逝，享年 ${nextAge} 岁。`
          : `在睡梦中平静祥和地告别了人世，福寿圆满，享年 ${nextAge} 岁。`;
      }
    }
  }

  if (isDead) {
    const deathLog: LifeLog = {
      id: `log_dead_${Date.now()}`,
      age: nextAge,
      content: `【终局时刻】${deathReason}`,
      type: 'danger',
    };
    const finalState: GameState = {
      ...state,
      age: nextAge,
      isDead: true,
      deathReason,
      phase: 'summary',
      autoPlay: false,
      logs: [...state.logs, deathLog],
    };
    const { updatedUnlocked } = checkAchievements(finalState);
    finalState.unlockedAchievementIds = updatedUnlocked;
    return finalState;
  }

  // 2. 匹配当前年龄的事件
  const matchingEvents = EVENTS_POOL.filter((e) => {
    if (nextAge < e.minAge || nextAge > e.maxAge) return false;
    if (e.condition && !e.condition({ ...state, age: nextAge, attrs: currentAttrs })) return false;
    return true;
  });

  let selectedEvent = matchingEvents[0];
  if (matchingEvents.length > 1) {
    // 权重抽选
    const totalWeight = matchingEvents.reduce((acc, cur) => acc + cur.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const evt of matchingEvents) {
      rand -= evt.weight;
      if (rand <= 0) {
        selectedEvent = evt;
        break;
      }
    }
  }

  // 如果没有具体事件，按年龄阶段生成多样化的写实风情记录
  const getFallbackDesc = (age: number) => {
    if (age <= 18) {
      const youngPool = [
        `${age}岁，书声琅琅，操场微风拂面，你在单纯而充实的青春岁月中拔节成长。`,
        `${age}岁，与三两发小畅谈未来，日子在纸飞机与金黄晚霞中悄然滑过。`,
        `${age}岁，求知若渴，在课本与百科全书之间探寻世界未知的奥秘。`,
      ];
      return youngPool[age % youngPool.length];
    } else if (age <= 35) {
      const youthPool = [
        `${age}岁，踏实奋斗，在职场探索与城市烟火气息中稳步积攒底蕴。`,
        `${age}岁，偶尔与老友小聚品尝家常小炒，在快节奏生活中坚守内心的宁静。`,
        `${age}岁，读了几本开卷有益的好书，对人生方向有了更清晰笃定的认知。`,
      ];
      return youthPool[age % youthPool.length];
    } else if (age <= 60) {
      const midPool = [
        `${age}岁，家庭事业从容运转，阅历渐丰，待人接物多了一份泰然自若。`,
        `${age}岁，闲暇时侍弄阳台花木，生活波澜不惊，岁月恬淡安然。`,
        `${age}岁，坚持日常锻炼与健康饮食，陪伴家人左右，日子过得有滋有味。`,
      ];
      return midPool[age % midPool.length];
    } else {
      const seniorPool = [
        `${age}岁，晨起散步打拳品茗，看云卷云舒，安享含饴弄孙的恬淡天伦。`,
        `${age}岁，身心健朗，精神矍铄，安然品味宁静祥和的银发岁月。`,
        `${age}岁，邻里和睦，常同老友下棋回忆往事，知足常乐福泽绵长。`,
      ];
      return seniorPool[age % seniorPool.length];
    }
  };

  let eventResult: {
    content: string;
    type: LogType;
    statChanges?: Partial<Record<AttributeKey, number>>;
    tagsGained?: string[];
    isDead?: boolean;
    deathReason?: string;
    triggerDecision?: LifeDecision;
  } = {
    content: getFallbackDesc(nextAge),
    type: 'normal',
    statChanges: undefined,
    tagsGained: undefined,
    isDead: false,
    deathReason: '',
    triggerDecision: undefined,
  };

  if (selectedEvent) {
    const res = selectedEvent.execute({ ...state, age: nextAge, attrs: currentAttrs });
    eventResult = { ...eventResult, ...res };
  }

  // 结算属性变化
  if (eventResult.statChanges) {
    (Object.keys(eventResult.statChanges) as AttributeKey[]).forEach((key) => {
      const delta = eventResult.statChanges?.[key] || 0;
      currentAttrs[key] = (currentAttrs[key] || 0) + delta;
    });
    currentAttrs = clampAttrs(currentAttrs);
  }

  if (eventResult.tagsGained) {
    eventResult.tagsGained.forEach((tag) => {
      if (!newTags.includes(tag)) newTags.push(tag);
    });
  }

  // 构建日志
  const currentLog: LifeLog = {
    id: `log_${nextAge}_${Date.now()}`,
    age: nextAge,
    content: eventResult.content,
    type: eventResult.type || 'normal',
    statChanges: eventResult.statChanges,
    tagsGained: eventResult.tagsGained,
  };

  const updatedLogs = [...state.logs, currentLog];

  // 检查是否由事件导致死亡（如渡劫飞升或意外）
  if (eventResult.isDead) {
    const finalState: GameState = {
      ...state,
      age: nextAge,
      attrs: currentAttrs,
      tags: newTags,
      isDead: true,
      deathReason: eventResult.deathReason || '突发意外离世',
      phase: 'summary',
      autoPlay: false,
      logs: updatedLogs,
    };
    const { updatedUnlocked } = checkAchievements(finalState);
    finalState.unlockedAchievementIds = updatedUnlocked;
    return finalState;
  }

  // 检查是否触发了决策
  if (eventResult.triggerDecision) {
    return {
      ...state,
      age: nextAge,
      attrs: currentAttrs,
      tags: newTags,
      phase: 'decision',
      currentDecision: eventResult.triggerDecision,
      autoPlay: false, // 决策时自动暂停
      logs: updatedLogs,
    };
  }

  // 轮回神殿神级天赋：【天道酬勤】每年全属性额外 +1
  if (state.tags.includes('天道酬勤')) {
    currentAttrs.charm += 1;
    currentAttrs.intelligence += 1;
    currentAttrs.strength += 1;
    currentAttrs.wealth += 1;
    currentAttrs = clampAttrs(currentAttrs);
  }

  // 18岁成年后激活【商海资产与理财/创业年结算】
  let updatedAssets = state.assets;
  if (nextAge >= 18 && updatedAssets) {
    const { updatedAssets: newAssets, settlement, newTags: financeTags } = settleYearlyFinances({
      ...state,
      age: nextAge,
      attrs: currentAttrs,
      tags: newTags,
    });
    updatedAssets = newAssets;
    financeTags.forEach((t) => {
      if (!newTags.includes(t)) newTags.push(t);
    });

    // 如果当年有重大理财/创业/破产/敲钟新闻，追加一条动态提示
    if (settlement.news.length > 0) {
      updatedLogs.push({
        id: `finance_${nextAge}_${Date.now()}`,
        age: nextAge,
        content: `【商海动向】${settlement.news.join(' ')}`,
        type: settlement.news.some((n) => n.includes('爆仓') || n.includes('亏损')) ? 'warning' : 'positive',
      });
    }
  }

  // 伴侣与家族年发展结算 (方案2)
  let updatedFamily = state.family;
  if (state.family) {
    const { updatedFamily: newFamily, news: familyNews, statBonuses } = settleYearlyFamily({
      ...state,
      age: nextAge,
      attrs: currentAttrs,
      tags: newTags,
    });
    updatedFamily = newFamily;
    Object.entries(statBonuses).forEach(([k, v]) => {
      const key = k as AttributeKey;
      if (typeof v === 'number') {
        currentAttrs[key] = (currentAttrs[key] || 0) + v;
      }
    });
    currentAttrs = clampAttrs(currentAttrs);
    if (familyNews.length > 0) {
      updatedLogs.push({
        id: `fam_${nextAge}_${Date.now()}`,
        age: nextAge,
        content: `【家族锦绣】${familyNews.join(' ')}`,
        type: 'positive',
      });
    }
  }

  // 奇遇与渡劫 D20 骰子掷点挑战判定 (方案3)
  const triggeredChallenge = checkRandomDiceAdventure({
    ...state,
    age: nextAge,
    attrs: currentAttrs,
    tags: newTags,
  });

  if (triggeredChallenge) {
    return {
      ...state,
      age: nextAge,
      attrs: currentAttrs,
      tags: newTags,
      assets: updatedAssets,
      family: updatedFamily,
      phase: 'challenge',
      currentChallenge: triggeredChallenge,
      autoPlay: false,
      logs: updatedLogs,
    };
  }

  // 常规推进
  const nextState: GameState = {
    ...state,
    age: nextAge,
    attrs: currentAttrs,
    tags: newTags,
    assets: updatedAssets,
    family: updatedFamily,
    logs: updatedLogs,
  };

  const { updatedUnlocked } = checkAchievements(nextState);
  nextState.unlockedAchievementIds = updatedUnlocked;

  return nextState;
}

// 解决 D20 奇遇掷点挑战结果 (方案3)
export function resolveDiceChallenge(state: GameState, result: DiceResult): GameState {
  if (!state.currentChallenge) return state;

  const challenge = state.currentChallenge;
  let currentAttrs = { ...state.attrs };
  let currentAssets = { ...state.assets };
  const newTags = [...state.tags];
  let isDead = false;
  let deathReason = '';

  let rewardText = '';
  let logType: LogType = 'special';

  if (result.isCriticalSuccess) {
    const rew = challenge.criticalSuccessReward;
    rewardText = rew.logText;
    logType = 'milestone';
    if (rew.statChanges) {
      Object.entries(rew.statChanges).forEach(([k, v]) => {
        const key = k as AttributeKey;
        currentAttrs[key] = (currentAttrs[key] || 0) + v;
      });
    }
    if (rew.tagsGained) {
      rew.tagsGained.forEach((t) => {
        if (!newTags.includes(t)) newTags.push(t);
      });
    }
    if (rew.cashReward) {
      currentAssets.cash += rew.cashReward;
    }
  } else if (result.isSuccess) {
    const rew = challenge.successReward;
    rewardText = rew.logText;
    logType = 'positive';
    if (rew.statChanges) {
      Object.entries(rew.statChanges).forEach(([k, v]) => {
        const key = k as AttributeKey;
        currentAttrs[key] = (currentAttrs[key] || 0) + v;
      });
    }
    if (rew.tagsGained) {
      rew.tagsGained.forEach((t) => {
        if (!newTags.includes(t)) newTags.push(t);
      });
    }
    if (rew.cashReward) {
      currentAssets.cash += rew.cashReward;
    }
  } else {
    const pen = challenge.failurePenalty;
    rewardText = pen.logText;
    logType = 'warning';
    if (pen.statChanges) {
      Object.entries(pen.statChanges).forEach(([k, v]) => {
        const key = k as AttributeKey;
        currentAttrs[key] = (currentAttrs[key] || 0) + v;
      });
    }
    if (pen.isDead) {
      isDead = true;
      deathReason = pen.deathReason || '在奇遇风暴中不幸殒落';
    }
  }

  currentAttrs = clampAttrs(currentAttrs);

  const challengeLog: LifeLog = {
    id: `dice_${state.age}_${Date.now()}`,
    age: state.age,
    content: `【D20 奇遇检定】掷出 ${result.rawRoll} 点 (+${result.attrBonus}) ➔ ${rewardText}`,
    type: logType,
  };

  const updatedLogs = [...state.logs, challengeLog];

  if (isDead) {
    const finalState: GameState = {
      ...state,
      attrs: currentAttrs,
      assets: currentAssets,
      tags: newTags,
      isDead: true,
      deathReason,
      phase: 'summary',
      currentChallenge: null,
      autoPlay: false,
      logs: updatedLogs,
    };
    const { updatedUnlocked } = checkAchievements(finalState);
    finalState.unlockedAchievementIds = updatedUnlocked;
    return finalState;
  }

  const nextState: GameState = {
    ...state,
    attrs: currentAttrs,
    assets: currentAssets,
    tags: newTags,
    phase: 'playing',
    currentChallenge: null,
    logs: updatedLogs,
  };

  const { updatedUnlocked } = checkAchievements(nextState);
  nextState.unlockedAchievementIds = updatedUnlocked;
  return nextState;
}

// 玩家在决策弹窗中做出选择
export function resolveDecision(state: GameState, optionId: string): GameState {
  if (!state.currentDecision) return state;

  const option = state.currentDecision.options.find((o) => o.id === optionId);
  if (!option) return state;

  const result = option.execute(state);

  let currentAttrs = { ...state.attrs };
  if (result.statChanges) {
    (Object.keys(result.statChanges) as AttributeKey[]).forEach((key) => {
      currentAttrs[key] = (currentAttrs[key] || 0) + (result.statChanges?.[key] || 0);
    });
    currentAttrs = clampAttrs(currentAttrs);
  }

  const newTags = [...state.tags];
  if (result.tagsGained) {
    result.tagsGained.forEach((tag) => {
      if (!newTags.includes(tag)) newTags.push(tag);
    });
  }

  const decisionLog: LifeLog = {
    id: `log_choice_${state.age}_${Date.now()}`,
    age: state.age,
    content: `【人生抉择】你选择了「${option.text}」—— ${result.logText}`,
    type: result.logType || 'special',
    statChanges: result.statChanges,
    tagsGained: result.tagsGained,
  };

  const updatedLogs = [...state.logs, decisionLog];

  if (result.isDead) {
    const finalState: GameState = {
      ...state,
      attrs: currentAttrs,
      tags: newTags,
      isDead: true,
      deathReason: result.deathReason || '在重大抉择中遭遇意外离世',
      phase: 'summary',
      currentDecision: null,
      autoPlay: false,
      logs: updatedLogs,
    };
    const { updatedUnlocked } = checkAchievements(finalState);
    finalState.unlockedAchievementIds = updatedUnlocked;
    return finalState;
  }

  const nextState: GameState = {
    ...state,
    attrs: currentAttrs,
    tags: newTags,
    phase: 'playing',
    currentDecision: null,
    logs: updatedLogs,
  };

  const { updatedUnlocked } = checkAchievements(nextState);
  nextState.unlockedAchievementIds = updatedUnlocked;

  return nextState;
}
