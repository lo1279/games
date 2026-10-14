/**
 * 坦克大战 - 全局常量与配置
 */
const CONFIG = {
  // 画布与地图规格 (26 x 26 基础瓦片)
  TILE_SIZE: 24,          // 单个瓦片像素尺寸 (24x24)
  MAP_COLS: 26,           // 列数
  MAP_ROWS: 26,           // 行数
  get CANVAS_WIDTH() { return this.TILE_SIZE * this.MAP_COLS; },   // 624px
  get CANVAS_HEIGHT() { return this.TILE_SIZE * this.MAP_ROWS; },  // 624px

  // 基础物理与速度 (像素/秒 或 像素/帧)
  FPS: 60,
  
  // 方向定义
  DIR: {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
  },

  // 方向对应的移动增量 (dx, dy)
  DIR_OFFSET: [
    { x: 0, y: -1 }, // UP
    { x: 1, y: 0 },  // RIGHT
    { x: 0, y: 1 },  // DOWN
    { x: -1, y: 0 }  // LEFT
  ],

  // 地图瓦片类型
  TILE: {
    EMPTY: 0,
    BRICK: 1,       // 砖墙 (可被击碎)
    STEEL: 2,       // 铁墙 (高等级穿甲炮可破)
    WATER: 3,       // 水域 (坦克不可过，子弹可穿)
    GRASS: 4,       // 丛林 (遮挡坦克视线)
    ICE: 5,         // 冰面 (加速与轻微滑行)
    EAGLE: 9,       // 基地雕像 (保卫目标)
    EAGLE_DEAD: 10  // 基地阵亡
  },

  // 坦克类型定义与属性
  TANK_TYPES: {
    PLAYER: {
      speed: 2.2,
      bulletSpeed: 5.5,
      maxBullets: 1,
      color: '#e6c300',
      trackColor: '#6b5c00'
    },
    BASIC: {
      type: 0,
      name: '普通装甲车',
      hp: 1,
      speed: 1.5,
      bulletSpeed: 4.0,
      score: 100,
      color: '#c0c0c0',
      trackColor: '#505050'
    },
    FAST: {
      type: 1,
      name: '轻型极速车',
      hp: 1,
      speed: 2.8,
      bulletSpeed: 4.5,
      score: 200,
      color: '#5ca3e6',
      trackColor: '#2b5a8c'
    },
    POWER: {
      type: 2,
      name: '强击火炮车',
      hp: 1,
      speed: 1.8,
      bulletSpeed: 6.8,
      score: 300,
      color: '#38b000',
      trackColor: '#1d5e00'
    },
    ARMOR: {
      type: 3,
      name: '重型装甲车',
      hp: 4,
      speed: 1.4,
      bulletSpeed: 4.5,
      score: 400,
      // 随着HP减少变换颜色
      colors: ['#38b000', '#e6a100', '#d90429', '#e6c300']
    }
  },

  // 道具类型
  POWERUP: {
    STAR: 0,      // 升级武器
    BOMB: 1,      // 全屏秒杀敌军
    CLOCK: 2,     // 冻结敌军行动
    SHOVEL: 3,    // 铁壁基地
    HELMET: 4,    // 无敌金钟罩
    TANK: 5       // 奖励一条命
  },

  // 道具持续时长(秒)
  DURATION: {
    CLOCK_FREEZE: 10,
    SHOVEL_STEEL: 15,
    HELMET_INVULNERABLE: 10,
    PLAYER_SPAWN_SHIELD: 4
  },

  // 关卡敌方坦克总数 (经典FC为20辆)
  TOTAL_ENEMIES_PER_LEVEL: 20,
  MAX_ACTIVE_ENEMIES: 4, // 场上同时存在的最大敌军数量

  // 初始玩家生命数
  PLAYER_INITIAL_LIVES: 3
};
