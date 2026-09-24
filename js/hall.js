/**
 * 🎮 综合游戏大厅 (Game Hub) - 核心控制引擎
 * 集成 7 款精品 Web 游戏，提供沉浸剧场游玩、独立窗口运行、分类检索与本地持久化
 */

// 7 款精品游戏元数据
const GAMES_DATA = [
  {
    id: 'dice-game',
    title: '3D 骰王争霸',
    englishTitle: 'Dice Master 3D',
    category: 'casual',
    categoryLabel: '休闲益智',
    tags: ['3D物理', '聚会博弈', '程序化音效', '筹码系统'],
    icon: '🎲',
    accentColor: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.08) 100%)',
    borderGlow: 'rgba(245, 158, 11, 0.45)',
    summary: '真实 Three.js 动力学物理掷骰，涵盖骰宝押大小、吹牛大话骰、快艇骰子与自由随心掷骰四合一。',
    path: 'dice-game/index.html',
    controls: '鼠标点击投掷、锁定与下注；支持破产救济金与拟真程序化音效切换。',
    rating: '4.9',
    features: ['Three.js 真实物理碰撞与重力', 'Web Audio 实时合成拟真音效', '经典四合一玩法合集', 'LocalStorage 自动存档']
  },
  {
    id: 'minesweeper',
    title: '经典扫雷',
    englishTitle: 'Minesweeper Modern',
    category: 'puzzle',
    categoryLabel: '休闲益智',
    tags: ['经典复古', '逻辑推理', '双重主题', '排行榜'],
    icon: '💣',
    accentColor: '#38bdf8',
    gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(3, 105, 161, 0.08) 100%)',
    borderGlow: 'rgba(56, 189, 248, 0.45)',
    summary: '高还原度经典扫雷，支持初中高级与自定义雷区，搭载现代发光与复古 Win98 双主题及胜利粒子特效。',
    path: 'minesweeper/index.html',
    controls: '鼠标左键翻开格子、右键插旗/取消、双击或左右键同时按下快速排雷。',
    rating: '4.8',
    features: ['经典与现代双主题随心切', '自定义长宽与雷数', '本地最佳纪录榜', '首踩无雷防猝死机制']
  },
  {
    id: 'mythology-deckbuilder',
    title: '万神纪元：诸神对决',
    englishTitle: 'Mythology Deckbuilder',
    category: 'strategy',
    categoryLabel: '策略卡牌',
    tags: ['Roguelike', '牌组构筑', '神话题材', '回合制策略'],
    icon: '⚡',
    accentColor: '#a855f7',
    gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(126, 34, 206, 0.08) 100%)',
    borderGlow: 'rgba(168, 85, 247, 0.45)',
    summary: '跨神话体系 Roguelike 卡牌对战，融合华夏、希腊、北欧神祇，收集神力卡牌与古老遗物，挑战远古魔神。',
    path: 'mythology-deckbuilder/dist/index.html',
    controls: '鼠标拖拽/点击出牌，根据能量点数与连携效果制定出牌策略，结束回合结算战斗。',
    rating: '5.0',
    features: ['React 19 + Tailwind 精致动效', '多阵营多神系套牌流派', '丰富的神器遗物与突发事件', '分支爬塔路线规划']
  },
  {
    id: 'tank-battle',
    title: '经典坦克大战',
    englishTitle: 'Tank Battle 1990 FC',
    category: 'action',
    categoryLabel: '动作射击',
    tags: ['街机红白机', '复古怀旧', '基地保卫', 'CRT滤镜'],
    icon: '🛡️',
    accentColor: '#22c55e',
    gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(21, 128, 61, 0.08) 100%)',
    borderGlow: 'rgba(34, 197, 94, 0.45)',
    summary: '原汁原味 FC 坦克大战复刻，守护老鹰基地，击溃敌方多型坦克，拾取星星与手雷升级重炮。',
    path: 'tank-battle/index.html',
    controls: 'WASD 或 方向键移动坦克，J 键或 空格键开炮射击，P 键暂停游戏。',
    rating: '4.9',
    features: ['高保真 FC 操控手感', '砖墙/钢板/河流/草丛经典地形', '特色 CRT 显像管扫描线', '多种道具与智能敌军AI']
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
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(190, 24, 93, 0.08) 100%)',
    borderGlow: 'rgba(236, 72, 153, 0.45)',
    summary: '未来赛博霓虹风格经典俄罗斯方块，支持方块暂存（Hold）、幽灵方块投影、T-Spin 与连消加倍得分。',
    path: 'tetris/index.html',
    controls: '← → 左右移动，↑ 旋转方块，↓ 软降，空格 硬降到底，C 键暂存(Hold)，P 键暂停。',
    rating: '4.9',
    features: ['7-Bag 官方随机方块生成法', '幽灵方块落点预测', '平滑流畅的输入响应', '多级下落速度与高分榜']
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
    gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(161, 98, 7, 0.08) 100%)',
    borderGlow: 'rgba(234, 179, 8, 0.45)',
    summary: '以三国宏大历史为背景的策略塔防，布置关羽、张飞、诸葛亮等名将，释放必杀大招抵御千军万马。',
    path: 'three-kingdoms-td/dist/index.html?v=preload2026',
    controls: '鼠标点击武将卡拖拽布阵，点击已部署武将可升级或释放专属绝技。',
    rating: '4.9',
    features: ['蜀魏吴知名武将阵容', '技能动画与大招特效', '兵种相克与攻击范围机制', '关卡策略与兵线运营']
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
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(14, 116, 144, 0.08) 100%)',
    borderGlow: 'rgba(6, 182, 212, 0.45)',
    summary: '太空弹幕飞行射击游戏，驾驶先进星际战机，拾取能量水晶升级弹道，开启狂暴模式歼灭敌军母舰。',
    path: 'thunder-fighter/index.html',
    controls: 'WASD 或 方向键移动战机，J 键自动/手动射击，空格键释放全屏毁灭大招。',
    rating: '4.8',
    features: ['绚丽粒子光效与弹幕轨迹', '僚机副武器进阶系统', '狂暴过载暴走状态', '巨型 BOSS 多阶段战斗']
  }
];

// 本地存储管理器
class StorageManager {
  static FAV_KEY = 'gamehub_favorites';
  static STATS_KEY = 'gamehub_play_stats';

  static getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(this.FAV_KEY) || '[]');
    } catch {
      return [];
    }
  }

  static toggleFavorite(gameId) {
    const favs = this.getFavorites();
    const idx = favs.indexOf(gameId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(gameId);
    }
    localStorage.setItem(this.FAV_KEY, JSON.stringify(favs));
    return favs.includes(gameId);
  }

  static isFavorite(gameId) {
    return this.getFavorites().includes(gameId);
  }

  static getStats() {
    try {
      return JSON.parse(localStorage.getItem(this.STATS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  static recordPlay(gameId) {
    const stats = this.getStats();
    if (!stats[gameId]) {
      stats[gameId] = { count: 0, lastPlayed: 0 };
    }
    stats[gameId].count += 1;
    stats[gameId].lastPlayed = Date.now();
    localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
  }

  static getGameStats(gameId) {
    const stats = this.getStats();
    return stats[gameId] || { count: 0, lastPlayed: 0 };
  }

  static getTotalPlayCount() {
    const stats = this.getStats();
    return Object.values(stats).reduce((sum, item) => sum + (item.count || 0), 0);
  }
}

// 格式化时间辅助函数
function formatRelativeTime(timestamp) {
  if (!timestamp) return '未游玩';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// 大厅应用主类
class GameHubApp {
  constructor() {
    this.games = GAMES_DATA;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.sortMethod = 'default';
    this.currentGame = null;

    // DOM 元素缓存
    this.gamesGrid = document.getElementById('gamesGrid');
    this.categoryTabs = document.getElementById('categoryTabs');
    this.searchInput = document.getElementById('searchInput');
    this.sortSelect = document.getElementById('sortSelect');
    this.totalGamesEl = document.getElementById('totalGamesCount');
    this.totalPlaysEl = document.getElementById('totalPlaysCount');
    this.randomGameBtn = document.getElementById('randomGameBtn');

    // 剧场模式 DOM
    this.theaterOverlay = document.getElementById('theaterOverlay');
    this.theaterIframe = document.getElementById('theaterIframe');
    this.theaterTitle = document.getElementById('theaterTitle');
    this.theaterIcon = document.getElementById('theaterIcon');
    this.theaterLoading = document.getElementById('theaterLoading');
    this.theaterCloseBtn = document.getElementById('theaterCloseBtn');
    this.theaterReloadBtn = document.getElementById('theaterReloadBtn');
    this.theaterFullscreenBtn = document.getElementById('theaterFullscreenBtn');
    this.theaterNewTabBtn = document.getElementById('theaterNewTabBtn');
    this.theaterGuideBtn = document.getElementById('theaterGuideBtn');

    // 详情模态框 DOM
    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalClose = document.getElementById('modalClose');
    this.modalIcon = document.getElementById('modalIcon');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalEng = document.getElementById('modalEng');
    this.modalDesc = document.getElementById('modalDesc');
    this.modalControls = document.getElementById('modalControls');
    this.modalFeatures = document.getElementById('modalFeatures');
    this.modalPlayBtn = document.getElementById('modalPlayBtn');
    this.modalDetailGame = null;

    this.init();
  }

  init() {
    this.renderTabs();
    this.renderGames();
    this.updateStatsBar();
    this.bindEvents();
  }

  bindEvents() {
    // 搜索输入
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderGames();
    });

    // 排序选择
    this.sortSelect.addEventListener('change', (e) => {
      this.sortMethod = e.target.value;
      this.renderGames();
    });

    // 随机推荐一个游戏
    this.randomGameBtn.addEventListener('click', () => {
      const randIdx = Math.floor(Math.random() * this.games.length);
      const chosen = this.games[randIdx];
      this.openTheater(chosen);
    });

    // 剧场控制事件
    this.theaterCloseBtn.addEventListener('click', () => this.closeTheater());
    this.theaterReloadBtn.addEventListener('click', () => this.reloadTheater());
    this.theaterFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.theaterGuideBtn.addEventListener('click', () => {
      if (this.currentGame) {
        this.openDetailModal(this.currentGame);
      }
    });

    // 详情弹窗关闭
    this.modalClose.addEventListener('click', () => this.closeDetailModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeDetailModal();
    });

    this.modalPlayBtn.addEventListener('click', () => {
      if (this.modalDetailGame) {
        this.closeDetailModal();
        this.openTheater(this.modalDetailGame);
      }
    });

    // 键盘快捷键监听 (ESC 退出剧场或详情)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modalOverlay.classList.contains('active')) {
          this.closeDetailModal();
        } else if (this.theaterOverlay.classList.contains('active')) {
          this.closeTheater();
        }
      }
    });

    // iframe 加载完成
    this.theaterIframe.addEventListener('load', () => {
      this.hideLoading();
      // 让 iframe 获得焦点，并在同源支持下捕获内部 ESC 按键以平滑退出剧场
      try {
        const cw = this.theaterIframe.contentWindow;
        if (cw) {
          cw.focus();
          cw.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              this.closeTheater();
            }
          });
        }
      } catch (e) {
        // 跨域或安全限制时安全忽略
      }
    });
  }

  renderTabs() {
    const categories = [
      { id: 'all', label: '全部游戏', icon: '🎮' },
      { id: 'puzzle', label: '休闲益智', icon: '🧩' },
      { id: 'strategy', label: '策略卡牌', icon: '⚔️' },
      { id: 'action', label: '动作射击', icon: '💥' },
      { id: 'arcade', label: '街机复古', icon: '👾' },
      { id: 'favorites', label: '我的收藏', icon: '❤️' }
    ];

    this.categoryTabs.innerHTML = categories.map(cat => `
      <button class="tab-btn ${this.activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.label}</span>
      </button>
    `).join('');

    this.categoryTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat;
        this.renderGames();
      });
    });
  }

  filterAndSortGames() {
    const favs = StorageManager.getFavorites();
    const stats = StorageManager.getStats();

    // 1. 过滤
    let filtered = this.games.filter(game => {
      // 分类筛选
      if (this.activeCategory === 'favorites') {
        if (!favs.includes(game.id)) return false;
      } else if (this.activeCategory === 'puzzle') {
        if (game.category !== 'puzzle' && game.category !== 'casual') return false;
      } else if (this.activeCategory !== 'all' && game.category !== this.activeCategory) {
        return false;
      }

      // 关键词搜索
      if (this.searchQuery) {
        const text = `${game.title} ${game.englishTitle} ${game.summary} ${game.tags.join(' ')}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }

      return true;
    });

    // 2. 排序
    filtered.sort((a, b) => {
      const aStat = stats[a.id] || { count: 0, lastPlayed: 0 };
      const bStat = stats[b.id] || { count: 0, lastPlayed: 0 };

      if (this.sortMethod === 'popular') {
        return bStat.count - aStat.count;
      } else if (this.sortMethod === 'recent') {
        return bStat.lastPlayed - aStat.lastPlayed;
      } else if (this.sortMethod === 'title') {
        return a.title.localeCompare(b.title, 'zh-Hans-CN');
      }
      return 0; // 默认排序
    });

    return filtered;
  }

  renderGames() {
    const list = this.filterAndSortGames();

    if (list.length === 0) {
      this.gamesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">未找到匹配的游戏</h3>
          <p>请尝试更换搜索关键字，或切换其他分类标签。</p>
        </div>
      `;
      return;
    }

    this.gamesGrid.innerHTML = list.map(game => {
      const isFav = StorageManager.isFavorite(game.id);
      const stat = StorageManager.getGameStats(game.id);
      const relativeTime = formatRelativeTime(stat.lastPlayed);

      return `
        <article class="game-card" 
          style="--card-gradient: ${game.gradient}; --card-border-glow: ${game.borderGlow}; --card-glow: ${game.borderGlow};" 
          data-id="${game.id}">
          <div>
            <div class="card-header">
              <div class="card-icon-wrap">${game.icon}</div>
              <div class="card-title-wrap">
                <h3 class="card-title">${game.title}</h3>
                <div class="card-eng-title">${game.englishTitle}</div>
              </div>
              <button class="fav-btn ${isFav ? 'favorited' : ''}" data-id="${game.id}" title="${isFav ? '取消收藏' : '添加收藏'}">
                ${isFav ? '❤️' : '🤍'}
              </button>
            </div>

            <div class="card-body">
              <p class="card-desc">${game.summary}</p>
              <div class="card-tags">
                <span class="tag-badge" style="color: ${game.accentColor}; font-weight: 600;">#${game.categoryLabel}</span>
                ${game.tags.map(t => `<span class="tag-badge">${t}</span>`).join('')}
              </div>

              <div class="card-meta-bar">
                <div class="card-meta-left">
                  <span class="meta-rating">★ ${game.rating}</span>
                  <span class="meta-played">已玩 ${stat.count} 次</span>
                </div>
                <div>${relativeTime}</div>
              </div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-play-theater" data-action="theater" data-id="${game.id}">
              <span>▶</span> 直接畅玩
            </button>
            <a href="${game.path}" target="_blank" class="btn-newtab" data-action="newtab" data-id="${game.id}" title="在新标签页独立打开">
              ↗
            </a>
            <button class="btn-info-detail" data-action="detail" data-id="${game.id}" title="查看玩法与操作指南">
              ℹ
            </button>
          </div>
        </article>
      `;
    }).join('');

    // 绑定卡片交互
    this.gamesGrid.querySelectorAll('.game-card').forEach(card => {
      const id = card.dataset.id;
      const game = this.games.find(g => g.id === id);

      // 收藏切换
      card.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const nowFav = StorageManager.toggleFavorite(id);
        const btn = card.querySelector('.fav-btn');
        btn.classList.toggle('favorited', nowFav);
        btn.innerHTML = nowFav ? '❤️' : '🤍';
        btn.title = nowFav ? '取消收藏' : '添加收藏';

        if (this.activeCategory === 'favorites' && !nowFav) {
          this.renderGames();
        }
      });

      // 直接畅玩
      card.querySelector('[data-action="theater"]').addEventListener('click', () => {
        this.openTheater(game);
      });

      // 新标签页打开链接触发记录
      card.querySelector('[data-action="newtab"]').addEventListener('click', () => {
        StorageManager.recordPlay(game.id);
        this.updateStatsBar();
      });

      // 玩法详情
      card.querySelector('[data-action="detail"]').addEventListener('click', () => {
        this.openDetailModal(game);
      });
    });
  }

  updateStatsBar() {
    if (this.totalGamesEl) this.totalGamesEl.textContent = this.games.length;
    if (this.totalPlaysEl) this.totalPlaysEl.textContent = StorageManager.getTotalPlayCount();
  }

  // ==========================================
  // 沉浸剧场模式 (In-Hub Arcade Theater)
  // ==========================================
  openTheater(game) {
    this.currentGame = game;
    StorageManager.recordPlay(game.id);
    this.updateStatsBar();

    // 更新剧场 UI
    this.theaterTitle.textContent = game.title;
    this.theaterIcon.textContent = game.icon;
    this.theaterNewTabBtn.href = game.path;

    // 显示加载指示器
    this.theaterLoading.style.display = 'flex';
    this.theaterLoading.style.opacity = '1';

    // 智能安全兜底：最多 1 秒强制平滑淡出遮罩层，绝不因为后台大图慢速加载阻塞画面
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.loadingTimer = setTimeout(() => {
      this.hideLoading();
    }, 1000);

    // 激活视窗
    this.theaterIframe.src = game.path;
    this.theaterOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 刷新大厅里的已游玩统计
    this.renderGames();
  }

  hideLoading() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.theaterLoading) {
      this.theaterLoading.style.opacity = '0';
      setTimeout(() => {
        this.theaterLoading.style.display = 'none';
      }, 300);
    }
  }

  closeTheater() {
    this.hideLoading();
    this.theaterOverlay.classList.remove('active');
    document.body.style.overflow = '';
    // 释放 iframe 避免后台继续播放声音或消耗 CPU/GPU
    this.theaterIframe.src = 'about:blank';
    this.currentGame = null;
    this.renderGames();
  }

  reloadTheater() {
    if (!this.currentGame) return;
    this.theaterLoading.style.display = 'flex';
    this.theaterLoading.style.opacity = '1';
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.loadingTimer = setTimeout(() => {
      this.hideLoading();
    }, 1000);

    try {
      if (this.theaterIframe.contentWindow && this.theaterIframe.contentWindow.location) {
        this.theaterIframe.contentWindow.location.reload();
        return;
      }
    } catch (e) {
      // 跨域或安全限制时回退
    }
    // 强制重置 src 再重新赋路径以触发真实重载
    const currentSrc = this.currentGame.path;
    this.theaterIframe.src = 'about:blank';
    setTimeout(() => {
      this.theaterIframe.src = currentSrc;
    }, 50);
  }

  toggleFullscreen() {
    const el = this.theaterOverlay;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // ==========================================
  // 详情与玩法指南弹窗
  // ==========================================
  openDetailModal(game) {
    this.modalDetailGame = game;
    this.modalIcon.textContent = game.icon;
    this.modalTitle.textContent = game.title;
    this.modalEng.textContent = game.englishTitle;
    this.modalDesc.textContent = game.summary;
    this.modalControls.textContent = game.controls;

    this.modalFeatures.innerHTML = game.features.map(f => `
      <div class="feature-pill">✦ ${f}</div>
    `).join('');

    this.modalOverlay.classList.add('active');
  }

  closeDetailModal() {
    this.modalOverlay.classList.remove('active');
    this.modalDetailGame = null;
  }
}

// 页面加载完成后启动大厅
document.addEventListener('DOMContentLoaded', () => {
  window.hubApp = new GameHubApp();
});
