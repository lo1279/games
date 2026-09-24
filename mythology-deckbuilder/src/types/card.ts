export type Mythology = 'huaxia' | 'greek' | 'norse' | 'neutral';

export type CardType = 'attack' | 'skill' | 'power' | 'artifact';

export type CardRarity = 'starter' | 'common' | 'rare' | 'epic' | 'legendary';

export interface CardEffect {
  damage?: number;
  shield?: number;
  draw?: number;
  energy?: number;
  heal?: number;
  vulnerable?: number; // 易伤/破甲层数
  weak?: number;       // 虚弱层数
  shock?: number;      // 感电层数 (受击额外雷暴)
  burn?: number;       // 灼烧/业火层数 (回合初掉血)
  strength?: number;   // 力量加成
  aoe?: boolean;       // 是否对全场敌人生效
  repeat?: number;     // 连击次数
  recoil?: number;     // 反噬伤害 (自损)
}

export interface Card {
  id: string;
  name: string;
  mythology: Mythology;
  type: CardType;
  rarity: CardRarity;
  cost: number;        // 神力消耗
  description: string;
  flavorText?: string;
  effect: CardEffect;
  icon: string;        // 标识图标名称
  upgraded?: boolean;  // 是否强化
}
