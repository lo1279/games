import type { Relic } from '../types/relic';

export const ALL_RELICS: Relic[] = [
  {
    id: 'relic_jingu_shard',
    name: '定海神针残片',
    mythology: 'huaxia',
    description: '大圣随身法宝遗落的神铁碎屑。每回合开始自动获得 4 点护盾。',
    icon: 'Shield',
    rarity: 'common',
  },
  {
    id: 'relic_zeus_spark',
    name: '宙斯之雷晶',
    mythology: 'greek',
    description: '蕴含奥林匹斯主神闪电的结晶。每场战斗开始时，赋予敌方全体 2 层【感电】。',
    icon: 'Zap',
    rarity: 'rare',
  },
  {
    id: 'relic_golden_apple',
    name: '金苹果圣果',
    mythology: 'greek',
    description: '赫斯珀里得斯圣园的不老苹果。每次战斗胜利后恢复 10 点生命值。',
    icon: 'Heart',
    rarity: 'rare',
  },
  {
    id: 'relic_alchemy_ember',
    name: '老君炉中火',
    mythology: 'huaxia',
    description: '兜率宫八卦炉飞落的神火余烬。攻击带有【灼烧】的敌人时，伤害提升 35%。',
    icon: 'Flame',
    rarity: 'epic',
  },
  {
    id: 'relic_valkyrie_feather',
    name: '女武神之翼羽',
    mythology: 'norse',
    description: '穿梭于英灵殿的女武神所赠。每场战斗抽牌上限 +1。',
    icon: 'Sparkles',
    rarity: 'rare',
  },
  {
    id: 'relic_loki_mask',
    name: '洛基的诡谲假面',
    mythology: 'norse',
    description: '恶作剧与诡计之神的面具。回合开始有 30% 概率额外获得 1 点神力。',
    icon: 'Smile',
    rarity: 'legendary',
  },
];
