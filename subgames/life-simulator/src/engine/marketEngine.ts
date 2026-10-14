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
    desc: '门槛亲民，回本周期快但同行竞争激烈，难以上市敲钟',
    minReq: { wealth: 10 },
  },
  {
    industry: 'media' as const,
    industryName: 'MCN与文娱传媒',
    cost: 50, // 50 万
    desc: '依靠颜值魅力与热点运营，爆发力强，但需警惕流量退潮与网红塌房',
    minReq: { charm: 30, intelligence: 30 },
  },
  {
    industry: 'tech' as const,
    industryName: '硬科技半导体/AI大模型',
    cost: 200, // 200 万
    desc: '技术壁垒极高，前期烧钱研发，一旦突破即成千亿行业独角兽',
    minReq: { intelligence: 60, wealth: 50 },
  },
  {
    industry: 'biotech' as const,
    industryName: '前沿生物医药/基因靶向',
    cost: 500, // 500 万
    desc: '临床试验与审批风险极高，但一旦新药过审即成跨国药企并造福万民',
    minReq: { intelligence: 75, wealth: 80 },
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
      rate = 0.35 + Math.random() * 0.85; // +35% ~ +120%
    } else {
      rate = -0.35 - Math.random() * 0.45; // -35% ~ -80%
    }

    if (state.attrs.luck > 75) rate += 0.2;
    if (state.tags.includes('商业先知')) rate = Math.max(0.2, rate);

    const delta = Math.round(assets.investments.crypto * rate * 10) / 10;
    investmentGain += delta;
    assets.investments.crypto = Math.max(0, Math.round((assets.investments.crypto + delta) * 10) / 10);

    if (delta > 30) news.push(`🚀 风险投资与数字资产爆发，净赚 +${delta.toFixed(1)} 万元！`);
    else if (delta < -20) news.push(`⚠️ 虚拟资产遭遇剧烈爆仓震荡，损失 ${Math.abs(delta).toFixed(1)} 万元`);
  }

  // 4. 企业经营与分红 (加入真实破产、重组与行业差异化机制)
  let companyDividends = 0;
  const updatedCompanies: StartupCompany[] = [];

  for (const comp of assets.companies) {
    if (comp.stage === 'bankrupt') {
      updatedCompanies.push(comp);
      continue;
    }

    // 行业差异化属性权重补正
    let attrScore = 0;
    if (comp.industry === 'catering') {
      attrScore = (state.attrs.wealth * 0.15) + (state.attrs.charm * 0.1);
    } else if (comp.industry === 'media') {
      attrScore = (state.attrs.charm * 0.25) + (state.attrs.intelligence * 0.12);
    } else if (comp.industry === 'tech') {
      attrScore = (state.attrs.intelligence * 0.3) + (state.attrs.luck * 0.12);
    } else if (comp.industry === 'biotech') {
      attrScore = (state.attrs.intelligence * 0.35) + (state.attrs.wealth * 0.1);
    }

    // 市场环境修正
    let marketBonus = 0;
    if (sentiment === 'bull') marketBonus = 12;
    if (sentiment === 'bear') marketBonus = -15;

    // 天赋加成
    if (state.tags.includes('商业先知')) marketBonus += 20;

    const successRoll = Math.random() * 100 + attrScore + marketBonus;

    // 经营结果判定
    if (successRoll > 68 && comp.stage !== 'listed') {
      // 成功获得融资晋升
      if (comp.stage === 'angel') {
        comp.stage = 'seed';
        comp.valuation = Math.round(comp.valuation * 1.8);
        comp.annualRevenue = Math.round(comp.valuation * 0.08);
        news.push(`💼 【${comp.name}】产品获得市场热烈反响，完成种子轮融资，估值达 ${comp.valuation} 万元！`);
      } else if (comp.stage === 'seed') {
        comp.stage = 'seriesA';
        comp.valuation = Math.round(comp.valuation * 2.2);
        comp.annualRevenue = Math.round(comp.valuation * 0.07);
        news.push(`🦄 【${comp.name}】突破行业重围，斩获 A 轮顶级投资，跻身知名梯队！`);
      } else if (comp.stage === 'seriesA' && successRoll > 88) {
        comp.stage = 'listed';
        comp.valuation = Math.max(2500, Math.round(comp.valuation * 3.0));
        comp.annualRevenue = Math.round(comp.valuation * 0.06);
        news.push(`🔔 奇迹达成！【${comp.name}】正式敲钟上市，全场起立欢呼！`);
        newTags.push('商业帝国敲钟');
      }
    } else if (successRoll < 16 && comp.stage !== 'listed') {
      // 极端危机：触发【破产清算】
      comp.stage = 'bankrupt';
      comp.valuation = 0;
      comp.annualRevenue = 0;
      news.push(`💥 资本寒冬与恶性价格战！你的企业【${comp.name}】资金链断裂，被迫申请破产清算...`);
    } else if (successRoll < 32 && comp.stage !== 'listed') {
      // 一般性经营困难
      news.push(`⚠️ 【${comp.name}】遭遇同行低价挤压与市场饱和，当年经营亏损，启动裁员降本。`);
      comp.annualRevenue = Math.max(0, Math.floor(comp.annualRevenue * 0.4));
      comp.valuation = Math.max(comp.valuation * 0.7, 5);
    }

    if (comp.stage !== 'bankrupt') {
      const dividend = Math.round(comp.annualRevenue * (comp.shareholding / 100));
      companyDividends += dividend;
    }
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
  industryType: 'catering' | 'media' | 'tech' | 'biotech',
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
    annualRevenue: Math.max(1, Math.round(cfg.cost * 0.08)),
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
