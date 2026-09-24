import type { Mythology } from './card';

export interface Relic {
  id: string;
  name: string;
  mythology: Mythology;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export type NodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'event' | 'boss';

export interface MapNode {
  id: string;
  type: NodeType;
  name: string;
  floor: number;
  columnIndex: number;
  visited: boolean;
  available: boolean;
  connections: string[]; // next node IDs
}

export interface MapFloor {
  floor: number;
  nodes: MapNode[];
}
