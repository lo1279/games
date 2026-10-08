/**
 * 🎮 超级马里奥兄弟 - 常量定义与像素级精灵图形渲染器
 * 采用原生 Canvas 2D 像素矩阵绘制，确保原版 8-bit FC 风格与矢量高清缩放
 */

const CONFIG = {
  // 原生 NES 分辨率
  VIEWPORT_WIDTH: 256,
  VIEWPORT_HEIGHT: 240,
  TILE_SIZE: 16,

  // 物理动力学参数 (高保真还原 FC 马里奥操作惯性)
  PHYSICS: {
    GRAVITY: 0.27,
    MAX_FALL_SPEED: 4.8,
    WALK_ACCEL: 0.075,
    RUN_ACCEL: 0.12,
    MAX_WALK_SPEED: 1.5,
    MAX_RUN_SPEED: 2.6,
    FRICTION: 0.06,
    SKID_FRICTION: 0.16,
    JUMP_IMPULSE: -4.8,
    JUMP_HOLD_BONUS: -0.18,
    MAX_JUMP_FRAMES: 16,
    BOUNCE_IMPULSE: -3.6
  },

  // 瓦片枚举
  TILE: {
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,
    QUESTION_COIN: 3,
    QUESTION_MUSHROOM: 4,
    EMPTY_BLOCK: 5,
    HARD_BLOCK: 6,
    PIPE_TL: 7,
    PIPE_TR: 8,
    PIPE_BL: 9,
    PIPE_BR: 10,
    FLAG_POLE: 11,
    FLAG_TOP: 12
  },

  // 经典 NES 色板
  PALETTE: {
    SKY_BLUE: '#5c94fc',
    WHITE: '#ffffff',
    BLACK: '#000000',
    MARIO_RED: '#b81800',
    MARIO_BROWN: '#887000',
    MARIO_SKIN: '#fc9838',
    GOOMBA_BROWN: '#e45c10',
    GOOMBA_DARK: '#482000',
    KOOPA_GREEN: '#00a800',
    KOOPA_YELLOW: '#fcd800',
    BRICK_BROWN: '#b84418',
    BRICK_DARK: '#000000',
    QUESTION_YELLOW: '#fc9838',
    PIPE_GREEN: '#00a800',
    PIPE_LIGHT: '#80d010',
    PIPE_DARK: '#005000',
    CLOUD_WHITE: '#fcfcfc',
    CLOUD_BORDER: '#000000',
    HILL_GREEN: '#00a800',
    HILL_DOT: '#005000',
    CASTLE_BRICK: '#b84418',
    CASTLE_GATE: '#000000',
    FLAG_GREEN: '#00a800'
  }
};

/**
 * 🎨 8-Bit 像素绘制工具集
 */
const SpriteRenderer = {
  // 绘制 16x16 地面砖
  drawGroundTile(ctx, x, y, theme = 'overworld') {
    const isUnder = theme === 'underground';
    const isTree = theme === 'treetop';
    ctx.fillStyle = isUnder ? '#008088' : (isTree ? '#00a800' : CONFIG.PALETTE.BRICK_BROWN);
    ctx.fillRect(x, y, 16, 16);
    // 高光与纹理
    ctx.fillStyle = isUnder ? '#00e8d8' : (isTree ? '#80d010' : '#fc9838');
    ctx.fillRect(x, y, 15, 1);
    ctx.fillRect(x, y, 1, 15);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y + 15, 16, 1);
    ctx.fillRect(x + 15, y, 1, 16);
    // 内部斑纹
    ctx.fillStyle = isUnder ? '#004050' : (isTree ? '#005800' : '#602000');
    ctx.fillRect(x + 3, y + 4, 3, 3);
    ctx.fillRect(x + 9, y + 7, 3, 3);
    ctx.fillRect(x + 4, y + 11, 3, 3);
  },

  // 绘制普通砖块 (支持地表、地下与高空主题)
  drawBrick(ctx, x, y, offsetY = 0, theme = 'overworld') {
    const drawY = y + offsetY;
    const isUnder = theme === 'underground';
    const isTree = theme === 'treetop';
    ctx.fillStyle = isUnder ? '#008088' : (isTree ? '#b84418' : CONFIG.PALETTE.BRICK_BROWN);
    ctx.fillRect(x, drawY, 16, 16);
    // 砖块黑色缝隙线条
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, drawY + 7, 16, 2);
    ctx.fillRect(x, drawY + 15, 16, 1);
    ctx.fillRect(x + 7, drawY, 2, 7);
    ctx.fillRect(x + 3, drawY + 8, 2, 7);
    ctx.fillRect(x + 12, drawY + 8, 2, 7);
    // 高光边缘
    ctx.fillStyle = isUnder ? '#00e8d8' : (isTree ? '#fc9838' : '#fc9838');
    ctx.fillRect(x, drawY, 15, 1);
    ctx.fillRect(x, drawY + 8, 15, 1);
  },

  // 绘制坚硬石块 (台阶、浮岛与障碍)
  drawHardBlock(ctx, x, y, theme = 'overworld') {
    const isUnder = theme === 'underground';
    const isTree = theme === 'treetop';
    ctx.fillStyle = isUnder ? '#008088' : (isTree ? '#00a800' : '#b84418');
    ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = isUnder ? '#00e8d8' : (isTree ? '#80d010' : '#fc9838');
    ctx.fillRect(x, y, 15, 2);
    ctx.fillRect(x, y, 2, 15);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillRect(x + 14, y, 2, 16);
    ctx.fillRect(x + 4, y + 4, 8, 8);
  },

  // 绘制问号砖块
  drawQuestionBlock(ctx, x, y, frame = 0, offsetY = 0) {
    const drawY = y + offsetY;
    // 背景亮黄色
    ctx.fillStyle = '#fc9838';
    ctx.fillRect(x, drawY, 16, 16);
    // 四周暗边与角上的铆钉
    ctx.fillStyle = '#b84418';
    ctx.fillRect(x, drawY, 16, 1);
    ctx.fillRect(x, drawY + 15, 16, 1);
    ctx.fillRect(x, drawY, 1, 16);
    ctx.fillRect(x + 15, drawY, 1, 16);
    // 角落螺栓
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 1, drawY + 1, 1, 1);
    ctx.fillRect(x + 14, drawY + 1, 1, 1);
    ctx.fillRect(x + 1, drawY + 14, 1, 1);
    ctx.fillRect(x + 14, drawY + 14, 1, 1);

    // 绘制经典的问号符号
    ctx.fillStyle = '#000000';
    // 问号顶部弯曲
    ctx.fillRect(x + 5, drawY + 3, 6, 2);
    ctx.fillRect(x + 9, drawY + 4, 3, 4);
    ctx.fillRect(x + 6, drawY + 7, 4, 2);
    ctx.fillRect(x + 6, drawY + 9, 2, 2);
    // 问号下面的点
    ctx.fillRect(x + 6, drawY + 12, 2, 2);
  },

  // 绘制顶过后的空砖块 (实心深棕色带四角铆钉)
  drawEmptyBlock(ctx, x, y, offsetY = 0) {
    const drawY = y + offsetY;
    ctx.fillStyle = '#887000';
    ctx.fillRect(x, drawY, 16, 16);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, drawY, 16, 1);
    ctx.fillRect(x, drawY + 15, 16, 1);
    ctx.fillRect(x, drawY, 1, 16);
    ctx.fillRect(x + 15, drawY, 1, 16);
    // 四角铆钉
    ctx.fillRect(x + 2, drawY + 2, 2, 2);
    ctx.fillRect(x + 12, drawY + 2, 2, 2);
    ctx.fillRect(x + 2, drawY + 12, 2, 2);
    ctx.fillRect(x + 12, drawY + 12, 2, 2);
  },

  // 绘制经典绿水管片段
  drawPipePart(ctx, x, y, type) {
    const P = CONFIG.PALETTE;
    if (type === CONFIG.TILE.PIPE_TL) {
      ctx.fillStyle = P.PIPE_GREEN;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = P.PIPE_LIGHT;
      ctx.fillRect(x, y, 4, 16);
      ctx.fillRect(x, y, 16, 2);
      ctx.fillStyle = P.PIPE_DARK;
      ctx.fillRect(x, y + 14, 16, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, 1, 16);
    } else if (type === CONFIG.TILE.PIPE_TR) {
      ctx.fillStyle = P.PIPE_GREEN;
      ctx.fillRect(x, y, 16, 16);
      ctx.fillStyle = P.PIPE_LIGHT;
      ctx.fillRect(x, y, 16, 2);
      ctx.fillStyle = P.PIPE_DARK;
      ctx.fillRect(x + 11, y, 4, 16);
      ctx.fillRect(x, y + 14, 16, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 15, y, 1, 16);
    } else if (type === CONFIG.TILE.PIPE_BL) {
      ctx.fillStyle = P.PIPE_GREEN;
      ctx.fillRect(x + 2, y, 14, 16);
      ctx.fillStyle = P.PIPE_LIGHT;
      ctx.fillRect(x + 2, y, 4, 16);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 2, y, 1, 16);
    } else if (type === CONFIG.TILE.PIPE_BR) {
      ctx.fillStyle = P.PIPE_GREEN;
      ctx.fillRect(x, y, 14, 16);
      ctx.fillStyle = P.PIPE_DARK;
      ctx.fillRect(x + 9, y, 4, 16);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 13, y, 1, 16);
    }
  },

  // 绘制小马里奥 (16x16)
  drawSmallMario(ctx, x, y, facingRight, state, frame) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    if (!facingRight) {
      ctx.scale(-1, 1);
      ctx.translate(-16, 0);
    }

    const R = CONFIG.PALETTE.MARIO_RED;
    const B = CONFIG.PALETTE.MARIO_BROWN;
    const S = CONFIG.PALETTE.MARIO_SKIN;

    if (state === 'die') {
      // 阵亡姿态
      ctx.fillStyle = R;
      ctx.fillRect(3, 0, 10, 5); // 帽子
      ctx.fillStyle = S;
      ctx.fillRect(3, 5, 10, 4); // 脸
      ctx.fillStyle = R;
      ctx.fillRect(2, 9, 12, 4); // 上身
      ctx.fillStyle = B;
      ctx.fillRect(1, 13, 6, 3); // 腿
      ctx.fillRect(9, 13, 6, 3);
      ctx.restore();
      return;
    }

    if (state === 'jump') {
      // 经典跳跃飞扑姿态
      // 帽子
      ctx.fillStyle = R;
      ctx.fillRect(5, 0, 8, 3);
      // 头部/面部
      ctx.fillStyle = S;
      ctx.fillRect(4, 3, 9, 4);
      // 头发与胡子
      ctx.fillStyle = B;
      ctx.fillRect(3, 2, 3, 3);
      ctx.fillRect(8, 4, 4, 2);
      // 衣服
      ctx.fillStyle = R;
      ctx.fillRect(2, 6, 11, 4);
      // 伸展手
      ctx.fillStyle = S;
      ctx.fillRect(1, 4, 3, 3);
      ctx.fillRect(11, 8, 3, 3);
      // 背带裤与腿部
      ctx.fillStyle = B;
      ctx.fillRect(4, 9, 8, 4);
      ctx.fillRect(1, 12, 5, 4);
      ctx.fillRect(10, 10, 5, 4);
      ctx.restore();
      return;
    }

    if (state === 'skid') {
      // 刹车转向姿态
      ctx.fillStyle = R;
      ctx.fillRect(3, 1, 8, 3);
      ctx.fillStyle = S;
      ctx.fillRect(3, 4, 8, 4);
      ctx.fillStyle = B;
      ctx.fillRect(2, 2, 2, 4);
      ctx.fillRect(8, 5, 3, 2);
      ctx.fillStyle = R;
      ctx.fillRect(2, 7, 9, 4);
      ctx.fillStyle = B;
      ctx.fillRect(3, 11, 8, 5);
      ctx.restore();
      return;
    }

    // 站立或跑动动画帧
    // 帽子
    ctx.fillStyle = R;
    ctx.fillRect(4, 1, 7, 3);
    ctx.fillRect(3, 2, 10, 2);
    // 脸部
    ctx.fillStyle = S;
    ctx.fillRect(4, 4, 8, 4);
    // 眼睛与胡子
    ctx.fillStyle = '#000';
    ctx.fillRect(8, 4, 1, 2);
    ctx.fillStyle = B;
    ctx.fillRect(2, 3, 3, 3); // 头发
    ctx.fillRect(7, 6, 4, 2); // 胡须
    // 衣服与背带
    ctx.fillStyle = R;
    ctx.fillRect(3, 8, 10, 3);
    ctx.fillStyle = B;
    ctx.fillRect(4, 9, 8, 4);
    // 手
    ctx.fillStyle = S;
    ctx.fillRect(2, 9, 2, 2);
    ctx.fillRect(11, 9, 2, 2);

    // 跑动腿部动画帧
    if (state === 'run') {
      const f = Math.floor(frame) % 3;
      if (f === 0) {
        ctx.fillStyle = B;
        ctx.fillRect(2, 12, 4, 4);
        ctx.fillRect(9, 12, 5, 3);
      } else if (f === 1) {
        ctx.fillStyle = B;
        ctx.fillRect(4, 12, 4, 4);
        ctx.fillRect(8, 12, 4, 4);
      } else {
        ctx.fillStyle = B;
        ctx.fillRect(1, 11, 4, 4);
        ctx.fillRect(8, 12, 6, 4);
      }
    } else {
      // 站立
      ctx.fillStyle = B;
      ctx.fillRect(3, 12, 4, 4);
      ctx.fillRect(8, 12, 4, 4);
    }

    ctx.restore();
  },

  // 绘制大马里奥 (16x32)
  drawBigMario(ctx, x, y, facingRight, state, frame, isCrouching = false) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    if (!facingRight) {
      ctx.scale(-1, 1);
      ctx.translate(-16, 0);
    }

    const R = CONFIG.PALETTE.MARIO_RED;
    const B = CONFIG.PALETTE.MARIO_BROWN;
    const S = CONFIG.PALETTE.MARIO_SKIN;

    if (isCrouching) {
      // 下蹲姿态 (高度缩减为 20px)
      ctx.fillStyle = R;
      ctx.fillRect(4, 10, 8, 4);
      ctx.fillStyle = S;
      ctx.fillRect(4, 14, 8, 5);
      ctx.fillStyle = B;
      ctx.fillRect(7, 16, 4, 2);
      ctx.fillStyle = R;
      ctx.fillRect(3, 19, 10, 5);
      ctx.fillStyle = B;
      ctx.fillRect(2, 24, 12, 8);
      ctx.restore();
      return;
    }

    if (state === 'jump') {
      // 腾空飞跃
      ctx.fillStyle = R;
      ctx.fillRect(4, 2, 8, 4);
      ctx.fillStyle = S;
      ctx.fillRect(4, 6, 9, 6);
      ctx.fillStyle = B;
      ctx.fillRect(3, 5, 3, 4);
      ctx.fillRect(8, 8, 5, 3);
      ctx.fillStyle = R;
      ctx.fillRect(2, 12, 12, 8);
      ctx.fillStyle = S;
      ctx.fillRect(0, 10, 4, 4);
      ctx.fillRect(12, 16, 4, 4);
      ctx.fillStyle = B;
      ctx.fillRect(4, 18, 8, 6);
      ctx.fillRect(1, 23, 6, 6);
      ctx.fillRect(10, 21, 6, 5);
      ctx.restore();
      return;
    }

    // 站立或跑动
    // 帽子
    ctx.fillStyle = R;
    ctx.fillRect(4, 2, 8, 4);
    ctx.fillRect(3, 4, 10, 2);
    // 脸部
    ctx.fillStyle = S;
    ctx.fillRect(4, 6, 9, 6);
    // 头发与胡子
    ctx.fillStyle = B;
    ctx.fillRect(2, 5, 3, 4);
    ctx.fillRect(8, 9, 5, 2);
    // 眼睛
    ctx.fillStyle = '#000';
    ctx.fillRect(9, 7, 2, 2);
    // 红色上衣
    ctx.fillStyle = R;
    ctx.fillRect(3, 12, 10, 7);
    ctx.fillStyle = S;
    ctx.fillRect(1, 14, 3, 4);
    ctx.fillRect(12, 14, 3, 4);
    // 背带裤
    ctx.fillStyle = B;
    ctx.fillRect(4, 18, 8, 6);

    // 双腿
    if (state === 'run') {
      const f = Math.floor(frame) % 3;
      if (f === 0) {
        ctx.fillStyle = B;
        ctx.fillRect(2, 24, 5, 8);
        ctx.fillRect(10, 24, 5, 6);
      } else if (f === 1) {
        ctx.fillStyle = B;
        ctx.fillRect(4, 24, 4, 8);
        ctx.fillRect(8, 24, 4, 8);
      } else {
        ctx.fillStyle = B;
        ctx.fillRect(1, 22, 5, 7);
        ctx.fillRect(9, 24, 6, 8);
      }
    } else {
      ctx.fillStyle = B;
      ctx.fillRect(3, 24, 5, 8);
      ctx.fillRect(9, 24, 5, 8);
    }

    ctx.restore();
  },

  // 绘制板栗仔 (Goomba 16x16)
  drawGoomba(ctx, x, y, frame, isFlat = false) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    const B = CONFIG.PALETTE.GOOMBA_BROWN;
    const D = CONFIG.PALETTE.GOOMBA_DARK;
    const S = CONFIG.PALETTE.MARIO_SKIN;

    if (isFlat) {
      // 被踩扁
      ctx.fillStyle = B;
      ctx.fillRect(1, 9, 14, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(4, 10, 2, 2);
      ctx.fillRect(10, 10, 2, 2);
      ctx.fillStyle = D;
      ctx.fillRect(0, 14, 16, 2);
      ctx.restore();
      return;
    }

    // 头部大蘑菇头
    ctx.fillStyle = B;
    ctx.fillRect(3, 1, 10, 3);
    ctx.fillRect(1, 4, 14, 6);
    // 眼睛
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 7, 2, 4);
    ctx.fillRect(10, 7, 2, 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(4, 7, 1, 3);
    ctx.fillRect(11, 7, 1, 3);
    // 眉毛
    ctx.fillStyle = D;
    ctx.fillRect(3, 6, 3, 1);
    ctx.fillRect(10, 6, 3, 1);
    // 下巴
    ctx.fillStyle = S;
    ctx.fillRect(4, 10, 8, 2);

    // 脚部交替踏步
    ctx.fillStyle = D;
    const f = Math.floor(frame) % 2;
    if (f === 0) {
      ctx.fillRect(1, 12, 4, 4);
      ctx.fillRect(9, 12, 5, 4);
    } else {
      ctx.fillRect(2, 12, 5, 4);
      ctx.fillRect(11, 12, 4, 4);
    }

    ctx.restore();
  },

  // 绘制绿乌龟 (Koopa 16x24)
  drawKoopa(ctx, x, y, facingRight, state, frame) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    if (!facingRight) {
      ctx.scale(-1, 1);
      ctx.translate(-16, 0);
    }

    const G = CONFIG.PALETTE.KOOPA_GREEN;
    const Y = CONFIG.PALETTE.KOOPA_YELLOW;
    const W = '#ffffff';

    if (state === 'shell' || state === 'shell_moving') {
      // 龟壳形态 16x16
      ctx.fillStyle = G;
      ctx.fillRect(2, 8, 12, 8);
      ctx.fillStyle = Y;
      ctx.fillRect(4, 10, 8, 5);
      ctx.fillStyle = W;
      ctx.fillRect(6, 11, 4, 3);
      ctx.restore();
      return;
    }

    // 乌龟头部
    ctx.fillStyle = G;
    ctx.fillRect(7, 2, 7, 6);
    ctx.fillStyle = W;
    ctx.fillRect(10, 3, 3, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(11, 4, 1, 2);
    // 龟壳躯体
    ctx.fillStyle = G;
    ctx.fillRect(3, 8, 10, 9);
    ctx.fillStyle = Y;
    ctx.fillRect(5, 10, 7, 6);
    // 双脚走动
    ctx.fillStyle = Y;
    const f = Math.floor(frame) % 2;
    if (f === 0) {
      ctx.fillRect(2, 17, 4, 7);
      ctx.fillRect(9, 17, 5, 6);
    } else {
      ctx.fillRect(3, 17, 5, 6);
      ctx.fillRect(10, 17, 4, 7);
    }

    ctx.restore();
  },

  // 绘制超级红蘑菇道具 (16x16)
  drawMushroom(ctx, x, y) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    // 蘑菇红伞面
    ctx.fillStyle = CONFIG.PALETTE.MARIO_RED;
    ctx.fillRect(2, 1, 12, 9);
    // 白色斑点
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 2, 4, 4);
    ctx.fillRect(2, 4, 2, 3);
    ctx.fillRect(12, 4, 2, 3);
    // 蘑菇白色根茎
    ctx.fillStyle = CONFIG.PALETTE.MARIO_SKIN;
    ctx.fillRect(4, 9, 8, 6);
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 11, 1, 2);
    ctx.fillRect(10, 11, 1, 2);
    ctx.restore();
  },

  // 绘制跳跃弹起的闪烁金币 (8x16)
  drawCoin(ctx, x, y, frame = 0) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));
    const f = Math.floor(frame) % 4;
    const Y = '#fc9838';
    const W = '#ffffff';

    if (f === 0 || f === 2) {
      // 宽金币
      ctx.fillStyle = Y;
      ctx.fillRect(3, 1, 10, 14);
      ctx.fillStyle = W;
      ctx.fillRect(6, 3, 2, 10);
      ctx.fillStyle = '#000';
      ctx.fillRect(2, 2, 1, 12);
      ctx.fillRect(13, 2, 1, 12);
    } else if (f === 1) {
      // 中等宽度
      ctx.fillStyle = Y;
      ctx.fillRect(5, 1, 6, 14);
      ctx.fillStyle = W;
      ctx.fillRect(7, 3, 2, 10);
    } else {
      // 细条侧面
      ctx.fillStyle = Y;
      ctx.fillRect(7, 1, 2, 14);
    }
    ctx.restore();
  },

  // 绘制碎砖粒子 (8x8 飞溅)
  drawBrickDebris(ctx, x, y) {
    ctx.fillStyle = CONFIG.PALETTE.BRICK_BROWN;
    ctx.fillRect(Math.floor(x), Math.floor(y), 8, 8);
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.floor(x) + 2, Math.floor(y) + 2, 4, 4);
  },

  // 绘制云朵
  drawCloud(ctx, x, y, widthInTiles = 3) {
    ctx.fillStyle = '#ffffff';
    const px = Math.floor(x);
    const py = Math.floor(y);
    const w = widthInTiles * 16;
    // 蓬松半圆与云底
    ctx.beginPath();
    ctx.arc(px + 12, py + 12, 10, 0, Math.PI * 2);
    ctx.arc(px + w / 2, py + 8, 14, 0, Math.PI * 2);
    ctx.arc(px + w - 12, py + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 8, py + 10, w - 16, 12);
  },

  // 绘制绿色小山丘
  drawHill(ctx, x, y, height = 35) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    ctx.fillStyle = CONFIG.PALETTE.HILL_GREEN;
    ctx.beginPath();
    ctx.ellipse(px + 30, py + height, 36, height, 0, Math.PI, 0);
    ctx.fill();
    // 山丘斑点
    ctx.fillStyle = CONFIG.PALETTE.HILL_DOT;
    ctx.fillRect(px + 28, py + 8, 4, 4);
    ctx.fillRect(px + 20, py + 18, 4, 4);
    ctx.fillRect(px + 38, py + 22, 4, 4);
  },

  // 绘制终点小城堡
  drawCastle(ctx, x, y) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    ctx.fillStyle = CONFIG.PALETTE.CASTLE_BRICK;
    // 城堡主体
    ctx.fillRect(px + 8, py + 24, 64, 56);
    // 左右城垛与顶部高塔
    ctx.fillRect(px + 20, py, 40, 24);
    ctx.fillRect(px + 4, py + 16, 12, 16);
    ctx.fillRect(px + 64, py + 16, 12, 16);
    // 城门与小窗口
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + 32, py + 48, 16, 32);
    ctx.fillRect(px + 36, py + 10, 8, 10);
  }
};
