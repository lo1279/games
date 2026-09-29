/**
 * 三国志·战略版 - 主城城建内政与资源经济引擎 (City & Economy)
 * 君王殿升级提升Cost上限、军舍解锁多部队、兵营提升带兵量、征兵处转化预备兵
 */

export const BUILDINGS_CONFIG = {
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
 * 校验资源是否足够
 */
export function hasEnoughResources(currentRes, cost) {
  for (const [resKey, amt] of Object.entries(cost)) {
    if ((currentRes[resKey] || 0) < amt) return false;
  }
  return true;
}

/**
 * 扣减资源
 */
export function deductResources(currentRes, cost) {
  const nextRes = { ...currentRes };
  for (const [resKey, amt] of Object.entries(cost)) {
    nextRes[resKey] = Math.max(0, (nextRes[resKey] || 0) - amt);
  }
  return nextRes;
}
