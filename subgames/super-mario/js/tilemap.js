/**
 * 🎮 超级马里奥兄弟 - 多关卡地图与碰撞引擎 (World 1-1, 1-2 & 1-3)
 */

class LevelTileMap {
  constructor(world = 1, stage = 1) {
    this.world = world;
    this.stage = stage;
    this.theme = (world === 1 && stage === 2) ? 'underground' : ((world === 1 && stage === 3) ? 'treetop' : ((world === 1 && stage === 4) ? 'castle' : 'overworld'));
    this.cols = (stage === 4) ? 176 : 212; // 城堡关总宽度
    this.rows = 15;  // 经典 NES 视口垂直 15 格 (每格 16 像素，共 240 高)
    this.grid = [];  // 二维瓦片矩阵 [row][col]
    this.bumpingBlocks = []; // 正在被顶动弹跳的砖块
    this.enemiesSpawnConfig = []; // 初始怪物生成点配置
    this.firebars = []; // 旋转火球棒机关
    this.bridgeCols = []; // 库巴熔岩吊桥列索引
    this.axePos = null; // 金飞斧坐标
    this.bowserSpawn = null;
    this.toadSpawn = null;
    this.flagPoleX = 198 * CONFIG.TILE_SIZE; // 胜利旗杆 X 坐标 (1-1 ~ 1-3)
    this.flagY = 3 * CONFIG.TILE_SIZE + 4; // 旗帜当前滑动位置
    this.flagBottomY = 12 * CONFIG.TILE_SIZE;
    this.castleDoorX = 206 * CONFIG.TILE_SIZE;
    
    if (this.stage === 2) {
      this.initUndergroundMap();
    } else if (this.stage === 3) {
      this.initTreetopMap();
    } else if (this.stage === 4) {
      this.initCastleMap();
    } else {
      this.initOverworldMap();
    }
  }

  // 初始化 World 1-1 (经典地表平原关)
  initOverworldMap() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }

    // 1. 铺设地表基本地面 (row 13 与 14)
    for (let c = 0; c < this.cols; c++) {
      // 避开悬崖裂谷
      const isChasm = (c >= 69 && c <= 71) || (c >= 86 && c <= 88) || (c >= 153 && c <= 155);
      if (!isChasm) {
        this.grid[13][c] = CONFIG.TILE.GROUND;
        this.grid[14][c] = CONFIG.TILE.GROUND;
      }
    }

    // 2. 放置经典绿水管 (高 2, 3, 4, 4)
    this.placePipe(28, 13, 2);
    this.placePipe(38, 13, 3);
    this.placePipe(46, 13, 4);
    this.placePipe(57, 13, 4);
    this.placePipe(163, 13, 2);
    this.placePipe(179, 13, 2);

    // 3. 初始砖块群 (x=16 起)
    this.grid[9][16] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][20] = CONFIG.TILE.BRICK;
    this.grid[9][21] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][22] = CONFIG.TILE.BRICK;
    this.grid[9][23] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][24] = CONFIG.TILE.BRICK;
    this.grid[5][22] = CONFIG.TILE.QUESTION_COIN;

    // 4. 第二组砖块 (水管后 x=77 起)
    this.grid[9][77] = CONFIG.TILE.BRICK;
    this.grid[9][78] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][79] = CONFIG.TILE.BRICK;
    for (let c = 80; c <= 87; c++) {
      this.grid[5][c] = CONFIG.TILE.BRICK;
    }
    this.grid[5][83] = CONFIG.TILE.QUESTION_COIN;

    // 5. 第三组砖块 (两段式空岛 x=91..110)
    for (let c = 91; c <= 93; c++) {
      this.grid[5][c] = CONFIG.TILE.BRICK;
    }
    this.grid[9][94] = CONFIG.TILE.BRICK;
    this.grid[9][95] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][100] = CONFIG.TILE.BRICK;
    this.grid[9][101] = CONFIG.TILE.BRICK;
    this.grid[5][106] = CONFIG.TILE.QUESTION_COIN;
    this.grid[5][109] = CONFIG.TILE.QUESTION_COIN;
    this.grid[5][112] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][109] = CONFIG.TILE.BRICK;
    this.grid[9][118] = CONFIG.TILE.BRICK;
    this.grid[9][121] = CONFIG.TILE.BRICK;
    this.grid[9][122] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][123] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][124] = CONFIG.TILE.BRICK;

    // 6. 第一组阶梯 (x=134 起)
    this.placeStairs(134, 13, 4, 1);  // 上升 4 阶
    this.placeStairs(140, 13, 4, -1); // 下降 4 阶

    // 7. 第二组阶梯
    this.placeStairs(148, 13, 4, 1);
    this.placeStairs(155, 13, 4, -1);

    // 8. 终点终极大金字塔阶梯 (x=181 起, 高度 8 阶)
    this.placeStairs(181, 13, 8, 1);
    this.grid[5][189] = CONFIG.TILE.HARD_BLOCK;

    // 9. 旗杆底座与旗杆
    this.grid[12][198] = CONFIG.TILE.HARD_BLOCK;
    for (let r = 3; r <= 11; r++) {
      this.grid[r][198] = CONFIG.TILE.FLAG_POLE;
    }
    this.grid[2][198] = CONFIG.TILE.FLAG_TOP;

    // 10. 敌人生成初始点定义
    this.enemiesSpawnConfig = [
      { type: 'goomba', x: 22 * 16 },
      { type: 'goomba', x: 40 * 16 },
      { type: 'goomba', x: 51 * 16 },
      { type: 'goomba', x: 52.5 * 16 },
      { type: 'koopa',  x: 75 * 16 },
      { type: 'goomba', x: 80 * 16 },
      { type: 'goomba', x: 82 * 16 },
      { type: 'goomba', x: 97 * 16 },
      { type: 'goomba', x: 99 * 16 },
      { type: 'koopa',  x: 107 * 16 },
      { type: 'goomba', x: 120 * 16 },
      { type: 'goomba', x: 124 * 16 },
      { type: 'goomba', x: 128 * 16 },
      { type: 'goomba', x: 174 * 16 },
      { type: 'goomba', x: 176 * 16 }
    ];
  }

  // 初始化 World 1-2 (经典地下世界 Underground)
  initUndergroundMap() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }

    // 1. 地下天花板 (Row 0 和 Row 1) - 原版经典地下全封顶跑道
    for (let c = 0; c <= 178; c++) {
      // 在开头留出 4 格掉落空间
      if (c > 3 && c < 8) continue;
      this.grid[0][c] = CONFIG.TILE.BRICK;
      this.grid[1][c] = CONFIG.TILE.BRICK;
    }

    // 2. 地下地面 (Row 13 和 Row 14) 与深渊陷阱
    for (let c = 0; c < this.cols; c++) {
      const isChasm = (c >= 62 && c <= 65) || (c >= 102 && c <= 105) || (c >= 142 && c <= 145);
      if (!isChasm) {
        this.grid[13][c] = CONFIG.TILE.GROUND;
        this.grid[14][c] = CONFIG.TILE.GROUND;
      }
    }

    // 3. 入口与管道群
    this.placePipe(26, 13, 2);
    this.placePipe(38, 13, 3);
    this.placePipe(50, 13, 4);
    this.placePipe(74, 13, 3);
    this.placePipe(112, 13, 2);
    this.placePipe(150, 13, 3);

    // 4. 第一组地下砖块与问号砖 (x=12 起)
    this.grid[9][12] = CONFIG.TILE.BRICK;
    this.grid[9][13] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][14] = CONFIG.TILE.BRICK;
    this.grid[9][15] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][16] = CONFIG.TILE.BRICK;

    // 5. 悬空金币天桥通道 (x=28..36)
    for (let c = 29; c <= 35; c++) {
      this.grid[5][c] = CONFIG.TILE.QUESTION_COIN;
      this.grid[9][c] = CONFIG.TILE.BRICK;
    }

    // 6. 第二组高空悬空跳台与断崖两岸桥梁 (x=56..70)
    for (let c = 56; c <= 61; c++) {
      this.grid[8][c] = CONFIG.TILE.HARD_BLOCK;
    }
    for (let c = 66; c <= 72; c++) {
      this.grid[8][c] = CONFIG.TILE.HARD_BLOCK;
    }
    this.grid[4][60] = CONFIG.TILE.QUESTION_COIN;
    this.grid[4][68] = CONFIG.TILE.QUESTION_MUSHROOM;

    // 7. 第三组密集多层金币连砖 (x=80..96)
    for (let c = 82; c <= 94; c++) {
      this.grid[9][c] = (c % 2 === 0) ? CONFIG.TILE.BRICK : CONFIG.TILE.QUESTION_COIN;
      this.grid[5][c] = CONFIG.TILE.BRICK;
    }

    // 8. 阶梯迷宫台阶 (x=120..138)
    this.placeStairs(122, 13, 4, 1);
    this.placeStairs(128, 13, 4, -1);
    this.placeStairs(134, 13, 4, 1);

    // 9. 地下出口长廊通向地表 (x=160..178)
    for (let c = 162; c <= 178; c++) {
      this.grid[9][c] = CONFIG.TILE.HARD_BLOCK;
    }

    // 10. 终点阶梯金字塔 (x=181 起) 与 旗杆城堡 (重返地表)
    this.placeStairs(181, 13, 8, 1);
    this.grid[5][189] = CONFIG.TILE.HARD_BLOCK;

    this.grid[12][198] = CONFIG.TILE.HARD_BLOCK;
    for (let r = 3; r <= 11; r++) {
      this.grid[r][198] = CONFIG.TILE.FLAG_POLE;
    }
    this.grid[2][198] = CONFIG.TILE.FLAG_TOP;

    // 11. 地下特有敌军分布 (板栗仔小分队 + 绿乌龟巡逻队)
    this.enemiesSpawnConfig = [
      { type: 'goomba', x: 18 * 16 },
      { type: 'goomba', x: 20 * 16 },
      { type: 'koopa',  x: 32 * 16 },
      { type: 'goomba', x: 44 * 16 },
      { type: 'goomba', x: 45.5 * 16 },
      { type: 'koopa',  x: 58 * 16 },
      { type: 'goomba', x: 78 * 16 },
      { type: 'koopa',  x: 85 * 16 },
      { type: 'goomba', x: 89 * 16 },
      { type: 'goomba', x: 91 * 16 },
      { type: 'koopa',  x: 116 * 16 },
      { type: 'goomba', x: 125 * 16 },
      { type: 'goomba', x: 130 * 16 },
      { type: 'goomba', x: 156 * 16 },
      { type: 'koopa',  x: 165 * 16 },
      { type: 'goomba', x: 174 * 16 }
    ];
  }

  // 初始化 World 1-3 (经典高空树冠与悬崖平台关)
  initTreetopMap() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }

    // 1. 起点安全平原 (c=0..12，让玩家准备起跑)
    for (let c = 0; c <= 12; c++) {
      this.grid[13][c] = CONFIG.TILE.GROUND;
      this.grid[14][c] = CONFIG.TILE.GROUND;
    }
    // 起点上方问号金币砖
    this.grid[9][7] = CONFIG.TILE.QUESTION_COIN;
    this.grid[9][9] = CONFIG.TILE.QUESTION_COIN;

    // 2. 经典树冠高空浮岛群 (万丈悬崖正式开始)
    // 浮岛 1：新手试跳浮岛 (c=14..18, row=10, 支撑柱 c=16)
    this.placeTreetopPlatform(14, 5, 10, 16);
    this.grid[6][16] = CONFIG.TILE.QUESTION_COIN;

    // 浮岛 2：高台升降与强化红蘑菇 (c=21..26, row=8, 支撑柱 c=23..24)
    this.placeTreetopPlatform(21, 6, 8, 23, 24);
    this.grid[4][23] = CONFIG.TILE.BRICK;
    this.grid[4][24] = CONFIG.TILE.QUESTION_MUSHROOM; // 经典升级红蘑菇

    // 浮岛 3：中距树冠跳台 (c=29..33, row=9, 支撑柱 c=31)
    this.placeTreetopPlatform(29, 5, 9, 31);

    // 浮岛 4：高阶冲刺大跳树冠 (c=36..41, row=6, 支撑双立柱 c=38..39)
    this.placeTreetopPlatform(36, 6, 6, 38, 39);
    this.grid[2][38] = CONFIG.TILE.QUESTION_COIN;
    this.grid[2][39] = CONFIG.TILE.QUESTION_COIN;

    // 浮岛 5：双层立体树冠长廊 (c=44..56)
    this.placeTreetopPlatform(44, 7, 9, 47); // 下层左树冠
    // 上层悬空木桥砖 (c=48..54, row=5)
    for (let c = 48; c <= 54; c++) {
      this.grid[5][c] = (c % 2 === 0) ? CONFIG.TILE.QUESTION_COIN : CONFIG.TILE.BRICK;
    }
    this.placeTreetopPlatform(52, 6, 9, 54); // 下层右树冠

    // 浮岛 6：高难度三连阶梯小踏板 (c=60..73, 极其考验起跳距离把控)
    this.placeTreetopPlatform(60, 3, 9);
    this.placeTreetopPlatform(65, 3, 8);
    this.placeTreetopPlatform(70, 4, 7, 71);
    this.grid[4][66] = CONFIG.TILE.QUESTION_COIN;

    // 浮岛 7：大跨度中央树冠母岛 (c=77..86, row=8, 支撑双柱 c=81..82)
    this.placeTreetopPlatform(77, 10, 8, 81, 82);
    this.grid[4][79] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[4][80] = CONFIG.TILE.QUESTION_COIN;
    this.grid[4][83] = CONFIG.TILE.BRICK;
    this.grid[4][84] = CONFIG.TILE.BRICK;

    // 浮岛 8：连续下跃树冠步道 (c=90..108)
    this.placeTreetopPlatform(90, 4, 6);
    this.placeTreetopPlatform(96, 4, 7);
    this.placeTreetopPlatform(102, 6, 8, 104);
    this.grid[3][92] = CONFIG.TILE.QUESTION_COIN;
    this.grid[3][98] = CONFIG.TILE.QUESTION_COIN;

    // 浮岛 9：高空密集金币木栈道群 (c=112..122, row=9)
    this.placeTreetopPlatform(112, 11, 9, 116, 117);
    for (let c = 114; c <= 120; c++) {
      this.grid[5][c] = (c % 2 === 0) ? CONFIG.TILE.QUESTION_COIN : CONFIG.TILE.BRICK;
    }

    // 浮岛 10：飞跃断崖双跳台 (c=126..142)
    this.placeTreetopPlatform(126, 4, 7);
    this.placeTreetopPlatform(133, 4, 6);
    this.placeTreetopPlatform(139, 6, 8, 141, 142);

    // 浮岛 11：通往终点的树冠天梯 (c=147..170)
    this.placeTreetopPlatform(147, 4, 9);
    this.placeTreetopPlatform(153, 4, 8);
    this.placeTreetopPlatform(159, 4, 7);
    this.placeTreetopPlatform(165, 6, 6, 167); // 终极大跳跃高台

    // 3. 终点重归坚固大地与胜利城堡 (c=174..211)
    for (let c = 174; c < this.cols; c++) {
      this.grid[13][c] = CONFIG.TILE.GROUND;
      this.grid[14][c] = CONFIG.TILE.GROUND;
    }

    // 终点经典的 8 阶大金字塔阶梯
    this.placeStairs(181, 13, 8, 1);
    this.grid[5][189] = CONFIG.TILE.HARD_BLOCK;

    // 终点旗杆底座与旗杆
    this.grid[12][198] = CONFIG.TILE.HARD_BLOCK;
    for (let r = 3; r <= 11; r++) {
      this.grid[r][198] = CONFIG.TILE.FLAG_POLE;
    }
    this.grid[2][198] = CONFIG.TILE.FLAG_TOP;

    // 4. 树冠高空敌人巡逻配置 (巡逻板栗仔 + 绿乌龟飞踢连击)
    this.enemiesSpawnConfig = [
      { type: 'goomba', x: 15 * 16,  y: 9 * 16 },
      { type: 'koopa',  x: 22 * 16,  y: 7 * 16 },
      { type: 'goomba', x: 30 * 16,  y: 8 * 16 },
      { type: 'goomba', x: 37 * 16,  y: 5 * 16 },
      { type: 'goomba', x: 40 * 16,  y: 5 * 16 },
      { type: 'koopa',  x: 46 * 16,  y: 8 * 16 },
      { type: 'goomba', x: 72 * 16,  y: 6 * 16 },
      { type: 'koopa',  x: 78 * 16,  y: 7 * 16 },
      { type: 'goomba', x: 84 * 16,  y: 7 * 16 },
      { type: 'goomba', x: 97 * 16,  y: 6 * 16 },
      { type: 'goomba', x: 104 * 16, y: 7 * 16 },
      { type: 'koopa',  x: 115 * 16, y: 8 * 16 },
      { type: 'goomba', x: 121 * 16, y: 8 * 16 },
      { type: 'goomba', x: 140 * 16, y: 7 * 16 },
      { type: 'koopa',  x: 160 * 16, y: 6 * 16 },
      { type: 'goomba', x: 178 * 16, y: 11 * 16 }
    ];
  }

  // 初始化 World 1-4 (经典终极库巴熔岩城堡关 Bowser's Castle)
  initCastleMap() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = new Uint8Array(this.cols);
    }
    this.firebars = [];
    this.bridgeCols = [];

    // 1. 铺设坚固石砖天花板 (全封闭城堡压迫感)
    for (let c = 0; c < this.cols; c++) {
      this.grid[0][c] = CONFIG.TILE.HARD_BLOCK;
      this.grid[1][c] = CONFIG.TILE.HARD_BLOCK;
    }

    // 2. 基础地面与初始长廊 (c=0..125)
    for (let c = 0; c <= 125; c++) {
      // 熔岩裂谷 1 (c=22..25) 与 熔岩裂谷 2 (c=64..68)
      const isLavaPit = (c >= 22 && c <= 25) || (c >= 64 && c <= 68);
      if (isLavaPit) {
        this.grid[13][c] = CONFIG.TILE.LAVA_TOP;
        this.grid[14][c] = CONFIG.TILE.LAVA_BODY;
      } else {
        this.grid[13][c] = CONFIG.TILE.GROUND;
        this.grid[14][c] = CONFIG.TILE.GROUND;
      }
    }

    // 3. 第一区域：火球棒石柱长廊 (c=0..35)
    // 旋转火球柱 1 (c=12, row=10)
    this.grid[10][12] = CONFIG.TILE.HARD_BLOCK;
    this.firebars.push(new Firebar(12, 10, 5, 0.045, 0));

    // 熔岩裂谷 1 前后的跳板与悬空砖
    this.grid[9][19] = CONFIG.TILE.BRICK;
    this.grid[9][20] = CONFIG.TILE.QUESTION_MUSHROOM;
    this.grid[9][21] = CONFIG.TILE.BRICK;

    // 熔岩坑上方悬空踏脚石 (c=23..24, row=9)
    this.grid[9][23] = CONFIG.TILE.HARD_BLOCK;
    this.grid[9][24] = CONFIG.TILE.HARD_BLOCK;

    // 旋转火球柱 2 (c=28, row=9)
    this.grid[9][28] = CONFIG.TILE.HARD_BLOCK;
    this.firebars.push(new Firebar(28, 9, 5, -0.05, Math.PI / 2));

    // 4. 第二区域：三层迷宫回廊 (c=36..75)
    // 经典城堡上中下三路台阶
    for (let c = 36; c <= 48; c++) {
      this.grid[5][c] = CONFIG.TILE.HARD_BLOCK;
      this.grid[9][c] = CONFIG.TILE.HARD_BLOCK;
    }
    // 旋转火球柱 3 (中层迷宫中心 c=42, row=9)
    this.firebars.push(new Firebar(42, 9, 4, 0.05, Math.PI));

    // 金币问号砖
    this.grid[3][40] = CONFIG.TILE.QUESTION_COIN;
    this.grid[7][45] = CONFIG.TILE.QUESTION_COIN;

    // 跨越熔岩裂谷 2 (c=64..68)
    for (let c = 58; c <= 63; c++) {
      this.grid[8][c] = CONFIG.TILE.HARD_BLOCK;
    }
    this.grid[8][66] = CONFIG.TILE.HARD_BLOCK; // 坑中单格落脚点
    this.firebars.push(new Firebar(66, 8, 4, 0.06, 0)); // 坑中极险火球棒

    // 5. 第三区域：高低压迫回廊与库巴殿堂前厅 (c=76..125)
    for (let c = 76; c <= 92; c++) {
      this.grid[9][c] = CONFIG.TILE.HARD_BLOCK;
    }
    this.grid[5][84] = CONFIG.TILE.QUESTION_COIN;
    this.grid[5][86] = CONFIG.TILE.QUESTION_COIN;
    // 旋转火球柱 4 (前厅通道 c=98, row=10)
    this.grid[10][98] = CONFIG.TILE.HARD_BLOCK;
    this.firebars.push(new Firebar(98, 10, 5, -0.045, Math.PI / 4));

    // 悬空石台阶 (c=106..122)
    this.placeStairs(108, 13, 4, 1);
    this.placeStairs(116, 13, 4, -1);
    this.firebars.push(new Firebar(112, 8, 5, 0.05, 0));

    // 6. 最终决战殿堂：大魔王库巴熔岩吊桥 (c=126..150)
    // 殿堂无底熔岩深渊 (c=126..148 全部为岩浆)
    for (let c = 126; c <= 148; c++) {
      this.grid[13][c] = CONFIG.TILE.LAVA_TOP;
      this.grid[14][c] = CONFIG.TILE.LAVA_BODY;
    }
    // 熔岩吊桥桥面 (c=130..144, row=12 全部为 BRIDGE)
    for (let c = 130; c <= 144; c++) {
      this.grid[12][c] = CONFIG.TILE.BRIDGE;
      this.bridgeCols.push(c);
    }

    // 吊桥左侧入口基座
    this.grid[12][126] = CONFIG.TILE.HARD_BLOCK;
    this.grid[12][127] = CONFIG.TILE.HARD_BLOCK;
    this.grid[12][128] = CONFIG.TILE.HARD_BLOCK;
    this.grid[12][129] = CONFIG.TILE.HARD_BLOCK;

    // 吊桥右侧尽头机关控制台 (c=145..152)
    for (let c = 145; c <= 152; c++) {
      this.grid[12][c] = CONFIG.TILE.HARD_BLOCK;
      this.grid[13][c] = CONFIG.TILE.HARD_BLOCK;
      this.grid[14][c] = CONFIG.TILE.HARD_BLOCK;
    }

    // 关键通关机关：金飞斧 (Axe) 位于 col 148, row 11
    this.grid[11][148] = CONFIG.TILE.AXE;
    this.axePos = { col: 148, row: 11, x: 148 * 16, y: 11 * 16 };

    // 库巴 Boss 出生配置 (站在吊桥右半区 c=140, row=10)
    this.bowserSpawn = { x: 140 * 16, y: 10 * 16 };

    // 7. 终点觐见厅与解救奇诺比奥 (c=153..175)
    for (let c = 153; c < this.cols; c++) {
      this.grid[13][c] = CONFIG.TILE.GROUND;
      this.grid[14][c] = CONFIG.TILE.GROUND;
    }
    // 奇诺比奥 NPC 出生点
    this.toadSpawn = { x: 164 * 16, y: 11 * 16 + 8 };

    // 城堡内部少量顽抗巡逻兵
    this.enemiesSpawnConfig = [
      { type: 'goomba', x: 20 * 16, y: 11 * 16 },
      { type: 'koopa',  x: 34 * 16, y: 11 * 16 },
      { type: 'goomba', x: 74 * 16, y: 11 * 16 },
      { type: 'koopa',  x: 90 * 16, y: 7 * 16 },
      { type: 'goomba', x: 102 * 16, y: 11 * 16 }
    ];
  }

  // 辅助函数：放置高空树冠浮岛平台与支撑树干
  placeTreetopPlatform(startCol, width, row, trunkStart = null, trunkEnd = null) {
    // 树冠平台顶板 (坚固的绿色蘑菇树冠平台)
    for (let c = startCol; c < startCol + width; c++) {
      if (c >= 0 && c < this.cols && row >= 0 && row < this.rows) {
        this.grid[row][c] = CONFIG.TILE.HARD_BLOCK;
      }
    }
    // 支撑树干立柱 (木质纹理砖柱向下延伸至悬崖深处)
    if (trunkStart !== null) {
      const tEnd = trunkEnd !== null ? trunkEnd : trunkStart;
      for (let c = trunkStart; c <= tEnd; c++) {
        for (let r = row + 1; r < this.rows; r++) {
          if (c >= 0 && c < this.cols) {
            this.grid[r][c] = CONFIG.TILE.BRICK;
          }
        }
      }
    }
  }

  // 辅助函数：放置坚固阶梯
  placeStairs(startCol, groundRow, height, direction) {
    for (let step = 0; step < height; step++) {
      const col = startCol + step;
      const stepHeight = direction === 1 ? step + 1 : height - step;
      for (let h = 0; h < stepHeight; h++) {
        const row = groundRow - 1 - h;
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          this.grid[row][col] = CONFIG.TILE.HARD_BLOCK;
        }
      }
    }
  }

  // 辅助函数：放置标准双格水管
  placePipe(col, groundRow, height) {
    const topRow = groundRow - height;
    if (topRow < 0) return;

    // 管口 Top
    this.grid[topRow][col] = CONFIG.TILE.PIPE_TL;
    this.grid[topRow][col + 1] = CONFIG.TILE.PIPE_TR;

    // 管身 Body
    for (let r = topRow + 1; r < groundRow; r++) {
      this.grid[r][col] = CONFIG.TILE.PIPE_BL;
      this.grid[r][col + 1] = CONFIG.TILE.PIPE_BR;
    }
  }

  // 获取指定行列的瓦片类型
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return CONFIG.TILE.EMPTY;
    }
    return this.grid[row][col];
  }

  // 设置指定行列瓦片
  setTile(col, row, type) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[row][col] = type;
    }
  }

  // 判断是否为实体可碰撞瓦片
  isSolid(tile) {
    return (
      tile === CONFIG.TILE.GROUND ||
      tile === CONFIG.TILE.BRICK ||
      tile === CONFIG.TILE.QUESTION_COIN ||
      tile === CONFIG.TILE.QUESTION_MUSHROOM ||
      tile === CONFIG.TILE.EMPTY_BLOCK ||
      tile === CONFIG.TILE.HARD_BLOCK ||
      tile === CONFIG.TILE.PIPE_TL ||
      tile === CONFIG.TILE.PIPE_TR ||
      tile === CONFIG.TILE.PIPE_BL ||
      tile === CONFIG.TILE.PIPE_BR ||
      tile === CONFIG.TILE.BRIDGE
    );
  }

  // 触发砖块被顶动画
  triggerBlockBump(col, row) {
    this.bumpingBlocks.push({
      col,
      row,
      timer: 0,
      maxTimer: 10,
      offsetY: 0
    });
  }

  // 更新砖块跳动动画
  updateBumpingBlocks() {
    for (let i = this.bumpingBlocks.length - 1; i >= 0; i--) {
      const b = this.bumpingBlocks[i];
      b.timer++;
      const half = b.maxTimer / 2;
      if (b.timer <= half) {
        b.offsetY = -Math.sin((b.timer / half) * (Math.PI / 2)) * 6;
      } else {
        b.offsetY = -Math.cos(((b.timer - half) / half) * (Math.PI / 2)) * 6;
      }

      if (b.timer >= b.maxTimer) {
        this.bumpingBlocks.splice(i, 1);
      }
    }
  }

  getBumpOffsetY(col, row) {
    const found = this.bumpingBlocks.find(b => b.col === col && b.row === row);
    return found ? found.offsetY : 0;
  }

  // 渲染视口可见区域内的瓦片与背景装饰
  render(ctx, cameraX, animFrame) {
    const startCol = Math.max(0, Math.floor(cameraX / CONFIG.TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((cameraX + CONFIG.VIEWPORT_WIDTH) / CONFIG.TILE_SIZE));

    // 1. 绘制背景山丘与云朵装饰 (地表与高空树冠世界渲染)
    if (this.theme === 'overworld' || this.theme === 'treetop') {
      this.renderScenery(ctx, cameraX);
    }

    // 2. 绘制终点城堡 (仅 1-1 ~ 1-3 渲染)
    if (this.theme !== 'castle') {
      const castlePixelX = 202 * CONFIG.TILE_SIZE - cameraX;
      if (castlePixelX > -100 && castlePixelX < CONFIG.VIEWPORT_WIDTH + 100) {
        SpriteRenderer.drawCastle(ctx, castlePixelX, 8 * CONFIG.TILE_SIZE);
      }
    }

    // 3. 绘制瓦片层 (支持地表、地下、高空与城堡主题风格)
    for (let r = 0; r < this.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.grid[r][c];
        if (tile === CONFIG.TILE.EMPTY) continue;

        const x = c * CONFIG.TILE_SIZE - cameraX;
        const y = r * CONFIG.TILE_SIZE;
        const bumpY = this.getBumpOffsetY(c, r);

        switch (tile) {
          case CONFIG.TILE.GROUND:
            SpriteRenderer.drawGroundTile(ctx, x, y, this.theme);
            break;
          case CONFIG.TILE.BRICK:
            SpriteRenderer.drawBrick(ctx, x, y, bumpY, this.theme);
            break;
          case CONFIG.TILE.QUESTION_COIN:
          case CONFIG.TILE.QUESTION_MUSHROOM:
            SpriteRenderer.drawQuestionBlock(ctx, x, y, animFrame, bumpY);
            break;
          case CONFIG.TILE.EMPTY_BLOCK:
            SpriteRenderer.drawEmptyBlock(ctx, x, y, bumpY);
            break;
          case CONFIG.TILE.HARD_BLOCK:
            SpriteRenderer.drawHardBlock(ctx, x, y, this.theme);
            break;
          case CONFIG.TILE.PIPE_TL:
          case CONFIG.TILE.PIPE_TR:
          case CONFIG.TILE.PIPE_BL:
          case CONFIG.TILE.PIPE_BR:
            SpriteRenderer.drawPipePart(ctx, x, y, tile);
            break;
          case CONFIG.TILE.LAVA_TOP:
            SpriteRenderer.drawLavaTop(ctx, x, y, animFrame);
            break;
          case CONFIG.TILE.LAVA_BODY:
            SpriteRenderer.drawLavaBody(ctx, x, y);
            break;
          case CONFIG.TILE.BRIDGE:
            SpriteRenderer.drawBridge(ctx, x, y);
            break;
          case CONFIG.TILE.AXE:
            SpriteRenderer.drawAxe(ctx, x, y, animFrame);
            break;
          case CONFIG.TILE.FLAG_POLE:
            ctx.fillStyle = '#00a800';
            ctx.fillRect(x + 7, y, 2, 16);
            break;
          case CONFIG.TILE.FLAG_TOP:
            ctx.fillStyle = '#00a800';
            ctx.beginPath();
            ctx.arc(x + 8, y + 10, 4, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
      }
    }

    // 4. 绘制终点胜利旗帜 (非城堡关跟随下降状态)
    if (this.stage !== 4) {
      const flagScreenX = this.flagPoleX - cameraX - 12;
      const flagScreenY = this.flagY;
      if (flagScreenX > -20 && flagScreenX < CONFIG.VIEWPORT_WIDTH + 20) {
        ctx.fillStyle = '#00a800';
        ctx.beginPath();
        ctx.moveTo(flagScreenX, flagScreenY);
        ctx.lineTo(flagScreenX + 14, flagScreenY + 6);
        ctx.lineTo(flagScreenX, flagScreenY + 12);
        ctx.fill();
      }
    }
  }

  // 绘制关卡背景元素 (小山与云彩)
  renderScenery(ctx, cameraX) {
    if (this.theme === 'treetop') {
      // 1-3 高空树冠世界：多层飘逸的高空云海与远景白云
      const treetopClouds = [
        { col: 6, row: 2, w: 3 },
        { col: 24, row: 3, w: 2 },
        { col: 42, row: 1, w: 3 },
        { col: 62, row: 3, w: 2 },
        { col: 80, row: 2, w: 4 },
        { col: 102, row: 1, w: 3 },
        { col: 122, row: 3, w: 2 },
        { col: 146, row: 2, w: 3 },
        { col: 168, row: 3, w: 2 },
        { col: 190, row: 1, w: 4 }
      ];
      treetopClouds.forEach(item => {
        const sx = item.col * 16 - cameraX;
        if (sx > -60 && sx < CONFIG.VIEWPORT_WIDTH + 60) {
          SpriteRenderer.drawCloud(ctx, sx, item.row * 16, item.w);
        }
      });
      return;
    }

    const sceneryPoints = [
      { type: 'cloud', col: 8, row: 3, w: 2 },
      { type: 'hill', col: 18, row: 11, h: 32 },
      { type: 'cloud', col: 36, row: 2, w: 3 },
      { type: 'hill', col: 48, row: 11, h: 32 },
      { type: 'cloud', col: 64, row: 4, w: 2 },
      { type: 'cloud', col: 90, row: 3, w: 3 },
      { type: 'hill', col: 104, row: 11, h: 32 },
      { type: 'cloud', col: 124, row: 2, w: 2 },
      { type: 'cloud', col: 145, row: 3, w: 3 },
      { type: 'hill', col: 168, row: 11, h: 32 }
    ];

    sceneryPoints.forEach(item => {
      const sx = item.col * 16 - cameraX;
      if (sx > -60 && sx < CONFIG.VIEWPORT_WIDTH + 60) {
        if (item.type === 'cloud') {
          SpriteRenderer.drawCloud(ctx, sx, item.row * 16, item.w);
        } else if (item.type === 'hill') {
          SpriteRenderer.drawHill(ctx, sx, item.row * 16, item.h);
        }
      }
    });
  }
}
