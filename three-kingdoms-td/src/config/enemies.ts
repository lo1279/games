import { EnemyConfig } from '../types/game';

export const ENEMIES: Record<string, EnemyConfig> = {
  yellow_turban_scout: {
    id: 'yellow_turban_scout',
    name: '黄巾流寇',
    char: '卒',
    maxHp: 240, // 180 -> 240
    speed: 58,
    armor: 0.05,
    magicResist: 0.05,
    rewardGold: 8, // 14 -> 8
    color: '#eab308',
    size: 14,
  },
  yellow_turban_spearman: {
    id: 'yellow_turban_spearman',
    name: '黄巾长枪兵',
    char: '枪',
    maxHp: 450, // 320 -> 450
    speed: 46,
    armor: 0.18,
    magicResist: 0.1,
    rewardGold: 12, // 20 -> 12
    color: '#ca8a04',
    size: 16,
  },
  shield_guard: {
    id: 'shield_guard',
    name: '大盾重步兵',
    char: '盾',
    maxHp: 950, // 650 -> 950
    speed: 32,
    armor: 0.6, // 高物理护甲，克制物理箭矢
    magicResist: 0.05, // 弱法术
    rewardGold: 20, // 35 -> 20
    color: '#71717a',
    size: 18,
  },
  xiliang_cavalry: {
    id: 'xiliang_cavalry',
    name: '西凉突骑',
    char: '骑',
    maxHp: 620, // 420 -> 620
    speed: 92, // 极高移速，威胁防线后排
    armor: 0.22,
    magicResist: 0.2,
    rewardGold: 18, // 30 -> 18
    color: '#f97316',
    size: 17,
  },
  siege_ram: {
    id: 'siege_ram',
    name: '破阵冲车',
    char: '车',
    maxHp: 2600, // 1600 -> 2600
    speed: 26,
    armor: 0.45,
    magicResist: 0.35,
    rewardGold: 35, // 60 -> 35
    color: '#78350f',
    size: 22,
  },
  evil_sorcerer: {
    id: 'evil_sorcerer',
    name: '太平妖术士',
    char: '术',
    maxHp: 680, // 480 -> 680
    speed: 42,
    armor: 0.05,
    magicResist: 0.65, // 高魔抗
    rewardGold: 22, // 40 -> 22
    color: '#9333ea',
    size: 16,
  },

  // Boss 级敌人（大幅增强威严与耐久）
  boss_zhangjiao: {
    id: 'boss_zhangjiao',
    name: '天公将军·张角',
    char: '角',
    maxHp: 5800, // 3800 -> 5800
    speed: 35,
    armor: 0.28,
    magicResist: 0.5,
    rewardGold: 120, // 200 -> 120
    color: '#a855f7',
    size: 26,
    isBoss: true,
    bossSkillName: '黄天当立',
    bossSkillDesc: '苍天已死，黄天当立！释放雷云护体，免疫大量负面减速状态。',
  },
  boss_huaxiong: {
    id: 'boss_huaxiong',
    name: '关西猛将·华雄',
    char: '雄',
    maxHp: 8800, // 5600 -> 8800
    speed: 40,
    armor: 0.52,
    magicResist: 0.25,
    rewardGold: 160, // 260 -> 160
    color: '#b91c1c',
    size: 27,
    isBoss: true,
    bossSkillName: '骁勇劈山',
    bossSkillDesc: '威风凛凛，血量低于 50% 时进入怒火冲锋，移速提升 40%！',
  },
  boss_lvbu: {
    id: 'boss_lvbu',
    name: '温侯·吕布',
    char: '布',
    maxHp: 16800, // 9500 -> 16800 终极战神血量
    speed: 55,
    armor: 0.55,
    magicResist: 0.45,
    rewardGold: 260, // 450 -> 260
    color: '#ef4444',
    size: 30,
    isBoss: true,
    bossSkillName: '天下无双',
    bossSkillDesc: '人中吕布，马中赤兔！方天画戟威震群雄，周期性激发生命护盾并清除自身减速！',
  },
};
