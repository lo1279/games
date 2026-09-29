import type { PersonalAssets, RealEstate, StartupCompany, InvestmentType, GameState } from '../types/game';

// 初始可购置房产清单
export const REAL_ESTATE_CATALOG: Omit<RealEstate, 'ownedCount'>[] = [
  {
    id: 'studio_flat',
    name: '青年单身公寓',
    price: 30, // 30 万
    annualRent: 1.5, // 年租金 1.5 万
    happinessBonus: 2,
  },
  {
    id: 'school_district',
    name: '学区优质商品房',
    price: 150, // 150 万
    annualRent: 6, // 年租金 6 万
    happinessBonus: 5,
  },
  {
    id: 'river_view_penthouse',
    name: '滨江一线大平层',
    price: 600, // 600 万
    annualRent: 25, // 年租金 25 万
    happinessBonus: 12,
  },
  {
    id: 'luxury_mansion',
    name: '顶奢海湾庄园',
    price: 3000, // 3000 万
    annualRent: 120, // 年租金 120 万
    happinessBonus: 25,
  },
];

// 创业行业选项
export const INDUSTRY_CATALOG = [
  {
    industry: 'catering' as const,
    industryName: '潮流茶饮/连锁餐饮',
    cost: 15, // 启动资金 15 万
    desc: '门槛亲民，受大众喜爱，回本周期快但竞争激烈',
    minReq: { wealth: 10 },
  },
  {
    industry: 'media' as const,
    industryName: 'MCN与文娱传媒',
    cost: 50, // 50 万
    desc: '依靠颜值、热点运营与智力，极易爆发式吸金',
    minReq: { charm: 30, intelligence: 30 },
  },
  {
    industry: 'tech' as const,
    industryName: '硬科技半导体/AI实验室',
    cost: 200, // 200 万
    desc: '技术壁垒极高，烧钱研发，一旦突破即成千亿独角兽',
    minReq: { intelligence: 60, wealth: 50 },
  },
];

// 创建默认资产初始状态
export function createDefaultAssets(goldSpoonLevel: number = 0, initialWealthAttr: number = 10): PersonalAssets {
  // 根据家境计算初始成年零花钱启动金 (万元)
  const baseCash = Math.max(2, Math.floor(initialWealthAttr * 0.8)) + goldSpoonLevel * 50;
  return {
    cash: baseCash,
    annualSalary: 0,
    investments: {
      deposit: 0,
      fund: 0,
      crypto: 0,
    },
    realEstates: {},
    companies: [],
    marketSentiment: 'normal',
  };
}

// 模拟每年宏观金融市场波动
export function simulateMarketCycle(): 'bear' | 'normal' | 'bull' {
  const rand = Math.random();
  if (rand < 0.25) return 'bear'; // 25% 熊市
  if (rand > 0.75) return 'bull'; // 25% 牛市
  return 'normal'; // 50% 震荡平衡市
}

export interface YearFinancialSettlement {
  salaryEarned: number;
  rentEarned: number;
  investmentGain: number;
  companyDividends: number;
  totalCashChange: number;
  news: string[];
}

// 每年年终进行资产盈亏、理财结算、房租收取与企业运营
export function settleYearlyFinances(state: GameState): {
  updatedAssets: PersonalAssets;
  settlement: YearFinancialSettlement;
  newTags: string[];
} {
  const assets = { ...state.assets };
  const sentiment = simulateMarketCycle();
  assets.marketSentiment = sentiment;

  const news: string[] = [];
  const newTags: string[] = [];

  // 1. 工资收入 (随年龄与智力/财富动态提升)
  let salary = 0;
  if (state.age >= 22 && state.age <= 65) {
    const base = Math.max(5, Math.floor(state.attrs.intelligence * 0.3) + Math.floor(state.attrs.wealth * 0.2));
    salary = base;
  }
  assets.annualSalary = salary;

  // 2. 房租收入
  let rentEarned = 0;
  for (const item of REAL_ESTATE_CATALOG) {
    const count = assets.realEstates[item.id] || 0;
    if (count > 0) {
      rentEarned += count * item.annualRent;
    }
  }

  // 3. 理财投资结算
  let investmentGain = 0;
  // 银行存款：保本 3.5%
  if (assets.investments.deposit > 0) {
    const gain = Math.round(assets.investments.deposit * 0.035 * 10) / 10;
    investmentGain += gain;
    assets.investments.deposit = Math.round((assets.investments.deposit + gain) * 10) / 10;
  }

  // 指数基金：受行情影响
  if (assets.investments.fund > 0) {
    let rate = 0;
    if (sentiment === 'bull') rate = 0.18 + Math.random() * 0.25; // +18% ~ +43%
    else if (sentiment === 'bear') rate = -0.15 - Math.random() * 0.15; // -15% ~ -30%
    else rate = -0.05 + Math.random() * 0.15; // -5% ~ +10%

    // 智商与运气加成
    if (state.attrs.intelligence > 70) rate += 0.05;
    if (state.tags.includes('商业先知')) rate = Math.max(0.1, rate * 1.5);

    const delta = Math.round(assets.investments.fund * rate * 10) / 10;
    investmentGain += delta;
    assets.investments.fund = Math.max(0, Math.round((assets.investments.fund + delta) * 10) / 10);

    if (delta > 10) news.push(`📈 基金投资收益颇丰，斩获 +${delta.toFixed(1)} 万元分红`);
    else if (delta < -10) news.push(`📉 遭遇金融市场回调，持仓基金浮亏 ${Math.abs(delta).toFixed(1)} 万元`);
  }

  // 数字资产/风险投资：剧烈波动
  if (assets.investments.crypto > 0) {
    let rate = 0;
    const cryptoDice = Math.random();
    if (sentiment === 'bull' || cryptoDice > 0.6) {
      rate = 0.4 + Math.random() * 1.2; // +40% ~ +160%
    } else {
      rate = -0.35 - Math.random() * 0.45; // -35% ~ -80%
    }

    if (state.attrs.luck > 75) rate += 0.2;
    if (state.tags.includes('商业先知')) rate = Math.max(0.2, rate);

    const delta = Math.round(assets.investments.crypto * rate * 10) / 10;
    investmentGain += delta;
    assets.investments.crypto = Math.max(0, Math.round((assets.investments.crypto + delta) * 10) / 10);

    if (delta > 30) news.push(`🚀 风险投资与加密资产爆发，净赚 +${delta.toFixed(1)} 万元！`);
    else if (delta < -20) news.push(`⚠️ 虚拟资产遭遇剧烈爆仓震荡，损失 ${Math.abs(delta).toFixed(1)} 万元`);
  }

  // 4. 企业经营与分红
  let companyDividends = 0;
  const updatedCompanies: StartupCompany[] = [];

  for (const comp of assets.companies) {
    if (comp.stage === 'bankrupt') continue;

    // 随机经营事件
    const successRoll = Math.random() * 100 + (state.attrs.intelligence * 0.2) + (state.attrs.luck * 0.15);

    if (successRoll > 65 && comp.stage !== 'listed') {
      // 融资或升级
      if (comp.stage === 'angel') {
        comp.stage = 'seed';
        comp.valuation *= 2.5;
        comp.annualRevenue = Math.round(comp.valuation * 0.15);
        news.push(`💼 你的公司【${comp.name}】产品走红，获得天使轮追加，估值达 ${comp.valuation} 万元！`);
      } else if (comp.stage === 'seed') {
        comp.stage = 'seriesA';
        comp.valuation *= 3;
        comp.annualRevenue = Math.round(comp.valuation * 0.12);
        news.push(`🦄 【${comp.name}】完成 A 轮融资，正式跻身行业知名梯队！`);
      } else if (comp.stage === 'seriesA' && successRoll > 85) {
        comp.stage = 'listed';
        comp.valuation = Math.max(2000, comp.valuation * 5);
        comp.annualRevenue = Math.round(comp.valuation * 0.1);
        news.push(`🔔 奇迹达成！【${comp.name}】正式敲钟上市，造就财富神话！`);
        newTags.push('商业帝国敲钟');
      }
    } else if (successRoll < 15 && comp.stage !== 'listed') {
      // 经营困难
      news.push(`⚠️ 【${comp.name}】遭遇恶性价格战与同行挤压，当年发生亏损。`);
      comp.annualRevenue = Math.max(0, Math.floor(comp.annualRevenue * 0.5));
    }

    const dividend = Math.round(comp.annualRevenue * (comp.shareholding / 100));
    companyDividends += dividend;
    updatedCompanies.push(comp);
  }
  assets.companies = updatedCompanies;

  // 汇总总现金变动
  const totalCashChange = salary + rentEarned + companyDividends;
  assets.cash = Math.max(0, Math.round((assets.cash + totalCashChange) * 10) / 10);

  // 资产总额突破检查
  const totalNetWorth =
    assets.cash +
    assets.investments.deposit +
    assets.investments.fund +
    assets.investments.crypto +
    Object.entries(assets.realEstates).reduce((sum, [id, count]) => {
      const estate = REAL_ESTATE_CATALOG.find((e) => e.id === id);
      return sum + (estate ? estate.price * count : 0);
    }, 0);

  if (totalNetWorth >= 1000 && !state.tags.includes('千万富翁')) {
    newTags.push('千万富翁');
    news.push(`🏆 个人净资产正式跨越 1000 万元门槛，成为商界新贵！`);
  }
  if (totalNetWorth >= 10000 && !state.tags.includes('福布斯富豪')) {
    newTags.push('福布斯富豪');
    news.push(`👑 个人净资产破亿，荣登福布斯全球杰出富豪榜！`);
  }

  return {
    updatedAssets: assets,
    settlement: {
      salaryEarned: salary,
      rentEarned,
      investmentGain,
      companyDividends,
      totalCashChange,
      news,
    },
    newTags,
  };
}

// 投资申购/赎回
export function tradeInvestment(
  assets: PersonalAssets,
  type: InvestmentType,
  amount: number, // 正数买入，负数赎回
  isBuy: boolean
): { success: boolean; newAssets: PersonalAssets; error?: string } {
  const newAssets = {
    ...assets,
    investments: { ...assets.investments },
  };

  if (isBuy) {
    if (newAssets.cash < amount) {
      return { success: false, newAssets: assets, error: '可用现金不足！' };
    }
    newAssets.cash = Math.round((newAssets.cash - amount) * 10) / 10;
    newAssets.investments[type] = Math.round(((newAssets.investments[type] || 0) + amount) * 10) / 10;
  } else {
    const current = newAssets.investments[type] || 0;
    if (current < amount) {
      return { success: false, newAssets: assets, error: '赎回金额超过当前持仓！' };
    }
    newAssets.investments[type] = Math.round((current - amount) * 10) / 10;
    newAssets.cash = Math.round((newAssets.cash + amount) * 10) / 10;
  }

  return { success: true, newAssets };
}

// 购买房产
export function buyRealEstate(
  assets: PersonalAssets,
  estateId: string
): { success: boolean; newAssets: PersonalAssets; error?: string } {
  const estate = REAL_ESTATE_CATALOG.find((e) => e.id === estateId);
  if (!estate) return { success: false, newAssets: assets, error: '未找到指定不动产' };

  if (assets.cash < estate.price) {
    return { success: false, newAssets: assets, error: `现金不足！需要 ${estate.price} 万元` };
  }

  const newAssets: PersonalAssets = {
    ...assets,
    cash: Math.round((assets.cash - estate.price) * 10) / 10,
    realEstates: {
      ...assets.realEstates,
      [estateId]: (assets.realEstates[estateId] || 0) + 1,
    },
  };

  return { success: true, newAssets };
}

// 创办新企业
export function foundCompany(
  assets: PersonalAssets,
  industryType: 'catering' | 'media' | 'tech',
  companyName: string
): { success: boolean; newAssets: PersonalAssets; error?: string } {
  const cfg = INDUSTRY_CATALOG.find((i) => i.industry === industryType);
  if (!cfg) return { success: false, newAssets: assets, error: '未知行业领域' };

  if (assets.cash < cfg.cost) {
    return { success: false, newAssets: assets, error: `启动资金不足！需要 ${cfg.cost} 万元` };
  }

  const newCompany: StartupCompany = {
    id: `comp_${Date.now()}`,
    name: companyName || cfg.industryName,
    industry: cfg.industry,
    industryName: cfg.industryName,
    level: 1,
    valuation: cfg.cost * 1.5,
    annualRevenue: Math.round(cfg.cost * 0.2),
    shareholding: 100,
    stage: 'angel',
  };

  const newAssets: PersonalAssets = {
    ...assets,
    cash: Math.round((assets.cash - cfg.cost) * 10) / 10,
    companies: [...assets.companies, newCompany],
  };

  return { success: true, newAssets };
}
