import type { Mythology } from './card';

export interface DivineTrait {
  name: string;
  description: string;
  icon: string;
}

export interface Hero {
  id: string;
  name: string;
  title: string;
  mythology: Mythology;
  avatar: string;
  color: string;
  maxHp: number;
  hp: number;
  maxEnergy: number;
  energy: number;
  shield: number;
  gold: number;
  trait: DivineTrait;
  starterDeckIds: string[];
  lore: string;
}
