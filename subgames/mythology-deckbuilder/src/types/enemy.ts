export type IntentType = 'attack' | 'defend' | 'buff' | 'debuff' | 'charge';

export interface EnemyIntent {
  type: IntentType;
  value?: number;
  multiHit?: number;
  description: string;
}

export interface StatusEffects {
  vulnerable: number; // 易伤：受伤害 +50%
  weak: number;       // 虚弱：造成伤害 -25%
  shock: number;      // 感电：受击额外触发闪电伤害
  burn: number;       // 灼烧：回合初造成真实伤害
  strength: number;   // 力量：攻击力加成
}

export interface Enemy {
  id: string;
  name: string;
  title: string;
  mythology: 'huaxia' | 'greek' | 'norse' | 'abyss';
  avatar: string;
  maxHp: number;
  hp: number;
  shield: number;
  status: StatusEffects;
  intent: EnemyIntent;
  turnCount: number;
  isElite?: boolean;
  isBoss?: boolean;
  lore: string;
}
