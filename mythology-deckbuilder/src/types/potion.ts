export type PotionRarity = 'common' | 'rare' | 'epic';

export interface PotionEffect {
  heal?: number;
  energy?: number;
  strength?: number;
  shield?: number;
  draw?: number;
  vulnerable?: number; // 给予全场易伤
  burn?: number;       // 给予全场灼烧
  damage?: number;     // 全场伤害
}

export interface Potion {
  id: string;
  name: string;
  mythology: 'huaxia' | 'greek' | 'norse' | 'neutral';
  rarity: PotionRarity;
  costGold: number;
  icon: string;
  description: string;
  effect: PotionEffect;
}
