// 游戏核心数据类型定义

export type AttributeKey = 'charm' | 'intelligence' | 'strength' | 'wealth' | 'happiness' | 'luck' | 'spiritualRoot';

export interface Attributes {
  charm: number;         // 颜值/魅力 (0-100+)
  intelligence: number;  // 智力/才智 (0-100+)
  strength: number;      // 体质/健康 (0-100+)
  wealth: number;        // 家境/财富 (0-100+)
  happiness: number;     // 快乐/心态 (0-100)
  luck: number;          // 幸运值 (0-100)
  spiritualRoot?: number;// 隐藏：灵根/修真悟性 (0-100)
}

export type TalentGrade = 1 | 2 | 3 | 4; // 1:普通(白), 2:优秀(蓝), 3:史诗(紫), 4:传说(金)

export interface Talent {
  id: string;
  name: string;
  description: string;
  grade: TalentGrade;
  statBonus?: Partial<Attributes>;
  exclusiveWith?: string[]; // 互斥天赋
  specialTag?: string;      // 特殊标记（如 "immortal_seed", "prodigy", "rich_heir"）
}

export type LogType = 'normal' | 'positive' | 'warning' | 'danger' | 'special' | 'milestone';

export interface LifeLog {
  id: string;
  age: number;
  content: string;
  type: LogType;
  statChanges?: Partial<Record<AttributeKey, number>>;
  tagsGained?: string[];
}

export interface ChoiceOption {
  id: string;
  text: string;
  description?: string;
  minReq?: Partial<Attributes>; // 属性要求（如智力>=60）
  reqDesc?: string;
  execute: (current: GameState) => {
    logText: string;
    logType?: LogType;
    statChanges?: Partial<Record<AttributeKey, number>>;
    tagsGained?: string[];
    isDead?: boolean;
    deathReason?: string;
  };
}

export interface LifeDecision {
  id: string;
  title: string;
  description: string;
  category: 'education' | 'career' | 'love' | 'family' | 'crisis' | 'destiny';
  options: ChoiceOption[];
}

export interface LifeEvent {
  id: string;
  minAge: number;
  maxAge: number;
  weight: number;
  category?: string;
  condition?: (state: GameState) => boolean;
  execute: (state: GameState) => {
    content: string;
    type?: LogType;
    statChanges?: Partial<Record<AttributeKey, number>>;
    tagsGained?: string[];
    isDead?: boolean;
    deathReason?: string;
    triggerDecision?: LifeDecision;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number; // 解锁时的年龄
}

// ================= 方案 1：理财、不动产与商海创业数据模型 =================

// 理财产品类型
export type InvestmentType = 'deposit' | 'fund' | 'crypto';

export interface InvestmentItem {
  id: InvestmentType;
  name: string;
  desc: string;
  principal: number; // 持仓本金 (万元)
  rateHint: string;  // 预期年化描述
  riskLevel: '低风险' | '中风险' | '高风险';
}

// 不动产类型
export interface RealEstate {
  id: string;
  name: string;
  price: number;       // 售价 (万元)
  annualRent: number;  // 每年租金回报 (万元)
  happinessBonus: number; // 宜居心情加成
  ownedCount: number;  // 持有套数
}

// 创办企业阶段
export type CompanyStage = 'angel' | 'seed' | 'seriesA' | 'preIPO' | 'listed' | 'bankrupt';

export interface StartupCompany {
  id: string;
  name: string;
  industry: 'catering' | 'media' | 'tech' | 'biotech';
  industryName: string;
  level: number;       // 企业等级 1-5
  valuation: number;   // 企业估值 (万元)
  annualRevenue: number;// 每年企业净利润分红 (万元)
  shareholding: number;// 持股比例 0-100%
  stage: CompanyStage;
}

// 个人总资产状态
export interface PersonalAssets {
  cash: number;               // 可支配现金 (万元)
  annualSalary: number;       // 基础年薪 (万元)
  investments: Record<InvestmentType, number>; // 各类理财持仓本金 (万元)
  realEstates: Record<string, number>;        // 各房产持有数量
  companies: StartupCompany[];                // 名下创办企业
  marketSentiment: 'bear' | 'normal' | 'bull'; // 当年宏观金融行情 (熊市/平稳/牛市)
}

// ================= 方案 4：轮回神殿局外养成系统数据模型 =================

export interface KarmaUpgrades {
  extraAttrPointsLevel: number; // 初始自由分配点数 (+2/级，默认0级=20点)
  extraTalentSlotsLevel: number;// 额外可选天赋槽位 (+1/级，默认0级=选3个)
  goldSpoonLevel: number;       // 含金钥匙/出生启动金等级 (+50万/级，家境+10/级)
  unlockedDivineTalents: string[]; // 已解锁神级专属天赋 ID 列表
}

export interface KarmaState {
  karmaCoins: number;       // 功德币余额
  totalKarmaEarned: number; // 累积获得功德币
  reincarnationCount: number;// 轮回转生次数
  upgrades: KarmaUpgrades;   // 局外天赋树等级
}

// ================= 方案 2：伴侣社交、子女培养与家族世代传承 =================

export interface Partner {
  id: string;
  name: string;
  identity: string;       // 身份（青梅竹马 / 商业巨擘 / 世家千金 / 隐世仙子）
  favorability: number;   // 好感度 0-100
  isMarried: boolean;     // 是否已结婚
  avatar: string;         // 头像表情
  annualBonusDesc: string;// 每年为家庭带来的增益（例如提供商机、提升快乐、灵气双修）
  reqAttr: Partial<Attributes>; // 结识/求婚门槛
}

export interface Child {
  id: string;
  name: string;
  gender: '男' | '女';
  age: number;
  educationTrend: 'science' | 'business' | 'arts' | 'cultivation'; // 培育偏向
  talentInherited?: Talent; // 继承自父母的天赋
  potential: number;        // 成长潜力 0-100
}

export interface FamilyState {
  partner: Partner | null;
  children: Child[];
  familyPrestige: number;   // 家族声望
  generation: number;       // 家族传承代数 (第1代、第2代...)
}

// ================= 方案 3：奇遇世界线变动与 D20 骰子掷点检定 =================

export interface DiceChallenge {
  id: string;
  title: string;
  description: string;
  category: 'adventure' | 'cultivation' | 'business_gamble' | 'crisis' | 'science' | 'diplomacy' | 'heritage';
  targetDC: number;         // 检定目标难度阈值 (Difficulty Class 10-35)
  checkAttr: AttributeKey;  // 检定依赖的属性 (如 intelligence, luck, strength, spiritualRoot, charm, wealth)
  attrScale: number;        // 属性补正换算系数 (例如 attrs[key] * 0.2)
  successReward: {
    logText: string;
    statChanges?: Partial<Record<AttributeKey, number>>;
    tagsGained?: string[];
    cashReward?: number;
  };
  criticalSuccessReward: {  // 掷出大成功 (20点)
    logText: string;
    statChanges?: Partial<Record<AttributeKey, number>>;
    tagsGained?: string[];
    cashReward?: number;
  };
  failurePenalty: {
    logText: string;
    statChanges?: Partial<Record<AttributeKey, number>>;
    isDead?: boolean;
    deathReason?: string;
  };
}

export interface DiceResult {
  rawRoll: number;      // 1-20
  attrBonus: number;    // 属性补正
  totalScore: number;   // 总得分
  isCriticalSuccess: boolean;
  isCriticalFumble: boolean;
  isSuccess: boolean;
}

export type GamePhase = 'talent' | 'alloc' | 'playing' | 'decision' | 'challenge' | 'summary';

export interface GameState {
  phase: GamePhase;
  age: number;
  gender: '男' | '女';
  name: string;
  isDead: boolean;
  deathReason: string;
  career: string;
  education: string;
  attrs: Attributes;
  selectedTalents: Talent[];
  allTalentsPool: Talent[];
  tags: string[];
  logs: LifeLog[];
  currentDecision: LifeDecision | null;
  autoPlay: boolean;
  playSpeedMs: number;
  achievements: Achievement[];
  unlockedAchievementIds: string[];
  // 方案 1：商海资产与个人财务
  assets: PersonalAssets;
  // 方案 2：情缘伴侣与家族传承
  family: FamilyState;
  // 方案 3：当前触发的 D20 奇遇掷骰挑战
  currentChallenge: DiceChallenge | null;
  // 方案 4：本局轮回功德记录
  earnedKarmaThisLife?: number;
}
