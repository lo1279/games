/**
 * 三国志·战略版 - 主城城建内政与资源经济引擎 (City & Economy)
 * 君王殿升级提升Cost上限、军舍解锁多部队、兵营提升带兵量、征兵处转化预备兵
 */

const BUILDINGS_CONFIG = {
  palace: {
    id: 'palace',
    name: '君王殿',
    icon: '🏯',
    maxLevel: 10,
    desc: '主城核心中枢，每升1级提升部队统御上限(Cost +1)与全建筑等级上限。',
    cost: (lvl) => ({
      wood: 2000 * Math.pow(1.8, lvl - 1),
      iron: 2000 * Math.pow(1.8, lvl - 1),
      stone: 4000 * Math.pow(2.0, lvl - 1)
    }),
    effect: (lvl) => `部队 Cost 上限: ${14 + lvl}`
  },
  barracks: {
    id: 'barracks',
    name: '兵营',
    icon: '🚩',
    maxLevel: 10,
    desc: '提升全武将最大带兵上限，每级提升每位武将 300 兵力。',
    cost: (lvl) => ({
      wood: 1500 * Math.pow(1.6, lvl - 1),
      iron: 1500 * Math.pow(1.6, lvl - 1),
      stone: 2000 * Math.pow(1.7, lvl - 1)
    }),
    effect: (lvl) => `每位武将带兵量 +${lvl * 300}`
  },
  militaryCamp: {
    id: 'militaryCamp',
    name: '军舍',
    icon: '⛺',
    maxLevel: 3,
    desc: '扩充部队编制，最多可统领 3 支主力大军。',
    cost: (lvl) => ({
      wood: 3000 * lvl,
      iron: 3000 * lvl,
      stone: 5000 * lvl
    }),
    effect: (lvl) => `可配置部队编制: ${lvl} 队`
  },
  conscription: {
    id: 'conscription',
    name: '征兵处',
    icon: '🛡️',
    maxLevel: 5,
    desc: '扩建招募校场，大幅提高征兵速度与预备兵存储容量。',
    cost: (lvl) => ({
      wood: 1200 * lvl,
      iron: 1500 * lvl,
      stone: 1800 * lvl
    }),
    effect: (lvl) => `预备兵上限: ${lvl * 3000}`
  },
  quarry: {
    id: 'quarry',
    name: '采石处',
    icon: '🪨',
    maxLevel: 10,
    desc: '开采山脉巨石，持续产出城建最关键的石料。',
    cost: (lvl) => ({
      wood: 800 * lvl,
      iron: 800 * lvl,
      grain: 400 * lvl
    }),
    effect: (lvl) => `石料基础产出 +${lvl * 250}/小时`
  },
  ironMine: {
    id: 'ironMine',
    name: '冶铁所',
    icon: '⛏️',
    maxLevel: 10,
    desc: '熔炼精铁打造甲胄兵器，提供持续铁矿产出。',
    cost: (lvl) => ({
      wood: 800 * lvl,
      stone: 800 * lvl,
      grain: 400 * lvl
    }),
    effect: (lvl) => `铁矿基础产出 +${lvl * 250}/小时`
  },
  lumberMill: {
    id: 'lumberMill',
    name: '伐木场',
    icon: '🌲',
    maxLevel: 10,
    desc: '伐木取材建造战车与要塞，提供木材产出。',
    cost: (lvl) => ({
      iron: 800 * lvl,
      stone: 800 * lvl,
      grain: 400 * lvl
    }),
    effect: (lvl) => `木材基础产出 +${lvl * 250}/小时`
  },
  farm: {
    id: 'farm',
    name: '军屯农田',
    icon: '🌾',
    maxLevel: 10,
    desc: '开辟军屯供给三军粮饷，保证征兵与出征消耗。',
    cost: (lvl) => ({
      wood: 800 * lvl,
      iron: 800 * lvl,
      stone: 800 * lvl
    }),
    effect: (lvl) => `粮食基础产出 +${lvl * 250}/小时`
  }
};

/**
 * 主城分区：把 8 座建筑按职能归入 4 个区域，供城景视图分组排布。
 * 纯展示组织，不影响任何数值与升级逻辑。
 * ⚠️ buildings 里的 id 必须与 BUILDINGS_CONFIG 的键一一对应，
 *    遗漏的建筑不会出现在城景里（升级入口也就没了）。
 */
const CITY_DISTRICTS = [
  { id: 'core', name: '中枢', desc: '主城核心', buildings: ['palace'] },
  // 征兵处归军事区：征募新兵本质是军事职能，单独成区在窄屏会留下半屏空白
  { id: 'military', name: '军事区', desc: '扩军备战', buildings: ['barracks', 'militaryCamp', 'conscription'] },
  { id: 'resource', name: '资源区', desc: '工农产出', buildings: ['lumberMill', 'ironMine', 'quarry', 'farm'] },
];

/**
 * 等级档位：把「当前等级 / 上限」映射为外观档位，用于城景中建筑随等级升级而变化的视觉。
 * 档位只驱动样式类名（tier-xxx），不参与任何数值计算。
 * @param {number} lvl 当前等级
 * @param {number} maxLevel 等级上限
 * @returns {{key:string, name:string, built:boolean}}
 */
function levelTier(lvl, maxLevel) {
  const lv = Number(lvl) || 0;
  const max = Number(maxLevel) || 1;
  if (lv <= 0) return { key: 'none', name: '未建造', built: false };
  if (lv >= max) return { key: 'peak', name: '鼎盛', built: true };
  const p = lv / max;
  if (p >= 0.7) return { key: 'fine', name: '精良', built: true };
  if (p >= 0.4) return { key: 'grown', name: '初具', built: true };
  return { key: 'rough', name: '草创', built: true };
}

/**
 * 建筑升级可行性判定：集中一处，避免城景牌位与详情弹窗两处各写一遍导致口径不一致。
 * @param {object} cfg BUILDINGS_CONFIG 中的配置
 * @param {number} lvl 当前等级
 * @param {object} resources 当前资源
 * @returns {{isMax:boolean, nextLevel:number, cost:object|null, canAfford:boolean, shortage:Array<{key:string,need:number,have:number,gap:number}>}}
 */
function buildingUpgradeState(cfg, lvl, resources) {
  const lv = Number(lvl) || 0;
  const isMax = lv >= cfg.maxLevel;
  if (isMax) return { isMax, nextLevel: lv, cost: null, canAfford: false, shortage: [] };
  const cost = cfg.cost(lv + 1);
  const shortage = [];
  // 刻意用 Object.keys().forEach 而非 for..of + 数组解构：小程序"增强编译"会把数组解构
  // 编译成 require('@babel/runtime/helpers/arrayWithHoles')，而小程序运行时无该依赖 → 白屏崩溃。
  Object.keys(cost).forEach((key) => {
    const need = cost[key];
    const have = (resources && resources[key]) || 0;
    if (have < need) shortage.push({ key, need, have, gap: need - have });
  });
  return { isMax, nextLevel: lv + 1, cost, canAfford: shortage.length === 0, shortage };
}

/**
 * 校验资源是否足够
 */
function hasEnoughResources(currentRes, cost) {
  const keys = Object.keys(cost);
  for (let i = 0; i < keys.length; i++) {
    if ((currentRes[keys[i]] || 0) < cost[keys[i]]) return false;
  }
  return true;
}

/**
 * 扣减资源
 */
function deductResources(currentRes, cost) {
  const nextRes = { ...currentRes };
  Object.keys(cost).forEach((resKey) => {
    nextRes[resKey] = Math.max(0, (nextRes[resKey] || 0) - cost[resKey]);
  });
  return nextRes;
}

/**
 * 太学府 · 科技研究分类定义
 */
const TECH_CATEGORIES = {
  arms: { id: 'arms', name: '兵种专精营', desc: '提升专属兵种的实战攻防与特色战技' },
  camps: { id: 'camps', name: '协力阵营策', desc: '激活并强化 3 位同阵营国家队全属性加成' },
  stats: { id: 'stats', name: '武略天书', desc: '永久提升全军所有武将的核心四维属性' }
};

/**
 * 太学府 · 科技研究核心配置 (三战原版经典复刻)
 */
const TECH_CONFIG = {
  // === 1. 兵种专精营 (君王殿 Lv.3 解锁) ===
  tech_cavalry: {
    id: 'tech_cavalry',
    category: 'arms',
    name: '铁骑营·突击精研',
    arm: 'cavalry',
    icon: '🏇',
    maxLevel: 5,
    palaceReq: 3,
    desc: '专精骑兵机动力与冲阵杀伤，提升骑兵伤害与全员先手速度。',
    cost: (lvl) => ({
      copper: 5000 * lvl,
      wood: 4000 * lvl,
      iron: 6000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `骑兵伤害 +${lvl * 2}% · 全员速度 +${lvl * 3}` : '尚未研发 (骑兵无加成)'
  },
  tech_shield: {
    id: 'tech_shield',
    category: 'arms',
    name: '重盾营·坚壁精研',
    arm: 'shield',
    icon: '🛡️',
    maxLevel: 5,
    palaceReq: 3,
    desc: '精铸百炼重铠构筑屏障，降低盾兵部队受到的全部伤害。',
    cost: (lvl) => ({
      copper: 5000 * lvl,
      iron: 6000 * lvl,
      stone: 5000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `盾兵受到伤害 -${lvl * 2}%` : '尚未研发 (盾兵无免伤)'
  },
  tech_bow: {
    id: 'tech_bow',
    category: 'arms',
    name: '神弓营·百步穿杨',
    arm: 'bow',
    icon: '🏹',
    maxLevel: 5,
    palaceReq: 3,
    desc: '研习齐射箭阵，提高弓兵部队主动战法发动几率。',
    cost: (lvl) => ({
      copper: 5000 * lvl,
      wood: 6000 * lvl,
      grain: 4000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `弓兵主动战法发动几率 +${lvl * 1}%` : '尚未研发 (弓兵无法动率加成)'
  },
  tech_spear: {
    id: 'tech_spear',
    category: 'arms',
    name: '精枪营·连环破阵',
    arm: 'spear',
    icon: '🗡️',
    maxLevel: 5,
    palaceReq: 3,
    desc: '演练枪阵刺杀合击，提高枪兵部队破甲无视防御比例。',
    cost: (lvl) => ({
      copper: 5000 * lvl,
      wood: 5000 * lvl,
      iron: 5000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `枪兵无视目标防御 +${lvl * 2}%` : '尚未研发 (枪兵无破防加成)'
  },

  // === 2. 协力阵营策 (君王殿 Lv.4 解锁) ===
  tech_camp_wei: {
    id: 'tech_camp_wei',
    category: 'camps',
    name: '协力·曹魏军略',
    camp: 'wei',
    icon: '🟦',
    maxLevel: 5,
    palaceReq: 4,
    desc: '演练魏武典章，激活并强化 3 位魏国武将的国家队全属性加成。',
    cost: (lvl) => ({
      copper: 8000 * lvl,
      iron: 7000 * lvl,
      stone: 7000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `魏国国家队属性加成: +${Math.round(2 + lvl * 1.6)}%` : '尚未研发 (魏国同阵营无加成)'
  },
  tech_camp_shu: {
    id: 'tech_camp_shu',
    category: 'camps',
    name: '协力·蜀汉义师',
    camp: 'shu',
    icon: '🟩',
    maxLevel: 5,
    palaceReq: 4,
    desc: '修习昭烈汉略，激活并强化 3 位蜀国武将的国家队全属性加成。',
    cost: (lvl) => ({
      copper: 8000 * lvl,
      wood: 7000 * lvl,
      grain: 7000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `蜀国国家队属性加成: +${Math.round(2 + lvl * 1.6)}%` : '尚未研发 (蜀国同阵营无加成)'
  },
  tech_camp_wu: {
    id: 'tech_camp_wu',
    category: 'camps',
    name: '协力·东吴水师',
    camp: 'wu',
    icon: '🟥',
    maxLevel: 5,
    palaceReq: 4,
    desc: '传习江东水战阵法，激活并强化 3 位吴国武将的国家队全属性加成。',
    cost: (lvl) => ({
      copper: 8000 * lvl,
      wood: 7000 * lvl,
      stone: 7000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `吴国国家队属性加成: +${Math.round(2 + lvl * 1.6)}%` : '尚未研发 (吴国同阵营无加成)'
  },
  tech_camp_qun: {
    id: 'tech_camp_qun',
    category: 'camps',
    name: '协力·群雄逐鹿',
    camp: 'qun',
    icon: '🪪',
    maxLevel: 5,
    palaceReq: 4,
    desc: '收拢各路豪强霸业，激活并强化 3 位群雄武将的国家队全属性加成。',
    cost: (lvl) => ({
      copper: 8000 * lvl,
      iron: 7000 * lvl,
      grain: 7000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `群雄国家队属性加成: +${Math.round(2 + lvl * 1.6)}%` : '尚未研发 (群雄同阵营无加成)'
  },

  // === 3. 武略天书 (君王殿 Lv.2 解锁) ===
  tech_stat_force: {
    id: 'tech_stat_force',
    category: 'stats',
    name: '武军诀·勇冠三军',
    icon: '⚔️',
    maxLevel: 5,
    palaceReq: 2,
    desc: '研习古代兵器与格斗肉搏，提升全军所有武将武力基础属性。',
    cost: (lvl) => ({
      copper: 3000 * lvl,
      iron: 4000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `全军武将武力 +${lvl * 4}` : '尚未研发'
  },
  tech_stat_intel: {
    id: 'tech_stat_intel',
    category: 'stats',
    name: '文心诀·神机妙算',
    icon: '🧠',
    maxLevel: 5,
    palaceReq: 2,
    desc: '修习易经韬略与阴阳兵法，提升全军所有武将智力基础属性。',
    cost: (lvl) => ({
      copper: 3000 * lvl,
      wood: 4000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `全军武将智力 +${lvl * 4}` : '尚未研发'
  },
  tech_stat_command: {
    id: 'tech_stat_command',
    category: 'stats',
    name: '磐石诀·固若金汤',
    icon: '🏰',
    maxLevel: 5,
    palaceReq: 2,
    desc: '钻研阵地布设与防守督军，提升全军所有武将统率基础属性。',
    cost: (lvl) => ({
      copper: 3000 * lvl,
      stone: 4000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `全军武将统率 +${lvl * 4}` : '尚未研发'
  },
  tech_stat_speed: {
    id: 'tech_stat_speed',
    category: 'stats',
    name: '疾风诀·行军神速',
    icon: '🐎',
    maxLevel: 5,
    palaceReq: 2,
    desc: '改良粮草输送与行军队列，提升全军所有武将速度基础属性。',
    cost: (lvl) => ({
      copper: 3000 * lvl,
      grain: 4000 * lvl
    }),
    effect: (lvl) => lvl > 0 ? `全军武将速度 +${lvl * 4}` : '尚未研发'
  }
};

/**
 * 太学府 · 学府分区（场景化改造，对齐营建司城景）
 * 三类科技各立为一座「学府」，供太学研习城景分组排布。纯展示组织，不影响数值与研发逻辑。
 */
const TECH_DISTRICTS = [
  { id: 'arms', name: '兵种专精营', desc: '研习四大兵种专属战技', icon: '🏹' },
  { id: 'camps', name: '协力阵营策', desc: '激活同阵营国家队加成', icon: '🛡️' },
  { id: 'stats', name: '武略天书', desc: '永久强化全军四维', icon: '📜' },
];

/**
 * 太学府科技研发可行性判定（对齐 buildingUpgradeState）。
 * 除资源外，额外判定君王殿解锁门槛（palaceReq）。
 * @param {object} cfg TECH_CONFIG 中的配置
 * @param {object} state 游戏状态（需含 buildings.palace / resources / techLevels）
 * @returns {{isUnlocked,isLocked,isMax,level,nextLevel,cost,canAfford,shortage,status,palaceReq}}
 */
function techUpgradeState(cfg, state) {
  const lvl = (state.techLevels && state.techLevels[cfg.id]) || 0;
  const palaceLvl = (state.buildings && state.buildings.palace) || 1;
  const palaceReq = cfg.palaceReq || 1;
  const isUnlocked = palaceLvl >= palaceReq;
  if (!isUnlocked) {
    // 君王殿未达门槛：学府尚未设立，不可研习
    return { isUnlocked: false, isLocked: true, isMax: false, level: lvl, nextLevel: lvl + 1, cost: null, canAfford: false, shortage: [], status: 'locked', palaceReq };
  }
  const isMax = lvl >= cfg.maxLevel;
  if (isMax) {
    return { isUnlocked: true, isLocked: false, isMax: true, level: lvl, nextLevel: lvl, cost: null, canAfford: false, shortage: [], status: 'max', palaceReq };
  }
  const cost = cfg.cost(lvl + 1);
  const shortage = [];
  // 同 buildingUpgradeState：避免数组解构触发 @babel/runtime 外部引用
  Object.keys(cost).forEach((key) => {
    const need = cost[key];
    const have = (state.resources && state.resources[key]) || 0;
    if (have < need) shortage.push({ key, need, have, gap: need - have });
  });
  return {
    isUnlocked: true, isLocked: false, isMax: false, level: lvl, nextLevel: lvl + 1,
    cost, canAfford: shortage.length === 0, shortage,
    status: shortage.length === 0 ? 'ready' : 'lack', palaceReq,
  };
}

/**
 * 太学府累计加成汇总（供总览条展示）。
 * 武略天书每级对各四维 +4，与 TECH_CONFIG 中 effect 口径一致。
 * @param {object} state
 * @returns {{researched:number, maxed:number, total:number, force:number, intel:number, command:number, speed:number}}
 */
function aggregateTechBuffs(state) {
  const techLevels = state.techLevels || {};
  const total = Object.keys(TECH_CONFIG).length;
  const STAT_OF = { tech_stat_force: 'force', tech_stat_intel: 'intel', tech_stat_command: 'command', tech_stat_speed: 'speed' };
  const out = { researched: 0, maxed: 0, total, force: 0, intel: 0, command: 0, speed: 0 };
  for (const cfg of Object.values(TECH_CONFIG)) {
    const lv = techLevels[cfg.id] || 0;
    if (lv > 0) out.researched++;
    if (lv >= cfg.maxLevel) out.maxed++;
    if (STAT_OF[cfg.id]) out[STAT_OF[cfg.id]] += lv * 4;
  }
  return out;
}

module.exports = Object.assign(module.exports || {}, {
  BUILDINGS_CONFIG,
  CITY_DISTRICTS,
  TECH_CATEGORIES,
  TECH_CONFIG,
  TECH_DISTRICTS,
  levelTier,
  buildingUpgradeState,
  hasEnoughResources,
  deductResources,
  techUpgradeState,
  aggregateTechBuffs
});
