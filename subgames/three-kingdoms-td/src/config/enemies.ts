import { EnemyConfig } from '../types/game';

export const ENEMIES: Record<string, EnemyConfig> = {
  yellow_turban_scout: {
    id: 'yellow_turban_scout',
    name: '黄巾流寇',
    char: '卒',
    maxHp: 240,
    speed: 58,
    armor: 0.05,
    magicResist: 0.05,
    armorType: 'light', // 轻装皮甲：移速适中，易被弓箭穿刺与挥砍收割
    rewardGold: 8,
    color: '#eab308',
    size: 14,
  },
  yellow_turban_spearman: {
    id: 'yellow_turban_spearman',
    name: '黄巾长枪兵',
    char: '枪',
    maxHp: 450,
    speed: 46,
    armor: 0.18,
    magicResist: 0.1,
    armorType: 'cloth', // 布衣步兵：中庸防御
    rewardGold: 12,
    color: '#ca8a04',
    size: 16,
  },
  shield_guard: {
    id: 'shield_guard',
    name: '大盾重步兵',
    char: '盾',
    maxHp: 950,
    speed: 32,
    armor: 0.65, // 重装巨盾：极高物防，严重抵挡穿刺弓箭，极度惧怕雷火法术融甲！
    magicResist: 0.05,
    armorType: 'heavy', // 重装铁甲
    rewardGold: 20,
    color: '#71717a',
    size: 18,
  },
  xiliang_cavalry: {
    id: 'xiliang_cavalry',
    name: '西凉突骑',
    char: '骑',
    maxHp: 620,
    speed: 95, // 极速冲阵，对防线造成极大压迫，极易被穿刺弓箭狙杀
    armor: 0.2,
    magicResist: 0.2,
    armorType: 'light', // 轻装战马皮甲
    rewardGold: 18,
    color: '#f97316',
    size: 17,
  },
  siege_ram: {
    id: 'siege_ram',
    name: '破阵冲车',
    char: '车',
    maxHp: 2600,
    speed: 26,
    armor: 0.5,
    magicResist: 0.35,
    armorType: 'heavy', // 重装巨型器械
    rewardGold: 35,
    color: '#78350f',
    size: 22,
  },
  evil_sorcerer: {
    id: 'evil_sorcerer',
    name: '太平妖术士',
    char: '术',
    maxHp: 680,
    speed: 42,
    armor: 0.05,
    magicResist: 0.7, // 符文护体：高法术抗性，惧怕物理狙杀
    armorType: 'cloth', // 道袍布衣
    rewardGold: 22,
    color: '#9333ea',
    size: 16,
  },

  // Boss 级敌人
  boss_zhangjiao: {
    id: 'boss_zhangjiao',
    name: '天公将军·张角',
    char: '角',
    maxHp: 6200,
    speed: 35,
    armor: 0.25,
    magicResist: 0.55,
    armorType: 'cloth', // 太平天书法袍
    rewardGold: 130,
    color: '#a855f7',
    size: 26,
    isBoss: true,
    bossSkillName: '太平唤生·五雷正法',
    bossSkillDesc: '【布衣法袍】免疫减速。周期召唤 3 名黄巾死士护体，并吟唱 2 秒降下天罚神雷直击我方名将（可用眩晕打断吟唱）！',
  },
  boss_huaxiong: {
    id: 'boss_huaxiong',
    name: '关西猛将·华雄',
    char: '雄',
    maxHp: 9200,
    speed: 40,
    armor: 0.55,
    magicResist: 0.25,
    armorType: 'heavy', // 关西百炼玄铁重铠
    rewardGold: 180,
    color: '#b91c1c',
    size: 27,
    isBoss: true,
    bossSkillName: '骁勇重劈·陷阵铁壁',
    bossSkillDesc: '【玄铁重铠】攻击使我方武将震荡力竭 1.5 秒！半血时狂暴冲锋并激发生命铁壁护盾，需用法术破甲（诸葛亮/周瑜/关羽）克制！',
  },
  boss_lvbu: {
    id: 'boss_lvbu',
    name: '温侯·吕布',
    char: '布',
    maxHp: 18800,
    speed: 55,
    armor: 0.58,
    magicResist: 0.45,
    armorType: 'heavy', // 兽面吞头连环铠
    rewardGold: 300,
    color: '#ef4444',
    size: 30,
    isBoss: true,
    bossSkillName: '天下无双·鬼神灭世',
    bossSkillDesc: '【终极魔王·双阶段】一阶段辕门穿云射击退我方名将；半血进入魔神降世霸体，蓄力 2 秒发动 180 码鬼神灭世横扫（可用手操眩晕打断或阵位调遣撤离）！',
  },
};
