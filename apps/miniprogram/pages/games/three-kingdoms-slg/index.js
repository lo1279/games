// pages/games/three-kingdoms-slg/index.js
/**
 * 🏯 三国志·鼎立战略版 - 100% 原版完整移植主控
 * 包含：
 *  - 全量 115 位武将数据与 154 种战法数据
 *  - 4091 行原版战报推演引擎 (battle.js simulateBattle)
 *  - 沙盘四大资源领地打地与屯田系统 (map.js)
 *  - 营建司建筑升级与内政系统 (city.js)
 *  - 抽卡大保底、暗保底与铜币自动折卡 (gacha.js)
 *  - 5支主力大军团自由编队与满兵补充 (storage.js)
 *  - 双轨离线挂机收益与云端数据同步 (cloud.js)
 */

const { GENERALS_DATA, ARMS } = require('./data/generals.js');
const { TACTICS_DATA } = require('./data/tactics.js');
const { CAMPAIGNS_DATA } = require('./data/campaigns.js');
// 注意：pullCloudSave 定义在 storage.js（它内部调 cloud.js 的 loadCloudSave），
// cloud.js 只导出 pushCloudSave。早期版本误从 cloud.js 导入 pullCloudSave，
// 导致点「云端同步」时抛 "pullCloudSave is not a function"。
const { loadGameState, saveGameState, resetGameState, pullCloudSave } = require('./engine/storage.js');
const { simulateBattle } = require('./engine/battle.js');
const { LAND_TIERS, RESOURCE_TYPES, createLandGuardTroop } = require('./engine/map.js');
const { BUILDINGS_CONFIG } = require('./engine/city.js');
const { GACHA_CONFIG } = require('./engine/gacha.js');
const { pushCloudSave } = require('./engine/cloud.js');
const { portraitPath, recordBattle, viewLogs, toView } = require('./slg-common.js');
const { playSfx } = require('./audio.js');

// 视图数据净化统一走 slg-common.js 的 toView / viewLogs。
// 历史教训（2026-10-14 真机栈溢出）：此处曾自建 cloneForView = JSON.parse(JSON.stringify())，
// 遇循环引用抛错后在 catch 里「回退原对象」——等于把带环对象直接喂给 setData，
// 基础库序列化无限递归 → RangeError: Maximum call stack size exceeded。
// toView 遇环是切断而非回退，并打印环路，从机制上杜绝该问题。

Page({
  data: {
    activeTab: 'map', // map, city, battle, gacha, troops
    // 占位空壳：保证首帧 WXML 的 {{gameState.*}} 绑定不会解引用 null（onLoad 后填真实数据）
    gameState: { resources: {}, ownedGenerals: [], troops: [] },
    resourceLandsList: [],
    buildingsList: [],
    campaignsList: [],
    currentTroopIdx: 0,
    currentTroop: null,
    armsList: ['cavalry', 'shield', 'bow', 'spear', 'siege'],
    currentArmIndex: 0,
    cloudSynced: false,
    showRechargeModal: false,
    showBattleModal: false,
    battleResult: { victory: false, logs: [] },
    showHeroSelectModal: false,
    selectingSlotPos: 0
  },

  onLoad() {
    this.refreshAllData();
  },

  onShow() {
    this.refreshAllData();
  },

  // ===== 数据同步与视图刷新 =====
  refreshAllData() {
    const state = loadGameState();
    
    // 1. 组装资源领地数据
    const lands = Object.keys(RESOURCE_TYPES).map(k => {
      const def = RESOURCE_TYPES[k];
      const maxLv = (state.resourceLands && state.resourceLands[k]) ? state.resourceLands[k].maxOccupiedLevel : 1;
      let totalProd = 0;
      for (let l = 1; l <= maxLv; l++) {
        totalProd += (LAND_TIERS[l]?.prodPerHour || 150);
      }
      return {
        key: k,
        name: def.name,
        resName: def.resName,
        icon: def.icon,
        border: def.border,
        maxOccupiedLevel: maxLv,
        prodPerHour: totalProd
      };
    });

    // 2. 组装主城内政数据
    const buildings = Object.keys(BUILDINGS_CONFIG).map(bId => {
      const cfg = BUILDINGS_CONFIG[bId];
      const curLvl = (state.buildings && state.buildings[bId]) || 0;
      const isMax = curLvl >= cfg.maxLevel;
      const cost = isMax ? { wood: 0, iron: 0, stone: 0 } : cfg.cost(curLvl + 1);
      const canUpgrade = !isMax && 
        state.resources.wood >= cost.wood && 
        state.resources.iron >= cost.iron && 
        state.resources.stone >= cost.stone;

      return {
        id: bId,
        name: cfg.name,
        icon: cfg.icon,
        desc: cfg.desc,
        level: curLvl,
        maxLevel: cfg.maxLevel,
        isMax,
        cost: {
          wood: Math.round(cost.wood),
          iron: Math.round(cost.iron),
          stone: Math.round(cost.stone)
        },
        effectText: cfg.effect(curLvl),
        canUpgrade
      };
    });

    // 3. 组装历史战役数据
    const campaigns = CAMPAIGNS_DATA.map(c => {
      const cleared = !!(state.campaignProgress && state.campaignProgress[c.id]?.cleared);
      const armLabel = c.enemyTroop?.arm || 'spear';
      const enemySoldiers = (c.enemyTroop?.heroes || []).reduce((acc, h) => acc + (h.currentSoldiers || 6000), 0);
      return {
        id: c.id,
        name: c.name,
        desc: c.desc,
        enemyName: c.enemyTroop?.name || '守关敌军',
        enemyArmLabel: armLabel,
        enemySoldiers: enemySoldiers || 12000,
        cleared
      };
    });

    // 4. 当前选中的军团
    const currentTroop = (state.troops && state.troops[this.data.currentTroopIdx]) || state.troops[0];
    // 立绘装饰（大厅在分包根目录，资源前缀为 assets/generals/）
    (currentTroop.heroes || []).forEach(h => { h.portrait = portraitPath(h, 'assets/generals/'); });
    const armIdx = this.data.armsList.indexOf(currentTroop.arm);

    // ⚠️ 分字段下发 + 先净化去别名，切勿合并成一次性大对象 setData。
    // 教训：原实现一次 setData({ gameState: state, currentTroop, ... })，
    // 其中 currentTroop === state.troops[idx]，且 troops[].heroes[] === ownedGenerals[]，
    // 同一对象出现在多个路径上，真机序列化时栈溢出白屏（详见 toView 注释）。
    const payload = {
      gameState: toView(state),
      resourceLandsList: lands,
      buildingsList: buildings,
      campaignsList: campaigns,
      currentTroop: toView(currentTroop),
      currentArmIndex: armIdx >= 0 ? armIdx : 0
    };
    Object.keys(payload).forEach((k) => {
      try {
        this.setData({ [k]: payload[k] });
      } catch (err) {
        // 单个字段下发失败不阻断其余字段，且能精确定位到具体数据路径
        console.error(`[SLG] setData 字段「${k}」下发失败:`, err);
      }
    });
  },

  // ===== 选项卡切换 =====
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // ===== 子系统导航（M1-M4 全量玩法入口）=====
  navTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({ url: `./${page}/index` });
  },

  // 立绘加载失败回退 emoji
  onImgErr(e) {
    const path = e.currentTarget.dataset.path;
    if (path) this.setData({ [path]: '' });
  },

  // ===== 1. 沙盘领地开拓与屯田 =====
  farmAllLands() {
    const state = this.data.gameState;
    let woodGain = 0, ironGain = 0, stoneGain = 0, grainGain = 0;

    Object.keys(RESOURCE_TYPES).forEach(k => {
      const maxLv = (state.resourceLands && state.resourceLands[k]) ? state.resourceLands[k].maxOccupiedLevel : 1;
      let prod = 0;
      for (let l = 1; l <= maxLv; l++) prod += (LAND_TIERS[l]?.prodPerHour || 150);
      const gain = prod * 3;
      if (k === 'wood') woodGain += gain;
      if (k === 'iron') ironGain += gain;
      if (k === 'stone') stoneGain += gain;
      if (k === 'grain') grainGain += gain;
    });

    state.resources.wood += woodGain;
    state.resources.iron += ironGain;
    state.resources.stone += stoneGain;
    state.resources.grain += grainGain;

    saveGameState(state);
    this.refreshAllData();

    wx.showModal({
      title: '🌾 全境大丰收',
      content: `屯田3小时完成！\n木材 +${woodGain}\n铁矿 +${ironGain}\n石料 +${stoneGain}\n粮食 +${grainGain}`,
      showCancel: false
    });
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
  },

  attackNextLevelLand(e) {
    const type = e.currentTarget.dataset.type;
    const state = this.data.gameState;
    const currentLv = (state.resourceLands && state.resourceLands[type]) ? state.resourceLands[type].maxOccupiedLevel : 1;

    if (currentLv >= 10) {
      wx.showToast({ title: '该领地已达到最高Lv.10！', icon: 'none' });
      return;
    }

    const nextLv = currentLv + 1;
    const targetLand = LAND_TIERS[nextLv];
    const playerTroop = this.data.currentTroop;

    if (!playerTroop.heroes || playerTroop.heroes.length === 0) {
      wx.showToast({ title: '当前军团未配置出征武将！', icon: 'none' });
      this.setData({ activeTab: 'troops' });
      return;
    }

    // 组装敌方守军阵容进行推演（对齐 Web createLandGuardTroop，守军带兵种适性）
    const enemyTroop = createLandGuardTroop(nextLv, type);

    wx.showLoading({ title: '攻占领地推演中...' });
    setTimeout(() => {
      wx.hideLoading();
      const report = simulateBattle(playerTroop, enemyTroop, {
        playerMorale: 100,
        tacticLevels: state.tacticLevels || {},
        techLevels: state.techLevels || {}
      });
      const isWin = report.summary.winner === 'player';
      const battleLogs = report.logs || [];

      if (isWin) {
        state.resourceLands[type].maxOccupiedLevel = nextLv;
        saveGameState(state);
        this.refreshAllData();
      }

      recordBattle(state, {
        category: 'pioneer',
        title: `开拓 Lv.${nextLv} · ${enemyTroop.heroes[0].name}`,
        isVictory: isWin,
        summary: isWin ? `成功占领 ${nextLv} 级领地！` : `开拓 Lv.${nextLv} 受挫`,
        logs: battleLogs || ['战斗推演完成']
      });

      // ⚠️ battleLogs 是引擎原始日志（meta 里含自引用武将对象），
      // 必须经 viewLogs 转成纯字符串才能下发，否则真机栈溢出。
      this.setData({
        battleResult: {
          victory: isWin,
          logs: viewLogs(battleLogs, '战斗推演完成')
        },
        showBattleModal: true
      });
      try { playSfx(isWin ? 'win' : 'lose'); } catch (e) {}
      try { wx.vibrateShort({ type: isWin ? 'heavy' : 'light' }); } catch (e) {}
    }, 300);
  },

  // ===== 2. 主城内政城建升级 =====
  upgradeBuilding(e) {
    const bId = e.currentTarget.dataset.id;
    const state = this.data.gameState;
    const cfg = BUILDINGS_CONFIG[bId];
    const curLvl = state.buildings[bId] || 0;

    if (curLvl >= cfg.maxLevel) return;

    const cost = cfg.cost(curLvl + 1);
    if (state.resources.wood < cost.wood || state.resources.iron < cost.iron || state.resources.stone < cost.stone) {
      wx.showToast({ title: '资源不足！', icon: 'none' });
      return;
    }

    state.resources.wood -= Math.round(cost.wood);
    state.resources.iron -= Math.round(cost.iron);
    state.resources.stone -= Math.round(cost.stone);
    state.buildings[bId] = curLvl + 1;

    saveGameState(state);
    this.refreshAllData();
    wx.showToast({ title: `${cfg.name} 升级至 Lv.${curLvl + 1}！`, icon: 'success' });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
  },

  // ===== 3. 历史著名战役挑战 =====
  startCampaignBattle(e) {
    const cId = e.currentTarget.dataset.id;
    const campaign = CAMPAIGNS_DATA.find(c => c.id === cId);
    const playerTroop = this.data.currentTroop;

    if (!playerTroop.heroes || playerTroop.heroes.length === 0) {
      wx.showToast({ title: '请先到【军团】界面配置出征将领！', icon: 'none' });
      this.setData({ activeTab: 'troops' });
      return;
    }

    wx.showLoading({ title: '大军集结交锋中...' });
    setTimeout(() => {
      wx.hideLoading();
      // ⚠️ state 必须先在函数作用域顶部声明：原写法把它放在 simulateBattle 之后，
      // 而上面的入参已经读取 state.tacticLevels —— const 的 TDZ 会直接抛
      // ReferenceError: Cannot access 'state' before initialization。
      const state = this.data.gameState;
      const report = simulateBattle(playerTroop, campaign.enemyTroop, {
        playerMorale: 100,
        tacticLevels: state.tacticLevels || {},
        techLevels: state.techLevels || {}
      });
      const isWin = report.summary.winner === 'player';
      const battleLogs = report.logs || [];

      if (isWin) {
        state.campaignProgress = state.campaignProgress || {};
        state.campaignProgress[cId] = { cleared: true, stars: 3 };
        state.resources.gold += 300; // 战役首胜金铢赏赐
        saveGameState(state);
        this.refreshAllData();
      }

      recordBattle(state, {
        category: 'campaign',
        title: `战役 · ${campaign.name}`,
        isVictory: isWin,
        summary: isWin ? `平定 ${campaign.name}！` : `${campaign.name} 战败`,
        logs: battleLogs || ['战报演算完毕']
      });

      this.setData({
        battleResult: {
          victory: isWin,
          logs: viewLogs(battleLogs, '战报演算完毕')
        },
        showBattleModal: true
      });
      try { playSfx(isWin ? 'win' : 'lose'); } catch (e) {}
      try { wx.vibrateShort({ type: isWin ? 'heavy' : 'medium' }); } catch (e) {}
    }, 400);
  },

  // ===== 4. 点将招募 (原版概率与保底) =====
  executeGacha(e) {
    const type = e.currentTarget.dataset.type;
    const isFive = type === 'five';
    const cost = isFive ? GACHA_CONFIG.goldFiveCost : GACHA_CONFIG.goldSingleCost;
    const count = isFive ? 5 : 1;
    const state = this.data.gameState;

    if (state.resources.gold < cost) {
      wx.showModal({
        title: '金铢不足',
        content: '主公金铢不足，是否进入【金铢钱庄】模拟充值？',
        success: (res) => {
          if (res.confirm) this.openRechargeModal();
        }
      });
      return;
    }

    state.resources.gold -= cost;
    const results = [];

    for (let i = 0; i < count; i++) {
      // 触发原版保底与抽卡判定
      state.totalGachaCount = (state.totalGachaCount || 0) + 1;
      state.gachaPity = (state.gachaPity || 0) + 1;
      state.gachaPityFour = (state.gachaPityFour || 0) + 1;

      let drawStar = 3;
      if (state.gachaPity >= GACHA_CONFIG.hardPityFiveStar) {
        drawStar = 5;
        state.gachaPity = 0;
      } else if (state.gachaPityFour >= GACHA_CONFIG.hardPityFourStar) {
        drawStar = 4;
        state.gachaPityFour = 0;
      } else {
        const rand = Math.random() * 100;
        if (rand < 5.6) {
          drawStar = 5;
          state.gachaPity = 0;
        } else if (rand < 41.6) {
          drawStar = 4;
          state.gachaPityFour = 0;
        } else {
          drawStar = 3;
        }
      }

      // 从原版武将库筛选对应星级
      const pool = GENERALS_DATA.filter(g => g.star === drawStar);
      const picked = pool[Math.floor(Math.random() * pool.length)];

      if (drawStar === 3 && state.gachaAutoConvert?.star3) {
        // 3星自动折铜币
        state.resources.copper += GACHA_CONFIG.threeStarCopperValue;
        results.push({ ...picked, autoConverted: true });
      } else {
        state.ownedGenerals.push({
          ...picked,
          id: `${picked.id}_inst_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          level: 1,
          exp: 0,
          currentSoldiers: 1000,
          maxSoldiers: 1000
        });
        results.push(picked);
      }
    }

    saveGameState(state);
    this.refreshAllData();

    const cardNames = results.map(r => `${r.name}(${r.star}⭐${r.autoConverted ? '·已化铜币' : ''})`).join('、');
    wx.showModal({
      title: '📜 点将捷报',
      content: `招募成功！\n获得将领: ${cardNames}`,
      showCancel: false
    });
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
  },

  // ===== 5. 军团出征管理 =====
  selectTroopTab(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    this.setData({ currentTroopIdx: idx });
    this.refreshAllData();
  },

  onArmChange(e) {
    const armIdx = parseInt(e.detail.value, 10);
    const armName = this.data.armsList[armIdx];
    const state = this.data.gameState;
    state.troops[this.data.currentTroopIdx].arm = armName;
    saveGameState(state);
    this.refreshAllData();
  },

  fillTroopSoldiers() {
    const state = this.data.gameState;
    const troop = state.troops[this.data.currentTroopIdx];
    let needed = 0;

    (troop.heroes || []).forEach(h => {
      needed += Math.max(0, (h.maxSoldiers || 3000) - (h.currentSoldiers || 0));
    });

    if (needed <= 0) {
      wx.showToast({ title: '本军团已是满兵状态！', icon: 'none' });
      return;
    }

    if (state.resources.reserveSoldiers < needed) {
      // 预备兵不足时，有多少补多少
      const fillAmount = state.resources.reserveSoldiers;
      if (fillAmount <= 0) {
        wx.showToast({ title: '预备兵不足，请在内政营建征兵处！', icon: 'none' });
        return;
      }
      troop.heroes.forEach(h => {
        h.currentSoldiers = (h.currentSoldiers || 0) + Math.floor(fillAmount / troop.heroes.length);
      });
      state.resources.reserveSoldiers = 0;
    } else {
      state.resources.reserveSoldiers -= needed;
      troop.heroes.forEach(h => {
        h.currentSoldiers = h.maxSoldiers || 3000;
      });
    }

    saveGameState(state);
    this.refreshAllData();
    wx.showToast({ title: '全军已迅速补充兵员！', icon: 'success' });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
  },

  openSelectHeroModal(e) {
    const pos = parseInt(e.currentTarget.dataset.pos, 10);
    this.setData({
      selectingSlotPos: pos,
      showHeroSelectModal: true
    });
  },

  confirmAssignHero(e) {
    // 用下标取「真实武将对象」：dataset 只能传可序列化的值，直接传对象会经视图层
    // 往返后与 ownedGenerals 脱钩（后续升级/红星写不回原对象），故只传 index。
    const idx = Number(e.currentTarget.dataset.idx);
    const state = this.data.gameState;
    const hero = (state.ownedGenerals || [])[idx];
    if (!hero) return;
    const troop = state.troops[this.data.currentTroopIdx];

    troop.heroes = troop.heroes || [];
    troop.heroes[this.data.selectingSlotPos] = hero;

    saveGameState(state);
    this.setData({ showHeroSelectModal: false });
    this.refreshAllData();
    wx.showToast({ title: `成功委任【${hero.name}】！`, icon: 'success' });
  },

  closeHeroSelectModal() {
    this.setData({ showHeroSelectModal: false });
  },

  // ===== 云端与重置 =====
  async handleCloudSync() {
    wx.showLoading({ title: '正在连通云端...' });
    const cloudSave = await pullCloudSave();

    if (cloudSave) {
      saveGameState(cloudSave);
      this.refreshAllData();
      wx.hideLoading();
      this.setData({ cloudSynced: true });
      wx.showToast({ title: '已从云端拉取最新存档！', icon: 'success' });
    } else {
      pushCloudSave(this.data.gameState);
      wx.hideLoading();
      this.setData({ cloudSynced: true });
      wx.showToast({ title: '本地进度已同步上云！', icon: 'success' });
    }
  },

  handleReset() {
    wx.showModal({
      title: '重置警告',
      content: '确定要重置当前天下大势存档、重新开局吗？',
      success: (res) => {
        if (res.confirm) {
          const freshState = resetGameState();
          this.refreshAllData();
          wx.showToast({ title: '开局已重新初始化', icon: 'success' });
        }
      }
    });
  },

  // ===== 充值弹窗 =====
  openRechargeModal() {
    this.setData({ showRechargeModal: true });
  },

  closeRechargeModal() {
    this.setData({ showRechargeModal: false });
  },

  doRecharge(e) {
    const amt = parseInt(e.currentTarget.dataset.amount, 10);
    const goldBonus = amt * 20; // 始终双倍返利
    const state = this.data.gameState;

    state.resources.gold += goldBonus;
    saveGameState(state);
    this.refreshAllData();

    wx.showToast({ title: `模拟充值成功！金铢 +${goldBonus}`, icon: 'success' });
    this.closeRechargeModal();
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
  },

  closeBattleModal() {
    this.setData({ showBattleModal: false });
  }
});
