/**
 * utils/games-data.js - 大厅游戏元数据与本地存储管理
 *
 * 迁移自 Web 版 js/hall.js 的 GAMES_DATA 与 StorageManager，
 * 存储层由 localStorage 替换为小程序 wx.getStorageSync / wx.setStorageSync。
 *
 * playable 字段说明：
 *   true  = 已在小程序内完成原生重写，可直接进入
 *   false = 暂未移植，卡片展示为「敬请期待」不可点击进入
 * 后续逐款移植时只需将该字段改为 true 并补齐 route。
 */

/**
 * 分类字典：id -> 中文名
 * fav 为收藏筛选页，由运行时追加（不在静态数据中体现）
 */
const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: 'casual', label: '休闲益智' },
  { id: 'strategy', label: '策略卡牌' },
  { id: 'action', label: '动作射击' },
  { id: 'arcade', label: '街机复古' },
  { id: 'fav', label: '我的收藏' }
];

const GAMES_DATA = [
  {
    id: 'minesweeper',
    title: '经典扫雷',
    englishTitle: 'Minesweeper',
    category: 'casual',
    categoryLabel: '休闲益智',
    tags: ['经典复古', '逻辑推理', '双重主题', '排行榜'],
    icon: '💣',
    accentColor: '#38bdf8',
    summary: '高还原度经典扫雷，支持初中高级三档雷区，搭载现代发光主题与胜利反馈，底部双模切换专为手机触屏设计。',
    controls: '默认挖掘模式单触翻开；切换插旗模式后单触标记地雷；长按任意格子可快捷插旗。',
    rating: '4.8',
    features: ['初中高三档难度自由切换', '触屏双模挖掘/插旗操作', '本地最佳成绩排行榜', '震动反馈与首踩无雷机制'],
    playable: true,
    route: '/pages/games/minesweeper/index'
  },
  {
    id: 'three-kingdoms-slg',
    title: '三国志·鼎立战略版',
    englishTitle: 'Three Kingdoms SLG',
    category: 'strategy',
    categoryLabel: '策略卡牌',
    tags: ['无限金铢', '经典战役', '演武爬塔', '兵种克制'],
    icon: '⚔️',
    accentColor: '#f59e0b',
    summary: '单机专属战役卡牌对战，聚焦虎牢关/官渡/赤壁/夷陵等历史战役演义与演武试炼通天阁，满兵自由配队。',
    controls: '触屏点选历史战役与演武试炼出征；自由搭配魏蜀吴五星名将与传承战法。',
    rating: '5.0',
    features: ['三国经典战役演义(1~3星评定)', '演武试炼阶梯天梯通天阁', '全套指挥/被动/主动战法', '骑盾弓枪循环相克与主将斩首'],
    playable: false,
    route: ''
  },
  {
    id: 'life-simulator',
    title: '人生模拟器 · 轮回录',
    englishTitle: 'Life Simulator',
    category: 'strategy',
    categoryLabel: '模拟养成',
    tags: ['人生模拟', '轮回神殿', '商海大亨', 'D20检定'],
    icon: '✨',
    accentColor: '#ec4899',
    summary: '高自由度人生转生模拟器，融合功德神殿局外升级、商海理财创业、红尘良缘婚育与家族世代传承。',
    controls: '触屏点选天赋与自由属性点，点击「下一年」演进人生。',
    rating: '5.0',
    features: ['局外功德神殿永久养成', '商海大亨：基金/房产/创业', '良缘恋爱婚育与世代继承', 'D20 命运转盘物理检定'],
    playable: false,
    route: ''
  },
  {
    id: 'dice-game',
    title: '3D 骰王争霸',
    englishTitle: 'Dice Master 3D',
    category: 'casual',
    categoryLabel: '休闲益智',
    tags: ['3D物理', '聚会博弈', '拟真音效', '筹码系统'],
    icon: '🎲',
    accentColor: '#f59e0b',
    summary: 'Three.js 动力学物理掷骰，涵盖骰宝押大小、吹牛大话骰、快艇骰子与自由随心掷骰四合一玩法。',
    controls: '点击投掷、锁定与下注；支持破产救济金。',
    rating: '4.9',
    features: ['真实物理碰撞与重力', '实时合成拟真音效', '经典四合一玩法合集', '本地筹码存档'],
    playable: false,
    route: ''
  },
  {
    id: 'mythology-deckbuilder',
    title: '万神纪元：诸神对决',
    englishTitle: 'Mythology Deckbuilder',
    category: 'strategy',
    categoryLabel: '策略卡牌',
    tags: ['Roguelike', '牌组构筑', '神话题材', '回合制'],
    icon: '⚡',
    accentColor: '#a855f7',
    summary: '跨神话体系 Roguelike 卡牌对战，融合华夏、希腊、北欧神祇，收集神力卡牌与古老遗物挑战远古魔神。',
    controls: '点选出牌，根据能量点数与连携效果制定策略，结束回合结算战斗。',
    rating: '5.0',
    features: ['多阵营多神系套牌流派', '丰富的神器遗物与突发事件', '分支爬塔路线规划', '回合制策略对战'],
    playable: false,
    route: ''
  },
  {
    id: 'tank-battle',
    title: '经典坦克大战',
    englishTitle: 'Tank Battle FC',
    category: 'action',
    categoryLabel: '动作射击',
    tags: ['街机红白机', '复古怀旧', '基地保卫', 'CRT滤镜'],
    icon: '🛡️',
    accentColor: '#22c55e',
    summary: '原汁原味 FC 坦克大战复刻，守护老鹰基地，击溃敌方多型坦克，拾取星星与手雷升级重炮。',
    controls: '方向键移动坦克，开火键射击，暂停键暂停。',
    rating: '4.9',
    features: ['高保真 FC 操控手感', '砖墙/钢板/河流/草丛地形', 'CRT 显像管扫描线', '道具与敌军 AI'],
    playable: false,
    route: ''
  },
  {
    id: 'three-kingdoms-td',
    title: '三国志·群英塔防',
    englishTitle: 'Three Kingdoms TD',
    category: 'strategy',
    categoryLabel: '策略卡牌',
    tags: ['塔防战略', '三国演义', '武将技能', '兵种克制'],
    icon: '🏯',
    accentColor: '#eab308',
    summary: '以三国宏大历史为背景的策略塔防，布置关羽、张飞、诸葛亮等名将，释放必杀大招抵御千军万马。',
    controls: '点击武将卡布阵，点击已部署武将可升级或释放绝技。',
    rating: '4.9',
    features: ['蜀魏吴知名武将阵容', '技能动画与大招特效', '兵种相克与攻击范围', '关卡策略与兵线运营'],
    playable: false,
    route: ''
  },
  {
    id: 'tetris',
    title: '霓虹俄罗斯方块',
    englishTitle: 'Tetris Neon Arcade',
    category: 'arcade',
    categoryLabel: '街机复古',
    tags: ['霓虹赛博', '方块消除', 'Hold暂存', '连击消行'],
    icon: '🕹️',
    accentColor: '#ec4899',
    summary: '未来赛博霓虹风格经典俄罗斯方块，支持方块暂存（Hold）、幽灵方块投影与连消加倍得分。',
    controls: '左右移动，旋转方块，软降，硬降到底，暂存(Hold)，暂停。',
    rating: '4.9',
    features: ['7-Bag 官方随机方块生成法', '幽灵方块落点预测', '平滑流畅输入响应', '多级下落速度与高分榜'],
    playable: false,
    route: ''
  },
  {
    id: 'thunder-fighter',
    title: '雷霆战机',
    englishTitle: 'Thunder Fighter STG',
    category: 'action',
    categoryLabel: '动作射击',
    tags: ['飞行射击', '弹幕STG', '战机暴走', 'BOSS激斗'],
    icon: '🚀',
    accentColor: '#06b6d4',
    summary: '太空弹幕飞行射击，驾驶星际战机拾取能量水晶升级弹道，开启狂暴模式歼灭敌军母舰。',
    controls: '移动战机，自动射击，释放全屏大招。',
    rating: '4.8',
    features: ['绚丽粒子光效与弹幕轨迹', '僚机副武器进阶系统', '狂暴过载暴走状态', '巨型 BOSS 多阶段战斗'],
    playable: false,
    route: ''
  },
  {
    id: 'super-mario',
    title: '超级马里奥兄弟',
    englishTitle: 'Super Mario Bros FC',
    category: 'arcade',
    categoryLabel: '街机复古',
    tags: ['经典FC', '平台跳跃', '横版闯关', '红白机'],
    icon: '🍄',
    accentColor: '#ef4444',
    summary: '原生复刻 1985 年红白机《超级马里奥兄弟》，含 World 1-1 地表、1-2 地下洞窟、1-3 高空树冠与 1-4 库巴城堡。',
    controls: '左右移动，下蹲，跳跃（长按大跳/轻按小跳），冲刺奔跑，暂停，重开。',
    rating: '5.0',
    features: ['高保真 NES 物理加速度手感', 'World 1-1 ~ 1-4 四大关连续挑战', '8-Bit 专属旋律实时合成', '旋转火球棒与库巴 Boss 战'],
    playable: false,
    route: ''
  }
];

/**
 * 存储管理器：封装收藏与游玩统计的读写
 * 所有方法内部已做异常兜底，存储不可用时降级为「仅本次会话有效」
 */
const StorageManager = {
  FAV_KEY: 'gamehub_favorites',
  STATS_KEY: 'gamehub_play_stats',

  /** 读取收藏列表 */
  getFavorites() {
    try {
      return wx.getStorageSync(this.FAV_KEY) || [];
    } catch (e) {
      return [];
    }
  },

  /** 保存收藏列表 */
  setFavorites(list) {
    try {
      wx.setStorageSync(this.FAV_KEY, list);
    } catch (e) {
      console.warn('收藏保存失败', e);
    }
  },

  /** 判断某游戏是否已收藏 */
  isFavorite(id) {
    return this.getFavorites().indexOf(id) !== -1;
  },

  /**
   * 切换收藏状态
   * @returns {boolean} 切换后是否为已收藏
   */
  toggleFavorite(id) {
    const list = this.getFavorites();
    const idx = list.indexOf(id);
    if (idx === -1) {
      list.push(id);
      this.setFavorites(list);
      return true;
    }
    list.splice(idx, 1);
    this.setFavorites(list);
    return false;
  },

  /** 读取全部游玩统计 */
  getStats() {
    try {
      return wx.getStorageSync(this.STATS_KEY) || {};
    } catch (e) {
      return {};
    }
  },

  /**
   * 记录一次游玩
   * @param {string} id 游戏 id
   */
  recordPlay(id) {
    const stats = this.getStats();
    if (!stats[id]) {
      stats[id] = { plays: 0, lastPlayed: 0 };
    }
    stats[id].plays += 1;
    stats[id].lastPlayed = Date.now();
    try {
      wx.setStorageSync(this.STATS_KEY, stats);
    } catch (e) {
      console.warn('游玩统计保存失败', e);
    }
  },

  /** 累计游玩总次数 */
  getTotalPlays() {
    let total = 0;
    const stats = this.getStats();
    for (const key in stats) {
      if (Object.prototype.hasOwnProperty.call(stats, key) && stats[key]) {
        total += stats[key].plays || 0;
      }
    }
    return total;
  }
};

module.exports = {
  GAMES_DATA,
  CATEGORIES,
  StorageManager
};