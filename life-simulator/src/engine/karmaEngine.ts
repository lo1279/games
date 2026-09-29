import type { KarmaState, KarmaUpgrades, GameState } from '../types/game';

const KARMA_STORAGE_KEY = 'life_simulator_karma_state';

// 默认局外养成状态
export const DEFAULT_KARMA_STATE: KarmaState = {
  karmaCoins: 0,
  totalKarmaEarned: 0,
  reincarnationCount: 0,
  upgrades: {
    extraAttrPointsLevel: 0,
    extraTalentSlotsLevel: 0,
    goldSpoonLevel: 0,
    unlockedDivineTalents: [],
  },
};

// 升级所需功德消耗阶梯
export const UPGRADE_CONFIG = {
  extraAttrPointsLevel: {
    title: '天生灵根',
    desc: '每一世出生时，自由可分配属性点数 +2 点',
    maxLevel: 5,
    costs: [100, 250, 500, 1000, 2000],
    getEffectDesc: (lvl: number) => `额外分配点数 +${lvl * 2}（基础20点，当前${20 + lvl * 2}点）`,
  },
  extraTalentSlotsLevel: {
    title: '宿命机缘',
    desc: '逆天改命，转生时可勾选的天赋数量增加',
    maxLevel: 2,
    costs: [500, 1500],
    getEffectDesc: (lvl: number) => `可选天赋数量：${3 + lvl} 项（基础 3 项）`,
  },
  goldSpoonLevel: {
    title: '富贵命格',
    desc: '转生含着金汤匙出生，自带巨额启动资金与家境加成',
    maxLevel: 4,
    costs: [80, 200, 500, 1200],
    getEffectDesc: (lvl: number) => `开局家境 +${lvl * 10}，成年启动金 +${lvl * 50} 万元`,
  },
};

// 神级专属解锁天赋定义
export const DIVINE_TALENTS_CONFIG = [
  {
    id: 'divine_god_favored',
    name: '天道酬勤',
    grade: 4 as const,
    cost: 300,
    desc: '受天道眷顾，每长 1 岁所有属性额外自动 +1，运气 +10',
    statBonus: { luck: 15, happiness: 10 },
  },
  {
    id: 'divine_business_oracle',
    name: '商业先知',
    grade: 4 as const,
    cost: 600,
    desc: '精准洞悉每一次金融周期，理财投资收益翻倍，创业成功率暴增',
    statBonus: { intelligence: 20, wealth: 30 },
  },
  {
    id: 'divine_immortal_vessel',
    name: '真仙降世',
    grade: 4 as const,
    cost: 1000,
    desc: '开局自带无垢灵根，百病不侵，寿命大幅延长，极高概率飞升渡劫',
    statBonus: { strength: 40, spiritualRoot: 80, charm: 20 },
  },
];

// 读取持久化功德数据（兼容微信小程序与本地 Storage）
export function loadKarmaState(): KarmaState {
  try {
    const wxObj = typeof window !== 'undefined' ? (window as unknown as { wx?: { getStorageSync?: (k: string) => unknown } }).wx : undefined;
    if (wxObj?.getStorageSync) {
      const data = wxObj.getStorageSync(KARMA_STORAGE_KEY);
      if (data && typeof data === 'object') return { ...DEFAULT_KARMA_STATE, ...(data as KarmaState) };
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_KARMA_STATE, ...parsed };
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(KARMA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_KARMA_STATE, ...parsed };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_KARMA_STATE;
}

// 保存功德数据
export function saveKarmaState(state: KarmaState): void {
  try {
    const wxObj = typeof window !== 'undefined' ? (window as unknown as { wx?: { setStorageSync?: (k: string, v: unknown) => void } }).wx : undefined;
    if (wxObj?.setStorageSync) {
      wxObj.setStorageSync(KARMA_STORAGE_KEY, state);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(KARMA_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

// 终局结算本生获得的功德点数
export function calculateEarnedKarma(state: GameState, rank: string): number {
  let karma = 0;
  // 寿命功德
  karma += Math.floor(state.age * 2);
  // 最终资产/财富功德 (每 10 点财富折算 5 功德，每 100 万现金折算 10 功德)
  karma += Math.floor(state.attrs.wealth * 0.8);
  const totalMoney = state.assets?.cash || 0;
  karma += Math.min(300, Math.floor(totalMoney / 10));

  // 终局评级奖励
  switch (rank) {
    case 'SSS':
      karma += 800;
      break;
    case 'SS':
      karma += 400;
      break;
    case 'S':
      karma += 200;
      break;
    case 'A':
      karma += 100;
      break;
    case 'B':
      karma += 50;
      break;
    default:
      karma += 20;
  }

  // 飞升神话加成
  if (state.tags.includes('羽化登仙')) {
    karma += 500;
  }
  if (state.tags.includes('福布斯富豪') || state.tags.includes('商业帝国敲钟')) {
    karma += 300;
  }

  return Math.max(10, karma);
}

// 升级天赋树项
export function upgradeKarmaSkill(
  currentState: KarmaState,
  skillKey: keyof Omit<KarmaUpgrades, 'unlockedDivineTalents'>
): { success: boolean; newState: KarmaState; error?: string } {
  const currentLvl = currentState.upgrades[skillKey] || 0;
  const config = UPGRADE_CONFIG[skillKey];

  if (currentLvl >= config.maxLevel) {
    return { success: false, newState: currentState, error: '已达到该天赋最高境界！' };
  }

  const cost = config.costs[currentLvl];
  if (currentState.karmaCoins < cost) {
    return { success: false, newState: currentState, error: `功德不足！需要 ${cost} 功德币` };
  }

  const newState: KarmaState = {
    ...currentState,
    karmaCoins: currentState.karmaCoins - cost,
    upgrades: {
      ...currentState.upgrades,
      [skillKey]: currentLvl + 1,
    },
  };

  saveKarmaState(newState);
  return { success: true, newState };
}

// 解锁神级专属天赋
export function unlockDivineTalent(
  currentState: KarmaState,
  talentId: string
): { success: boolean; newState: KarmaState; error?: string } {
  if (currentState.upgrades.unlockedDivineTalents.includes(talentId)) {
    return { success: false, newState: currentState, error: '该神级天命已解锁！' };
  }

  const config = DIVINE_TALENTS_CONFIG.find((t) => t.id === talentId);
  if (!config) {
    return { success: false, newState: currentState, error: '未找到该天命秘录' };
  }

  if (currentState.karmaCoins < config.cost) {
    return { success: false, newState: currentState, error: `功德不足！解锁需要 ${config.cost} 功德币` };
  }

  const newState: KarmaState = {
    ...currentState,
    karmaCoins: currentState.karmaCoins - config.cost,
    upgrades: {
      ...currentState.upgrades,
      unlockedDivineTalents: [...currentState.upgrades.unlockedDivineTalents, talentId],
    },
  };

  saveKarmaState(newState);
  return { success: true, newState };
}
