import type { Enemy, EnemyIntent } from '../types/enemy';

export interface EnemyTemplate {
  id: string;
  name: string;
  title: string;
  mythology: 'huaxia' | 'greek' | 'norse' | 'abyss';
  avatar: string;
  maxHp: number;
  lore: string;
  isElite?: boolean;
  isBoss?: boolean;
  getIntents: (turn: number) => EnemyIntent;
}

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  // ================= 普通魔怪 =================
  {
    id: 'yaksha',
    name: '巡海夜叉',
    title: '东海斥候',
    mythology: 'huaxia',
    avatar: '🔱',
    maxHp: 38,
    lore: '东海龙宫先锋夜叉，手持三叉钢戟，善于踏浪突袭。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 8, description: '钢戟突刺，准备造成 8 点伤害' };
      if (step === 2) return { type: 'defend', value: 9, description: '水盾凝结，准备获得 9 点护盾' };
      return { type: 'attack', value: 12, description: '翻江倒海，蓄力重击造成 12 点伤害' };
    },
  },
  {
    id: 'centaur',
    name: '狂暴半人马',
    title: '色萨利原野游侠',
    mythology: 'greek',
    avatar: '🏹',
    maxHp: 44,
    lore: '身具人身马躯的凶悍战士，兼具狂奔践踏与精准箭术。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 7, multiHit: 2, description: '双连箭射击，准备造成 7x2 点伤害' };
      if (step === 2) return { type: 'buff', description: '战马嘶鸣，提升自身 3 点力量' };
      return { type: 'attack', value: 14, description: '战蹄践踏，准备造成 14 点重击伤害' };
    },
  },
  {
    id: 'frost_scout',
    name: '霜巨人先锋',
    title: '约顿海姆寒冰卫士',
    mythology: 'norse',
    avatar: '❄️',
    maxHp: 48,
    lore: '来自极寒之境约顿海姆的巨裔，披挂坚硬厚重玄冰。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'defend', value: 12, description: '坚冰壁垒，获得 12 点护盾' };
      if (step === 2) return { type: 'attack', value: 10, description: '冰锤挥击，造成 10 点寒霜伤害' };
      return { type: 'debuff', description: '严寒冻气，施加 2 层【虚弱】与【破甲】' };
    },
  },

  // ================= 精英挑战怪 =================
  {
    id: 'hydra',
    name: '勒拿九头蛇 · 海德拉',
    title: '希腊深渊毒瘴之兽',
    mythology: 'greek',
    avatar: '🐍',
    maxHp: 75,
    isElite: true,
    lore: '毒沼之中的剧毒狂兽，长有数颗致命蛇首，断首重生，剧毒无比。',
    getIntents: (turn) => {
      const step = turn % 4;
      if (step === 1) return { type: 'attack', value: 10, multiHit: 2, description: '多头齐咬，准备造成 10x2 点伤害' };
      if (step === 2) return { type: 'debuff', description: '剧毒喷吐，施加 3 层【虚弱】与 3 层【灼烧】' };
      if (step === 3) return { type: 'defend', value: 15, description: '蛇鳞再生，获得 15 点护盾' };
      return { type: 'attack', value: 22, description: '蛇首狂乱轰击，准备造成 22 点伤害' };
    },
  },
  {
    id: 'fenrir_pup',
    name: '魔狼芬里尔之嗣',
    title: '诸神黄昏撕裂者',
    mythology: 'norse',
    avatar: '🐺',
    maxHp: 80,
    isElite: true,
    lore: '魔狼芬里尔留下的狂暴后裔，血月之下嚎叫，渴望撕碎天地的利齿。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 15, description: '血口撕咬，造成 15 点撕裂伤害' };
      if (step === 2) return { type: 'buff', description: '血月狂暴，获得 4 点力量' };
      return { type: 'attack', value: 8, multiHit: 3, description: '残影乱爪，造成 8x3 点高频伤害' };
    },
  },

  // ================= 守关终极 BOSS =================
  {
    id: 'boss_nidhogg',
    name: '灭世黑龙 · 尼德霍格',
    title: '啃噬世界之树的深渊之喉',
    mythology: 'norse',
    avatar: '🐉',
    maxHp: 160,
    isBoss: true,
    lore: '潜伏在世界之树尤克特拉希尔最底部的绝望之龙。当其咬断世界之树之根，诸神黄昏的末日烈焰将燃尽九界！',
    getIntents: (turn) => {
      const step = turn % 4;
      if (step === 1) return { type: 'charge', description: '【灭世蓄力】黑龙正汲取世界树死气，下回合将降下灾祸！' };
      if (step === 2) return { type: 'attack', value: 30, description: '【深渊龙息】降临，造成 30 点全屏毁灭龙息！' };
      if (step === 3) return { type: 'defend', value: 20, description: '龙鳞铁壁，获得 20 点坚韧护盾并驱散负面' };
      return { type: 'attack', value: 12, multiHit: 2, description: '黑龙甩尾，造成 12x2 点伤害并施加 2 层破甲' };
    },
  },
];

export function createEnemyInstance(templateId: string): Enemy {
  const template = ENEMY_TEMPLATES.find(t => t.id === templateId) || ENEMY_TEMPLATES[0];
  const initialIntent = template.getIntents(1);

  return {
    id: `${template.id}_${Date.now()}`,
    name: template.name,
    title: template.title,
    mythology: template.mythology,
    avatar: template.avatar,
    maxHp: template.maxHp,
    hp: template.maxHp,
    shield: 0,
    status: {
      vulnerable: 0,
      weak: 0,
      shock: 0,
      burn: 0,
      strength: 0,
    },
    intent: initialIntent,
    turnCount: 1,
    isElite: template.isElite,
    isBoss: template.isBoss,
    lore: template.lore,
  };
}
