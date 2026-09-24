// 三国塔防核心类型定义

export type Camp = 'shu' | 'wei' | 'wu' | 'qun';
export type HeroRole = 'warrior' | 'archer' | 'strategist' | 'support'; // 猛将、神射、军师、辅助

export interface Coordinate {
  x: number;
  y: number;
}

export interface GridPos {
  col: number;
  row: number;
}

// 武将配置模版
export interface HeroConfig {
  id: string;
  name: string;
  title: string;
  camp: Camp;
  role: HeroRole;
  avatarChar: string; // 显示单字如“羽”、“亮”、“操”
  cost: number;
  baseDamage: number;
  baseRange: number;
  baseAttackInterval: number; // 攻击间隔 (秒)
  description: string;
  skillName: string;
  skillDesc: string;
  skillCooldown: number; // 技能冷却 (秒)
  color: string;
  projectileType: 'slash' | 'arrow' | 'lightning' | 'fireball' | 'spear';
  avatarUrl?: string;
  baseHp?: number; // 基础生命值（猛将高、射手法师适中）
}

// 放置在场上的防御塔实体
export interface PlacedTower {
  id: string;
  heroId: string;
  col: number;
  row: number;
  x: number;
  y: number;
  level: number;
  damage: number;
  range: number;
  attackInterval: number;
  attackTimer: number;
  skillTimer: number;
  totalDamageDealt: number;
  kills: number;
  targetId: string | null;
  angle: number; // 朝向
  buffTimer?: number; // 曹操鼓舞攻速 Buff 剩余时间
  attackAnimationTimer?: number; // 攻击/施法动作持续时间（大于0时显示攻击姿态，为0时显示待机姿态）
  hp: number; // 当前生命值
  maxHp: number; // 最大生命值
  isDown: boolean; // 是否处于负伤力竭休整状态
  recoveryTimer: number; // 负伤休整倒计时（秒）
}

// 敌人配置
export interface EnemyConfig {
  id: string;
  name: string;
  char: string;
  maxHp: number;
  speed: number;
  armor: number; // 物理防御百分比 (0-0.8)
  magicResist: number; // 法术防御百分比 (0-0.8)
  rewardGold: number;
  color: string;
  size: number;
  isBoss?: boolean;
  bossSkillName?: string;
  bossSkillDesc?: string;
}

// 场上的敌方士兵实体
export interface EnemyEntity {
  id: string;
  typeId: string;
  name: string;
  char: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  armor: number;
  magicResist: number;
  rewardGold: number;
  color: string;
  size: number;
  isBoss: boolean;
  bossSkillTriggered?: boolean;
  shield?: number;
  waypointIndex: number;
  distanceTraveled: number;
  slowTimer: number;
  stunTimer: number;
  burnTimer: number;
  burnDps: number;
  isDead: boolean;
  reachedEnd: boolean;
  facingRight?: boolean; // 行进朝向：true 为向右，false 为向左
  attackTowerTimer?: number; // 对点将台武将反击的内置冷却计时器
}

// 弹道飞行物
export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetEnemyId: string | null;
  speed: number;
  damage: number;
  damageType: 'physical' | 'magic';
  type: 'slash' | 'arrow' | 'lightning' | 'fireball' | 'spear';
  color: string;
  radius: number;
  aoeRadius?: number;
  slowDuration?: number;
  stunDuration?: number;
  burnDuration?: number;
  piercing?: boolean;
  hitEnemyIds?: string[];
  sourceTowerId?: string; // 发射该弹道的武将防御塔ID（用于准确结算总输出与击杀归属）
}

// 飘字伤害与特效粒子
export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  duration: number;
  elapsed: number;
  fontSize: number;
  isCrit?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
}

export interface VisualSkillEffect {
  type:
    | 'crescent_slash'
    | 'guanyu_dragon'
    | 'zhangfei_shock'
    | 'zhuge_lightning'
    | 'zhouyu_firestorm'
    | 'zhaoyun_spear_storm'
    | 'caocao_imperial'
    | 'sunshangxiang_blossom'
    | 'liubei_benevolence'
    | 'huatuo_healing';
  id: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  angle: number;
  radius: number;
  color: string;
  secondaryColor?: string;
  duration: number;
  elapsed: number;
}

// 关卡波次定义
export interface WaveEnemySpawn {
  enemyId: string;
  count: number;
  interval: number; // 秒
  delayBefore: number; // 距上一批兵延迟
}

export interface WaveConfig {
  waveNumber: number;
  name: string;
  spawns: WaveEnemySpawn[];
}

export interface StageConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  bgTheme: string;
  initialGold: number;
  initialLives: number;
  path: Coordinate[]; // 像素或归一化坐标路径
  towerSlots: GridPos[]; // 可建塔点
  waves: WaveConfig[];
}

// 主公军师锦囊技能
export interface MasterSkill {
  id: string;
  name: string;
  icon: string;
  cost: number;
  cooldown: number;
  currentCooldown: number;
  desc: string;
  type: 'freeze' | 'bombard' | 'inspire';
}
