import type { Enemy, EnemyIntent } from '../types/enemy';

export interface EnemyTemplate {
  id: string;
  name: string;
  title: string;
  mythology: 'huaxia' | 'greek' | 'norse' | 'abyss';
  avatar: string;
  maxHp: number;
  lore: string;
  act?: 1 | 2 | 3;
  isElite?: boolean;
  isBoss?: boolean;
  getIntents: (turn: number) => EnemyIntent;
}

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  // ================= 第一幕 · 凡尘与幽林 (Act 1) =================
  {
    id: 'yaksha',
    name: '巡海夜叉',
    title: '东海斥候',
    mythology: 'huaxia',
    avatar: '🔱',
    maxHp: 38,
    act: 1,
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
    act: 1,
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
    act: 1,
    lore: '来自极寒之境约顿海姆的巨裔，披挂坚硬厚重玄冰。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'defend', value: 12, description: '坚冰壁垒，获得 12 点护盾' };
      if (step === 2) return { type: 'attack', value: 10, description: '冰锤挥击，造成 10 点寒霜伤害' };
      return { type: 'debuff', description: '严寒冻气，施加 2 层【虚弱】与【破甲】' };
    },
  },
  {
    id: 'hydra',
    name: '勒拿九头蛇 · 海德拉',
    title: '希腊深渊毒瘴之兽',
    mythology: 'greek',
    avatar: '🐍',
    maxHp: 75,
    act: 1,
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
  // 第一幕 BOSS: 蚩尤战魂
  {
    id: 'boss_chiyou',
    name: '兵主 · 蚩尤战魂',
    title: '上古九黎之主 · 万兵始祖',
    mythology: 'huaxia',
    avatar: '👹',
    maxHp: 130,
    act: 1,
    isBoss: true,
    lore: '铜头铁额，八肱八趾，人身牛蹄。掌握上古兵戈杀伐大道，虽肉身已殒，不灭战魂依旧统御太古战场！',
    getIntents: (turn) => {
      const step = turn % 4;
      if (step === 1) return { type: 'attack', value: 14, description: '【九黎破天斩】战魂咆哮，造成 14 点凶悍斩击！' };
      if (step === 2) return { type: 'buff', description: '【万兵唤魂】汲取四方煞气，提升 4 点力量并获得 15 点护甲！' };
      if (step === 3) return { type: 'attack', value: 9, multiHit: 3, description: '【八肱连环杀】八臂挥舞兵刃，连续狂斩 9x3 点伤害！' };
      return { type: 'debuff', description: '【弥天大雾】释放上古迷雾，施加 3 层【虚弱】与 3 层【破甲】！' };
    },
  },

  // ================= 第二幕 · 神山圣所 (Act 2) =================
  {
    id: 'minotaur',
    name: '迷宫牛头怪 · 米诺陶洛斯',
    title: '克里特血狱狂魔',
    mythology: 'greek',
    avatar: '🐂',
    maxHp: 65,
    act: 2,
    lore: '迷宫深处的残暴凶兽，双目血红，挥舞双刃巨斧。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 16, description: '巨斧狂劈，准备造成 16 点伤害' };
      if (step === 2) return { type: 'buff', description: '狂怒战吼，获得 3 点力量与 10 点护盾' };
      return { type: 'attack', value: 11, multiHit: 2, description: '横冲直撞，造成 11x2 践踏伤害' };
    },
  },
  {
    id: 'fire_elemental',
    name: '穆斯贝尔海姆熔岩巨魔',
    title: '烈焰火灵',
    mythology: 'norse',
    avatar: '🔥',
    maxHp: 70,
    act: 2,
    lore: '火之国度穆斯贝尔海姆的岩浆精粹凝聚而成的熔岩狂魔。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'debuff', description: '熔岩喷溅，施加 4 层【灼烧】' };
      if (step === 2) return { type: 'attack', value: 18, description: '熔岩烈拳，造成 18 点烈火伤害' };
      return { type: 'defend', value: 18, description: '黑曜石硬壳，获得 18 点护盾' };
    },
  },
  {
    id: 'fenrir_pup',
    name: '魔狼芬里尔之嗣',
    title: '诸神黄昏撕裂者',
    mythology: 'norse',
    avatar: '🐺',
    maxHp: 95,
    act: 2,
    isElite: true,
    lore: '魔狼芬里尔留下的狂暴后裔，血月之下嚎叫，渴望撕碎天地的利齿。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 18, description: '血口撕咬，造成 18 点撕裂伤害' };
      if (step === 2) return { type: 'buff', description: '血月狂暴，获得 5 点力量' };
      return { type: 'attack', value: 10, multiHit: 3, description: '残影乱爪，造成 10x3 点高频伤害' };
    },
  },
  // 第二幕 BOSS: 时空泰坦 · 克洛诺斯
  {
    id: 'boss_cronus',
    name: '时空泰坦 · 克洛诺斯',
    title: '第二代神王 · 时间与衰老之支配者',
    mythology: 'greek',
    avatar: '⏳',
    maxHp: 180,
    act: 2,
    isBoss: true,
    lore: '宙斯之父，挥舞巨大的时间神镰。能操控时间的逆流与极速衰朽，曾吞噬诸神子女！',
    getIntents: (turn) => {
      const step = turn % 4;
      if (step === 1) return { type: 'attack', value: 20, description: '【时间神镰】撕裂岁月，造成 20 点时空湮灭伤害！' };
      if (step === 2) return { type: 'debuff', description: '【衰老光环】时间加速剥夺生机，施加 3 层【虚弱】与 3 层【破甲】！' };
      if (step === 3) return { type: 'charge', description: '【时间逆转蓄力】泰坦正在逆转因果，准备引爆混沌时空！' };
      return { type: 'attack', value: 34, description: '【湮灭时空洪流】轰击全场，造成 34 点崩坏伤害！' };
    },
  },

  // ================= 第三幕 · 诸神黄昏与归墟 (Act 3) =================
  {
    id: 'abyss_behemoth',
    name: '深渊腐化巨兽',
    title: '终焉余烬',
    mythology: 'abyss',
    avatar: '👾',
    maxHp: 90,
    act: 3,
    lore: '被诸神黄昏毁灭死气完全浸染的远古异种，散发着无尽腐朽。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 22, description: '深渊碾压，造成 22 点重击伤害' };
      if (step === 2) return { type: 'defend', value: 25, description: '腐化护盾，获得 25 点坚韧护甲' };
      return { type: 'attack', value: 12, multiHit: 2, description: '双重腐蚀鞭挞，造成 12x2 点伤害' };
    },
  },
  {
    id: 'chaos_valkyrie',
    name: '堕落女武神',
    title: '黄昏死兆星',
    mythology: 'norse',
    avatar: '🖤',
    maxHp: 110,
    act: 3,
    isElite: true,
    lore: '在阿斯加德陨落后化作死兆的折翼武神，手中长枪沾满神明之血。',
    getIntents: (turn) => {
      const step = turn % 3;
      if (step === 1) return { type: 'attack', value: 24, description: '死兆贯穿枪，造成 24 点致命穿刺！' };
      if (step === 2) return { type: 'buff', description: '死誓之舞，获得 4 点力量并获得 20 点护甲' };
      return { type: 'attack', value: 12, multiHit: 3, description: '极速死影连刺，造成 12x3 点伤害！' };
    },
  },
  // 第三幕 终极 BOSS: 灭世黑龙 · 尼德霍格
  {
    id: 'boss_nidhogg',
    name: '灭世黑龙 · 尼德霍格',
    title: '啃噬世界之树的深渊之喉',
    mythology: 'norse',
    avatar: '🐉',
    maxHp: 240,
    act: 3,
    isBoss: true,
    lore: '潜伏在世界之树尤克特拉希尔最底部的绝望之龙。当其咬断世界之树之根，诸神黄昏的末日烈焰将燃尽九界！',
    getIntents: (turn) => {
      const step = turn % 4;
      if (step === 1) return { type: 'charge', description: '【灭世蓄力】黑龙正汲取世界树死气，下回合将降下灾祸！' };
      if (step === 2) return { type: 'attack', value: 36, description: '【深渊灭世龙息】降临，造成 36 点全屏毁灭龙息！' };
      if (step === 3) return { type: 'defend', value: 30, description: '龙鳞铁壁，获得 30 点坚韧护盾并驱散负面' };
      return { type: 'attack', value: 15, multiHit: 2, description: '黑龙甩尾，造成 15x2 点伤害并施加 3 层破甲' };
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
