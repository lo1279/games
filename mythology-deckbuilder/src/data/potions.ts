import type { Potion } from '../types/potion';

export const ALL_POTIONS: Potion[] = [
  {
    id: 'nine_turn_elixir',
    name: '九转金丹',
    mythology: 'huaxia',
    rarity: 'epic',
    costGold: 75,
    icon: '💊',
    description: '太上老君金炉神丹。立即回复 25 点生命值，并获得 1 点力量。',
    effect: {
      heal: 25,
      strength: 1
    }
  },
  {
    id: 'ambrosia_flask',
    name: '奥林匹斯仙露',
    mythology: 'greek',
    rarity: 'rare',
    costGold: 60,
    icon: '🏺',
    description: '诸神赐福的甘露。立即恢复 2 点神力，并抽 2 张牌。',
    effect: {
      energy: 2,
      draw: 2
    }
  },
  {
    id: 'berserk_mead',
    name: '狂战士神蜜酒',
    mythology: 'norse',
    rarity: 'rare',
    costGold: 65,
    icon: '🍺',
    description: '英灵殿烈酒。本场战斗永久增加 3 点力量。',
    effect: {
      strength: 3
    }
  },
  {
    id: 'vajra_water',
    name: '金刚护体神液',
    mythology: 'huaxia',
    rarity: 'common',
    costGold: 45,
    icon: '🛡️',
    description: '饮下后周身生出金光。立即获得 20 点护甲。',
    effect: {
      shield: 20
    }
  },
  {
    id: 'thunder_brew',
    name: '雷暴天露',
    mythology: 'norse',
    rarity: 'common',
    costGold: 50,
    icon: '⚡',
    description: '引动九霄雷鸣。对敌方造成 15 点全场雷暴伤害，并附加 2 层易伤。',
    effect: {
      damage: 15,
      vulnerable: 2
    }
  },
  {
    id: 'samadhi_flask',
    name: '三昧真火灵油',
    mythology: 'huaxia',
    rarity: 'rare',
    costGold: 55,
    icon: '🔥',
    description: '点燃天地业火。使敌方全体陷入 5 层灼烧。',
    effect: {
      burn: 5
    }
  }
];

export function getRandomPotion(): Potion {
  const idx = Math.floor(Math.random() * ALL_POTIONS.length);
  return { ...ALL_POTIONS[idx] };
}
