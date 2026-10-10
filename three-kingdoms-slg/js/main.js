/**
 * 三国志·战略版 - 主应用调度控制引擎 (App Controller - 路线B纯轻量战术卡牌模式)
 */

import { CAMPS, ARMS, GENERAL_APTITUDE_MODIFIERS, GENERALS_DATA, addGeneralExp, getExpRequiredForLevel, MAX_GENERAL_LEVEL, getGeneralAvatarHtml } from './data/generals.js';
import { TACTICS_DATA, TACTIC_UPGRADE_COSTS, MAX_TACTIC_LEVEL, getTacticEffectiveProps, TACTIC_INHERIT_SOURCES, getHeroInheritTacticId } from './data/tactics.js';
import { CAMPAIGNS_DATA, TRIALS_DATA } from './data/campaigns.js';
import { simulateBattle } from './engine/battle.js';
import { GACHA_CONFIG, pullGeneral, CORE_FIVE_STAR_IDS } from './engine/gacha.js';
import { sound } from './engine/audio.js';
import { goldFX } from './engine/goldfx.js';
import { loadGameState, saveGameState, resetGameState } from './engine/storage.js';
import { MAP_CONFIG, LAND_TIERS, RESOURCE_TYPES, isTileAdjacentToPlayer, calculateMarchMorale, createLandGuardTroop } from './engine/map.js';
import { estimateTroopPower, estimateWinChance, evaluateLandMatchup } from './engine/power.js';
import { BUILDINGS_CONFIG, hasEnoughResources, deductResources } from './engine/city.js';
import { checkActiveBonds, getBondsForHero } from './data/bonds.js';

const TACTICS_MAP = new Map(TACTICS_DATA.map(t => [t.id, t]));
const GENERALS_MAP = new Map(GENERALS_DATA.map(g => [g.id, g]));

class GameApp {
  constructor() {
    this.state = loadGameState();
    this.activeTab = 'tabMap'; // 默认沙盘开荒大地图
    this.battleSubTab = 'campaigns'; // 'campaigns' | 'trials'
    this.generalSubTab = 'generals'; // 'generals' | 'tactics'
    this.generalFilter = { camp: 'all', star: 'all' }; // 武将多维筛选状态
    this.tacticFilter = { quality: 'all', level: 'all', type: 'all', damageType: 'all' }; // 战法多维筛选状态 (品阶、等级、机制类型、伤害性质)
    this.initDOM();
    this.bindEvents();
    this.renderAll();
  }

  initDOM() {
    // 顶部轻量 HUD
    this.domRes = {
      gold: document.getElementById('resGold'),
      copper: document.getElementById('resCopper'),
      wood: document.getElementById('resWood'),
      iron: document.getElementById('resIron'),
      stone: document.getElementById('resStone'),
      grain: document.getElementById('resGrain'),
      campaignStars: document.getElementById('resCampaignStars'),
      trialFloor: document.getElementById('resTrialFloor'),
      ownedCount: document.getElementById('resOwnedCount')
    };

    // 页面与容器
    this.tabPages = document.querySelectorAll('.slg-tab-page');
    this.navBtns = document.querySelectorAll('.nav-tab-btn[data-tab]');
    this.worldMapGrid = document.getElementById('worldMapGrid');
    this.resourceLandsGrid = document.getElementById('resourceLandsGrid');
    this.btnQuickFarmAll = document.getElementById('btnQuickFarmAll');
    this.cityBuildingsGrid = document.getElementById('cityBuildingsGrid');
    this.cityStatsBanner = document.getElementById('cityStatsBanner');
    this.campaignsContainer = document.getElementById('campaignsContainer');
    this.trialsContainer = document.getElementById('trialsContainer');
    this.troopsContainer = document.getElementById('troopsContainer');
    this.ownedGeneralsGrid = document.getElementById('ownedGeneralsGrid');
    this.battleReportsList = document.getElementById('battleReportsList');
    this.gachaPityCount = document.getElementById('gachaPityCount');

    // 战法研习二级界面容器
    this.btnSubTabGenerals = document.getElementById('btnSubTabGenerals');
    this.btnSubTabTactics = document.getElementById('btnSubTabTactics');
    this.generalsActionBar = document.getElementById('generalsActionBar');
    this.viewOwnedGenerals = document.getElementById('viewOwnedGenerals');
    this.viewTacticsUpgrade = document.getElementById('viewTacticsUpgrade');
    this.tacticsUpgradeContainer = document.getElementById('tacticsUpgradeContainer');
    this.tacticViewCopperVal = document.getElementById('tacticViewCopperVal');

    // 地块操作弹窗
    this.tileActionModal = document.getElementById('tileActionModal');
    this.tileModalTitle = document.getElementById('tileModalTitle');
    this.tileModalBody = document.getElementById('tileModalBody');

    // 模态弹窗
    this.battleDetailModal = document.getElementById('battleDetailModal');
    this.battleDetailTitle = document.getElementById('battleDetailTitle');
    this.battleDetailBody = document.getElementById('battleDetailBody');
    this.gachaShowcase = document.getElementById('gachaShowcase');
    this.gachaShowcaseTitle = document.getElementById('gachaShowcaseTitle');
    this.gachaSummaryBar = document.getElementById('gachaSummaryBar');
    this.gachaCardsContainer = document.getElementById('gachaCardsContainer');
    this.gachaAutoFlipTimers = [];

    // 🎯 假想敌自定义沙盒演习容器与模态框
    this.sandboxContainer = document.getElementById('sandboxContainer');
    this.subTabSandbox = document.getElementById('subTabSandbox');
    this.sandboxCustomModal = document.getElementById('sandboxCustomModal');
    this.sandboxModalTitle = document.getElementById('sandboxModalTitle');
    this.sandboxModalBody = document.getElementById('sandboxModalBody');

    // 👑 名将卡池全景预览模态框
    this.gachaPoolPreviewModal = document.getElementById('gachaPoolPreviewModal');
    this.gachaPoolPreviewGrid = document.getElementById('gachaPoolPreviewGrid');
    this.previewPoolTotalBadge = document.getElementById('previewPoolTotalBadge');
    this.poolPreviewFilter = { camp: 'all', star: 'all' };
  }

  bindEvents() {
    // 底部标签导航切换
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
        sound.playDrum();
      });
    });

    // 征战子选项卡切换 (历史战役 vs 演武试炼 vs 假想敌沙盒)
    const subTabCamp = document.getElementById('subTabCampaigns');
    const subTabTrial = document.getElementById('subTabTrials');
    const subTabSand = document.getElementById('subTabSandbox');

    const updateBattleSubTabs = (activeTab) => {
      this.battleSubTab = activeTab;
      if (subTabCamp) subTabCamp.classList.toggle('active', activeTab === 'campaigns');
      if (subTabTrial) subTabTrial.classList.toggle('active', activeTab === 'trials');
      if (subTabSand) subTabSand.classList.toggle('active', activeTab === 'sandbox');

      if (this.campaignsContainer) this.campaignsContainer.style.display = (activeTab === 'campaigns' ? 'flex' : 'none');
      if (this.trialsContainer) this.trialsContainer.style.display = (activeTab === 'trials' ? 'flex' : 'none');
      if (this.sandboxContainer) this.sandboxContainer.style.display = (activeTab === 'sandbox' ? 'flex' : 'none');

      if (activeTab === 'campaigns') this.renderCampaigns();
      else if (activeTab === 'trials') this.renderTrials();
      else if (activeTab === 'sandbox') this.renderSandbox();
      sound.playDrum();
    };

    if (subTabCamp) subTabCamp.addEventListener('click', () => updateBattleSubTabs('campaigns'));
    if (subTabTrial) subTabTrial.addEventListener('click', () => updateBattleSubTabs('trials'));
    if (subTabSand) subTabSand.addEventListener('click', () => updateBattleSubTabs('sandbox'));

    // 沙盒假想敌关闭模态框
    const btnSandboxModalClose = document.getElementById('btnSandboxModalClose');
    if (btnSandboxModalClose) {
      btnSandboxModalClose.addEventListener('click', () => {
        if (this.sandboxCustomModal) this.sandboxCustomModal.style.display = 'none';
      });
    }

    // 沙盒演习开战按钮
    const btnLaunchSandbox = document.getElementById('btnLaunchSandboxBattle');
    if (btnLaunchSandbox) {
      btnLaunchSandbox.addEventListener('click', () => this.launchSandboxBattle());
    }

    // 沙盒假想敌预设阵容按钮
    document.querySelectorAll('.btn-sandbox-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-preset');
        this.applySandboxPreset(presetKey);
      });
    });

    // 武将与战法研习二级导航切换
    if (this.btnSubTabGenerals && this.btnSubTabTactics) {
      this.btnSubTabGenerals.addEventListener('click', () => {
        this.btnSubTabGenerals.classList.add('active');
        this.btnSubTabTactics.classList.remove('active');
        this.viewOwnedGenerals.style.display = 'block';
        this.viewTacticsUpgrade.style.display = 'none';
        if (this.generalsActionBar) this.generalsActionBar.style.display = 'flex';
        this.generalSubTab = 'generals';
        sound.playDrum();
      });

      this.btnSubTabTactics.addEventListener('click', () => {
        this.btnSubTabTactics.classList.add('active');
        this.btnSubTabGenerals.classList.remove('active');
        this.viewOwnedGenerals.style.display = 'none';
        this.viewTacticsUpgrade.style.display = 'block';
        if (this.generalsActionBar) this.generalsActionBar.style.display = 'none';
        this.generalSubTab = 'tactics';
        this.renderTacticsUpgrade();
        sound.playDrum();
      });
    }

    // 关闭战报详情
    document.getElementById('btnBattleDetailClose').addEventListener('click', () => {
      this.battleDetailModal.style.display = 'none';
    });

    // 确认并关闭抽卡开箱（支持底部大按钮与右上角快捷关闭按钮）
    const closeGachaShowcase = () => {
      if (this.gachaAutoFlipTimers && this.gachaAutoFlipTimers.length > 0) {
        this.gachaAutoFlipTimers.forEach(tid => clearTimeout(tid));
        this.gachaAutoFlipTimers = [];
      }
      this.gachaShowcase.style.display = 'none';
      // 必须卸载粒子画布：其 RAF 循环会一直跑到页面结束，
      // 空转的 requestAnimationFrame 在移动端是实打实的耗电与发热源
      goldFX.unmount();
      this.renderGenerals();
      this.renderTroops();
      this.renderHUD();
    };
    document.getElementById('btnGachaShowcaseConfirm')?.addEventListener('click', closeGachaShowcase);
    document.getElementById('btnGachaShowcaseClose')?.addEventListener('click', closeGachaShowcase);

    // 清空战报历史
    document.getElementById('btnClearReports').addEventListener('click', () => {
      slgNotice({
        title: '清空战报',
        body: '确认清空所有历史战报吗？',
        seal: '🗡️',
        type: 'warn',
        okText: '清空',
        cancelText: '再思',
        onConfirm: () => {
          this.state.battleReports = [];
          this.renderReports();
          this.save();
        }
      });
    });

    // 招募按钮绑定 (1 / 5 / 10 / 50 / 100 连抽)
    document.getElementById('btnGachaFamousSingle')?.addEventListener('click', () => this.doGacha('famous', 1));
    document.getElementById('btnGachaFamousFive')?.addEventListener('click', () => this.doGacha('famous', 5));
    document.getElementById('btnGachaFamousTen')?.addEventListener('click', () => this.doGacha('famous', 10));
    document.getElementById('btnGachaFamousFifty')?.addEventListener('click', () => this.doGacha('famous', 50));
    document.getElementById('btnGachaFamousHundred')?.addEventListener('click', () => this.doGacha('famous', 100));

    document.getElementById('btnGachaCopperSingle')?.addEventListener('click', () => this.doGacha('copper', 1));
    document.getElementById('btnGachaCopperTen')?.addEventListener('click', () => this.doGacha('copper', 10));
    document.getElementById('btnGachaCopperFifty')?.addEventListener('click', () => this.doGacha('copper', 50));
    document.getElementById('btnGachaCopperHundred')?.addEventListener('click', () => this.doGacha('copper', 100));

    // ♻️ 招募自动转化 3★ / 4★ 武将开关绑定
    const chkAuto3 = document.getElementById('chkAutoConvert3Star');
    const chkAuto4 = document.getElementById('chkAutoConvert4Star');
    if (!this.state.gachaAutoConvert) {
      this.state.gachaAutoConvert = { star3: true, star4: false };
    }
    if (chkAuto3) {
      chkAuto3.checked = this.state.gachaAutoConvert.star3 !== false;
      chkAuto3.addEventListener('change', () => {
        this.state.gachaAutoConvert.star3 = chkAuto3.checked;
        sound.playDrum();
        this.save();
      });
    }
    if (chkAuto4) {
      chkAuto4.checked = !!this.state.gachaAutoConvert.star4;
      chkAuto4.addEventListener('change', () => {
        this.state.gachaAutoConvert.star4 = chkAuto4.checked;
        sound.playDrum();
        this.save();
      });
    }

    // 👑 名将卡池全景预览弹窗入口
    const btnPreviewFamous = document.getElementById('btnPreviewFamousPool');
    if (btnPreviewFamous) {
      btnPreviewFamous.addEventListener('click', () => {
        sound.playDrum();
        this.openGachaPoolPreview();
      });
    }

    const btnClosePreview = document.getElementById('btnGachaPoolPreviewClose');
    if (btnClosePreview && this.gachaPoolPreviewModal) {
      btnClosePreview.addEventListener('click', () => {
        this.gachaPoolPreviewModal.style.display = 'none';
      });
    }

    // 预览弹窗阵营筛选
    document.querySelectorAll('.btn-pool-filter-camp').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-pool-filter-camp').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.poolPreviewFilter.camp = btn.getAttribute('data-camp');
        sound.playDrum();
        this.renderGachaPoolPreviewCards();
      });
    });

    // 预览弹窗品质筛选
    document.querySelectorAll('.btn-pool-filter-star').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-pool-filter-star').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.poolPreviewFilter.star = btn.getAttribute('data-star');
        sound.playDrum();
        this.renderGachaPoolPreviewCards();
      });
    });

    // 模拟充值金珠钱庄入口绑定
    const badgeGold = document.getElementById('badgeGold');
    if (badgeGold) {
      badgeGold.addEventListener('click', () => this.openRechargeModal());
    }
    const btnOpenRechargeModal = document.getElementById('btnOpenRechargeModal');
    if (btnOpenRechargeModal) {
      btnOpenRechargeModal.addEventListener('click', () => this.openRechargeModal());
    }
    const btnRechargeModalClose = document.getElementById('btnRechargeModalClose');
    if (btnRechargeModalClose) {
      btnRechargeModalClose.addEventListener('click', () => this.closeRechargeModal());
    }

    // 重置存档按钮
    const btnResetGame = document.getElementById('btnResetGame');
    if (btnResetGame) {
      btnResetGame.addEventListener('click', () => {
        slgNotice({
          title: '重置开局确认',
          body: '⚠️ 主公，确认清除当前所有战绩、麾下武将与战法研习进度吗？\n将重置为初始开局（赠送【关平(主将)+郭淮+张宝+韩当】经典良将开荒团、3,000 启动金珠及 20,000 启动铜币）！',
          seal: '⚠️',
          type: 'danger',
          okText: '确认重置',
          cancelText: '再思',
          onConfirm: () => {
            this.state = resetGameState();
            this.activeTab = 'tabBattle';
            this.battleSubTab = 'campaigns';
            this.generalSubTab = 'generals';
            sound.playVictoryHorn();
            this.renderAll();
            slgNotice({ title: '天下重置', body: '🔄 恭祝主公重振旗鼓！\n天下格局已重置，先锋开荒营已整装待发！', seal: '🔄', type: 'info' });
          }
        });
      });
    }

    // 阵营筛选事件绑定
    document.querySelectorAll('.btn-filter-camp').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-camp').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.generalFilter.camp = btn.getAttribute('data-camp');
        sound.playDrum();
        this.renderGenerals();
      });
    });

    // 星级筛选事件绑定
    document.querySelectorAll('.btn-filter-star').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-star').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const starVal = btn.getAttribute('data-star');
        this.generalFilter.star = starVal === 'all' ? 'all' : parseInt(starVal, 10);
        sound.playDrum();
        this.renderGenerals();
      });
    });

    // ========== 战法研习多维筛选事件绑定 ==========
    // 0. 战法品阶筛选 (S级 / A级 / 全部)
    document.querySelectorAll('.btn-filter-tac-quality').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-tac-quality').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tacticFilter.quality = btn.getAttribute('data-tac-quality');
        sound.playDrum();
        this.renderTacticsUpgrade();
      });
    });

    // 1. 战法等级筛选
    document.querySelectorAll('.btn-filter-tac-level').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-tac-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tacticFilter.level = btn.getAttribute('data-tac-level');
        sound.playDrum();
        this.renderTacticsUpgrade();
      });
    });

    // 2. 战法类型筛选
    document.querySelectorAll('.btn-filter-tac-type').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-tac-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tacticFilter.type = btn.getAttribute('data-tac-type');
        sound.playDrum();
        this.renderTacticsUpgrade();
      });
    });

    // 3. 伤害/作用性质筛选
    document.querySelectorAll('.btn-filter-tac-damage').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter-tac-damage').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tacticFilter.damageType = btn.getAttribute('data-tac-damage');
        sound.playDrum();
        this.renderTacticsUpgrade();
      });
    });

    // 🌟 一键同名升星进阶
    const btnAutoPromote = document.getElementById('btnQuickAutoPromote');
    if (btnAutoPromote) {
      btnAutoPromote.addEventListener('click', () => this.quickAutoPromote());
    }

    // 🪙 一键解甲全部3星将
    const btnSellThree = document.getElementById('btnQuickSellThreeStars');
    if (btnSellThree) {
      btnSellThree.addEventListener('click', () => this.quickSellThreeStars());
    }

    // 🪙 一键解甲全部4星将
    const btnSellFour = document.getElementById('btnQuickSellFourStars');
    if (btnSellFour) {
      btnSellFour.addEventListener('click', () => this.quickSellFourStars());
    }
    // 地块操作弹窗关闭
    const btnTileModalClose = document.getElementById('btnTileModalClose');
    if (btnTileModalClose) {
      btnTileModalClose.addEventListener('click', () => {
        if (this.tileActionModal) this.tileActionModal.style.display = 'none';
      });
    }

    // 全境一键屯田
    if (this.btnQuickFarmAll) {
      this.btnQuickFarmAll.addEventListener('click', () => this.quickFarmAllLands());
    }
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.tabPages.forEach(p => p.classList.toggle('active', p.id === tabId));
    this.navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    if (tabId === 'tabMap') this.renderWorldMap();
    if (tabId === 'tabCity') this.renderCityBuildings();
    if (tabId === 'tabBattle') {
      if (this.battleSubTab === 'sandbox') {
        this.renderSandbox();
      } else if (this.battleSubTab === 'trials') {
        this.renderTrials();
      } else {
        this.renderCampaigns();
      }
    }
    if (tabId === 'tabTroops') this.renderTroops();
    if (tabId === 'tabGenerals') {
      if (this.generalSubTab === 'tactics') {
        this.renderTacticsUpgrade();
      } else {
        this.renderGenerals();
      }
    }
    if (tabId === 'tabReports') this.renderReports();
  }

  renderAll() {
    const chkAuto3 = document.getElementById('chkAutoConvert3Star');
    const chkAuto4 = document.getElementById('chkAutoConvert4Star');
    if (chkAuto3) chkAuto3.checked = this.state.gachaAutoConvert?.star3 !== false;
    if (chkAuto4) chkAuto4.checked = !!this.state.gachaAutoConvert?.star4;

    this.renderHUD();
    this.renderWorldMap();
    this.renderCityBuildings();
    this.renderCampaigns();
    this.renderTrials();
    this.renderSandbox();
    this.renderTroops();
    this.renderGenerals();
    this.renderTacticsUpgrade();
    this.renderReports();
  }
  renderHUD() {
    this.domRes.gold.textContent = (this.state.resources.gold ?? 0).toLocaleString();
    const elGachaGoldBal = document.getElementById('gachaGoldBalanceVal');
    if (elGachaGoldBal) {
      elGachaGoldBal.textContent = (this.state.resources.gold ?? 0).toLocaleString();
    }
    const elGachaRechargeMoney = document.getElementById('gachaRechargeMoneyVal');
    if (elGachaRechargeMoney) {
      elGachaRechargeMoney.textContent = `¥${(this.state.rechargeStats?.totalMoney || 0).toLocaleString()}`;
    }
    if (this.domRes.copper) {
      this.domRes.copper.textContent = (this.state.resources.copper || 0).toLocaleString();
    }
    if (this.domRes.wood) {
      this.domRes.wood.textContent = (this.state.resources.wood || 0).toLocaleString();
    }
    if (this.domRes.iron) {
      this.domRes.iron.textContent = (this.state.resources.iron || 0).toLocaleString();
    }
    if (this.domRes.stone) {
      this.domRes.stone.textContent = (this.state.resources.stone || 0).toLocaleString();
    }
    if (this.domRes.grain) {
      this.domRes.grain.textContent = (this.state.resources.grain || 0).toLocaleString();
    }
    if (this.tacticViewCopperVal) {
      this.tacticViewCopperVal.textContent = (this.state.resources.copper || 0).toLocaleString();
    }
    
    // 统计总星数
    const totalStars = Object.values(this.state.campaignProgress || {}).reduce((acc, cur) => acc + (cur.stars || 0), 0);
    this.domRes.campaignStars.textContent = `${totalStars} / ${CAMPAIGNS_DATA.length * 3}`;
    this.domRes.trialFloor.textContent = `第 ${this.state.trialFloor || 1} 层`;
    this.domRes.ownedCount.textContent = this.state.ownedGenerals.length;
    this.gachaPityCount.textContent = this.state.gachaPity || 0;

    // ★ 招募保底进度可视化（三条）
    // 五星大保底30 抽、四星小保底 5 抽、大核心"7+1"暗保底 7 抽。
    // 玩家最关心的就是"还有几次必出"，用进度条比纯数字直观得多。
    const renderPity = (barId, cur, max, dangerAt) => {
      const bar = document.getElementById(barId);
      if (!bar) return;
      const pct = Math.min(100, ((cur || 0) / max) * 100);
      const fill = bar.querySelector('.pity-fill');
      const label = bar.querySelector('.pity-label');
      if (fill) {
        fill.style.width = pct + '%';
        // 接近保底时填充转为警示红，提示"下次必出"
        fill.classList.toggle('is-near', cur >= dangerAt);
      }
      if (label) label.textContent = `${cur || 0} / ${max}`;
    };
    renderPity('pityBarFive', this.state.gachaPity || 0, 30, 24);
    renderPity('pityBarFour', this.state.gachaFourPity || 0, 5, 3);
    renderPity('pityBarCore', this.state.gachaCorePity || 0, 7, 5);

    // 招募统计数据刷新
    const elTotal = document.getElementById('gachaTotalCount');
    if (elTotal) elTotal.innerHTML = `${(this.state.totalGachaCount || 0).toLocaleString()} <span class="stat-tile-unit">次</span>`;
    const elFive = document.getElementById('gachaTotalFiveCount');
    if (elFive) elFive.innerHTML = `${(this.state.totalFiveStarCount || 0).toLocaleString()} <span class="stat-tile-unit">位</span>`;
    const elCore = document.getElementById('gachaTotalCoreCount');
    if (elCore) elCore.innerHTML = `${(this.state.totalCoreCount || 0).toLocaleString()} <span class="stat-tile-unit">位</span>`;

    // 城建状态横幅
    if (this.cityStatsBanner) {
      const palaceLvl = this.state.buildings?.palace || 1;
      const barracksLvl = this.state.buildings?.barracks || 0;
      this.cityStatsBanner.innerHTML = `部队统御上限: <b class="val-gold">统御 ${14 + palaceLvl}</b> · 兵营加成: <b class="val-copper">+${barracksLvl * 300} 兵/将</b>`;
    }
  }

  // ================= 0. 战棋版沙盘系统 (四大战略资源领地模块 · 1~10级自由出征无需连地) =================
  renderWorldMap() {
    if (!this.resourceLandsGrid && !this.worldMapGrid) return;

    // 确保数据结构完整
    if (!this.state.resourceLands) {
      this.state.resourceLands = {
        wood: { maxOccupiedLevel: 1 },
        iron: { maxOccupiedLevel: 1 },
        stone: { maxOccupiedLevel: 1 },
        grain: { maxOccupiedLevel: 1 }
      };
    }

    // 若有战棋版领地容器，优先渲染四大模块卡片
    if (this.resourceLandsGrid) {
      this.resourceLandsGrid.innerHTML = '';
      const resKeys = ['wood', 'iron', 'stone', 'grain'];

      resKeys.forEach(resKey => {
        const meta = RESOURCE_TYPES[resKey] || { name: '战略要地', resName: '资源', icon: '🚩', color: '#fbbf24', border: '#d97706', bgGrad: 'rgba(0,0,0,0.5)' };
        const landData = this.state.resourceLands[resKey] || { maxOccupiedLevel: 0 };
        const maxLv = landData.maxOccupiedLevel || 0;

        // 计算当前小时累计产出
        let currentProdPerHour = 0;
        for (let l = 1; l <= maxLv; l++) {
          currentProdPerHour += (LAND_TIERS[l]?.prodPerHour || 150);
        }
        if (currentProdPerHour === 0) currentProdPerHour = LAND_TIERS[1]?.prodPerHour || 150;

        const nextLv = Math.min(10, maxLv + 1);
        const nextCfg = LAND_TIERS[nextLv];

        const card = document.createElement('div');
        card.className = 'resource-land-card';
        card.style.background = meta.bgGrad;
        card.style.borderColor = meta.border;

        card.innerHTML = `
          <!-- 头部信息 -->
          <div class="resource-land-header">
            <div class="resource-land-title-wrap">
              <div class="resource-land-icon" style="box-shadow: 0 0 15px ${meta.color}40;">${meta.icon}</div>
              <div>
                <div class="resource-land-name">${meta.name}</div>
                <div class="resource-land-sub">主要战略资源：<b style="color:${meta.color};">${meta.resName}</b></div>
              </div>
            </div>
            <div>
              <span class="resource-land-badge" style="background:${maxLv >= 10 ? 'rgba(251,191,36,0.2)' : 'rgba(16,185,129,0.2)'}; border:1px solid ${maxLv >= 10 ? '#f59e0b' : '#059669'}; color:${maxLv >= 10 ? '#fbbf24' : '#6ee7b7'};">
                ${maxLv >= 10 ? '👑 已通关 10 级领地' : (maxLv > 0 ? `🛡️ 已开拓 Lv.${maxLv} 级` : '⚪ 尚未开拓')}
              </span>
            </div>
          </div>

          <!-- 产能看板与敌情预期 -->
          <div class="resource-land-stats-box">
            <div>
              <div class="card-note">当前领地产能</div>
              <div style="font-size:16px; font-weight:800; color:#6ee7b7; margin-top:2px;">
                +${currentProdPerHour.toLocaleString()} <span class="card-note">/小时</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="card-note">下一阶攻坚目标</div>
              <div style="font-size:13px; font-weight:bold; color:${maxLv >= 10 ? '#9ca3af' : '#fbbf24'}; margin-top:2px;">
                ${maxLv >= 10 ? '已达顶峰 10 级' : `Lv.${nextLv} 守将 (${nextCfg?.soldiers.toLocaleString()} 兵)`}
              </div>
            </div>
          </div>

          <!-- 底部快捷操作组 -->
          <div class="resource-land-actions">
            <button class="upgrade-btn btn-farm-single" style="flex:1; background:rgba(255,255,255,0.08); border:1px solid #4b5563; font-size:12px; padding:8px 6px;">
              🌾 快速屯田 (+3h)
            </button>
            <button class="upgrade-btn btn-select-level" style="flex:1.4; background:linear-gradient(135deg, #d97706 0%, #b45309 100%); font-weight:bold; font-size:13px; padding:8px 10px; box-shadow:0 2px 8px rgba(217,119,6,0.4);">
              ⚔️ 选地出征 (1~10级)
            </button>
          </div>
        `;

        // 绑定单项屯田
        card.querySelector('.btn-farm-single').addEventListener('click', (e) => {
          e.stopPropagation();
          this.quickFarmLand(resKey);
        });

        // 绑定打开1~10级选择弹窗
        card.querySelector('.btn-select-level').addEventListener('click', () => {
          sound.playDrum();
          this.openResourceLandModal(resKey);
        });

        // 点击卡片整体也可以打开
        card.addEventListener('click', () => {
          sound.playDrum();
          this.openResourceLandModal(resKey);
        });

        this.resourceLandsGrid.appendChild(card);
      });
    }
  }

  // 打开四大资源领地 1~10 级选择与出征全息 Modal
  openResourceLandModal(resKey) {
    if (!this.tileActionModal) return;

    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', resName: '资源', icon: '🚩', color: '#fbbf24' };
    const landData = this.state.resourceLands[resKey] || { maxOccupiedLevel: 0 };
    const maxLv = landData.maxOccupiedLevel || 0;

    this.tileModalTitle.innerHTML = `${meta.icon} ${meta.name} · 1~10 级领地开拓`;

    // 组装 1~10 级阶梯列表
    const playerTroop = this.getCurrentTroop();
    const hasTroop = !!(playerTroop && playerTroop.heroes && playerTroop.heroes.length);
    // 我方总战力：只需算一次，10 行复用（敌阵不同会导致克制修正，故每行单独评估）
    const myPowerInfo = hasTroop ? estimateTroopPower(playerTroop) : { total: 0, soldiers: 0 };

    let tierItemsHtml = '';
    for (let lv = 1; lv <= 10; lv++) {
      const cfg = LAND_TIERS[lv] || LAND_TIERS[1];
      const guardTroop = createLandGuardTroop(lv, resKey);
      // 标记等级供 evaluateLandMatchup 计算跳级幅度
      guardTroop._level = lv;
      const leadHero = guardTroop.heroes[0];
      const armMeta = ARMS[guardTroop.arm] || { name: guardTroop.arm, icon: '⚔️' };
      const isOccupied = (lv <= maxLv);
      const isNextTarget = (lv === maxLv + 1);

      // 兵种克制提示：骑克盾、盾克弓、弓克枪、枪克骑
      let restTip = '';
      if (guardTroop.arm === 'cavalry') restTip = '克制盾兵 · 惧怕枪兵';
      else if (guardTroop.arm === 'shield') restTip = '克制弓兵 · 惧怕骑兵';
      else if (guardTroop.arm === 'bow') restTip = '克制枪兵 · 惧怕盾兵';
      else if (guardTroop.arm === 'spear') restTip = '克制骑兵 · 惧怕弓兵';

      // ★ 战力评估：出征前就告知胜算，避免盲目送兵
      const matchup = hasTroop
        ? evaluateLandMatchup(playerTroop, guardTroop, { nextTarget: isNextTarget, isOccupied })
        : null;
      const chance = matchup ? matchup.chance : null;
      const enemyPower = matchup ? matchup.enemy.total : 0;

      // 战力对比条：以守军战力为 100% 基准，我方战力映射为百分比宽度（上限 130% 防溢出）
      const mineRatio = matchup && enemyPower > 0 ? Math.min(130, (myPowerInfo.total / enemyPower) * 100) : 0;
      const barClass = chance ? chance.level : 'even';
      const riskTip = chance
        ? (chance.level === 'great' ? '胜算极大，可稳推' :
           chance.level === 'even'  ? '势均力敌，看战法搭配' :
           chance.level === 'weak'  ? '兵力偏弱，建议先扫荡屯田' : '⚠️ 悬殊，强烈不建议出征')
        : '尚未配置出征武将';

      tierItemsHtml += `
        <div class="land-tier-item ${isOccupied ? 'occupied' : (isNextTarget ? 'current-target' : '')} ${chance && !isOccupied && (chance.level === 'weak' || chance.level === 'danger') ? 'risky' : ''} card-row--split"
             style="gap:12px; padding:12px; background:#161922; border:1px solid ${isNextTarget ? '#f59e0b' : '#2d3340'}; border-radius:8px">
          <!-- 守军基本信息与兵种 -->
          <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
            <div style="font-size:28px; width:44px; height:44px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
              ${leadHero.avatar}
            </div>
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-weight:800; font-size:14px; color:#fff;">Lv.${lv} ${cfg.name}</span>
                <span style="font-size:10px; background:rgba(56,189,248,0.15); border:1px solid #0284c7; color:#38bdf8; padding:1px 6px; border-radius:4px;">
                  ${armMeta.icon} ${armMeta.name}
                </span>
                ${isOccupied ? '<span style="font-size:10px; background:rgba(16,185,129,0.2); color:#6ee7b7; padding:1px 5px; border-radius:3px; font-weight:bold;">已占领</span>' : ''}
                ${isNextTarget ? '<span style="font-size:10px; background:rgba(251,191,36,0.2); color:#fbbf24; padding:1px 5px; border-radius:3px; font-weight:bold;">首要开拓</span>' : ''}
              </div>
              <div style="font-size:11px; color:#9ca3af; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap;">
                <span>守将: <b style="color:#e2e8f0;">${leadHero.name}</b></span>
                <span>守备兵力: <b class="val-damage">${cfg.soldiers.toLocaleString()}</b></span>
                <span class="val-copper">+${cfg.prodPerHour}/h</span>
              </div>
              <div style="font-size:10px; color:#a1a1aa; margin-top:2px;">
                克制关系: ${restTip}
              </div>

              <!-- ★ 战力对比条：绿=优势 / 黄=均势 / 橙=劣势 / 红=危局 -->
              ${hasTroop ? `
                <div class="power-compare ${barClass}" style="margin-top:6px;">
                  <div class="power-compare-head">
                    <span>我方 <b>${myPowerInfo.total.toLocaleString()}</b></span>
                    <span class="power-verdict">${chance.label} · ${chance.ratioText}</span>
                    <span>守军 <b>${enemyPower.toLocaleString()}</b></span>
                  </div>
                  <div class="power-bar-track">
                    <div class="power-bar-fill" style="width:${Math.max(6, mineRatio).toFixed(1)}%"></div>
                    <div class="power-bar-guard" style="left:${Math.min(96, 100).toFixed(1)}%"></div>
                  </div>
                  <div class="power-tip">${riskTip}</div>
                </div>
              ` : `
                <div class="power-compare empty" style="margin-top:6px;">
                  <div class="power-tip">⚠️ 尚未配置出征武将，无法评估战力</div>
                </div>
              `}
            </div>
          </div>

          <!-- 操作按钮区 (无需连地，直接出征) -->
          <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <button class="upgrade-btn btn-scout-tier" data-tier="${lv}" style="background:#374151; font-size:11px; padding:6px 10px;">
              🔍 虚实
            </button>
            ${isOccupied ? `
              <button class="upgrade-btn btn-farm-tier" data-tier="${lv}" style="background:linear-gradient(135deg, #059669 0%, #047857 100%); font-size:12px; padding:6px 12px; font-weight:bold;">
                🌾 扫荡
              </button>
            ` : `
              <button class="upgrade-btn btn-attack-tier" data-tier="${lv}" ${!hasTroop ? 'disabled' : ''}
                style="background:${isNextTarget ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'}; font-size:12px; padding:6px 14px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.3);${(!hasTroop || chance.level === 'danger') ? 'opacity:0.45;' : ''}">
                ⚔️ 出征
              </button>
            `}
          </div>
        </div>
      `;
    }

    this.tileModalBody.innerHTML = `
      <!-- 顶部领地总览（sticky：10 级列表较长，滚动时仍需可见当前进度与战力） -->
      <div class="land-overview-sticky">
        <div class="card-row--split card-row--wrap" style="flex-wrap:wrap; gap:8px">
          <div>
            <span style="font-size:13px; font-weight:bold; color:#fff;">【战棋出征模式】</span>
            <span style="font-size:12px; color:#9ca3af; margin-left:6px;">无需连地铺路，全图任意选定 1~10 级土地自由挥师出征！</span>
          </div>
          <div style="font-size:12px; color:#fbbf24; font-weight:bold;">
            当前最高开拓：Lv.${maxLv} / 10 级
          </div>
        </div>
        <!-- ★ 我方出征军团战力概览：出征前先知道自己有多强 -->
        <div class="land-my-power">
          ${hasTroop ? `
            <div class="land-my-power-item">
              <span class="lmp-label">出征军团</span>
              <span class="lmp-value">${playerTroop.name || '未命名军团'}</span>
            </div>
            <div class="land-my-power-item">
              <span class="lmp-label">总兵力</span>
              <span class="lmp-value">${myPowerInfo.soldiers.toLocaleString()}</span>
            </div>
            <div class="land-my-power-item">
              <span class="lmp-label">综合战力</span>
              <span class="lmp-value highlight">${myPowerInfo.total.toLocaleString()}</span>
            </div>
            <div class="land-my-power-hint">绿色优势 / 黄色均势 / 橙色劣势 / 红色危局，仅供决策参考</div>
          ` : `
            <div class="land-my-power-item warn">
              <span class="lmp-label">⚠️ 尚未配置出征武将</span>
              <span class="lmp-value">请先前往【编队】配置出战阵容</span>
            </div>
          `}
        </div>
      </div>

      <!-- 1~10 级阶梯列表 -->
      <div class="land-tier-list" style="display:flex; flex-direction:column; gap:10px; max-height:58vh; overflow-y:auto; padding-right:4px;">
        ${tierItemsHtml}
      </div>
    `;

    this.tileActionModal.style.display = 'flex';

    // 绑定各级【出征攻占】
    this.tileModalBody.querySelectorAll('.btn-attack-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const lv = parseInt(btn.getAttribute('data-tier'), 10);
        this.tileActionModal.style.display = 'none';
        this.launchLandAttack(resKey, lv);
      });
    });

    // 绑定各级【扫荡】
    this.tileModalBody.querySelectorAll('.btn-farm-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const lv = parseInt(btn.getAttribute('data-tier'), 10);
        this.tileActionModal.style.display = 'none';
        this.sweepLandTier(resKey, lv);
      });
    });

    // 绑定各级【侦查虚实】—— 弹出斥候军报（含战力评估），替代原生 alert
    this.tileModalBody.querySelectorAll('.btn-scout-tier').forEach(btn => {
      btn.addEventListener('click', () => {
        const lv = parseInt(btn.getAttribute('data-tier'), 10);
        sound.playDrum();
        this.openScoutReportModal(resKey, lv);
      });
    });

    // 打开弹窗后自动定位到「首要开拓」那一级，省去用户手动滚动
    const targetItem = this.tileModalBody.querySelector('.land-tier-item.current-target');
    if (targetItem) {
      requestAnimationFrame(() => {
        targetItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }

  /**
   * 斥候军报弹窗：把守军三人明细与战力评估集中呈现。
   * 原实现是浏览器原生 alert，信息密度低且打断操作流；
   * 这里复用 tileActionModal 作为报告容器，关闭后可回到阶梯列表继续决策。
   */
  openScoutReportModal(resKey, level) {
    if (!this.tileActionModal) return;

    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', resName: '资源', icon: '🚩' };
    const cfg = LAND_TIERS[level] || LAND_TIERS[1];
    const guardTroop = createLandGuardTroop(level, resKey);
    guardTroop._level = level;
    const armMeta = ARMS[guardTroop.arm] || { name: guardTroop.arm };
    const playerTroop = this.getCurrentTroop();
    const hasTroop = !!(playerTroop && playerTroop.heroes && playerTroop.heroes.length);

    this.tileModalTitle.innerHTML = `🔍 斥候军报 · ${meta.name} Lv.${level}`;

    const heroRows = guardTroop.heroes.map((h, idx) => `
      <div class="scout-hero-row" role="${idx === 0 ? '主将' : idx === 1 ? '左卫' : '右翼'}">
        <div class="shr-avatar">${h.avatar}</div>
        <div class="shr-info">
          <div class="shr-name">${h.name} <span class="shr-role">${idx === 0 ? '主将' : idx === 1 ? '左卫' : '右翼'}</span></div>
          <div class="shr-detail">Lv.${h.level} · 兵力 ${h.currentSoldiers.toLocaleString()} · 统 ${h.command} · 武 ${h.force} · 智 ${h.intel}</div>
        </div>
        <div class="shr-power">战力 ${estimateTroopPower({ arm: guardTroop.arm, heroes: [h] }).total.toLocaleString()}</div>
      </div>
    `).join('');

    const matchupHtml = hasTroop
      ? (() => {
          const m = evaluateLandMatchup(playerTroop, guardTroop, { nextTarget: false, isOccupied: false });
          return `
            <div class="scout-verdict ${m.chance.level}">
              <div class="sv-head">
                <span>战力对比</span>
                <span class="sv-badge">${m.chance.label} · ${m.chance.ratioText}</span>
              </div>
              <div class="sv-bar">
                <div class="sv-fill" style="width:${Math.min(100, m.mine.total / m.enemy.total * 100).toFixed(1)}%"></div>
              </div>
              <div class="sv-nums">
                <span>我军 <b>${m.mine.total.toLocaleString()}</b></span>
                <span>守军 <b>${m.enemy.total.toLocaleString()}</b></span>
              </div>
            </div>
          `;
        })()
      : `<div class="scout-verdict empty"><span>⚠️ 尚未配置出征武将，无法评估战力</span></div>`;

    this.tileModalBody.innerHTML = `
      <div class="scout-report">
        <div class="scout-summary">
          <div class="scout-summary-row">
            <span class="ssr-label">守军部曲</span>
            <span class="ssr-value">${armMeta.name || armMeta.icon || guardTroop.arm}</span>
          </div>
          <div class="scout-summary-row">
            <span class="ssr-label">总兵力</span>
            <span class="ssr-value danger">${cfg.soldiers.toLocaleString()}</span>
          </div>
          <div class="scout-summary-row">
            <span class="ssr-label">土地产出</span>
            <span class="ssr-value gain">+${cfg.prodPerHour.toLocaleString()} /小时</span>
          </div>
        </div>

        ${matchupHtml}

        <div class="scout-hero-list">
          <div class="scout-section-title">守军编成明细</div>
          ${heroRows}
        </div>

        <div class="scout-tip">
          💡 <b>兵种克制</b>：骑克盾、盾克弓、弓克枪、枪克骑。克制方伤害 +15%，被克方 −15%。
          调整出征兵种可显著改变胜负。<br>
          ⚠️ 本报告为<strong>事前静态估算</strong>，实际胜负受战法触发与站位影响，仅供决策参考。
        </div>

        <button class="upgrade-btn scout-back-btn" style="width:100%; background:linear-gradient(135deg,#374151 0%,#1f2937 100%); padding:9px; font-weight:bold;">
          ← 返回阶梯列表
        </button>
      </div>
    `;

    this.tileActionModal.style.display = 'flex';

    this.tileModalBody.querySelector('.scout-back-btn')?.addEventListener('click', () => {
      // 重新渲染会重建阶梯列表内容，回到原弹窗视图
      this.openResourceLandModal(resKey);
    });
  }

  // 获取当前选中的主力出征军团 (5支军团任意切换出战)
  getCurrentTroop() {
    const idx = Math.max(0, Math.min(4, this.state.currentTroopIndex || 0));
    return this.state.troops[idx] || this.state.troops[0];
  }

  // 战棋版自由出征打地推演 (彻底无需连地)
  launchLandAttack(resKey, level) {
    const playerTroop = this.getCurrentTroop();
    if (!playerTroop || playerTroop.heroes.length === 0) {
      slgNotice({ title: '出征受阻', body: '您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playDrum();

    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', resName: '资源' };
    const tierCfg = LAND_TIERS[level] || LAND_TIERS[1];
    const guardTroop = createLandGuardTroop(level, resKey);

    // 战棋版直接 100 士气全胜出征推演 (代入战法等级)
    const result = simulateBattle(playerTroop, guardTroop, {
      playerMorale: 100,
      tacticLevels: this.state.tacticLevels || {}
    });

    const isWin = (result.summary.winner === 'player');
    const landData = this.state.resourceLands[resKey] || { maxOccupiedLevel: 0 };
    const oldMaxLv = landData.maxOccupiedLevel || 0;

    if (isWin) {
      sound.playVictoryHorn();

      // 若战胜了更高等级，突破晋升开拓进度
      if (level > oldMaxLv) {
        this.state.resourceLands[resKey].maxOccupiedLevel = level;
      }

      // 攻占丰厚奖励
      const copperReward = level * 1000;
      this.state.resources.copper = (this.state.resources.copper || 0) + copperReward;

      // 参战武将获得战斗历练经验 (依据土地等级与守军兵力计算)
      const baseExp = Math.round(tierCfg.soldiers * 0.85);
      const levelUpMessages = [];
      playerTroop.heroes.forEach(h => {
        const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
        const res = addGeneralExp(realHero, baseExp);
        h.level = realHero.level;
        h.exp = realHero.exp;
        if (res.leveledUp) {
          levelUpMessages.push(`【${realHero.name}】晋升至 Lv.${res.newLevel} (带兵上限提升)！`);
        }
      });

      const promoteStr = (level > oldMaxLv) ? `👑 【${meta.name}】最高开拓等级晋升至 Lv.${level}！全境产能大幅提升！` : '';

      // 结算信息不再重复弹原生 alert；改由下方战报弹窗统一呈现。
      // 存在实例属性而非 this.state —— 纯 UI 瞬态不该被存档持久化。
      this.pendingLandResult = {
        title: '🎉 攻占大捷',
        lines: [
          `攻克 ${meta.name} · Lv.${level} ${tierCfg.name}`,
          `铜币 🪙 +${copperReward.toLocaleString()}`,
          `参战武将历练经验 +${baseExp.toLocaleString()}`,
        ],
        extras: [promoteStr, ...levelUpMessages].filter(Boolean),
      };
    } else {
      sound.playSwordClash();
      this.pendingLandResult = {
        title: '⚠️ 出征失利',
        lines: [`未能击溃 Lv.${level} 守备部曲，领地攻占失败`],
        extras: ['建议先扫荡屯田积蓄兵力，或调整兵种克制关系后再战'],
      };
    }

    // 战报沉淀
    const reportItem = {
      id: `rep_${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      tileName: `战棋沙盘 · ${meta.name}(Lv.${level})`,
      isVictory: isWin,
      summary: result.summary,
      logs: result.logs
    };
    this.state.battleReports.unshift(reportItem);
    if (this.state.battleReports.length > 20) this.state.battleReports.pop();

    this.save();
    this.renderHUD();
    this.renderWorldMap();
    // 把本次出征的收获/损失挂到战报上，由战报弹窗顶部结算条渲染
    reportItem.reward = this.pendingLandResult;
    this.pendingLandResult = null;
    this.openBattleDetailModal(reportItem);
  }

  // 扫荡已占领土地 (获得经验与屯田丰收)
  sweepLandTier(resKey, level) {
    const playerTroop = this.getCurrentTroop();
    if (!playerTroop || playerTroop.heroes.length === 0) {
      slgNotice({ title: '出征受阻', body: '您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playDrum();
    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', resName: '资源' };
    const tierCfg = LAND_TIERS[level] || LAND_TIERS[1];

    // 扫荡直接收获 3 小时该地块产出
    const harvest = tierCfg.prodPerHour * 3;
    this.state.resources[resKey] = (this.state.resources[resKey] || 0) + harvest;

    // 武将获得历练经验
    const baseExp = Math.round(tierCfg.soldiers * 0.5);
    const levelUpMessages = [];
    playerTroop.heroes.forEach(h => {
      const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
      const res = addGeneralExp(realHero, baseExp);
      h.level = realHero.level;
      h.exp = realHero.exp;
      if (res.leveledUp) {
        levelUpMessages.push(`【${realHero.name}】晋升至 Lv.${res.newLevel}！`);
      }
    });

    sound.playVictoryHorn();
    this.save();
    this.renderHUD();
    this.renderWorldMap();
    this.showHarvestReportModal(resKey, level, harvest, baseExp, levelUpMessages);
  }

  /**
   * 屯田/扫荡成果面板。
   * 扫荡不产生战报（无战斗推演），故单独做一个轻量成果弹窗，
   * 替代原先的原生 alert —— 保留同样的信息量，但不再打断浏览器原生弹窗。
   */
  showHarvestReportModal(resKey, level, harvest, baseExp, levelUpMessages = []) {
    if (!this.tileActionModal) return;
    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', icon: '🚩' };
    const cfg = LAND_TIERS[level] || LAND_TIERS[1];

    this.tileModalTitle.innerHTML = `🌾 屯田成果 · ${meta.name} Lv.${level}`;
    this.tileModalBody.innerHTML = `
      <div class="harvest-report">
        <div class="harvest-big">
          <div class="hb-label">${meta.resName || meta.name} 入库</div>
          <div class="hb-value" style="color:${meta.color || '#fbbf24'};">+${harvest.toLocaleString()}</div>
          <div class="hb-sub">按 ${cfg.name} 产出 ${cfg.prodPerHour.toLocaleString()}/h × 3 小时结算</div>
        </div>
        <div class="harvest-rows">
          ${baseExp > 0 ? `
            <div class="harvest-row">
              <span>参战武将历练经验</span>
              <b>+${baseExp.toLocaleString()}</b>
            </div>
          ` : ''}
          <div class="harvest-row">
            <span>本次结算等级</span>
            <b>Lv.${level} ${cfg.name}</b>
          </div>
        </div>
        ${levelUpMessages.length ? `
          <div class="harvest-levelups">
            <div class="scout-section-title">🌟 武将突破升级</div>
            ${levelUpMessages.map(m => `<div class="hl-item">${m}</div>`).join('')}
          </div>
        ` : ''}
        <button class="upgrade-btn harvest-back-btn" style="width:100%; background:linear-gradient(135deg,#374151 0%,#1f2937 100%); padding:9px; font-weight:bold;">
          确认收下
        </button>
      </div>
    `;
    this.tileActionModal.style.display = 'flex';
    this.tileModalBody.querySelector('.harvest-back-btn')?.addEventListener('click', () => {
      // 回到领地阶梯列表，保持用户的操作上下文连续
      this.openResourceLandModal(resKey);
    });
  }

  // 快速屯田单个资源领地 (+3小时产出)
  quickFarmLand(resKey) {
    const meta = RESOURCE_TYPES[resKey] || { name: '战略领地', resName: '资源' };
    const landData = this.state.resourceLands[resKey] || { maxOccupiedLevel: 1 };
    const maxLv = Math.max(1, landData.maxOccupiedLevel || 1);

    // 计算当前小时累计产出
    let currentProdPerHour = 0;
    for (let l = 1; l <= maxLv; l++) {
      currentProdPerHour += (LAND_TIERS[l]?.prodPerHour || 150);
    }
    const harvest = currentProdPerHour * 3;
    this.state.resources[resKey] = (this.state.resources[resKey] || 0) + harvest;

    sound.playVictoryHorn();
    this.save();
    this.renderHUD();
    this.renderWorldMap();
    // 复用成果面板：exp 传 0 表示本次无战斗历练，渲染时自动隐藏经验行
    this.showHarvestReportModal(resKey, maxLv, harvest, 0, []);
  }

  // 全境一键屯田 (+3小时全部4大资源产出)
  quickFarmAllLands() {
    const resKeys = ['wood', 'iron', 'stone', 'grain'];
    const detail = [];
    let totalHarvest = 0;

    resKeys.forEach(rk => {
      const meta = RESOURCE_TYPES[rk];
      const landData = this.state.resourceLands?.[rk] || { maxOccupiedLevel: 1 };
      const maxLv = Math.max(1, landData.maxOccupiedLevel || 1);
      let prod = 0;
      for (let l = 1; l <= maxLv; l++) {
        prod += (LAND_TIERS[l]?.prodPerHour || 150);
      }
      const harvest = prod * 3;
      this.state.resources[rk] = (this.state.resources[rk] || 0) + harvest;
      totalHarvest += harvest;
      detail.push({ meta, harvest, maxLv });
    });

    sound.playVictoryHorn();
    this.save();
    this.renderHUD();
    this.renderWorldMap();

    // 全境屯田用独立面板：一次列出四大资源明细，比逐个弹四次更清晰
    if (this.tileActionModal) {
      this.tileModalTitle.innerHTML = '🌾 全境屯田大丰收';
      this.tileModalBody.innerHTML = `
        <div class="harvest-report">
          <div class="harvest-big">
            <div class="hb-label">四境资源合计入库</div>
            <div class="hb-value" style="color:#fbbf24;">+${totalHarvest.toLocaleString()}</div>
            <div class="hb-sub">各领地按当前开拓等级 × 3 小时结算</div>
          </div>
          <div class="harvest-rows">
            ${detail.map(d => `
              <div class="harvest-row">
                <span>${d.meta.icon} ${d.meta.name} <small style="color:#6b7280;">(Lv.${d.maxLv})</small></span>
                <b style="color:${d.meta.color};">+${d.harvest.toLocaleString()}</b>
              </div>
            `).join('')}
          </div>
          <button class="upgrade-btn harvest-back-btn" style="width:100%; background:linear-gradient(135deg,#374151 0%,#1f2937 100%); padding:9px; font-weight:bold;">
            确认收下
          </button>
        </div>
      `;
      this.tileActionModal.style.display = 'flex';
      this.tileModalBody.querySelector('.harvest-back-btn')?.addEventListener('click', () => {
        this.tileActionModal.style.display = 'none';
      });
    }
  }

  // ================= 0.5. 主城内政城建系统 (君王殿、兵营、军舍、四大资源所) =================
  renderCityBuildings() {
    if (!this.cityBuildingsGrid) return;
    this.cityBuildingsGrid.innerHTML = '';

    const buildings = this.state.buildings || {};

    Object.values(BUILDINGS_CONFIG).forEach(cfg => {
      const currentLvl = buildings[cfg.id] || 0;
      const isMax = (currentLvl >= cfg.maxLevel);
      const nextLvl = currentLvl + 1;
      const cost = isMax ? null : cfg.cost(nextLvl);
      const canAfford = cost ? hasEnoughResources(this.state.resources, cost) : false;

      const card = document.createElement('div');
      card.className = 'campaign-card';
      card.style.background = '#181b22';

      let costStr = '';
      if (!isMax && cost) {
        costStr = Object.entries(cost).map(([k, v]) => {
          const names = { wood: '🌲木', iron: '⛏️铁', stone: '🪨石', grain: '🌾粮' };
          const have = this.state.resources[k] || 0;
          const color = have >= v ? '#6ee7b7' : '#ef4444';
          return `<span style="color:${color}; font-size:11px;">${names[k] || k} ${Math.round(v).toLocaleString()}</span>`;
        }).join(' · ');
      }

      card.innerHTML = `
        <div class="campaign-left">
          <div class="campaign-icon">${cfg.icon}</div>
          <div>
            <div class="campaign-title-row">
              <span class="campaign-name">${cfg.name}</span>
              <span style="font-size:12px; color:#fbbf24; font-weight:bold; background:rgba(251,191,36,0.1); border:1px solid #d97706; padding:1px 6px; border-radius:4px;">
                Lv.${currentLvl} / ${cfg.maxLevel}
              </span>
            </div>
            <div class="campaign-desc">${cfg.desc}</div>
            <div style="font-size:11px; color:#38bdf8;">
              当前功效: <b>${cfg.effect(currentLvl)}</b>
              ${!isMax ? ` ➔ 下级: <b class="val-gold">${cfg.effect(nextLvl)}</b>` : ''}
            </div>
            ${!isMax ? `<div style="margin-top:6px; font-size:11px; color:#9ca3af;">升级所需: ${costStr}</div>` : ''}
          </div>
        </div>
        <div class="campaign-right">
          ${isMax ? `
            <div style="font-size:12px; color:#fbbf24; font-weight:bold;">已达顶级</div>
          ` : `
            <button class="upgrade-btn btn-upgrade-building" data-id="${cfg.id}" style="padding:6px 16px; font-size:12px; font-weight:bold; ${!canAfford ? 'opacity:0.5;' : 'background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);'}">
              🏛️ 建造升级
            </button>
          `}
        </div>
      `;

      this.cityBuildingsGrid.appendChild(card);
    });

    // 绑定升级按钮
    this.cityBuildingsGrid.querySelectorAll('.btn-upgrade-building').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.upgradeBuilding(id);
      });
    });
  }

  // 执行建筑升级
  upgradeBuilding(bId) {
    const cfg = BUILDINGS_CONFIG[bId];
    if (!cfg) return;

    const currentLvl = this.state.buildings[bId] || 0;
    if (currentLvl >= cfg.maxLevel) {
      slgNotice({ title: '建造提示', body: '该建筑已升至最高等级！', seal: '🏯', type: 'info' });
      return;
    }

    const nextLvl = currentLvl + 1;
    const cost = cfg.cost(nextLvl);

    if (!hasEnoughResources(this.state.resources, cost)) {
      slgNotice({ title: '军资告急', body: '⚠️ 资源不足！\n请占领更多对应资源地块或屯田积攒战略储备！', seal: '⚠️', type: 'danger' });
      return;
    }

    // 扣减资源并升级
    this.state.resources = deductResources(this.state.resources, cost);
    this.state.buildings[bId] = nextLvl;

    sound.playVictoryHorn();
    slgNotice({ title: '城建告捷', body: `🎉【城建告捷】恭贺主公！【${cfg.name}】成功营建升级至 Lv.${nextLvl}！\n生效收益：${cfg.effect(nextLvl)}！`, seal: '🏯', type: 'ok' });

    this.save();
    this.renderHUD();
    this.renderCityBuildings();
  }

  // ================= 1. 征战天下：历史战役与演武试炼 =================
  renderCampaigns() {
    this.campaignsContainer.innerHTML = '';
    const progress = this.state.campaignProgress || {};

    CAMPAIGNS_DATA.forEach((camp, idx) => {
      const campState = progress[camp.id] || { stars: 0, cleared: false };
      const card = document.createElement('div');
      card.className = `campaign-card ${campState.cleared ? 'cleared' : ''}`;
      card.style.background = camp.bgGradient;

      const starStr = campState.stars > 0 
        ? '★'.repeat(campState.stars) + '☆'.repeat(3 - campState.stars)
        : '☆☆☆';

      const enemyArmObj = ARMS[camp.enemyArm] || ARMS.spear;

      card.innerHTML = `
        <div class="campaign-left">
          <div class="campaign-icon">${camp.icon}</div>
          <div>
            <div class="campaign-title-row">
              <span class="campaign-name">第 ${camp.chapter} 章 · ${camp.title}</span>
              <span class="campaign-stars">${starStr}</span>
            </div>
            <div class="campaign-desc">${camp.desc}</div>
            <div class="campaign-hint">${camp.tacticalHint}</div>
          </div>
        </div>
        <div class="campaign-right">
          <div style="font-size:11px; color:#fbbf24;">敌方兵种: <b>${enemyArmObj.icon} ${enemyArmObj.name}</b></div>
          <div class="enemy-heroes-preview">
            ${camp.enemyHeroes.map(h => `<span class="enemy-hero-tag">${h.avatar} ${h.name}</span>`).join('')}
          </div>
          <button class="btn-start-battle" data-id="${camp.id}">
            ${campState.cleared ? '🔄 再次挑战' : '⚔️ 全军出击'}
          </button>
        </div>
      `;

      card.querySelector('.btn-start-battle').addEventListener('click', () => {
        this.launchCampaignBattle(camp);
      });

      this.campaignsContainer.appendChild(card);
    });
  }

  renderTrials() {
    this.trialsContainer.innerHTML = '';
    const currentFloor = this.state.trialFloor || 1;

    TRIALS_DATA.forEach(trial => {
      const card = document.createElement('div');
      const isCleared = (trial.floor < currentFloor);
      const isCurrent = (trial.floor === currentFloor);
      const isLocked = (trial.floor > currentFloor);

      card.className = `trial-card ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''}`;
      const armObj = ARMS[trial.arm] || ARMS.spear;

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="font-size:24px; font-weight:900; color:${isCurrent?'#38bdf8':'#9ca3af'}; width:48px; text-align:center;">
            F.${trial.floor}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px; font-weight:bold; color:#fff;">${trial.title}</span>
              <span style="font-size:11px; background:${isCleared?'#059669':isCurrent?'#0284c7':'#4b5563'}; color:#fff; padding:1px 6px; border-radius:4px;">
                ${isCleared ? '已通关' : isCurrent ? '当前迎战' : '尚未解锁'}
              </span>
              <span style="font-size:11px; color:#fbbf24;">${armObj.icon} ${armObj.name}</span>
            </div>
            <div style="font-size:12px; color:#9ca3af; margin-top:2px;">守军主将: <b>${trial.leadName}</b> · 难度: <b style="color:#f59e0b;">${trial.difficulty}</b></div>
            <div style="font-size:11px; color:#38bdf8; margin-top:2px;">${trial.hint}</div>
          </div>
        </div>
        <div>
          <button class="upgrade-btn btn-trial-battle" data-floor="${trial.floor}" style="background:${isCurrent?'#0284c7':'#4b5563'}; padding:6px 16px; font-size:12px;" ${isLocked ? 'disabled' : ''}>
            ${isCleared ? '已通过' : isCurrent ? '⚔️ 迎击试炼' : '未解锁'}
          </button>
        </div>
      `;

      if (isCurrent) {
        card.querySelector('.btn-trial-battle').addEventListener('click', () => {
          this.launchTrialBattle(trial);
        });
      }

      this.trialsContainer.appendChild(card);
    });
  }

  // 发起历史战役对战 (主线闯关：使用武将真实养成等级与带兵量，保全练级与开荒的真实爽感)
  launchCampaignBattle(camp) {
    const playerTroop = this.getCurrentTroop();
    if (!playerTroop || playerTroop.heroes.length === 0) {
      slgNotice({ title: '出征受阻', body: '您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playDrum();

    // 敌方依据各章节历史设定的阶梯等级与兵力配置
    const enemyTroop = {
      isPlayer: false,
      arm: camp.enemyArm,
      heroes: camp.enemyHeroes.map(h => ({
        ...h,
        currentSoldiers: h.currentSoldiers || 10000,
        maxSoldiers: h.maxSoldiers || 10000
      }))
    };

    // 执行8回合战斗推演 (应用我方武将真实等级、属性成长与战法研习级别)
    const result = simulateBattle(playerTroop, enemyTroop, { tacticLevels: this.state.tacticLevels || {} });
    const isWin = (result.summary.winner === 'player');

    if (isWin) {
      sound.playVictoryHorn();
      const starsEarned = result.summary.stars || 1;
      const prevStars = this.state.campaignProgress[camp.id]?.stars || 0;
      this.state.campaignProgress[camp.id] = {
        cleared: true,
        stars: Math.max(prevStars, starsEarned)
      };
      // 战役胜利奖励铜币
      const copperReward = 3000 * starsEarned;
      this.state.resources.copper = (this.state.resources.copper || 0) + copperReward;

      // 🌟 参战武将获得战役海量经验 (实打实练级成长，带来突破与兵力上限飞跃)
      const campExp = 1500 * starsEarned;
      const levelUpMessages = [];
      playerTroop.heroes.forEach(h => {
        const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
        const res = addGeneralExp(realHero, campExp);
        h.level = realHero.level;
        h.exp = realHero.exp;
        h.maxSoldiers = realHero.maxSoldiers;
        h.currentSoldiers = realHero.currentSoldiers;
        if (res.leveledUp) {
          levelUpMessages.push(`【${realHero.name}】突破升至 Lv.${res.newLevel} (带兵上限 +${(res.newLevel - res.oldLevel) * 100})！`);
        }
      });
      if (levelUpMessages.length > 0) {
        slgNotice({ title: '武将练级突破', body: `🌟【武将练级突破】\n${levelUpMessages.join('\n')}`, seal: '🌟', type: 'ok' });
      }
    } else {
      sound.playSwordClash();
    }

    // 战报入库
    const reportItem = {
      id: `rep_${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      tileName: camp.title,
      isVictory: isWin,
      stars: result.summary.stars,
      summary: result.summary,
      logs: result.logs
    };
    this.state.battleReports.unshift(reportItem);
    if (this.state.battleReports.length > 20) this.state.battleReports.pop();

    this.save();
    this.renderHUD();
    this.renderCampaigns();
    this.openBattleDetailModal(reportItem);
  }

  // 发起演武试炼对战 (征战模式：双方全员默认 Lv.50 满级、10,000 满兵力巅峰公平竞技)
  launchTrialBattle(trial) {
    const rawPlayerTroop = this.getCurrentTroop();
    if (!rawPlayerTroop || rawPlayerTroop.heroes.length === 0) {
      slgNotice({ title: '出征受阻', body: '您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playDrum();

    // 1. 我方参战部队：克隆出征武将，征战模式统一设置为 Lv.50 满级与 10,000 满兵力
    const playerTroop = {
      ...rawPlayerTroop,
      heroes: rawPlayerTroop.heroes.map(h => ({
        ...h,
        level: MAX_GENERAL_LEVEL,
        currentSoldiers: 10000,
        maxSoldiers: 10000
      }))
    };

    // 2. 敌方试炼部队：统一设置为 Lv.50 满级、10,000 满兵力，且战法等级全部拉满 (Lv.10 满级)
    const enemyHeroes = trial.heroes.map(h => {
      const template = GENERALS_DATA.find(g => g.name === h.name) || h;
      return {
        ...template,
        ...h,
        level: MAX_GENERAL_LEVEL,
        tacticLevel: MAX_TACTIC_LEVEL, // 敌方战法统一拉满至 Lv.10
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: template.aptitude || { cavalry: 'A', shield: 'A', bow: 'A', spear: 'A', siege: 'B' }
      };
    });

    const enemyTroop = {
      isPlayer: false,
      arm: trial.arm,
      heroes: enemyHeroes
    };

    // 执行8回合战斗推演 (我方应用实际研习战法等级，演武敌方全员战法统一强制 Lv.10 满级)
    const result = simulateBattle(playerTroop, enemyTroop, { 
      tacticLevels: this.state.tacticLevels || {},
      enemyTacticLevels: new Proxy({}, { get: () => MAX_TACTIC_LEVEL }) // 确保敌方任意战法均为满级 10
    });
    const isWin = (result.summary.winner === 'player');

    if (isWin) {
      sound.playVictoryHorn();
      this.state.trialFloor = (this.state.trialFloor || 1) + 1;
      const copperReward = trial.floor * 3000;
      this.state.resources.copper = (this.state.resources.copper || 0) + copperReward;

      slgNotice({ title: '演武通天阁 · 捷报', body: `🎉 恭贺主公！\n力克强敌，斩获演武第 ${trial.floor} 层胜利！\n获赠 🪙 ${copperReward.toLocaleString()} 铜币！\n晋级至第 ${this.state.trialFloor} 层！`, seal: '🏆', type: 'ok' });
    } else {
      sound.playSwordClash();
    }

    const reportItem = {
      id: `rep_${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      tileName: trial.title,
      isVictory: isWin,
      summary: result.summary,
      logs: result.logs
    };
    this.state.battleReports.unshift(reportItem);
    if (this.state.battleReports.length > 20) this.state.battleReports.pop();

    this.save();
    this.renderHUD();
    this.renderTrials();
  }

  // ================= 1.8. 假想敌自定义沙盒演习系统 (全武将·全战法自由对战) =================
  renderSandbox() {
    if (!this.sandboxContainer) return;

    const playerTroop = this.state.troops[this.state.currentTroopIndex || 0] || this.state.troops[0];
    const previewEl = document.getElementById('sandboxPlayerTroopPreview');
    const enemyPanelEl = document.getElementById('sandboxEnemyTroopPanel');

    // 1. 渲染我方出征部队预览
    if (previewEl && playerTroop) {
      const armMeta = ARMS[playerTroop.arm] || { name: '枪兵', icon: '🗡️' };
      const heroCardsHtml = (playerTroop.heroes || []).map((h, sIdx) => {
        if (!h) {
          return `
            <div style="background:rgba(0,0,0,0.3); border:1px dashed #4b5563; border-radius:6px; padding:8px; text-align:center; font-size:11px; color:#6b7280;">
              ${sIdx === 0 ? '【主将空置】' : '【副将空置】'}
            </div>
          `;
        }
        const bTactic = TACTICS_DATA.find(t => t.id === h.builtInTacticId);
        const t1 = TACTICS_DATA.find(t => t.id === h.equippedTactic1);
        const t2 = TACTICS_DATA.find(t => t.id === h.equippedTactic2);
        return `
          <div class="card-row--split" style="background:rgba(0,0,0,0.3); border:1px solid #2d3340; border-radius:6px; padding:8px 10px">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">${h.avatar}</span>
              <div>
                <div style="font-size:13px; font-weight:bold; color:#fff;">
                  ${h.name} <span class="card-micro">(Lv.${h.level || 50})</span>
                </div>
                <div class="card-note card-note--tight">
                  战法: ${bTactic?.name || '自带战法'} · ${t1?.name || '无'} · ${t2?.name || '无'}
                </div>
              </div>
            </div>
            <span style="font-size:11px; color:#34d399; font-weight:bold;">${sIdx === 0 ? '★主将' : '副将'}</span>
          </div>
        `;
      }).join('');

      previewEl.innerHTML = `
        <div class="card-row--split" style="border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px">
          <div>
            <div style="font-weight:800; font-size:15px; color:#10b981;">🛡️ 我方参战：${playerTroop.name}</div>
            <div class="card-note card-note--tight">兵种：<b class="val-copper">${armMeta.icon} ${armMeta.name}</b> (可在【编队】自由换将)</div>
          </div>
          <span style="font-size:11px; background:rgba(16,185,129,0.15); border:1px solid #059669; color:#6ee7b7; padding:2px 8px; border-radius:4px;">
            满状态推演
          </span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${heroCardsHtml}
        </div>
      `;
    }

    // 2. 渲染敌方假想部队控制台
    if (enemyPanelEl) {
      const enemyCfg = this.state.customEnemyTroop || {
        name: '假想敌军',
        arm: 'spear',
        heroes: [
          { generalId: 'gen_zhu_ge_liang', level: 50, tactic1Id: 'tac_ba_men_jin_suo', tactic2Id: 'tac_chen_huo_da_jie' },
          { generalId: 'gen_liu_bei', level: 50, tactic1Id: 'tac_yu_di_ping_zhang', tactic2Id: 'tac_zi_yu' },
          { generalId: 'gen_guan_yu', level: 50, tactic1Id: 'tac_suo_xiang_pi_mi', tactic2Id: 'tac_po_zhen_cui_jian' }
        ]
      };

      // 兵种切换按钮
      const armsHtml = Object.keys(ARMS).map(ak => `
        <button class="nav-tab-btn btn-enemy-arm ${enemyCfg.arm === ak ? 'active' : ''}" data-arm="${ak}" style="padding:4px 8px; font-size:11px; border:1px solid #374151;">
          ${ARMS[ak].icon} ${ARMS[ak].name}
        </button>
      `).join('');

      // 3个槽位
      const slotsHtml = [0, 1, 2].map(slotIdx => {
        const hCfg = enemyCfg.heroes[slotIdx] || { generalId: 'gen_liu_bei', level: 50, tactic1Id: null, tactic2Id: null };
        const gen = GENERALS_DATA.find(g => g.id === hCfg.generalId) || GENERALS_DATA[0];
        const t1 = TACTICS_DATA.find(t => t.id === hCfg.tactic1Id);
        const t2 = TACTICS_DATA.find(t => t.id === hCfg.tactic2Id);
        const bTactic = TACTICS_DATA.find(t => t.id === gen.builtInTacticId);
        const camp = CAMPS[gen.camp] || { name: '群', color: '#888' };

        return `
          <div class="sandbox-slot-card">
            <div class="card-row--split">
              <span style="font-size:12px; font-weight:bold; color:${slotIdx === 0 ? '#f87171' : '#fbbf24'};">
                ${slotIdx === 0 ? '★ 敌方主将' : `敌方副将 ${slotIdx}`}
              </span>
              <button class="upgrade-btn btn-change-sandbox-hero" data-slot="${slotIdx}" style="padding:2px 8px; font-size:11px; background:#4b5563;">
                🔄 换将
              </button>
            </div>
            
            <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:6px;">
              <span style="font-size:28px;">${gen.avatar}</span>
              <div style="flex:1;">
                <div style="font-size:13px; font-weight:bold; color:#fff; display:flex; align-items:center; gap:6px;">
                  <span>${gen.name}</span>
                  <span style="font-size:10px; background:${camp.color}; padding:1px 4px; border-radius:3px;">${camp.name}</span>
                  <span class="card-micro">${'★'.repeat(gen.star)}</span>
                </div>
                <div class="card-note card-note--tight">
                  自带: <b class="val-gold">${bTactic?.name || '自带战法'}</b> (Lv.10)
                </div>
              </div>
            </div>

            <!-- 战法槽 1 与 战法槽 2 -->
            <div style="display:flex; gap:6px;">
              <div class="sandbox-tactic-badge btn-change-sandbox-tactic" data-slot="${slotIdx}" data-tslot="1" style="flex:1;">
                <span style="font-size:10px; color:#9ca3af;">战法1:</span>
                <span style="font-weight:bold; color:#6ee7b7;">${t1?.name || '+ 选战法'}</span>
              </div>
              <div class="sandbox-tactic-badge btn-change-sandbox-tactic" data-slot="${slotIdx}" data-tslot="2" style="flex:1;">
                <span style="font-size:10px; color:#9ca3af;">战法2:</span>
                <span style="font-weight:bold; color:#6ee7b7;">${t2?.name || '+ 选战法'}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      enemyPanelEl.innerHTML = `
        <div class="card-row--split card-row--wrap" style="border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; flex-wrap:wrap; gap:6px">
          <div>
            <div style="font-weight:800; font-size:15px; color:#f87171;">⚔️ 敌方假想军团</div>
            <div class="card-note card-note--tight">等级：Lv.50 · 兵力：30,000 · 战法：Lv.10</div>
          </div>
          <div style="display:flex; gap:4px;">
            ${armsHtml}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${slotsHtml}
        </div>
      `;

      // 绑定敌军兵种切换
      enemyPanelEl.querySelectorAll('.btn-enemy-arm').forEach(btn => {
        btn.addEventListener('click', () => {
          this.state.customEnemyTroop.arm = btn.getAttribute('data-arm');
          sound.playDrum();
          this.renderSandbox();
          this.save();
        });
      });

      // 绑定更换敌将
      enemyPanelEl.querySelectorAll('.btn-change-sandbox-hero').forEach(btn => {
        btn.addEventListener('click', () => {
          const sIdx = parseInt(btn.getAttribute('data-slot'), 10);
          this.openSandboxSelectModal('general', sIdx);
        });
      });

      // 绑定更换战法
      enemyPanelEl.querySelectorAll('.btn-change-sandbox-tactic').forEach(btn => {
        btn.addEventListener('click', () => {
          const sIdx = parseInt(btn.getAttribute('data-slot'), 10);
          const tSlot = parseInt(btn.getAttribute('data-tslot'), 10);
          this.openSandboxSelectModal('tactic', sIdx, tSlot);
        });
      });
    }
  }

  // 套用假想敌经典预设国家队
  applySandboxPreset(presetKey) {
    if (!this.state.customEnemyTroop) {
      this.state.customEnemyTroop = { arm: 'spear', heroes: [] };
    }

    if (presetKey === 'shuguo') {
      // 诸葛蜀枪
      this.state.customEnemyTroop.name = '假想敌·天下第一蜀枪';
      this.state.customEnemyTroop.arm = 'spear';
      this.state.customEnemyTroop.heroes = [
        { generalId: 'gen_zhu_ge_liang', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_ba_men_jin_suo', tactic2Id: 'tac_chen_huo_da_jie' },
        { generalId: 'gen_liu_bei', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_yu_di_ping_zhang', tactic2Id: 'tac_zi_yu' },
        { generalId: 'gen_guan_yu', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_suo_xiang_pi_mi', tactic2Id: 'tac_po_zhen_cui_jian' }
      ];
    } else if (presetKey === 'taowei') {
      // 太尉真盾
      this.state.customEnemyTroop.name = '假想敌·山岳太尉坚盾';
      this.state.customEnemyTroop.arm = 'shield';
      this.state.customEnemyTroop.heroes = [
        { generalId: 'gen_si_ma_yi', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_suo_xiang_pi_mi', tactic2Id: 'tac_ba_men_jin_suo' },
        { generalId: 'gen_cao_cao', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_yu_di_ping_zhang', tactic2Id: 'tac_zi_yu' },
        { generalId: 'gen_guo_huai', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_fen_fa', tactic2Id: 'tac_shou_qi_dao_luo' }
      ];
    } else if (presetKey === 'dudu') {
      // 都督神火弓
      this.state.customEnemyTroop.name = '假想敌·东吴都督火弓';
      this.state.customEnemyTroop.arm = 'bow';
      this.state.customEnemyTroop.heroes = [
        { generalId: 'gen_zhou_yu', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_luo_feng', tactic2Id: 'tac_ba_men_jin_suo' },
        { generalId: 'gen_lu_xun', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_chen_huo_da_jie', tactic2Id: 'tac_suo_xiang_pi_mi' },
        { generalId: 'gen_lv_meng', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_yu_di_ping_zhang', tactic2Id: 'tac_zuo_you_kai_gong' }
      ];
    } else if (presetKey === 'lvbu') {
      // 无双三势骑
      this.state.customEnemyTroop.name = '假想敌·无双突进暴骑';
      this.state.customEnemyTroop.arm = 'cavalry';
      this.state.customEnemyTroop.heroes = [
        { generalId: 'gen_lv_bu', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_shou_qi_dao_luo', tactic2Id: 'tac_luo_feng' },
        { generalId: 'gen_guo_jia', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_ba_men_jin_suo', tactic2Id: 'tac_yu_di_ping_zhang' },
        { generalId: 'gen_diao_chan', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_zi_yu', tactic2Id: 'tac_fen_fa' }
      ];
    }

    sound.playDrum();
    this.renderSandbox();
    this.save();
  }

  // 打开沙盒假想敌全图鉴武将或战法选择器 Modal
  openSandboxSelectModal(type, slotIdx, tacticSlot = 1) {
    if (!this.sandboxCustomModal) return;

    if (type === 'general') {
      this.sandboxModalTitle.innerHTML = `🎯 选择假想敌【${slotIdx === 0 ? '主将' : `副将${slotIdx}`}】`;
      
      // 渲染全武将列表
      const generalsHtml = GENERALS_DATA.map(g => {
        const camp = CAMPS[g.camp] || { name: '群', color: '#888' };
        const bTactic = TACTICS_DATA.find(t => t.id === g.builtInTacticId);
        const isCore = CORE_FIVE_STAR_IDS.has(g.id);

        return `
          <div class="general-card-item card-row--split" data-gid="${g.id}" style="background:#151821; border:1px solid ${g.star === 5 ? '#d97706' : '#374151'}; border-radius:8px; padding:10px; cursor:pointer; transition:all 0.2s ease">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:32px;">${g.avatar}</span>
              <div>
                <div style="font-size:14px; font-weight:bold; color:#fff; display:flex; align-items:center; gap:6px;">
                  <span>${g.name}</span>
                  <span style="font-size:10px; background:${camp.color}; padding:1px 5px; border-radius:3px;">${camp.name}</span>
                  <span style="font-size:11px; color:#fbbf24;">${'★'.repeat(g.star)}</span>
                </div>
                <div class="card-note card-note--tight">
                  自带战法: <b class="val-gold">${bTactic?.name || '自带战法'}</b> · 统御: ${g.cost}御
                </div>
              </div>
            </div>
            <button class="upgrade-btn" style="padding:4px 12px; font-size:12px; background:linear-gradient(135deg, #059669 0%, #047857 100%);">选定</button>
          </div>
        `;
      }).join('');

      this.sandboxModalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${generalsHtml}
        </div>
      `;

      this.sandboxModalBody.querySelectorAll('.general-card-item').forEach(card => {
        card.addEventListener('click', () => {
          const gid = card.getAttribute('data-gid');
          if (this.state.customEnemyTroop && this.state.customEnemyTroop.heroes[slotIdx]) {
            this.state.customEnemyTroop.heroes[slotIdx].generalId = gid;
            sound.playDrum();
            this.sandboxCustomModal.style.display = 'none';
            this.renderSandbox();
            this.save();
          }
        });
      });
    } else if (type === 'tactic') {
      const hCfg = this.state.customEnemyTroop.heroes[slotIdx];
      const gen = GENERALS_DATA.find(g => g.id === hCfg?.generalId) || { name: '敌将' };
      this.sandboxModalTitle.innerHTML = `🎯 为【${gen.name}】装配第 ${tacticSlot} 战法`;

      const tacticsHtml = TACTICS_DATA.map(t => {
        const typeMap = { command: { name: '指挥', color: '#60a5fa' }, passive: { name: '被动', color: '#34d399' }, active: { name: '主动', color: '#f59e0b' }, assault: { name: '突击', color: '#f87171' } };
        const dmgBadgeMap = {
          physical: { name: '⚔️ 兵刃', color: '#f87171' },
          tactical: { name: '🔮 谋略', color: '#60a5fa' },
          heal: { name: '🩹 急救', color: '#34d399' },
          buff: { name: '🛡️ 增益', color: '#e879f9' },
          debuff: { name: '⛓️ 控制', color: '#e879f9' }
        };
        const typeMeta = typeMap[t.type] || { name: '战法', color: '#9ca3af' };
        const dmgType = t.damageType || (t.damageRate ? 'physical' : 'buff');
        const dmgMeta = dmgBadgeMap[dmgType] || { name: '辅助', color: '#9ca3af' };

        return `
          <div class="tactic-select-item card-row--split" data-tid="${t.id}" style="background:#151821; border:1px solid #2d3340; border-radius:8px; padding:10px; cursor:pointer; transition:all 0.2s ease">
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:bold; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>${t.name}</span>
                <span style="font-size:10px; background:${typeMeta.color}25; border:1px solid ${typeMeta.color}; color:${typeMeta.color}; padding:1px 5px; border-radius:3px;">${typeMeta.name}</span>
                <span style="font-size:10px; background:${dmgMeta.color}25; border:1px solid ${dmgMeta.color}; color:${dmgMeta.color}; padding:1px 5px; border-radius:3px;">${dmgMeta.name}</span>
                <span class="card-micro">发动率: ${t.rate}%</span>
              </div>
              <div style="font-size:11px; color:#9ca3af; margin-top:3px; line-height:1.4;">
                ${t.desc || ''}
              </div>
            </div>
            <button class="upgrade-btn" style="padding:4px 12px; font-size:12px; background:linear-gradient(135deg, #d97706 0%, #b45309 100%); margin-left:12px;">装配</button>
          </div>
        `;
      }).join('');

      this.sandboxModalBody.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${tacticsHtml}
        </div>
      `;

      this.sandboxModalBody.querySelectorAll('.tactic-select-item').forEach(card => {
        card.addEventListener('click', () => {
          const tid = card.getAttribute('data-tid');
          if (this.state.customEnemyTroop && this.state.customEnemyTroop.heroes[slotIdx]) {
            if (tacticSlot === 1) {
              this.state.customEnemyTroop.heroes[slotIdx].tactic1Id = tid;
            } else {
              this.state.customEnemyTroop.heroes[slotIdx].tactic2Id = tid;
            }
            sound.playDrum();
            this.sandboxCustomModal.style.display = 'none';
            this.renderSandbox();
            this.save();
          }
        });
      });
    }

    this.sandboxCustomModal.style.display = 'flex';
  }

  // 发起假想敌沙盒巅峰演习对决推演
  launchSandboxBattle() {
    const playerTroop = this.state.troops[this.state.currentTroopIndex || 0] || this.state.troops[0];
    if (!playerTroop || (playerTroop.heroes || []).filter(Boolean).length === 0) {
      slgNotice({ title: '出征受阻', body: '您的当前军团尚未配置武将，请先前往【编队】配置出战阵容！', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playDrum();

    const enemyCfg = this.state.customEnemyTroop || {};
    const enemyArm = enemyCfg.arm || 'spear';
    const enemyHeroes = (enemyCfg.heroes || []).map((hCfg, idx) => {
      const gen = GENERALS_DATA.find(g => g.id === hCfg.generalId) || GENERALS_DATA[0];
      return {
        ...gen,
        id: `mock_enemy_${idx}_${Date.now()}`,
        level: 50,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        builtInTacticId: gen.builtInTacticId,
        equippedTactic1: hCfg.tactic1Id,
        equippedTactic2: hCfg.tactic2Id
      };
    });

    const enemyTroop = {
      name: enemyCfg.name || '假想敌军团',
      arm: enemyArm,
      isPlayer: false,
      heroes: enemyHeroes
    };

    // 玩家武将在沙盒演习中以 Lv.50、10,000 兵满状态竞技对决
    const mockPlayerTroop = {
      ...playerTroop,
      isPlayer: true,
      heroes: playerTroop.heroes.map(h => ({
        ...h,
        level: 50,
        tacticLevel: MAX_TACTIC_LEVEL,
        currentSoldiers: 10000,
        maxSoldiers: 10000
      }))
    };

    // 执行 8 回合严谨物理伤害与战法判定推演 (双方战法统一强制满级 Lv.10 竞技)
    const result = simulateBattle(mockPlayerTroop, enemyTroop, {
      playerMorale: 100,
      tacticLevels: new Proxy({}, { get: () => MAX_TACTIC_LEVEL }),
      enemyTacticLevels: new Proxy({}, { get: () => MAX_TACTIC_LEVEL })
    });

    const isWin = (result.summary.winner === 'player');
    if (isWin) {
      sound.playVictoryHorn();
    } else {
      sound.playSwordClash();
    }

    const reportItem = {
      id: `rep_${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      tileName: `🎯 沙盒演习 · 对战【${enemyTroop.name}】`,
      isVictory: isWin,
      summary: result.summary,
      logs: result.logs
    };

    this.state.battleReports.unshift(reportItem);
    if (this.state.battleReports.length > 20) this.state.battleReports.pop();

    this.save();
    this.renderReports();
    this.openBattleDetailModal(reportItem);
  }

  // ================= 2. 军团编制配置与武将上阵 (支持 5 支军团共存) =================
  renderTroops() {
    this.troopsContainer.innerHTML = '';
    const currentIdx = Math.max(0, Math.min(4, this.state.currentTroopIndex || 0));
    this.state.currentTroopIndex = currentIdx;

    // 渲染 5 支军团切换导航
    const troopTabsContainer = document.getElementById('troopTabsContainer');
    if (troopTabsContainer) {
      troopTabsContainer.innerHTML = '';
      this.state.troops.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.className = `troop-tab-btn ${currentIdx === idx ? 'active' : ''}`;
        const heroCount = (t.heroes || []).filter(Boolean).length;
        const armMeta = ARMS[t.arm] || { icon: '🛡️' };
        btn.innerHTML = `
          <span>${armMeta.icon} ${t.name}</span>
          <span style="font-size:11px; opacity:0.8; background:rgba(0,0,0,0.3); padding:1px 5px; border-radius:3px;">${heroCount}/3</span>
        `;
        btn.addEventListener('click', () => {
          this.state.currentTroopIndex = idx;
          sound.playDrum();
          this.renderTroops();
          this.save();
        });
        troopTabsContainer.appendChild(btn);
      });
    }

    const troop = this.state.troops[currentIdx] || this.state.troops[0];
    if (!troop) return;

    const el = document.createElement('div');
    el.style.background = '#181b22';
    el.style.border = '1px solid #374151';
    el.style.borderRadius = '12px';
    el.style.padding = '20px';

    // 兵种切换按钮
    const armsHtml = Object.keys(ARMS).map(armKey => `
      <button class="nav-tab-btn arm-btn ${troop.arm === armKey ? 'active' : ''}" data-arm="${armKey}" style="padding:6px 12px; border:1px solid #374151; font-size:13px;">
        ${ARMS[armKey].icon} ${ARMS[armKey].name}
      </button>
    `).join('');

    // 阵营羁绊检查
    const camps = troop.heroes.map(h => h.camp);
    const isCampBonus = (camps.length === 3 && camps.every(c => c === camps[0]));
    const campBonusHtml = isCampBonus 
      ? `<span style="color:#10b981; font-weight:bold; font-size:12px; background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:2px 8px; border-radius:4px;">🏰 激活【${CAMPS[camps[0]].name}国家队】阵营加成！全员核心属性提升 10%！</span>`
      : `<span style="color:#9ca3af; font-size:12px;">提示：上阵 3 位同阵营武将可激活 10% 全属性国家队加成</span>`;

    // 🌟 武将缘分羁绊检查 (桃园结义、五虎上将、西蜀之智、乱世三仙等)
    const heroNames = troop.heroes.map(h => h.name);
    const activeBonds = checkActiveBonds(heroNames);
    const bondsHtml = activeBonds.length > 0 ? activeBonds.map(b => `
      <div style="color:#fde047; font-weight:bold; font-size:12px; background:linear-gradient(135deg, rgba(217,119,6,0.2) 0%, rgba(180,83,9,0.1) 100%); border:1px solid #d97706; padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 0 8px rgba(217,119,6,0.3);">
        <span>✨ 激活天命缘分【${b.name}】</span>
        <span style="font-size:11px; color:#d1d5db; font-weight:normal;">(${b.desc})</span>
      </div>
    `).join('') : '';

    // 3位武将槽位
    const heroesHtml = [0, 1, 2].map(slotIdx => {
      const rawHero = troop.heroes[slotIdx];
      const hero = rawHero ? (this.state.ownedGenerals.find(g => g.id === rawHero.id) || rawHero) : null;
      if (hero) {
        troop.heroes[slotIdx] = hero;
        const apt = hero.aptitude[troop.arm] || 'C';
        const aptMod = GENERAL_APTITUDE_MODIFIERS[apt] || 1.0;
        const hLvl = hero.level || 1;
        const hExp = hero.exp || 0;
        const reqExp = getExpRequiredForLevel(hLvl);
        const expPct = reqExp > 0 ? Math.min(100, Math.round((hExp / reqExp) * 100)) : 100;
        const redStars = hero.redStars || 0;
        const maxRedStars = hero.star || 5;
        const isFullRed = redStars >= maxRedStars;

        let starsHtml = '';
        for (let s = 1; s <= (hero.star || 5); s++) {
          starsHtml += (s <= redStars) ? `<span class="star-red">★</span>` : `<span class="star-gold">★</span>`;
        }
        const redBadgeHtml = isFullRed
          ? `<span style="font-size:10px; background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color:#fde047; border:1px solid #fbbf24; padding:0 5px; border-radius:3px; font-weight:bold;">👑满红</span>`
          : (redStars > 0
            ? `<span style="font-size:10px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid #ef4444; padding:0 5px; border-radius:3px; font-weight:bold;">${redStars}红</span>`
            : `<span style="font-size:10px; background:rgba(107,114,128,0.25); color:#9ca3af; border:1px solid #4b5563; padding:0 4px; border-radius:3px;">白板</span>`);

        const builtInTac = TACTICS_MAP.get(hero.builtInTacticId);
        const builtInLvl = hero.builtInTacticLevel || this.state.tacticLevels?.[hero.builtInTacticId] || 1;

        return `
          <div class="troop-hero-card clickable" style="background:#11141a; border:1px solid ${isFullRed ? '#ef4444' : (hero.star===5?'#d97706':'#374151')}; ${isFullRed ? 'box-shadow:0 0 12px rgba(239,68,68,0.3);' : ''} border-radius:10px; padding:14px; width:220px; display:flex; flex-direction:column; align-items:center; position:relative;">
            <div style="font-size:12px; color:#fbbf24; font-weight:bold; margin-bottom:4px;">${slotIdx===0?'★ 主将位 (核心) ★':`副将位 ${slotIdx}`}</div>
            
            <!-- 可点击查看详情的武将核心主体 -->
            <div class="hero-click-area" data-slot="${slotIdx}" title="点击查看【${hero.name}】军略全息详情与升级自带战法" style="display:flex; flex-direction:column; align-items:center; width:100%;">
              <div style="width:58px; height:58px; margin-bottom:4px;">
                ${getGeneralAvatarHtml(hero, { size: 58, borderRadius: '10px', fontSize: '38px' })}
              </div>
              <div style="font-size:15px; font-weight:bold; margin-top:2px; color:#fff; display:flex; align-items:center; gap:5px; flex-wrap:wrap; justify-content:center;">
                <span>${hero.name}</span>
                <span class="hero-level-badge">Lv.${hLvl}</span>
                ${redBadgeHtml}
              </div>
              <div style="font-size:12px; letter-spacing:1px; margin:2px 0;">${starsHtml}</div>
              
              <!-- 经验条 -->
              <div style="width:100%; margin:2px 0;">
                <div class="card-row--split" style="font-size:10px; color:#9ca3af">
                  <span>历练经验</span>
                  <span>${hLvl>=MAX_GENERAL_LEVEL?'已达满级':`${hExp}/${reqExp}`}</span>
                </div>
                <div class="hero-exp-track" style="margin-top:2px;">
                  <div class="hero-exp-progress" style="width:${expPct}%;"></div>
                </div>
              </div>

              <div style="font-size:11px; color:#9ca3af; margin:2px 0;">${CAMPS[hero.camp].name} · ${ARMS[troop.arm]?.name || troop.arm}适性:<b class="apt-tag ${apt}">${apt} (${Math.round(aptMod*100)}%)</b></div>
              <div style="font-size:11px; color:#fde047; margin:2px 0;">[自带] ${builtInTac ? builtInTac.name : '军略'} <span style="color:#6ee7b7; background:rgba(5,150,105,0.2); border:1px solid #059669; padding:0 4px; border-radius:3px; font-size:10px;">Lv.${builtInLvl}</span></div>
              <div style="font-size:12px; color:#34d399; margin:2px 0;">带兵量: <b>${(hero.maxSoldiers || 3000).toLocaleString()}</b></div>
              <div style="font-size:10px; color:#38bdf8; margin-top:1px;">🔍 点击升级战法 / 查看全息属性</div>
            </div>

            <!-- 操作按钮组 -->
            <div style="display:flex; gap:6px; width:100%; margin-top:8px;">
              <button class="upgrade-btn btn-view-hero-detail" data-slot="${slotIdx}" style="padding:4px 6px; font-size:11px; flex:1; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">🔍 详情</button>
              <button class="upgrade-btn btn-change-hero" data-slot="${slotIdx}" style="padding:4px 6px; font-size:11px; flex:1;">更换</button>
              <button class="upgrade-btn btn-remove-hero" data-slot="${slotIdx}" style="padding:4px 6px; font-size:11px; background:#4b5563; flex:1;">下阵</button>
            </div>
          </div>
        `;
      } else {
        return `
          <div style="background:#11141a; border:2px dashed #4b5563; border-radius:10px; padding:16px; width:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:220px;">
            <div style="color:#6b7280; font-size:13px; margin-bottom:12px;">${slotIdx===0?'【主将虚位以待】':`【副将位 ${slotIdx} 空置】`}</div>
            <button class="upgrade-btn btn-add-hero" data-slot="${slotIdx}" style="padding:6px 14px; font-size:13px;">+ 选拔名将上阵</button>
          </div>
        `;
      }
    }).join('');

    el.innerHTML = `
      <div class="card-row--split card-row--wrap" style="margin-bottom:14px; flex-wrap:wrap; gap:10px">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span style="font-size:17px; font-weight:bold; color:#fbbf24;">${troop.name}</span>
          ${campBonusHtml}
        </div>
        <div style="display:flex; gap:6px;">${armsHtml}</div>
      </div>
      ${bondsHtml ? `<div style="margin-bottom:14px; display:flex; flex-direction:column; gap:6px;">${bondsHtml}</div>` : ''}
      <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">
        ${heroesHtml}
      </div>
    `;

    // 绑定兵种切换
    el.querySelectorAll('.arm-btn').forEach(b => {
      b.addEventListener('click', () => {
        troop.arm = b.getAttribute('data-arm');
        sound.playDrum();
        this.renderTroops();
        this.save();
      });
    });

    // 绑定点击查看武将详情 (卡片主体与详情按钮)
    el.querySelectorAll('.hero-click-area, .btn-view-hero-detail').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const sIdx = parseInt(b.getAttribute('data-slot'));
        const hero = troop.heroes[sIdx];
        if (hero) {
          sound.playDrum();
          this.openHeroDetailModal(hero);
        }
      });
    });

    // 卸下武将
    el.querySelectorAll('.btn-remove-hero').forEach(b => {
      b.addEventListener('click', () => {
        const sIdx = parseInt(b.getAttribute('data-slot'));
        troop.heroes.splice(sIdx, 1);
        sound.playDrum();
        this.renderTroops();
        this.save();
      });
    });

    // 上阵与更换武将
    el.querySelectorAll('.btn-add-hero, .btn-change-hero').forEach(b => {
      b.addEventListener('click', () => {
        const sIdx = parseInt(b.getAttribute('data-slot'));
        this.openAssignHeroModal(troop, sIdx);
      });
    });

    this.troopsContainer.appendChild(el);
  }

  // 武将全息详情弹窗 (战法配装、五维属性与成长、兵种适性)
  openHeroDetailModal(hero) {
    // 确保从 ownedGenerals 获取最新引用
    const realHero = this.state.ownedGenerals.find(g => g.id === hero.id) || hero;
    const campInfo = CAMPS[realHero.camp] || CAMPS.qun;
    const builtInTac = TACTICS_MAP.get(realHero.builtInTacticId);
    const tac1 = TACTICS_MAP.get(realHero.equippedTactic1);
    const tac2 = TACTICS_MAP.get(realHero.equippedTactic2);
    const inheritTacId = getHeroInheritTacticId(realHero);
    const inheritTac = TACTICS_MAP.get(inheritTacId);
    const isInherited = this.state.ownedTactics.includes(inheritTacId);
    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));
    const isInTroop = currentTroopHeroIds.has(realHero.id);
    const isOwned = (this.state.ownedGenerals || []).some(g => g.id === realHero.id || (g.name === realHero.name && g.star === realHero.star));

    const hLvl = realHero.level || 1;
    const hExp = realHero.exp || 0;
    const reqExp = getExpRequiredForLevel(hLvl);
    const expPct = reqExp > 0 ? Math.min(100, Math.round((hExp / reqExp) * 100)) : 100;
    const redStars = realHero.redStars || 0;
    const maxRedStars = realHero.star || 5;
    const isFullRed = (redStars >= maxRedStars);

    // 星级渲染 (4星限4红、5星限5红，原版纯净星标)
    let starsHtml = '';
    for (let s = 1; s <= realHero.star; s++) {
      starsHtml += (s <= redStars) ? `<span class="star-red">★</span>` : `<span class="star-gold">★</span>`;
    }

    // 模态弹窗构建
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:880px; width:95%; max-height:88vh;">
        <div class="modal-header">
          <div class="modal-title"><span class="title-emoji">🎴 </span>🎴</div>
          <button class="modal-close-btn" id="btnHeroDetailClose">✕</button>
        </div>
        <div class="modal-body" style="padding:16px; overflow-y:auto;">
          <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">

            <!-- 左侧：名将全息战卡 (300px 大画幅沉浸卡面) -->
            <div style="width:300px; flex-shrink:0; background:linear-gradient(180deg, #181d26 0%, #0d1016 100%); border:1px solid #374151; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px; box-shadow:0 8px 24px rgba(0,0,0,0.6);">
              
              <!-- 纵向高清大画幅立绘卡面 (高 380px，悬浮国标与名牌) -->
              <div style="width:100%; height:380px; position:relative; border-radius:8px; overflow:hidden; border:1px solid #475569; background:#0b0f19; box-shadow:inset 0 0 20px rgba(0,0,0,0.8);">
                <!-- 完整大画幅立绘主体 -->
                ${getGeneralAvatarHtml(realHero, { borderRadius: '6px', fontSize: '80px', style: 'width:100%; height:100%;' })}
                
                <!-- 顶部悬浮：阵营与统御、等级 -->
                <div class="card-row--split" style="position:absolute; top:8px; left:8px; right:8px; z-index:2; pointer-events:none">
                  <span class="camp-tag" style="background:${campInfo.color}; font-size:12px; padding:2px 8px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.6);">${campInfo.badge}国</span>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="cost-badge" style="font-size:11px; padding:2px 6px; background:rgba(0,0,0,0.6); border:1px solid rgba(251,191,36,0.4); border-radius:4px; backdrop-filter:blur(2px);">统御 ${realHero.cost}</span>
                    <span class="hero-level-badge" style="font-size:11px; padding:2px 6px; background:rgba(0,0,0,0.6); border:1px solid rgba(251,191,36,0.4); border-radius:4px; backdrop-filter:blur(2px);">Lv.${hLvl}</span>
                  </div>
                </div>

                <!-- 底部悬浮：姓名、称号与星级磨砂名牌 -->
                <div style="position:absolute; bottom:0; left:0; right:0; padding:22px 10px 10px 10px; background:linear-gradient(to top, rgba(13,16,22,0.95) 0%, rgba(13,16,22,0.7) 60%, transparent 100%); z-index:2; text-align:center; pointer-events:none;">
                  <div style="font-size:22px; font-weight:900; color:#fff; letter-spacing:1px; text-shadow:0 2px 6px rgba(0,0,0,0.9);">${realHero.name}</div>
                  <div style="margin:3px 0;">${starsHtml}</div>
                  <div style="font-size:11px; color:#cbd5e1; text-shadow:0 1px 3px rgba(0,0,0,0.8);">${realHero.title || '三国名宿'}</div>
                </div>
              </div>

              <!-- 带兵上限与历练进度 -->
              <div style="background:rgba(0,0,0,0.4); border:1px solid #2d3340; border-radius:6px; padding:8px 10px;">
                <div class="card-row--split" style="font-size:11px">
                  <span class="val-muted">带兵上限</span>
                  <span style="font-size:15px; font-weight:bold; color:#34d399;">${(realHero.maxSoldiers || 3000).toLocaleString()}</span>
                </div>
                <div style="margin-top:6px;">
                  <div class="card-row--split" style="font-size:10px; margin-bottom:3px">
                    <span style="color:#fbbf24;">⚔️ 历练经验</span>
                    <span class="val-muted">${hLvl>=MAX_GENERAL_LEVEL?'Lv.50 (满级)':`${hExp}/${reqExp} (${expPct}%)`}</span>
                  </div>
                  <div class="hero-exp-track" style="height:5px;">
                    <div class="hero-exp-progress" style="width:${expPct}%;"></div>
                  </div>
                </div>
              </div>

              <!-- 快捷军务管理（传承与转化 / 未招募预览提示） -->
              ${!isOwned ? `
                <div style="text-align:center; font-size:11px; color:#fbbf24; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:4px; padding:6px 0; margin-top:2px;">
                  🔍 卡池图鉴预览 · 招募后可出征与配装
                </div>
              ` : (() => {
                const convertCardCount = 1 + (realHero.redStars || 0);
                const convertCopper = (realHero.star >= 5 ? 5000 : (realHero.star === 4 ? 1000 : 300)) * convertCardCount;
                const convertLabel = convertCopper >= 1000 ? `${convertCopper / 1000}千` : `${convertCopper}`;
                return `
                  <div style="display:flex; gap:6px; margin-top:2px;">
                    ${isInherited ? `
                      <div style="flex:1; text-align:center; font-size:11px; color:#10b981; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:5px 0;">
                        ✔ 战法已传承
                      </div>
                    ` : `
                      <button class="upgrade-btn btn-modal-inherit" style="flex:1; padding:5px 0; font-size:11px; background:linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);" ${isInTroop ? 'disabled title="已在出征阵容中，不可传承"' : ''}>
                        📖 传承战法
                      </button>
                    `}
                    <button class="upgrade-btn btn-modal-sell" style="padding:5px 12px; font-size:11px; background:${isInTroop ? '#374151' : (realHero.star >= 5 ? 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' : '#4b5563')};" ${isInTroop ? 'disabled title="正在出征阵容中，不可转化"' : `title="消耗该武将卡转化为 ${convertCopper.toLocaleString()} 铜币（用于战法研习）"`}>
                      ${isInTroop ? '出征中' : `🪙 转化(${convertLabel})`}
                    </button>
                  </div>
                `;
              })()}

            </div>

            <!-- 右侧：军略属性与战法面板 -->
            <div style="flex:1; min-width:320px; display:flex; flex-direction:column; gap:10px;">
              
              <!-- 四维核心战斗属性与成长率 -->
              ${(() => {
                const redBonus = redStars * 5;
                const curForce = Math.round(realHero.force + (realHero.forceGrowth || 1.0) * (hLvl - 1));
                const curIntel = Math.round(realHero.intel + (realHero.intelGrowth || 1.0) * (hLvl - 1));
                const curCommand = Math.round(realHero.command + (realHero.commandGrowth || 1.0) * (hLvl - 1));
                const curSpeed = Math.round(realHero.speed + (realHero.speedGrowth || 1.0) * (hLvl - 1));
                const redInlineTag = redBonus > 0
                  ? ` <span style="font-size:11px; color:#f87171; font-weight:bold;">(红+${redBonus})</span>`
                  : '';
                const redHeaderBadge = redBonus > 0
                  ? `<span style="font-size:11px; background:${isFullRed ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'rgba(239,68,68,0.2)'}; color:${isFullRed ? '#fde047' : '#fca5a5'}; border:1px solid ${isFullRed ? '#fbbf24' : '#ef4444'}; padding:1px 7px; border-radius:4px; font-weight:bold;">${isFullRed ? `👑 满红(${redStars}红)` : `🔥 进阶${redStars}红`} · 全属性 +${redBonus}</span>`
                  : `<span class="card-micro">白板(0红) · 进阶每红全属性 +5</span>`;

                return `
                  <div class="hero-detail-section">
                    <div class="hero-detail-title card-row--split card-row--wrap" style="gap:6px;">
                      <span>📊 四维实战属性与成长 <span class="card-micro">(Lv.${hLvl})</span></span>
                      ${redHeaderBadge}
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                      <div class="card-row--split" style="background:rgba(0,0,0,0.35); padding:7px 10px; border-radius:6px; border:1px solid #2d3340">
                        <span>🗡️ 武力: <b style="color:#fde047; font-size:15px;">${curForce}</b>${redInlineTag}</span>
                        <span class="hero-growth-tag" style="color:#fbbf24;">(+${realHero.forceGrowth || 1.0}/级)</span>
                      </div>
                      <div class="card-row--split" style="background:rgba(0,0,0,0.35); padding:7px 10px; border-radius:6px; border:1px solid #2d3340">
                        <span>🧠 智力: <b style="color:#60a5fa; font-size:15px;">${curIntel}</b>${redInlineTag}</span>
                        <span class="hero-growth-tag" style="color:#93c5fd;">(+${realHero.intelGrowth || 1.0}/级)</span>
                      </div>
                      <div class="card-row--split" style="background:rgba(0,0,0,0.35); padding:7px 10px; border-radius:6px; border:1px solid #2d3340">
                        <span>🛡️ 统率: <b style="color:#34d399; font-size:15px;">${curCommand}</b>${redInlineTag}</span>
                        <span class="hero-growth-tag val-copper">(+${realHero.commandGrowth || 1.0}/级)</span>
                      </div>
                      <div class="card-row--split" style="background:rgba(0,0,0,0.35); padding:7px 10px; border-radius:6px; border:1px solid #2d3340">
                        <span>⚡ 速度: <b style="color:#f472b6; font-size:15px;">${curSpeed}</b>${redInlineTag}</span>
                        <span class="hero-growth-tag" style="color:#f9a8d4;">(+${realHero.speedGrowth || 1.0}/级)</span>
                      </div>
                    </div>
                    <div class="card-note card-note--tight" style="margin-top:6px;">
                      ${redBonus > 0
                        ? `💡 相比同级白板（Lv.1 初始 武${realHero.force - redBonus} / 智${realHero.intel - redBonus} / 统${realHero.command - redBonus} / 速${realHero.speed - redBonus}），${redStars}红进阶已永久提升四维各 <b class="val-danger">+${redBonus}</b> 点`
                        : `💡 当前为白板属性（Lv.1 初始 武${realHero.force} / 智${realHero.intel} / 统${realHero.command} / 速${realHero.speed}），消耗同名卡每进阶 1 红四维各 <b class="val-gold">+5</b> 点`}
                    </div>
                  </div>
                `;
              })()}

              <!-- 五大兵种适性面板 -->
              <div class="hero-detail-section">
                <div class="hero-detail-title">🛡️ 兵种统领适性</div>
                <div class="apt-row card-row--split card-row--wrap" style="padding:6px 10px; font-size:12px; flex-wrap:wrap; gap:6px">
                  <span>骑兵 <b class="apt-tag ${realHero.aptitude.cavalry}">${realHero.aptitude.cavalry}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.cavalry]||1)*100)}%)</span>
                  <span>盾兵 <b class="apt-tag ${realHero.aptitude.shield}">${realHero.aptitude.shield}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.shield]||1)*100)}%)</span>
                  <span>弓兵 <b class="apt-tag ${realHero.aptitude.bow}">${realHero.aptitude.bow}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.bow]||1)*100)}%)</span>
                  <span>枪兵 <b class="apt-tag ${realHero.aptitude.spear}">${realHero.aptitude.spear}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.spear]||1)*100)}%)</span>
                  <span>器械 <b class="apt-tag ${realHero.aptitude.siege || 'B'}">${realHero.aptitude.siege || 'B'}</b></span>
                </div>
                <div class="card-note card-note--tight">适性加成说明：S级 120% 全属性 · A级 100% · B级 85% · C级 70%</div>
              </div>

              <!-- 三大战法配置槽位 -->
              <div class="hero-detail-section">
                <div class="hero-detail-title">📚 战法装配与研习</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  
                  <!-- 自带战法（支持 Lv.1 ~ Lv.10 研习升级与一键满级） -->
                  ${(() => {
                    const qBuiltIn = (realHero.star === 3) ? 'B' : (builtInTac?.quality || (realHero.star === 5 ? 'S' : 'A'));
                    const isS = qBuiltIn === 'S';
                    const isA = qBuiltIn === 'A';
                    const color = isS ? '#fbbf24' : (isA ? '#c084fc' : '#60a5fa');
                    const borderColor = isS ? 'rgba(217,119,6,0.5)' : (isA ? 'rgba(147,51,234,0.5)' : 'rgba(59,130,246,0.5)');
                    const bgBadge = isS ? 'rgba(217,119,6,0.2)' : (isA ? 'rgba(147,51,234,0.2)' : 'rgba(59,130,246,0.2)');
                    const borderBadge = isS ? '#d97706' : (isA ? '#9333ea' : '#2563eb');
                    const qualityBadgeText = isS ? '🌟 S级' : (isA ? '💜 A级' : '🔷 B级');
                    const typeZh = { command: '指挥', passive: '被动', active: '主动', assault: '突击' }[builtInTac?.type] || '战法';

                    const builtInLvl = Math.max(1, Math.min(MAX_TACTIC_LEVEL, realHero.builtInTacticLevel || this.state.tacticLevels?.[realHero.builtInTacticId] || 1));
                    const isBuiltInMax = (builtInLvl >= MAX_TACTIC_LEVEL);
                    const nextBuiltInCost = isBuiltInMax ? 0 : (TACTIC_UPGRADE_COSTS[builtInLvl] || 26000);
                    let maxRemainingCost = 0;
                    for (let lv = builtInLvl; lv < MAX_TACTIC_LEVEL; lv++) {
                      maxRemainingCost += (TACTIC_UPGRADE_COSTS[lv] || 26000);
                    }
                    const currentCopper = this.state.resources?.copper || 0;
                    const canAffordNext = currentCopper >= nextBuiltInCost;
                    const canAffordMax = currentCopper >= maxRemainingCost;

                    // 计算当前等级与下一级属性成长预览
                    let builtInCompareHtml = '';
                    if (builtInTac) {
                      const curP = getTacticEffectiveProps(builtInTac, builtInLvl);
                      const nxtP = isBuiltInMax ? null : getTacticEffectiveProps(builtInTac, builtInLvl + 1);
                      const parts = [];
                      if (builtInTac.rate && builtInTac.rate < 100) {
                        parts.push(`<span>发动率: <b style="color:#f472b6;">${curP.rate}%</b>${isBuiltInMax ? '' : ` <span class="val-ok">➜ ${nxtP.rate}%</span>`}</span>`);
                      }
                      if (builtInTac.damageRate) {
                        parts.push(`<span>伤害率: <b class="val-gold">${Math.round(curP.damageRate * 100)}%</b>${isBuiltInMax ? '' : ` <span class="val-ok">➜ ${Math.round(nxtP.damageRate * 100)}%</span>`}</span>`);
                      }
                      if (builtInTac.healRate || builtInTac.emergencyHealRate) {
                        const curHeal = curP.healRate || curP.emergencyHealRate;
                        const nxtHeal = nxtP ? (nxtP.healRate || nxtP.emergencyHealRate) : 0;
                        parts.push(`<span>治疗率: <b class="val-copper">${Math.round(curHeal * 100)}%</b>${isBuiltInMax ? '' : ` <span class="val-ok">➜ ${Math.round(nxtHeal * 100)}%</span>`}</span>`);
                      }
                      if (builtInTac.statBoost || builtInTac.statBoostForce || builtInTac.statBoostCmd) {
                        const curStat = curP.statBoost || curP.statBoostForce || curP.statBoostCmd;
                        const nxtStat = nxtP ? (nxtP.statBoost || nxtP.statBoostForce || nxtP.statBoostCmd) : 0;
                        parts.push(`<span>属性加成: <b style="color:#38bdf8;">+${curStat}</b>${isBuiltInMax ? '' : ` <span class="val-ok">➜ +${nxtStat}</span>`}</span>`);
                      }
                      if (builtInTac.teamDamageBonus || builtInTac.selfDamageReduction || builtInTac.shareDamageRate) {
                        const curBonus = curP.teamDamageBonus || curP.selfDamageReduction || curP.shareDamageRate;
                        const nxtBonus = nxtP ? (nxtP.teamDamageBonus || nxtP.selfDamageReduction || nxtP.shareDamageRate) : 0;
                        parts.push(`<span>核心增益: <b style="color:#fb923c;">${Math.round(curBonus * 100)}%</b>${isBuiltInMax ? '' : ` <span class="val-ok">➜ ${Math.round(nxtBonus * 100)}%</span>`}</span>`);
                      }
                      if (parts.length === 0) {
                        parts.push(`<span>战法效能倍率: <b style="color:#38bdf8;">${Math.round(curP.scale * 100)}%</b>${isBuiltInMax ? ' (已满额)' : ` <span class="val-ok">➜ ${Math.round(nxtP.scale * 100)}%</span>`}</span>`);
                      }
                      builtInCompareHtml = parts.join('<span style="color:#4b5563; margin:0 6px;">|</span>');
                    }

                    return `
                      <div style="background:rgba(0,0,0,0.3); border:1px solid ${borderColor}; padding:8px 12px; border-radius:6px;">
                        <div class="card-row--split card-row--wrap" style="gap:8px; flex-wrap:wrap">
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="color:${color}; font-weight:bold; font-size:12px;">[自带战法] ${builtInTac ? builtInTac.name : '军略'}</span>
                            <span style="font-size:10px; color:${color}; background:${bgBadge}; border:1px solid ${borderBadge}; padding:1px 6px; border-radius:3px;">
                              ${qualityBadgeText} · ${typeZh}
                            </span>
                            <span style="font-size:10px; color:${isBuiltInMax ? '#fde047' : '#6ee7b7'}; background:${isBuiltInMax ? 'rgba(217,119,6,0.25)' : 'rgba(5,150,105,0.2)'}; border:1px solid ${isBuiltInMax ? '#f59e0b' : '#059669'}; padding:0 5px; border-radius:3px; font-weight:bold;">
                              ${isBuiltInMax ? '👑 Lv.10 MAX' : `Lv.${builtInLvl} / ${MAX_TACTIC_LEVEL}`}
                            </span>
                          </div>
                          ${isOwned ? (isBuiltInMax ? `
                            <span style="font-size:10px; color:#fbbf24; font-weight:bold;">✔ 自带战法已臻满级</span>
                          ` : `
                            <div style="display:flex; gap:5px; align-items:center; flex-shrink:0;">
                              <button class="upgrade-btn btn-modal-upgrade-builtin" style="padding:3px 8px; font-size:11px; background:${canAffordNext ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#4b5563'};" title="消耗 ${nextBuiltInCost.toLocaleString()} 铜币升级自带战法">
                                🪙 升至Lv.${builtInLvl + 1} (${nextBuiltInCost >= 1000 ? (nextBuiltInCost / 1000) + 'k' : nextBuiltInCost})
                              </button>
                              ${builtInLvl < MAX_TACTIC_LEVEL - 1 ? `
                                <button class="upgrade-btn btn-modal-max-builtin" style="padding:3px 8px; font-size:11px; background:${canAffordMax ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : '#4b5563'};" title="共需 ${maxRemainingCost.toLocaleString()} 铜币直接升至 Lv.10 满级">
                                  ⚡ 一键满级
                                </button>
                              ` : ''}
                            </div>
                          `) : ''}
                        </div>
                        <div style="font-size:11px; color:#cbd5e1; margin-top:4px; line-height:1.4;">${builtInTac ? builtInTac.desc : '名将核心自带军略'}</div>
                        ${builtInCompareHtml ? `
                          <div style="font-size:11px; color:#9ca3af; margin-top:5px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.08); display:flex; flex-wrap:wrap; align-items:center;">
                            ${builtInCompareHtml}
                          </div>
                        ` : ''}
                      </div>
                    `;
                  })()}

                  <!-- 战法槽位 1 -->
                  ${(() => {
                    const q1 = tac1?.quality || 'A';
                    const isS1 = q1 === 'S';
                    const color1 = isS1 ? '#fbbf24' : '#c084fc';
                    const typeZh1 = { command: '指挥', passive: '被动', active: '主动', assault: '突击' }[tac1?.type] || '战法';
                    const borderColor1 = tac1 ? (isS1 ? 'rgba(217,119,6,0.45)' : 'rgba(147,51,234,0.45)') : '#374151';
                    return `
                      <div class="card-row--split" style="background:rgba(0,0,0,0.3); border:1px solid ${borderColor1}; padding:8px 12px; border-radius:6px; gap:8px">
                        <div style="flex:1; min-width:0;">
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="color:#fbbf24; font-weight:bold; font-size:12px; flex-shrink:0;">[传承战法①]</span>
                            ${tac1 ? `
                              <span style="color:${color1}; font-size:13px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tac1.name}</span>
                              <span style="font-size:10px; color:${color1}; background:${isS1 ? 'rgba(251,191,36,0.15)' : 'rgba(192,132,252,0.15)'}; border:1px solid ${isS1 ? '#d97706' : '#9333ea'}; padding:0 4px; border-radius:3px;">
                                ${isS1 ? '🌟 S级' : '💜 A级'} · ${typeZh1}
                              </span>
                              <span style="font-size:10px; color:#6ee7b7; background:rgba(5,150,105,0.2); border:1px solid #059669; padding:0 4px; border-radius:3px; flex-shrink:0;">Lv.${this.state.tacticLevels?.[tac1.id] || 1}</span>
                            ` : `
                              <span style="color:#9ca3af; font-size:12px;">未装配</span>
                            `}
                          </div>
                          <div style="font-size:11px; color:#9ca3af; margin-top:2px; line-height:1.3;">${tac1 ? (tac1.desc.length > 38 ? tac1.desc.substring(0, 38) + '...' : tac1.desc) : '点击右侧按钮装配传承战法'}</div>
                        </div>
                        ${isOwned ? `
                          <button class="upgrade-btn btn-modal-change-tac1" style="padding:4px 10px; font-size:11px; white-space:nowrap; flex-shrink:0;">换配</button>
                        ` : `
                          <span style="font-size:10px; color:#6b7280; padding:2px 6px;">招募后解锁</span>
                        `}
                      </div>
                    `;
                  })()}

                  <!-- 战法槽位 2 -->
                  ${(() => {
                    const q2 = tac2?.quality || 'A';
                    const isS2 = q2 === 'S';
                    const color2 = isS2 ? '#fbbf24' : '#c084fc';
                    const typeZh2 = { command: '指挥', passive: '被动', active: '主动', assault: '突击' }[tac2?.type] || '战法';
                    const borderColor2 = tac2 ? (isS2 ? 'rgba(217,119,6,0.45)' : 'rgba(147,51,234,0.45)') : '#374151';
                    return `
                      <div class="card-row--split" style="background:rgba(0,0,0,0.3); border:1px solid ${borderColor2}; padding:8px 12px; border-radius:6px; gap:8px">
                        <div style="flex:1; min-width:0;">
                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <span style="color:#fbbf24; font-weight:bold; font-size:12px; flex-shrink:0;">[传承战法②]</span>
                            ${tac2 ? `
                              <span style="color:${color2}; font-size:13px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tac2.name}</span>
                              <span style="font-size:10px; color:${color2}; background:${isS2 ? 'rgba(251,191,36,0.15)' : 'rgba(192,132,252,0.15)'}; border:1px solid ${isS2 ? '#d97706' : '#9333ea'}; padding:0 4px; border-radius:3px;">
                                ${isS2 ? '🌟 S级' : '💜 A级'} · ${typeZh2}
                              </span>
                              <span style="font-size:10px; color:#6ee7b7; background:rgba(5,150,105,0.2); border:1px solid #059669; padding:0 4px; border-radius:3px; flex-shrink:0;">Lv.${this.state.tacticLevels?.[tac2.id] || 1}</span>
                            ` : `
                              <span style="color:#9ca3af; font-size:12px;">未装配</span>
                            `}
                          </div>
                          <div style="font-size:11px; color:#9ca3af; margin-top:2px; line-height:1.3;">${tac2 ? (tac2.desc.length > 38 ? tac2.desc.substring(0, 38) + '...' : tac2.desc) : '点击右侧按钮装配第二战法'}</div>
                        </div>
                        ${isOwned ? `
                          <button class="upgrade-btn btn-modal-change-tac2" style="padding:4px 10px; font-size:11px; white-space:nowrap; flex-shrink:0;">换配</button>
                        ` : `
                          <span style="font-size:10px; color:#6b7280; padding:2px 6px;">招募后解锁</span>
                        `}
                      </div>
                    `;
                  })()}
                </div>
              </div>

              <!-- 武将天命缘分羁绊展示 -->
              ${(() => {
                const heroBonds = getBondsForHero(realHero.name);
                if (heroBonds.length === 0) return '';
                const bondsListHtml = heroBonds.map(b => `
                  <div style="background:rgba(217,119,6,0.1); border:1px solid rgba(217,119,6,0.3); border-radius:6px; padding:6px 10px; margin-top:4px;">
                    <div class="card-row--split">
                      <span style="color:#fde047; font-weight:bold; font-size:12px;">✨【${b.name}】</span>
                      <span style="font-size:10px; color:#cbd5e1;">缘分同僚: ${b.heroNames.join('、')}</span>
                    </div>
                    <div style="font-size:11px; color:#d1d5db; margin-top:2px; line-height:1.4;">${b.desc}</div>
                  </div>
                `).join('');
                return `
                  <div class="hero-detail-section">
                    <div class="hero-detail-title">👑 天命武将缘分</div>
                    ${bondsListHtml}
                  </div>
                `;
              })()}

              <!-- 生平列传 -->
              ${realHero.bio ? `
                <div class="hero-detail-section" style="font-size:11px; color:#9ca3af; line-height:1.5;">
                  <span style="color:#fbbf24; font-weight:bold;">📜 将领列传：</span>${realHero.bio}
                </div>
              ` : ''}

            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btnHeroDetailClose').addEventListener('click', () => modal.remove());

    // 绑定自带战法单级强化
    modal.querySelector('.btn-modal-upgrade-builtin')?.addEventListener('click', () => {
      if (this.upgradeHeroBuiltInTactic(realHero, false)) {
        modal.remove();
        this.openHeroDetailModal(realHero);
      }
    });

    // 绑定自带战法一键满级
    modal.querySelector('.btn-modal-max-builtin')?.addEventListener('click', () => {
      if (this.upgradeHeroBuiltInTactic(realHero, true)) {
        modal.remove();
        this.openHeroDetailModal(realHero);
      }
    });

    // 绑定槽位1换配
    modal.querySelector('.btn-modal-change-tac1')?.addEventListener('click', () => {
      modal.remove();
      this.openEquipTacticModal(realHero, 1);
    });

    // 绑定槽位2换配
    modal.querySelector('.btn-modal-change-tac2')?.addEventListener('click', () => {
      modal.remove();
      this.openEquipTacticModal(realHero, 2);
    });

    // 绑定模态框中的传承
    const btnModalInherit = modal.querySelector('.btn-modal-inherit');
    if (btnModalInherit && !isInTroop) {
      btnModalInherit.addEventListener('click', () => {
        modal.remove();
        this.inheritTacticFromHero(realHero);
      });
    }

    // 绑定模态框中的解甲
    const btnModalSell = modal.querySelector('.btn-modal-sell');
    if (btnModalSell && !isInTroop) {
      btnModalSell.addEventListener('click', () => {
        modal.remove();
        this.sellHero(realHero);
      });
    }
  }

  // 升级武将自带战法（支持单级强化与一键满级，绑定至具体武将实例并同步全局与编队）
  upgradeHeroBuiltInTactic(hero, toMax = false) {
    if (!hero) return false;
    const realHero = this.state.ownedGenerals.find(g => g.id === hero.id) || hero;
    const tId = realHero.builtInTacticId;
    const tac = TACTICS_MAP.get(tId);
    if (!this.state.tacticLevels) this.state.tacticLevels = {};

    const currentLvl = Math.max(1, Math.min(MAX_TACTIC_LEVEL, realHero.builtInTacticLevel || this.state.tacticLevels[tId] || 1));
    if (currentLvl >= MAX_TACTIC_LEVEL) return false;

    const currentCopper = this.state.resources.copper || 0;
    let targetLvl = currentLvl + 1;
    let totalCost = TACTIC_UPGRADE_COSTS[currentLvl] || 26000;

    if (toMax) {
      totalCost = 0;
      for (let lv = currentLvl; lv < MAX_TACTIC_LEVEL; lv++) {
        totalCost += (TACTIC_UPGRADE_COSTS[lv] || 26000);
      }
      targetLvl = MAX_TACTIC_LEVEL;
    }

    if (currentCopper < totalCost) {
      slgNotice({ title: '战法强化', body: `主公，您的铜币不足！\n强化【${realHero.name}】的自带战法【${tac ? tac.name : '军略'}】至 Lv.${targetLvl} 需要 🪙 ${totalCost.toLocaleString()} 铜币，当前拥有 🪙 ${currentCopper.toLocaleString()} 铜币。`, seal: '🪙', type: 'warn' });
      return false;
    }

    this.state.resources.copper -= totalCost;
    realHero.builtInTacticLevel = targetLvl;
    // 同步维护全局字典最高等级，确保各处读取一致
    this.state.tacticLevels[tId] = Math.max(this.state.tacticLevels[tId] || 1, targetLvl);
    this.syncTroopHeroTactics(realHero.id);

    sound.playVictoryHorn();
    this.save();
    this.renderHUD();
    this.renderTroops();
    this.renderGenerals();
    return true;
  }

  // 选拔上阵弹窗 (支持 5 支军团共存全局排重，清晰区分满红/高红/白板同名武将)
  openAssignHeroModal(troop, slotIdx) {
    const assignedIds = new Set(
      this.state.troops.flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id))
    );
    if (troop.heroes[slotIdx]) {
      assignedIds.delete(troop.heroes[slotIdx].id);
    }
    const candidates = this.state.ownedGenerals.filter(g => !assignedIds.has(g.id));

    if (candidates.length === 0) {
      slgNotice({ title: '配将提示', body: '背包中没有其他未上阵的闲置武将！请前往【招募】拜将台招揽更多名将。', seal: '🪙', type: 'warn' });
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-mask';

    // 筛选状态
    const filterState = {
      camp: 'all',
      star: 'all',
      aptitude: 'all' // 'all' | 'sa' (仅S/A适性)
    };

    const currentArm = troop.arm || 'spear';
    const currentArmMeta = ARMS[currentArm] || { name: '枪兵', icon: '🗡️' };

    modal.innerHTML = `
      <div class="modal-content" style="max-width:740px; width:95%; max-height:88vh;">
        <div class="modal-header" style="flex-wrap:wrap; gap:8px;">
          <div>
            <div class="modal-title" style="display:flex; align-items:center; gap:8px;">
              <span>选拔上阵 · ${slotIdx===0?'★ 主将位 ★':`副将位 ${slotIdx}`}</span>
              <span id="assignModalTotalBadge" style="font-size:11px; background:#d97706; color:#fff; padding:1px 8px; border-radius:4px; font-weight:normal;"></span>
            </div>
            <div class="card-note card-note--tight">
              当前军团兵种：<b class="val-copper">${currentArmMeta.icon} ${currentArmMeta.name}</b> · 同名武将已按【👑满红 ➔ 高红 ➔ 白板】与等级优先排列
            </div>
          </div>
          <button class="modal-close-btn" id="btnAssignModalClose">✕</button>
        </div>

        <!-- 多维快捷筛选控制栏 -->
        <div style="padding:10px 18px; background:rgba(0,0,0,0.3); border-bottom:1px solid #2d3340; display:flex; flex-direction:column; gap:8px;">
          <!-- 1. 阵营与适性筛选 -->
          <div class="card-row--split card-row--wrap" style="flex-wrap:wrap; gap:8px">
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:12px; color:#9ca3af;">阵营:</span>
              <button class="nav-tab-btn active btn-assign-filter-camp" data-camp="all" style="padding:2px 8px; font-size:11px;">全部</button>
              <button class="nav-tab-btn btn-assign-filter-camp" data-camp="wei" style="padding:2px 8px; font-size:11px; color:#60a5fa;">魏国</button>
              <button class="nav-tab-btn btn-assign-filter-camp" data-camp="shu" style="padding:2px 8px; font-size:11px; color:#34d399;">蜀汉</button>
              <button class="nav-tab-btn btn-assign-filter-camp" data-camp="wu" style="padding:2px 8px; font-size:11px; color:#f87171;">东吴</button>
              <button class="nav-tab-btn btn-assign-filter-camp" data-camp="qun" style="padding:2px 8px; font-size:11px; color:#c084fc;">群雄</button>
            </div>

            <!-- 当前兵种适性筛选 -->
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:12px; color:#9ca3af;">${currentArmMeta.name}适性:</span>
              <button class="nav-tab-btn active btn-assign-filter-apt" data-apt="all" style="padding:2px 8px; font-size:11px;">全部</button>
              <button class="nav-tab-btn btn-assign-filter-apt" data-apt="sa" style="padding:2px 8px; font-size:11px; color:#fbbf24;">仅优选 S·A</button>
            </div>
          </div>

          <!-- 2. 品质筛选 -->
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:12px; color:#9ca3af;">品质:</span>
            <button class="nav-tab-btn active btn-assign-filter-star" data-star="all" style="padding:2px 8px; font-size:11px;">全部</button>
            <button class="nav-tab-btn btn-assign-filter-star" data-star="5" style="padding:2px 8px; font-size:11px; color:#fbbf24;">5★名将</button>
            <button class="nav-tab-btn btn-assign-filter-star" data-star="4" style="padding:2px 8px; font-size:11px; color:#c084fc;">4★良将</button>
            <button class="nav-tab-btn btn-assign-filter-star" data-star="3" style="padding:2px 8px; font-size:11px; color:#9ca3af;">3★偏将</button>
          </div>
        </div>

        <!-- 候选武将网格列表 -->
        <div class="modal-body" id="assignCandidatesContainer" style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding:14px 18px;">
          <!-- 动态渲染候选武将卡片 -->
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#btnAssignModalClose').addEventListener('click', () => modal.remove());

    const container = modal.querySelector('#assignCandidatesContainer');
    const badgeEl = modal.querySelector('#assignModalTotalBadge');

    // 动态渲染候选列表函数
    const renderFilteredCandidates = () => {
      container.innerHTML = '';

      const filtered = candidates.filter(c => {
        // 阵营筛选
        if (filterState.camp !== 'all' && c.camp !== filterState.camp) return false;
        // 品质星级筛选
        if (filterState.star !== 'all' && c.star !== parseInt(filterState.star, 10)) return false;
        // 适性筛选
        if (filterState.aptitude === 'sa') {
          const apt = c.aptitude?.[currentArm] || 'C';
          if (apt !== 'S' && apt !== 'A') return false;
        }
        return true;
      });

      // 排序规则：适性优先(S->A->B->C) -> 星级优先(5->4->3) -> 红星进阶度优先(满红/高红在前，白板在后) -> 等级 -> 自带战法等级 -> 属性
      const aptOrder = { S: 4, A: 3, B: 2, C: 1 };
      const sorted = [...filtered].sort((a, b) => {
        const aptA = aptOrder[a.aptitude?.[currentArm] || 'C'] || 0;
        const aptB = aptOrder[b.aptitude?.[currentArm] || 'C'] || 0;
        if (aptA !== aptB) return aptB - aptA;
        if (a.star !== b.star) return b.star - a.star;
        if ((b.redStars || 0) !== (a.redStars || 0)) return (b.redStars || 0) - (a.redStars || 0);
        if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
        const tacLvlA = a.builtInTacticLevel || this.state.tacticLevels?.[a.builtInTacticId] || 1;
        const tacLvlB = b.builtInTacticLevel || this.state.tacticLevels?.[b.builtInTacticId] || 1;
        if (tacLvlB !== tacLvlA) return tacLvlB - tacLvlA;
        return (b.force + b.intel) - (a.force + a.intel);
      });

      if (badgeEl) {
        badgeEl.textContent = `候选名将: ${sorted.length} / ${candidates.length} 位`;
      }

      if (sorted.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 10px; color:#9ca3af; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed #374151;">
            <div style="font-size:30px; margin-bottom:6px;">🔍</div>
            <div style="font-size:14px; font-weight:bold; color:#e5e7eb;">未找到符合筛选条件的名将</div>
            <div style="font-size:11px; color:#6b7280; margin-top:2px;">可尝试切换阵营、品质或适性筛选选项</div>
          </div>
        `;
        return;
      }

      sorted.forEach(c => {
        const campMeta = CAMPS[c.camp] || { name: '群', color: '#a855f7', badge: '群' };
        const apt = c.aptitude?.[currentArm] || 'C';
        const aptMod = GENERAL_APTITUDE_MODIFIERS[apt] || 1.0;
        const aptModPct = Math.round(aptMod * 100);
        const cLvl = c.level || 1;
        const redStars = c.redStars || 0;
        const maxRedStars = c.star || 5;
        const isFullRed = redStars >= maxRedStars;

        // 真实渲染红星 + 金星，并生成醒目的【满红 / X红 / 白板】身份标签
        let starsHtml = '';
        for (let s = 1; s <= (c.star || 5); s++) {
          starsHtml += (s <= redStars) ? `<span class="star-red">★</span>` : `<span class="star-gold">★</span>`;
        }
        const redIdentityBadge = isFullRed
          ? `<span style="font-size:10px; background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color:#fde047; border:1px solid #fbbf24; padding:1px 6px; border-radius:4px; font-weight:bold; box-shadow:0 0 8px rgba(239,68,68,0.4);">👑 满红(${redStars}红)</span>`
          : (redStars > 0
            ? `<span style="font-size:10px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid #ef4444; padding:1px 6px; border-radius:4px; font-weight:bold;">🔥 进阶${redStars}红</span>`
            : `<span style="font-size:10px; background:rgba(107,114,128,0.25); color:#d1d5db; border:1px solid #4b5563; padding:1px 5px; border-radius:4px;">白板(0红)</span>`);

        // 自带战法与已装配战法详情
        const builtInTac = TACTICS_MAP.get(c.builtInTacticId);
        const tacName = builtInTac ? builtInTac.name : '军略';
        const builtInLvl = c.builtInTacticLevel || this.state.tacticLevels?.[c.builtInTacticId] || 1;
        const eqTac1 = c.equippedTactic1 ? TACTICS_MAP.get(c.equippedTactic1) : null;
        const eqTac2 = c.equippedTactic2 ? TACTICS_MAP.get(c.equippedTactic2) : null;
        const eqTacTags = [
          eqTac1 ? `<span style="color:#c084fc;">[${eqTac1.name} Lv.${this.state.tacticLevels?.[eqTac1.id] || 1}]</span>` : '',
          eqTac2 ? `<span style="color:#c084fc;">[${eqTac2.name} Lv.${this.state.tacticLevels?.[eqTac2.id] || 1}]</span>` : ''
        ].filter(Boolean).join(' ');

        const cardBorder = isFullRed ? '#ef4444' : (redStars > 0 ? '#f59e0b' : (c.star === 5 ? '#d97706' : '#374151'));
        const cardBg = isFullRed ? 'linear-gradient(90deg, rgba(239,68,68,0.12) 0%, #11141a 45%)' : '#11141a';

        const card = document.createElement('div');
        card.style.cssText = `background:${cardBg}; border:1px solid ${cardBorder}; ${isFullRed ? 'box-shadow:0 0 10px rgba(239,68,68,0.25);' : ''} padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:12px; transition:border-color 0.2s;`;
        card.innerHTML = `
          <div class="candidate-info-area" style="display:flex; align-items:center; gap:10px; flex:1; min-width:0; cursor:pointer;" title="点击预览该张【${c.name}】全息军略详情">
            ${getGeneralAvatarHtml(c, { size: 46, borderRadius: '8px', fontSize: '28px' })}
            <div style="min-width:0; flex:1;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-weight:bold; color:#fff; font-size:14px;">${c.name}</span>
                ${redIdentityBadge}
                <span class="hero-level-badge" style="font-size:10px;">Lv.${cLvl}</span>
                <span style="font-size:10px; background:${campMeta.color}; color:#fff; padding:1px 5px; border-radius:3px;">${campMeta.name}</span>
                <span style="font-size:12px; letter-spacing:1px;">${starsHtml}</span>
                <span class="card-micro">${c.cost}御</span>
              </div>
              <div style="font-size:11px; color:#9ca3af; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <span>${currentArmMeta.name}适性: <b class="apt-tag ${apt}">${apt}</b> <span style="color:#6ee7b7; font-size:10px;">(${aptModPct}%)</span></span>
                <span>武:<b class="val-gold">${Math.round(c.force + (c.forceGrowth || 1.0) * (cLvl - 1))}</b> 智:<b style="color:#60a5fa;">${Math.round(c.intel + (c.intelGrowth || 1.0) * (cLvl - 1))}</b> 统:<b class="val-ok">${Math.round(c.command + (c.commandGrowth || 1.0) * (cLvl - 1))}</b> 速:<b style="color:#f472b6;">${Math.round(c.speed + (c.speedGrowth || 1.0) * (cLvl - 1))}</b>${redStars > 0 ? ` <span style="color:#f87171; font-weight:bold;">(红+${redStars * 5})</span>` : ''}</span>
                <span class="val-ok">兵力:${(c.maxSoldiers || 3000).toLocaleString()}</span>
                <span style="color:#e2e8f0;">[自带] <b style="color:${c.star === 5 ? '#fde047' : (c.star === 4 ? '#c084fc' : '#93c5fd')};">${tacName}</b> <span style="color:#6ee7b7; font-size:10px;">Lv.${builtInLvl}</span></span>
                ${eqTacTags ? `<span>配法: ${eqTacTags}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="upgrade-btn btn-choose-candidate" data-id="${c.id}" style="padding:6px 14px; font-size:12px; white-space:nowrap; background:${apt==='S'?'linear-gradient(135deg, #059669 0%, #047857 100%)':'linear-gradient(135deg, #d97706 0%, #b45309 100%)'};">
            ${slotIdx===0?'命为主将':'选拔上阵'}
          </button>
        `;

        card.querySelector('.candidate-info-area')?.addEventListener('click', () => {
          sound.playDrum();
          this.openHeroDetailModal(c);
        });

        card.querySelector('.btn-choose-candidate').addEventListener('click', () => {
          const chosen = this.state.ownedGenerals.find(g => g.id === c.id);
          if (chosen) {
            troop.heroes[slotIdx] = chosen;
            sound.playDrum();
            this.renderTroops();
            this.save();
          }
          modal.remove();
        });

        container.appendChild(card);
      });
    };

    // 绑定阵营筛选事件
    modal.querySelectorAll('.btn-assign-filter-camp').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.btn-assign-filter-camp').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.camp = btn.getAttribute('data-camp');
        sound.playDrum();
        renderFilteredCandidates();
      });
    });

    // 绑定适性筛选事件
    modal.querySelectorAll('.btn-assign-filter-apt').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.btn-assign-filter-apt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.aptitude = btn.getAttribute('data-apt');
        sound.playDrum();
        renderFilteredCandidates();
      });
    });

    // 绑定品质星级筛选事件
    modal.querySelectorAll('.btn-assign-filter-star').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.btn-assign-filter-star').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterState.star = btn.getAttribute('data-star');
        sound.playDrum();
        renderFilteredCandidates();
      });
    });

    // 初始渲染
    renderFilteredCandidates();
  }

  // ================= 3. 武将图鉴、升星进阶与双战法装配 =================
  renderGenerals() {
    this.ownedGeneralsGrid.innerHTML = '';
    const campFilter = this.generalFilter?.camp || 'all';
    const starFilter = this.generalFilter?.star || 'all';

    // 建立部队上阵排位权重映射 (军团顺位与主副将槽位)
    const troopOrderMap = new Map();
    (this.state.troops || []).forEach((t, tIdx) => {
      (t.heroes || []).forEach((h, hIdx) => {
        if (h && h.id) {
          troopOrderMap.set(h.id, tIdx * 10 + hIdx);
        }
      });
    });
    const currentTroopHeroIds = new Set(troopOrderMap.keys());

    // 联合筛选过滤
    const list = (this.state.ownedGenerals || []).filter(g => {
      if (campFilter !== 'all' && g.camp !== campFilter) return false;
      if (starFilter !== 'all' && g.star !== starFilter) return false;
      return true;
    });

    // 建立同名武将分组元数据映射 (用于同名卡相邻聚合与组间权重对比)
    const nameMetaMap = new Map();
    (this.state.ownedGenerals || []).forEach(g => {
      if (!nameMetaMap.has(g.name)) {
        nameMetaMap.set(g.name, {
          star: g.star || 3,
          maxRed: g.redStars || 0,
          maxLevel: g.level || 1,
          cost: g.cost || 0,
          attrSum: (g.force || 0) + (g.intel || 0) + (g.command || 0) + (g.speed || 0)
        });
      } else {
        const meta = nameMetaMap.get(g.name);
        meta.maxRed = Math.max(meta.maxRed, g.redStars || 0);
        meta.maxLevel = Math.max(meta.maxLevel, g.level || 1);
      }
    });

    // 🌟 原版多维权重综合排序 (同名武将紧密排列在一起)：
    // 1. 上阵出征状态置顶 (按军团与主副将顺位排列)
    // 2. 武将品质星级降序 (5星名将 > 4星良将 > 3星裨将)
    // 3. 同名武将相邻聚合 (同一武将的所有卡牌必定排列在一起，高红在左、白板在右)
    // 4. 不同武将之间按组主力红星、等级、御值有序排位
    list.sort((a, b) => {
      // 1. 出征部队置顶
      const inTroopA = troopOrderMap.has(a.id);
      const inTroopB = troopOrderMap.has(b.id);
      if (inTroopA !== inTroopB) {
        return inTroopA ? -1 : 1;
      }
      if (inTroopA && inTroopB) {
        const orderDiff = troopOrderMap.get(a.id) - troopOrderMap.get(b.id);
        if (orderDiff !== 0) return orderDiff;
      }

      // 2. 星级品质降序 (5星名将 > 4星良将 > 3星裨将)
      const starDiff = (b.star || 3) - (a.star || 3);
      if (starDiff !== 0) return starDiff;

      // 3. 同名卡紧密相邻排列！
      if (a.name === b.name) {
        // 同名卡内部排序：红星数降序 (满红/高红在左，白板在右)
        const redDiff = (b.redStars || 0) - (a.redStars || 0);
        if (redDiff !== 0) return redDiff;
        // 等级降序
        const lvlDiff = (b.level || 1) - (a.level || 1);
        if (lvlDiff !== 0) return lvlDiff;
        return a.id.localeCompare(b.id);
      }

      // 4. 不同武将组间排序权重 (以该武将主力最高战力排位，等级与御值优先，确保进阶后排位稳定不瞬移)
      const metaA = nameMetaMap.get(a.name) || {};
      const metaB = nameMetaMap.get(b.name) || {};

      // ① 最高等级降序 (主力核心靠前，进阶不改等级故排位稳定)
      const groupLvlDiff = (metaB.maxLevel || 1) - (metaA.maxLevel || 1);
      if (groupLvlDiff !== 0) return groupLvlDiff;

      // ② 统御值降序 (7御大核优先)
      const costDiff = (metaB.cost || 0) - (metaA.cost || 0);
      if (costDiff !== 0) return costDiff;

      // ③ 最高红星降序 (同等级同御值下，高红优先)
      const groupRedDiff = (metaB.maxRed || 0) - (metaA.maxRed || 0);
      if (groupRedDiff !== 0) return groupRedDiff;

      // ④ 综合属性降序
      const attrDiff = (metaB.attrSum || 0) - (metaA.attrSum || 0);
      if (attrDiff !== 0) return attrDiff;

      return (a.name || '').localeCompare(b.name || '', 'zh-Hans');
    });

    if (list.length === 0) {
      this.ownedGeneralsGrid.innerHTML = `
        <div style="width:100%; text-align:center; color:#9ca3af; padding:60px 0; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed #374151;">
          <div style="font-size:32px; margin-bottom:8px;">🏮</div>
          <div style="font-size:14px; font-weight:bold; color:#d1d5db;">暂无符合当前筛选条件的武将</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px;">请尝试切换阵营或品质标签，或前往【招募】点将台抽取更多名将！</div>
        </div>
      `;
      return;
    }

    list.forEach(g => {
      const card = document.createElement('div');
      const redStars = g.redStars || 0;
      const maxRedStars = g.star || 5;
      const isFullRed = (redStars >= maxRedStars);

      card.className = `general-card ${g.star===5?'star-5':''} ${isFullRed?'full-red':''}`;
      const campInfo = CAMPS[g.camp] || CAMPS.qun;
      const builtInTac = TACTICS_MAP.get(g.builtInTacticId);
      const tac1 = TACTICS_MAP.get(g.equippedTactic1);
      const tac2 = TACTICS_MAP.get(g.equippedTactic2);
      const inheritTacId = getHeroInheritTacticId(g);
      const inheritTac = TACTICS_MAP.get(inheritTacId);
      const isInherited = this.state.ownedTactics.includes(inheritTacId);

      // 统计可进阶同名卡数量 (未上阵、不是自身，且必须是未进阶的白板卡，保护高红卡不被吞噬)
      const duplicateCards = this.state.ownedGenerals.filter(other => 
        other.name === g.name && other.id !== g.id && !currentTroopHeroIds.has(other.id) && (other.redStars || 0) === 0
      );
      const canPromote = (!isFullRed && duplicateCards.length > 0);
      const isInTroop = currentTroopHeroIds.has(g.id);

      // 星级渲染 (红星 + 金星，原版纯净星标)
      let starsHtml = '';
      for (let s = 1; s <= g.star; s++) {
        if (s <= redStars) {
          starsHtml += `<span class="star-red">★</span>`;
        } else {
          starsHtml += `<span class="star-gold">★</span>`;
        }
      }

      const gLvl = g.level || 1;
      const gExp = g.exp || 0;
      const reqExp = getExpRequiredForLevel(gLvl);
      const expPct = reqExp > 0 ? Math.min(100, Math.round((gExp / reqExp) * 100)) : 100;

      card.innerHTML = `
        <div class="card-header">
          <span class="camp-tag" style="background:${campInfo.color};">${campInfo.badge}</span>
          <div style="display:flex; align-items:center; gap:4px;">
            ${isInTroop ? `<span style="font-size:10px; color:#10b981; background:rgba(16,185,129,0.15); border:1px solid #10b981; padding:0 4px; border-radius:3px;">出征</span>` : ''}
            <span class="cost-badge">${g.cost}御</span>
          </div>
        </div>
        <div class="avatar-box">
          ${getGeneralAvatarHtml(g, { fontSize: '42px' })}
        </div>
        <div class="hero-name">
          <span>${g.name}</span>
          <span class="hero-level-badge">Lv.${gLvl}</span>
        </div>
        
        <!-- 经验条 -->
        <div class="hero-exp-box">
          <div class="hero-exp-text">
            <span>经验</span>
            <span>${gLvl>=MAX_GENERAL_LEVEL?'满级':`${gExp}/${reqExp}`}</span>
          </div>
          <div class="hero-exp-track">
            <div class="hero-exp-progress" style="width:${expPct}%;"></div>
          </div>
        </div>

        <div class="stars-row">${starsHtml}</div>
        <div class="apt-row">
          <span>骑<b class="apt-tag ${g.aptitude.cavalry}">${g.aptitude.cavalry}</b></span>
          <span>盾<b class="apt-tag ${g.aptitude.shield}">${g.aptitude.shield}</b></span>
          <span>弓<b class="apt-tag ${g.aptitude.bow}">${g.aptitude.bow}</b></span>
          <span>枪<b class="apt-tag ${g.aptitude.spear}">${g.aptitude.spear}</b></span>
        </div>

        <!-- 极简辅助行 -->
        <div style="margin-top:2px; display:flex; justify-content:center;">
          ${canPromote ? `
            <button class="upgrade-btn btn-promote-hero" style="width:100%; padding:2px 0; font-size:10px; background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);">
              🌟 进阶
            </button>
          ` : isFullRed ? `
            <span style="font-size:10px; color:#fbbf24; font-weight:bold; padding:2px 0;">👑 满红名宿</span>
          ` : `
            <span style="font-size:10px; color:#6b7280; padding:2px 0;">点击查看军略</span>
          `}
        </div>
      `;

      // 绑定进阶升星
      const btnPromote = card.querySelector('.btn-promote-hero');
      if (btnPromote) {
        btnPromote.addEventListener('click', (e) => {
          e.stopPropagation();
          this.promoteHero(g, duplicateCards[0]);
        });
      }

      // 绑定整张卡片点击直接查看全息档案详情
      card.style.cursor = 'pointer';
      card.title = `点击查看【${g.name}】全息军略档案`;
      card.addEventListener('click', () => {
        sound.playDrum();
        this.openHeroDetailModal(g);
      });

        this.ownedGeneralsGrid.appendChild(card);
      });
  }

  // 武将转化传承战法
  inheritTacticFromHero(hero) {
    const tacId = getHeroInheritTacticId(hero);
    const tac = TACTICS_MAP.get(tacId);
    if (!tac) return;

    if (this.state.ownedTactics.includes(tacId)) {
      slgNotice({ title: '战法传承', body: `战法【${tac.name}】已在战法库中解锁，无需重复传承！`, seal: '📖', type: 'warn' });
      return;
    }

    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));
    if (currentTroopHeroIds.has(hero.id)) {
      slgNotice({ title: '战法传承', body: `武将【${hero.name}】正在主力出征军团中，不可献祭传承！`, seal: '⚔️', type: 'warn' });
      return;
    }

    slgNotice({
      title: '武将战法传承确认',
      body: `📖 主公，确认消耗 1 位闲置武将【${hero.name} (${hero.star}★)】吗？\n传承后将永久领悟解锁 ${tac.quality}级 战法【${tac.name}】(${tac.type})，可为麾下任意武将装配并研习升级！`,
      seal: '📖',
      type: 'warn',
      okText: '确认传承',
      cancelText: '再思',
      onConfirm: () => {
        const idx = this.state.ownedGenerals.findIndex(x => x.id === hero.id);
        if (idx >= 0) {
          this.state.ownedGenerals.splice(idx, 1);
          this.state.ownedTactics.push(tacId);
          if (!this.state.tacticLevels) this.state.tacticLevels = {};
          this.state.tacticLevels[tacId] = 1;

          sound.playVictoryHorn();
          this.save();
          this.renderGenerals();
          this.renderTacticsUpgrade();
          this.renderHUD();
          slgNotice({ title: '战法传承', body: `🎉 恭喜主公！\n成功献祭武将【${hero.name}】，领悟并解锁 ${tac.quality}级绝技【${tac.name}】！\n已永久加入战法研习库！`, seal: '✨', type: 'ok' });
        }
      }
    });
  }

  // 升星进阶单个武将 (智能选拔未满红培养主体，保护满红与高红，严格消耗白板副卡)
  promoteHero(targetHero, materialCard) {
    if (!targetHero) return;
    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));

    // 1. 汇集该武将的所有同名卡，并过滤掉已满红的卡牌（已满红卡牌独立留存，不阻塞后续同名卡继续培养）
    const sameNameCards = (this.state.ownedGenerals || []).filter(x => x.name === targetHero.name);
    if (sameNameCards.length <= 1) {
      slgNotice({ title: '武将进阶', body: `⚠️ 背包中没有多余的【${targetHero.name}】同名卡可供进阶！`, seal: '⚔️', type: 'warn' });
      return;
    }

    const nonFullSameNameCards = sameNameCards.filter(x => (x.redStars || 0) < (x.star || 5));
    if (nonFullSameNameCards.length === 0) {
      slgNotice({ title: '武将进阶', body: `⚠️【进阶封顶】麾下所有【${targetHero.name}】均已达到满红状态，无需继续进阶！`, seal: '⚔️', type: 'warn' });
      return;
    }
    if (nonFullSameNameCards.length <= 1) {
      slgNotice({ title: '武将进阶', body: `⚠️ 背包中没有多余的未满红【${targetHero.name}】同名卡可供进阶消耗！`, seal: '⚔️', type: 'warn' });
      return;
    }

    // 2. 在未满红同名卡中选拔进阶培养主体主卡：
    // 优先：已上阵 > 红星最高 > 等级最高 > 经验最高 > 当前点击的目标卡
    nonFullSameNameCards.sort((a, b) => {
      const inA = currentTroopHeroIds.has(a.id);
      const inB = currentTroopHeroIds.has(b.id);
      if (inA !== inB) return inA ? -1 : 1;
      const redDiff = (b.redStars || 0) - (a.redStars || 0);
      if (redDiff !== 0) return redDiff;
      const lvlDiff = (b.level || 1) - (a.level || 1);
      if (lvlDiff !== 0) return lvlDiff;
      const expDiff = (b.exp || 0) - (a.exp || 0);
      if (expDiff !== 0) return expDiff;
      if (a.id === targetHero.id) return -1;
      if (b.id === targetHero.id) return 1;
      return 0;
    });

    const mainHero = nonFullSameNameCards[0];
    const maxRed = mainHero.star || 5;

    // 3. 严格筛选可消耗的白板材料卡：非主卡、未出征、且必须是0红白板
    const candidateMaterials = nonFullSameNameCards.slice(1).filter(other => 
      other.id !== mainHero.id && !currentTroopHeroIds.has(other.id) && (other.redStars || 0) === 0
    );

    if (candidateMaterials.length === 0) {
      slgNotice({ title: '武将进阶', body: `⚠️ 未找到可作为进阶材料的【${mainHero.name}】白板副卡！已进阶的高红卡或出征部队已受到安全保护。`, seal: '⚔️', type: 'warn' });
      return;
    }

    // 优先使用传入的合法材料卡，否则取最后一张（优先级最低的）可用白板副卡
    const chosenMaterial = (materialCard && materialCard.id !== mainHero.id && candidateMaterials.some(m => m.id === materialCard.id))
      ? materialCard
      : candidateMaterials[candidateMaterials.length - 1];

    const matIdx = this.state.ownedGenerals.findIndex(x => x.id === chosenMaterial.id);
    if (matIdx < 0) return;

    // 4. 消耗材料副卡
    this.state.ownedGenerals.splice(matIdx, 1);

    // 5. 主力卡进阶属性暴涨
    mainHero.redStars = (mainHero.redStars || 0) + 1;
    mainHero.force = (mainHero.force || 50) + 5;
    mainHero.intel = (mainHero.intel || 50) + 5;
    mainHero.command = (mainHero.command || 50) + 5;
    mainHero.speed = (mainHero.speed || 50) + 5;

    // 6. 实时同步已上阵部队中的同一武将实例 (严格匹配唯一 id，避免覆盖部队中的其他同名满红卡)
    (this.state.troops || []).forEach(t => {
      (t.heroes || []).forEach(h => {
        if (h && h.id === mainHero.id) {
          h.redStars = mainHero.redStars;
          h.force = mainHero.force;
          h.intel = mainHero.intel;
          h.command = mainHero.command;
          h.speed = mainHero.speed;
        }
      });
    });

    sound.playVictoryHorn();
    this.save();
    this.renderGenerals();
    this.renderTroops();
    this.renderHUD();
    const isNowFull = (mainHero.redStars >= maxRed);
    slgNotice({
      title: '武将进阶',
      body: isNowFull 
        ? `👑【满红大成】消耗 1 张白板副卡，【${mainHero.name}】成功晋升为 ${maxRed} 星满红名宿！\n武力/智力/统率/速度全面提升 5 点！`
        : `🌟【进阶大捷】消耗 1 张白板副卡，【${mainHero.name}】成功进阶为 ${mainHero.redStars} 红！\n武力/智力/统率/速度全面提升 5 点！`,
      seal: isNowFull ? '👑' : '🌟',
      type: 'ok'
    });
  }

  // 一键同名卡升星进阶 (严密分组选拔未满红主力，支持满红后多余同名卡递进培养第2/第3只)
  quickAutoPromote() {
    let promotedCount = 0;
    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));

    // 1. 按武将名称分组 (Name -> 卡牌列表)
    const heroGroups = new Map();
    (this.state.ownedGenerals || []).forEach(g => {
      if (!heroGroups.has(g.name)) {
        heroGroups.set(g.name, []);
      }
      heroGroups.get(g.name).push(g);
    });

    // 2. 逐组安全递进进阶
    for (const [, cards] of heroGroups.entries()) {
      // 过滤掉已满红的卡牌，仅对未满红的同名卡执行进阶合成
      const availablePool = cards.filter(c => (c.redStars || 0) < (c.star || 5));
      if (availablePool.length <= 1) continue;

      // 选拔进阶主体优先级：已上阵 > 红星数最高 > 等级最高 > 经验最高
      availablePool.sort((a, b) => {
        const inA = currentTroopHeroIds.has(a.id);
        const inB = currentTroopHeroIds.has(b.id);
        if (inA !== inB) return inA ? -1 : 1;
        const redDiff = (b.redStars || 0) - (a.redStars || 0);
        if (redDiff !== 0) return redDiff;
        const lvlDiff = (b.level || 1) - (a.level || 1);
        if (lvlDiff !== 0) return lvlDiff;
        return (b.exp || 0) - (a.exp || 0);
      });

      // 支持将第1张升至满红后，剩余白板卡继续递进升星第2张、第3张同名卡
      while (availablePool.length > 1) {
        const mainHero = availablePool.shift();
        const maxRed = mainHero.star || 5;

        while ((mainHero.redStars || 0) < maxRed) {
          // 从队尾查找未上阵且为0红白板的材料卡
          let matPoolIdx = -1;
          for (let i = availablePool.length - 1; i >= 0; i--) {
            const candidate = availablePool[i];
            if (!currentTroopHeroIds.has(candidate.id) && (candidate.redStars || 0) === 0) {
              matPoolIdx = i;
              break;
            }
          }
          if (matPoolIdx === -1) break;

          const [matCard] = availablePool.splice(matPoolIdx, 1);
          const matIdx = this.state.ownedGenerals.findIndex(x => x.id === matCard.id);
          if (matIdx >= 0) {
            this.state.ownedGenerals.splice(matIdx, 1);
            mainHero.redStars = (mainHero.redStars || 0) + 1;
            mainHero.force = (mainHero.force || 50) + 5;
            mainHero.intel = (mainHero.intel || 50) + 5;
            mainHero.command = (mainHero.command || 50) + 5;
            mainHero.speed = (mainHero.speed || 50) + 5;
            promotedCount++;
          }
        }

        // 同步已上阵部队中对应的唯一武将实例
        (this.state.troops || []).forEach(t => {
          (t.heroes || []).forEach(h => {
            if (h && h.id === mainHero.id) {
              h.redStars = mainHero.redStars;
              h.force = mainHero.force;
              h.intel = mainHero.intel;
              h.command = mainHero.command;
              h.speed = mainHero.speed;
            }
          });
        });
      }
    }

    if (promotedCount === 0) {
      slgNotice({ title: '一键进阶', body: '背包中暂无满足条件的白板重复同名武将卡！\n单张闲置同名卡已安全为您留存，可用于传承战法或转化换取铜币。', seal: '⚔️', type: 'warn' });
      return;
    }

    sound.playVictoryHorn();
    this.save();
    this.renderGenerals();
    this.renderTroops();
    this.renderHUD();
    slgNotice({ title: '红度进阶', body: `🎉【一键进阶圆满】\n共计完成 ${promotedCount} 次红度进阶！\n全员进阶属性已同步提升！`, seal: '⚡', type: 'ok' });
  }

  // 单个武将转化铜币（3星300 / 4星1000 / 5星5000，已进阶红星按消耗同名卡数量全额折算返还）
  sellHero(hero) {
    const baseCopper = (hero.star === 5 ? 5000 : hero.star === 4 ? 1000 : 300);
    const cardCount = 1 + (hero.redStars || 0);
    const goldBack = baseCopper * cardCount;
    const starStr = '★'.repeat(hero.star);
    const redExtraNote = (hero.redStars > 0)
      ? `\n（含已进阶 ${hero.redStars} 红所消耗的同名武将卡，共按 ${cardCount} 张全额折算）`
      : '';

    const confirmMsg = hero.star === 5
      ? `👑【名将转化确认】\n\n【${hero.name} (${starStr})】乃稀世名将，可用于上阵统兵、进阶觉醒或传承 S 级绝技！\n确认将其消耗转化吗？转化后武将卡将消失且不可找回，转化为 🪙 ${goldBack.toLocaleString()} 铜币（用于战法研习）。${redExtraNote}`
      : `🪙【武将转化确认】\n\n确认消耗闲置武将【${hero.name} (${starStr})】进行转化吗？\n转化后该武将卡将消失，并转化为 🪙 ${goldBack.toLocaleString()} 铜币（用于战法研习升级）。${redExtraNote}`;

    const convertBody = hero.star === 5
      ? confirmMsg.replace('👑【名将转化确认】\n\n', '')
      : confirmMsg.replace('🪙【武将转化确认】\n\n', '');
    slgNotice({
      title: '武将转化确认',
      body: convertBody,
      seal: hero.star === 5 ? '👑' : '🪙',
      type: 'warn',
      okText: '确认转化',
      cancelText: '再思',
      onConfirm: () => {
        const idx = this.state.ownedGenerals.findIndex(x => x.id === hero.id);
        if (idx >= 0) {
          this.state.ownedGenerals.splice(idx, 1);
          this.state.resources.copper = (this.state.resources.copper || 0) + goldBack;
          sound.playGoldChime();
          this.save();
          this.renderGenerals();
          this.renderHUD();
          slgNotice({ title: '武将转化', body: `✔【转化完成】\n武将【${hero.name}】已成功转化为 🪙 ${goldBack.toLocaleString()} 铜币！`, seal: '🪙', type: 'ok' });
        }
      }
    });
  }

  // 批量转化全部闲置3星武将
  quickSellThreeStars() {
    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));
    const threeStars = this.state.ownedGenerals.filter(g => g.star === 3 && !currentTroopHeroIds.has(g.id));

    if (threeStars.length === 0) {
      slgNotice({ title: '转化军务', body: '当前麾下没有未上阵的 3★ 闲置裨将！', seal: '🪙', type: 'warn' });
      return;
    }

    const copperTotal = threeStars.reduce((sum, g) => sum + 300 * (1 + (g.redStars || 0)), 0);
    slgNotice({
      title: '批量转化确认',
      body: `🪙 确认将麾下全部 ${threeStars.length} 位未上阵的【3★ 裨将】消耗转化吗？\n转化后武将卡将消失，共转化为 🪙 ${copperTotal.toLocaleString()} 铜币（用于战法研习升级）。`,
      seal: '🪙',
      type: 'warn',
      okText: '确认转化',
      cancelText: '再思',
      onConfirm: () => {
        this.state.ownedGenerals = this.state.ownedGenerals.filter(g => !(g.star === 3 && !currentTroopHeroIds.has(g.id)));
        this.state.resources.copper = (this.state.resources.copper || 0) + copperTotal;

        sound.playGoldChime();
        this.save();
        this.renderGenerals();
        this.renderHUD();
        slgNotice({ title: '批量转化', body: `🪙【批量转化完成】\n共消耗 ${threeStars.length} 位 3★ 裨将，\n成功转化为 🪙 ${copperTotal.toLocaleString()} 铜币！`, seal: '🪙', type: 'ok' });
      }
    });
  }

  // 批量转化全部闲置4星良将
  quickSellFourStars() {
    const currentTroopHeroIds = new Set((this.state.troops || []).flatMap(t => (t.heroes || []).filter(Boolean).map(h => h.id)));
    const fourStars = this.state.ownedGenerals.filter(g => g.star === 4 && !currentTroopHeroIds.has(g.id));

    if (fourStars.length === 0) {
      slgNotice({ title: '转化军务', body: '当前麾下没有未上阵的 4★ 闲置良将！', seal: '🪙', type: 'warn' });
      return;
    }

    const copperTotal = fourStars.reduce((sum, g) => sum + 1000 * (1 + (g.redStars || 0)), 0);
    slgNotice({
      title: '四星良将批量转化确认',
      body: `⚠️ 确认将麾下全部 ${fourStars.length} 位未上阵的【4★ 良将】消耗转化吗？\n（提示：4★良将可用于传承 A 级战法）\n转化后武将卡将消失，共转化为 🪙 ${copperTotal.toLocaleString()} 铜币（用于战法研习升级）。`,
      seal: '⚠️',
      type: 'warn',
      okText: '确认转化',
      cancelText: '再思',
      onConfirm: () => {
        this.state.ownedGenerals = this.state.ownedGenerals.filter(g => !(g.star === 4 && !currentTroopHeroIds.has(g.id)));
        this.state.resources.copper = (this.state.resources.copper || 0) + copperTotal;

        sound.playGoldChime();
        this.save();
        this.renderGenerals();
        this.renderHUD();
        slgNotice({ title: '批量转化', body: `🎉【批量转化完成】\n共消耗 ${fourStars.length} 位 4★ 良将，\n成功转化为 🪙 ${copperTotal.toLocaleString()} 铜币！`, seal: '🪙', type: 'ok' });
      }
    });
  }

  openEquipTacticModal(hero, slot = 1) {
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    const currentEquippedId = (slot === 1 ? hero.equippedTactic1 : hero.equippedTactic2);
    const otherSlotEquippedId = (slot === 1 ? hero.equippedTactic2 : hero.equippedTactic1);

    // 统计全局所有武将的战法占用情况 (战法ID -> 占用武将名称)
    const tacticOccupiedMap = new Map();
    (this.state.ownedGenerals || []).forEach(g => {
      if (g.equippedTactic1) tacticOccupiedMap.set(g.equippedTactic1, { heroId: g.id, heroName: g.name, slot: 1 });
      if (g.equippedTactic2) tacticOccupiedMap.set(g.equippedTactic2, { heroId: g.id, heroName: g.name, slot: 2 });
    });

    modal.innerHTML = `
      <div class="modal-content" style="max-width:620px;">
        <div class="modal-header">
          <div class="modal-title">换配传承战法 · ${hero.name} (槽位 ${slot})</div>
          <button class="modal-close-btn" id="btnTacModalClose">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:10px;">
          
          <!-- 卸下当前战法选项 -->
          <div class="card-row--split" style="background:rgba(239, 68, 68, 0.08); border:1px dashed #ef4444; padding:8px 12px; border-radius:8px">
            <div>
              <div style="font-weight:bold; color:#fca5a5; font-size:12px;">🚫 卸下当前战法</div>
              <div class="card-note">卸下后槽位空置，可供其他武将研习装配该战法。</div>
            </div>
            <button class="upgrade-btn btn-unequip-tactic" style="background:#4b5563; padding:4px 12px; font-size:11px;" ${!currentEquippedId ? 'disabled' : ''}>
              ${currentEquippedId ? '立即卸下' : '当前已空置'}
            </button>
          </div>

          <!-- 📚 多维战法综合筛选面板 -->
          <div style="background:rgba(0,0,0,0.35); padding:10px 12px; border-radius:8px; border:1px solid #374151; display:flex; flex-direction:column; gap:7px;">
            <!-- 搜索与空闲状态 -->
            <div class="card-row--split card-row--wrap" style="gap:10px; flex-wrap:wrap">
              <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:180px;">
                <span style="font-size:11px; color:#9ca3af; font-weight:bold;">🔍 搜索:</span>
                <input type="text" id="modalTacticSearchInput" placeholder="输入战法名称查找..." style="flex:1; background:#11141a; border:1px solid #4b5563; border-radius:4px; padding:3px 8px; font-size:11px; color:#fff; outline:none;" />
              </div>
              <div style="display:flex; gap:4px; align-items:center;">
                <span class="card-note">状态:</span>
                <button class="nav-tab-btn active btn-modal-filter-status" data-status="all" style="padding:2px 7px; font-size:11px;">全部</button>
                <button class="nav-tab-btn btn-modal-filter-status" data-status="idle" style="padding:2px 7px; font-size:11px; color:#34d399;">仅空闲</button>
              </div>
            </div>

            <!-- 品阶等级筛选 -->
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="font-size:11px; color:#9ca3af; font-weight:bold; width:45px;">品阶:</span>
              <button class="nav-tab-btn active btn-modal-filter-quality" data-quality="all" style="padding:2px 8px; font-size:11px;">全部</button>
              <button class="nav-tab-btn btn-modal-filter-quality" data-quality="S" style="padding:2px 8px; font-size:11px; color:#fbbf24; border:1px solid rgba(251,191,36,0.3);">🌟 S级名将战法</button>
              <button class="nav-tab-btn btn-modal-filter-quality" data-quality="A" style="padding:2px 8px; font-size:11px; color:#c084fc; border:1px solid rgba(192,132,252,0.3);">💜 A级良将战法</button>
            </div>

            <!-- 机制类型筛选 -->
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="font-size:11px; color:#9ca3af; font-weight:bold; width:45px;">机制:</span>
              <button class="nav-tab-btn active btn-modal-filter-type" data-type="all" style="padding:2px 7px; font-size:11px;">全部</button>
              <button class="nav-tab-btn btn-modal-filter-type" data-type="command" style="padding:2px 7px; font-size:11px; color:#3b82f6;">指挥</button>
              <button class="nav-tab-btn btn-modal-filter-type" data-type="passive" style="padding:2px 7px; font-size:11px; color:#10b981;">被动</button>
              <button class="nav-tab-btn btn-modal-filter-type" data-type="active" style="padding:2px 7px; font-size:11px; color:#f59e0b;">主动</button>
              <button class="nav-tab-btn btn-modal-filter-type" data-type="assault" style="padding:2px 7px; font-size:11px; color:#ef4444;">突击</button>
            </div>

            <!-- 伤害性质筛选 -->
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span style="font-size:11px; color:#9ca3af; font-weight:bold; width:45px;">性质:</span>
              <button class="nav-tab-btn active btn-modal-filter-damage" data-damage="all" style="padding:2px 7px; font-size:11px;">全部</button>
              <button class="nav-tab-btn btn-modal-filter-damage" data-damage="physical" style="padding:2px 7px; font-size:11px; color:#f87171;">⚔️兵刃</button>
              <button class="nav-tab-btn btn-modal-filter-damage" data-damage="tactical" style="padding:2px 7px; font-size:11px; color:#60a5fa;">🔮谋略</button>
              <button class="nav-tab-btn btn-modal-filter-damage" data-damage="heal" style="padding:2px 7px; font-size:11px; color:#34d399;">🩹急救</button>
              <button class="nav-tab-btn btn-modal-filter-damage" data-damage="buff" style="padding:2px 7px; font-size:11px; color:#e879f9;">🛡️增益控制</button>
            </div>
          </div>

          <!-- 可装配战法列表 -->
          <div id="modalTacticItemsContainer" style="display:flex; flex-direction:column; gap:8px; max-height:48vh; overflow-y:auto; padding-right:4px;">
          ${this.state.ownedTactics.map(tId => {
            const tac = TACTICS_MAP.get(tId);
            if (!tac) return '';

            const isBuiltIn = (hero.builtInTacticId === tId);
            const isCurrentSlot = (currentEquippedId === tId);
            const isOtherSlot = (otherSlotEquippedId === tId);
            const occupier = tacticOccupiedMap.get(tId);
            const isOccupiedByOther = occupier && occupier.heroId !== hero.id;
            const currentTacticLvl = this.state.tacticLevels?.[tId] || 1;
            const dmgType = tac.damageType || (tac.damageRate ? 'physical' : (tac.healRate ? 'heal' : 'buff'));
            const typeNameMap = { command: '指挥', passive: '被动', active: '主动', assault: '突击' };

            let btnText = '装配此战法';
            let btnStyle = 'background:linear-gradient(135deg, #10b981 0%, #059669 100%);';
            let btnDisabled = false;
            let statusBadge = '';

            if (isBuiltIn) {
              btnText = '与自带战法冲突';
              btnStyle = 'background:#374151; color:#9ca3af; opacity:0.6;';
              btnDisabled = true;
              statusBadge = `<span style="font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); border:1px solid #ef4444; padding:1px 5px; border-radius:3px;">与本将自带战法冲突</span>`;
            } else if (isCurrentSlot) {
              btnText = '当前装配中';
              btnStyle = 'background:#1f2937; color:#9ca3af; border:1px solid #374151;';
              btnDisabled = true;
            } else if (isOtherSlot) {
              btnText = '自身另槽已装';
              btnStyle = 'background:#374151; color:#9ca3af; opacity:0.6;';
              btnDisabled = true;
              statusBadge = `<span style="font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); border:1px solid #ef4444; padding:1px 5px; border-radius:3px;">本将另一槽位已装配</span>`;
            } else if (isOccupiedByOther) {
              btnText = `顶替【${occupier.heroName}】`;
              btnStyle = 'background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%);';
              statusBadge = `<span style="font-size:10px; color:#fdba74; background:rgba(234,88,12,0.15); border:1px solid #ea580c; padding:1px 5px; border-radius:3px;">已被【${occupier.heroName}】占用</span>`;
            }

            return `
              <div class="modal-tactic-row card-row--split" 
                   data-tac-name="${tac.name || ''}"
                   data-tac-quality="${tac.quality || 'A'}" 
                   data-tac-type="${tac.type || 'active'}" 
                   data-tac-damage="${dmgType}" 
                   data-tac-occupied="${isOccupiedByOther ? '1' : '0'}"
                   style="background:#11141a; border:1px solid ${isCurrentSlot?'#059669':'#374151'}; padding:10px 14px; border-radius:8px">
                <div style="flex:1; padding-right:12px;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="font-weight:bold; color:${tac.quality==='S'?'#fbbf24':'#c084fc'}; font-size:14px;">${tac.name}</span>
                    <span style="font-size:10px; font-weight:bold; color:${tac.quality==='S'?'#fbbf24':'#c084fc'}; background:${tac.quality==='S'?'rgba(251,191,36,0.15)':'rgba(192,132,252,0.15)'}; border:1px solid currentColor; padding:0 4px; border-radius:3px;">${tac.quality==='S'?'🌟 S级':'💜 A级'}</span>
                    <span style="font-size:10px; color:#93c5fd; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.4); padding:0 4px; border-radius:3px;">${typeNameMap[tac.type] || tac.type}</span>
                    <span style="font-size:11px; color:#6ee7b7; background:rgba(110,231,183,0.15); border:1px solid #059669; padding:0 4px; border-radius:3px; font-weight:bold;">Lv.${currentTacticLvl}</span>
                    ${statusBadge}
                  </div>
                  <div style="font-size:11px; color:#9ca3af; margin-top:3px; line-height:1.4;">${tac.desc}</div>
                </div>
                <button class="upgrade-btn btn-confirm-equip" data-id="${tac.id}" data-occupied="${isOccupiedByOther?occupier.heroId:''}" style="padding:5px 12px; font-size:11px; white-space:nowrap; ${btnStyle}" ${btnDisabled ? 'disabled' : ''}>
                  ${btnText}
                </button>
              </div>
            `;
          }).join('')}
            <div id="modalTacticEmptyTip" style="display:none; text-align:center; padding:30px 10px; color:#9ca3af; background:rgba(0,0,0,0.2); border-radius:6px; border:1px dashed #374151;">
              <div style="font-size:24px; margin-bottom:4px;">🔍</div>
              <div style="font-size:13px; color:#d1d5db;">未找到符合当前多维筛选条件的战法</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#btnTacModalClose').addEventListener('click', () => modal.remove());

    // 多维联动筛选状态与逻辑
    const modalFilters = {
      keyword: '',
      status: 'all',
      quality: 'all',
      type: 'all',
      damage: 'all'
    };

    const applyModalFilters = () => {
      let visibleCount = 0;
      modal.querySelectorAll('.modal-tactic-row').forEach(row => {
        const q = row.getAttribute('data-tac-quality');
        const t = row.getAttribute('data-tac-type');
        const d = row.getAttribute('data-tac-damage');
        const occ = row.getAttribute('data-tac-occupied');
        const name = (row.getAttribute('data-tac-name') || '').toLowerCase();

        // 1. 关键词搜索
        if (modalFilters.keyword && !name.includes(modalFilters.keyword)) {
          row.style.display = 'none';
          return;
        }
        // 2. 空闲状态
        if (modalFilters.status === 'idle' && occ === '1') {
          row.style.display = 'none';
          return;
        }
        // 3. 品阶
        if (modalFilters.quality !== 'all' && q !== modalFilters.quality) {
          row.style.display = 'none';
          return;
        }
        // 4. 机制类型
        if (modalFilters.type !== 'all' && t !== modalFilters.type) {
          row.style.display = 'none';
          return;
        }
        // 5. 伤害性质
        if (modalFilters.damage !== 'all') {
          if (modalFilters.damage === 'buff') {
            if (d !== 'buff' && d !== 'debuff') {
              row.style.display = 'none';
              return;
            }
          } else if (d !== modalFilters.damage) {
            row.style.display = 'none';
            return;
          }
        }

        row.style.display = 'flex';
        visibleCount++;
      });

      const emptyTip = modal.querySelector('#modalTacticEmptyTip');
      if (emptyTip) {
        emptyTip.style.display = (visibleCount === 0) ? 'block' : 'none';
      }
    };

    // 绑定搜索输入框事件
    const searchInput = modal.querySelector('#modalTacticSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        modalFilters.keyword = e.target.value.trim().toLowerCase();
        applyModalFilters();
      });
    }

    // 绑定状态筛选
    modal.querySelectorAll('.btn-modal-filter-status').forEach(b => {
      b.addEventListener('click', () => {
        modal.querySelectorAll('.btn-modal-filter-status').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        modalFilters.status = b.getAttribute('data-status');
        applyModalFilters();
      });
    });

    // 绑定品阶筛选
    modal.querySelectorAll('.btn-modal-filter-quality').forEach(b => {
      b.addEventListener('click', () => {
        modal.querySelectorAll('.btn-modal-filter-quality').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        modalFilters.quality = b.getAttribute('data-quality');
        applyModalFilters();
      });
    });

    // 绑定机制类型筛选
    modal.querySelectorAll('.btn-modal-filter-type').forEach(b => {
      b.addEventListener('click', () => {
        modal.querySelectorAll('.btn-modal-filter-type').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        modalFilters.type = b.getAttribute('data-type');
        applyModalFilters();
      });
    });

    // 绑定伤害性质筛选
    modal.querySelectorAll('.btn-modal-filter-damage').forEach(b => {
      b.addEventListener('click', () => {
        modal.querySelectorAll('.btn-modal-filter-damage').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        modalFilters.damage = b.getAttribute('data-damage');
        applyModalFilters();
      });
    });

    // 卸下战法处理
    const btnUnequip = modal.querySelector('.btn-unequip-tactic');
    if (btnUnequip && currentEquippedId) {
      btnUnequip.addEventListener('click', () => {
        // 同步更新真实武将对象
        const realHero = this.state.ownedGenerals.find(g => g.id === hero.id) || hero;
        if (slot === 1) {
          realHero.equippedTactic1 = null;
          hero.equippedTactic1 = null;
        } else {
          realHero.equippedTactic2 = null;
          hero.equippedTactic2 = null;
        }

        // 同步队伍中的武将引用
        this.syncTroopHeroTactics(hero.id);

        sound.playDrum();
        this.renderGenerals();
        this.renderTroops();
        this.save();
        modal.remove();
        slgNotice({ title: '战法装配', body: `✔ 已成功将【${hero.name}】槽位 ${slot} 的战法卸下！该战法现已处于闲置状态，可供其他名将装配！`, seal: '🔓', type: 'ok' });
      });
    }

    // 确定装配与顶替处理
    modal.querySelectorAll('.btn-confirm-equip').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const occupiedHeroId = b.getAttribute('data-occupied');

        // 如果被其他武将占用，提示并从原武将身上卸下
        if (occupiedHeroId) {
          const prevHero = this.state.ownedGenerals.find(g => g.id === occupiedHeroId);
          if (prevHero) {
            if (prevHero.equippedTactic1 === id) prevHero.equippedTactic1 = null;
            if (prevHero.equippedTactic2 === id) prevHero.equippedTactic2 = null;
            this.syncTroopHeroTactics(prevHero.id);
          }
        }

        // 装配到当前武将 (严格校验自带战法互斥)
        const realHero = this.state.ownedGenerals.find(g => g.id === hero.id) || hero;
        if (realHero.builtInTacticId === id) {
          slgNotice({ title: '战法装配', body: `⚠️【${realHero.name}】自带战法与该战法相同，无法重复装配！`, seal: '⚠️', type: 'warn' });
          return;
        }
        if (slot === 1) {
          realHero.equippedTactic1 = id;
          hero.equippedTactic1 = id;
        } else {
          realHero.equippedTactic2 = id;
          hero.equippedTactic2 = id;
        }

        this.syncTroopHeroTactics(hero.id);

        sound.playGoldChime();
        this.renderGenerals();
        this.renderTroops();
        this.save();
        modal.remove();

        const tac = TACTICS_MAP.get(id);
        const tipMsg = occupiedHeroId 
          ? `✔ 战法唯一性生效：已将【${tac?.name}】从原配武将卸下，成功调配并装配至【${hero.name}】！` 
          : `🎉 成功为【${hero.name}】装配战法【${tac?.name}】！`;
        slgNotice({ title: '战法装配', body: tipMsg, seal: '🎉', type: 'ok' });
      });
    });
  }

  // 同步部队槽位中的武将战法与培养状态
  syncTroopHeroTactics(heroId) {
    (this.state.troops || []).forEach(troop => {
      (troop.heroes || []).forEach(h => {
        if (h && h.id === heroId) {
          const real = this.state.ownedGenerals.find(g => g.id === heroId);
          if (real) {
            h.builtInTacticLevel = real.builtInTacticLevel;
            h.equippedTactic1 = real.equippedTactic1;
            h.equippedTactic2 = real.equippedTactic2;
            h.redStars = real.redStars;
            h.level = real.level;
          }
        }
      });
    });
  }

  // ================= 战法研习阁升级系统 (Lv.1 ~ Lv.10) =================
  renderTacticsUpgrade() {
    if (!this.tacticsUpgradeContainer) return;
    this.tacticsUpgradeContainer.innerHTML = '';

    if (!this.state.tacticLevels) this.state.tacticLevels = {};
    const ownedTacticsSet = new Set(this.state.ownedTactics || []);
    const currentTroopHeroIds = new Set((this.state.troops[0]?.heroes || []).map(h => h.id));

    // 获取全部传承战法列表并进行多维筛选
    const allInheritableTactics = Object.keys(TACTIC_INHERIT_SOURCES).map(id => TACTICS_MAP.get(id)).filter(Boolean);

    // 联合多维过滤 (等级、机制类型、伤害/作用性质)
    const filteredTactics = allInheritableTactics.filter(tac => {
      const isUnlocked = ownedTacticsSet.has(tac.id);
      const currentLvl = this.state.tacticLevels[tac.id] || 1;
      const isMax = (currentLvl >= MAX_TACTIC_LEVEL);

      // 0. 战法品阶筛选 (S级 / A级)
      if (this.tacticFilter.quality !== 'all' && tac.quality !== this.tacticFilter.quality) return false;

      // 1. 等级筛选
      if (this.tacticFilter.level === 'max' && (!isUnlocked || !isMax)) return false;
      if (this.tacticFilter.level === 'learning' && (!isUnlocked || isMax)) return false;
      if (this.tacticFilter.level === 'locked' && isUnlocked) return false;

      // 2. 战法机制类型筛选 (指挥 command, 被动 passive, 主动 active, 突击 assault)
      if (this.tacticFilter.type !== 'all' && tac.type !== this.tacticFilter.type) return false;

      // 3. 伤害/作用性质筛选 (兵刃 physical, 谋略 tactical, 治疗 heal, 增益控制 buff/debuff)
      if (this.tacticFilter.damageType !== 'all') {
        const dmgType = tac.damageType || (tac.damageRate ? 'physical' : 'buff');
        if (this.tacticFilter.damageType === 'buff') {
          if (dmgType !== 'buff' && dmgType !== 'debuff') return false;
        } else if (dmgType !== this.tacticFilter.damageType) {
          return false;
        }
      }

      return true;
    });

    if (filteredTactics.length === 0) {
      this.tacticsUpgradeContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #9ca3af; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed #374151;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 14px; font-weight: bold; color: #e5e7eb;">未找到符合筛选条件的战法</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">可尝试切换顶部筛选标签，查看其他类型或等级的传承战法。</div>
        </div>
      `;
      return;
    }

    filteredTactics.forEach(tac => {
      const isUnlocked = ownedTacticsSet.has(tac.id);
      const sourceInfo = TACTIC_INHERIT_SOURCES[tac.id];
      const sourceNames = sourceInfo ? sourceInfo.names : [];

      // 类型标签
      const typeMap = { command: '指挥', passive: '被动', active: '主动', assault: '突击' };
      const typeClass = `tactic-type-${tac.type}`;

      const card = document.createElement('div');

      // 伤害/作用性质标签
      const dmgType = tac.damageType || (tac.damageRate ? 'physical' : 'buff');
      const dmgBadgeMap = {
        physical: '<span style="font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); padding:1px 5px; border-radius:3px;">⚔️ 兵刃</span>',
        tactical: '<span style="font-size:10px; color:#60a5fa; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.4); padding:1px 5px; border-radius:3px;">🔮 谋略</span>',
        heal: '<span style="font-size:10px; color:#34d399; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); padding:1px 5px; border-radius:3px;">🩹 急救</span>',
        buff: '<span style="font-size:10px; color:#e879f9; background:rgba(217,70,239,0.15); border:1px solid rgba(217,70,239,0.4); padding:1px 5px; border-radius:3px;">🛡️ 增益</span>',
        debuff: '<span style="font-size:10px; color:#e879f9; background:rgba(217,70,239,0.15); border:1px solid rgba(217,70,239,0.4); padding:1px 5px; border-radius:3px;">⛓️ 控制</span>'
      };
      const dmgBadgeHtml = dmgBadgeMap[dmgType] || dmgBadgeMap.buff;

      if (isUnlocked) {
        // ========== 1. 已解锁战法：研习与升级 ==========
        const currentLvl = this.state.tacticLevels[tac.id] || 1;
        const isMax = (currentLvl >= MAX_TACTIC_LEVEL);
        const nextCost = isMax ? 0 : (TACTIC_UPGRADE_COSTS[currentLvl] || 26000);
        const currentProps = getTacticEffectiveProps(tac, currentLvl);
        const nextProps = isMax ? null : getTacticEffectiveProps(tac, currentLvl + 1);

        card.className = `tactic-upgrade-card ${isMax ? 'max-level' : ''}`;
        const pct = Math.round((currentLvl / MAX_TACTIC_LEVEL) * 100);

        let statCompareHtml = '';
        if (tac.damageRate) {
          const label = tac.id === 'tac_jue_di_fan_ji' ? '反击爆发' : '伤害率';
          statCompareHtml += `<div>${label}: <b class="val-gold">${(currentProps.damageRate * 100).toFixed(0)}%</b> ${isMax ? '' : `<span class="val-ok">➜ ${(nextProps.damageRate * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.healRate) {
          statCompareHtml += `<div>治疗率: <b class="val-copper">${(currentProps.healRate * 100).toFixed(0)}%</b> ${isMax ? '' : `<span class="val-ok">➜ ${(nextProps.healRate * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.damageReduction || tac.teamDamageReduction) {
          const curRed = currentProps.damageReduction || currentProps.teamDamageReduction;
          const nextRed = nextProps ? (nextProps.damageReduction || nextProps.teamDamageReduction) : 0;
          statCompareHtml += `<div>减伤率: <b style="color:#60a5fa;">${(curRed * 100).toFixed(0)}%</b> ${isMax ? '' : `<span class="val-ok">➜ ${(nextRed * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.statBuff) {
          if (tac.id === 'tac_jue_di_fan_ji') {
            statCompareHtml += `<div>受击武力: <b class="val-gold">+${currentProps.statBuff}/次</b> ${isMax ? '' : `<span class="val-ok">➜ +${nextProps.statBuff}/次</span>`}</div>`;
          } else {
            statCompareHtml += `<div>属性提升: <b style="color:#38bdf8;">+${currentProps.statBuff}</b> ${isMax ? '' : `<span class="val-ok">➜ +${nextProps.statBuff}</span>`}</div>`;
          }
        }
        if (tac.statDebuff) {
          statCompareHtml += `<div>属性削减: <b class="val-damage">-${currentProps.statDebuff}</b> ${isMax ? '' : `<span class="val-ok">➜ -${nextProps.statDebuff}</span>`}</div>`;
        }
        if (tac.damageBonus) {
          statCompareHtml += `<div>伤害增幅: <b style="color:#fb923c;">+${(currentProps.damageBonus * 100).toFixed(0)}%</b> ${isMax ? '' : `<span class="val-ok">➜ +${(nextProps.damageBonus * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.activeRateBonus) {
          statCompareHtml += `<div>主动几率加成: <b style="color:#a78bfa;">+${currentProps.activeRateBonus}%</b> ${isMax ? '' : `<span class="val-ok">➜ +${nextProps.activeRateBonus}%</span>`}</div>`;
        }
        if (tac.disarmRate && tac.disarmRate < 100) {
          statCompareHtml += `<div>缴械几率: <b style="color:#fb7185;">${currentProps.disarmRate}%</b> ${isMax ? '' : `<span class="val-ok">➜ ${nextProps.disarmRate}%</span>`}</div>`;
        }
        if (tac.rate && tac.rate < 100) {
          statCompareHtml += `<div>发动几率: <b style="color:#f472b6;">${currentProps.rate}%</b> ${isMax ? '' : `<span class="val-ok">➜ ${nextProps.rate}%</span>`}</div>`;
        }

        const canAfford = (this.state.resources.copper || 0) >= nextCost;

        card.innerHTML = `
          <div>
            <div class="card-row--split" style="margin-bottom:6px">
              <span style="font-weight:bold; color:#fbbf24; font-size:15px;">${tac.name}</span>
              <div style="display:flex; gap:4px; align-items:center;">
                <span class="tactic-type-tag ${typeClass}">${typeMap[tac.type] || tac.type}</span>
                ${dmgBadgeHtml}
                <span style="font-size:11px; font-weight:bold; color:${tac.quality==='S'?'#fbbf24':'#c084fc'}; border:1px solid currentColor; padding:1px 4px; border-radius:3px;">${tac.quality}级</span>
              </div>
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-bottom:8px; line-height:1.4;">${tac.desc}</div>

            <!-- 等级进度条 -->
            <div class="card-row--split" style="font-size:12px">
              <span style="font-weight:bold; color:${isMax?'#f59e0b':'#38bdf8'}; font-size:13px;">
                ${isMax ? '👑 臻至化境 Lv.10 MAX' : `研习进度: Lv.${currentLvl} / ${MAX_TACTIC_LEVEL}`}
              </span>
              <span style="color:#9ca3af; font-size:11px;">${pct}%</span>
            </div>
            <div class="tactic-level-track">
              <div class="tactic-level-progress" style="width: ${pct}%;"></div>
            </div>

            <!-- 升级效果增益对比 -->
            <div style="background:rgba(0,0,0,0.3); border:1px solid #374151; border-radius:6px; padding:6px 10px; font-size:11px; margin-bottom:10px; display:flex; flex-direction:column; gap:2px;">
              ${statCompareHtml || '<div class="val-muted">持续战术生效中，属性随等级提升</div>'}
            </div>
          </div>

          <div>
            ${isMax ? `
              <button class="upgrade-btn" style="width:100%; background:linear-gradient(135deg, #d97706 0%, #78350f 100%); cursor:default; font-size:12px; padding:6px 0;" disabled>
                👑 已达巅峰满级 MAX
              </button>
            ` : `
              <button class="upgrade-btn btn-upgrade-tactic" data-id="${tac.id}" style="width:100%; font-size:12px; padding:6px 0; background:${canAfford?'linear-gradient(135deg, #059669 0%, #047857 100%)':'#4b5563'};" ${canAfford?'':'title="铜币不足，可通过遣散武将或战役赚取"'}>
                🪙 消耗 ${nextCost.toLocaleString()} 铜币 强化至 Lv.${currentLvl + 1}
              </button>
            `}
          </div>
        `;

        if (!isMax) {
          card.querySelector('.btn-upgrade-tactic').addEventListener('click', () => {
            this.upgradeTactic(tac.id);
          });
        }
      } else {
        // ========== 2. 未解锁战法：展示谱系来源与一键传承转化 ==========
        card.className = 'tactic-upgrade-card locked';

        // 查找背包中是否拥有满足该战法传承条件的闲置武将
        const matchedHero = this.state.ownedGenerals.find(g => 
          sourceNames.includes(g.name) && !currentTroopHeroIds.has(g.id)
        );

        card.innerHTML = `
          <div>
            <div class="card-row--split" style="margin-bottom:6px">
              <span style="font-weight:bold; color:#9ca3af; font-size:15px;">🔒 ${tac.name}</span>
              <div style="display:flex; gap:4px; align-items:center;">
                <span class="tactic-type-tag ${typeClass}">${typeMap[tac.type] || tac.type}</span>
                ${dmgBadgeHtml}
                <span style="font-size:11px; font-weight:bold; color:#6b7280; border:1px solid currentColor; padding:1px 4px; border-radius:3px;">${tac.quality}级</span>
              </div>
            </div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:10px; line-height:1.4;">${tac.desc}</div>

            <div style="background:rgba(0,0,0,0.4); border:1px dashed #4b5563; border-radius:6px; padding:8px 10px; font-size:11px; margin-bottom:12px;">
              <div style="color:#d8b4fe; font-weight:bold; margin-bottom:3px;">📖 传承来源武将：</div>
              <div style="color:#e5e7eb;">【${sourceNames.join('】、【')}】</div>
              <div class="card-note card-note--tight">献祭 1 位对应闲置武将即可领悟传承该战法！</div>
            </div>
          </div>

          <div>
            ${matchedHero ? `
              <button class="upgrade-btn btn-instant-inherit" style="width:100%; font-size:12px; padding:6px 0; background:linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);">
                📖 消耗【${matchedHero.name}】立即传承转化
              </button>
            ` : `
              <button class="upgrade-btn btn-go-gacha-tip" style="width:100%; font-size:11px; padding:6px 0; background:#374151; color:#d1d5db;">
                🏮 前往拜将台招募对应武将
              </button>
            `}
          </div>
        `;

        if (matchedHero) {
          card.querySelector('.btn-instant-inherit').addEventListener('click', () => {
            this.inheritTacticFromHero(matchedHero);
          });
        } else {
          card.querySelector('.btn-go-gacha-tip').addEventListener('click', () => {
            this.switchTab('tabGacha');
            sound.playDrum();
          });
        }
      }

      this.tacticsUpgradeContainer.appendChild(card);
    });
  }

  // 强化战法
  upgradeTactic(tId) {
    if (!this.state.tacticLevels) this.state.tacticLevels = {};
    const currentLvl = this.state.tacticLevels[tId] || 1;
    if (currentLvl >= MAX_TACTIC_LEVEL) return;

    const cost = TACTIC_UPGRADE_COSTS[currentLvl] || 26000;
    const currentCopper = this.state.resources.copper || 0;

    if (currentCopper < cost) {
      slgNotice({ title: '战法研习', body: `主公，您的铜币不足！\n升级该战法需要 🪙 ${cost.toLocaleString()} 铜币，当前拥有 🪙 ${currentCopper.toLocaleString()} 铜币。\n您可在【麾下名将】中一键解甲闲置3星武将，或通过通关历史战役获取丰厚铜币！`, seal: '🪙', type: 'warn' });
      return;
    }

    this.state.resources.copper -= cost;
    this.state.tacticLevels[tId] = currentLvl + 1;

    sound.playVictoryHorn();
    this.save();
    this.renderHUD();
    this.renderTacticsUpgrade();
    this.renderGenerals();
  }

  // ================= 4. 金铢钱庄 · 模拟充值系统 (始终双倍金珠) =================
  openRechargeModal() {
    const modal = document.getElementById('rechargeModal');
    if (!modal) return;
    this.renderRechargeModal();
    modal.style.display = 'flex';
    sound.playDrum();
  }

  closeRechargeModal() {
    const modal = document.getElementById('rechargeModal');
    if (modal) modal.style.display = 'none';
  }

  renderRechargeModal() {
    if (!this.state.rechargeStats) {
      this.state.rechargeStats = { totalMoney: 0, totalGold: 0, count: 0, history: [] };
    }

    // 刷新统计看板数字
    const elMoney = document.getElementById('modalTotalRechargeMoney');
    const elGold = document.getElementById('modalTotalRechargeGold');
    const elBal = document.getElementById('modalCurrentGoldBalance');
    if (elMoney) elMoney.textContent = `¥${(this.state.rechargeStats.totalMoney || 0).toLocaleString()}`;
    if (elGold) elGold.textContent = (this.state.rechargeStats.totalGold || 0).toLocaleString();
    if (elBal) elBal.textContent = (this.state.resources.gold ?? 0).toLocaleString();

    // 渲染各充值档位卡片 (始终双倍到账)
    const container = document.getElementById('rechargeTiersContainer');
    if (container) {
      container.innerHTML = '';
      const tiers = [
        { id: 'tier_6', price: 6, baseGold: 60, title: '60 金珠', desc: '微光初绽 · 赠送体验', icon: '💰' },
        { id: 'tier_30', price: 30, baseGold: 300, title: '300 金珠', desc: '烽火初聚 · 畅快招募', icon: '💰' },
        { id: 'tier_68', price: 68, baseGold: 680, title: '680 金珠', desc: '将星璀璨 · 挥斥方遒', icon: '💎' },
        { id: 'tier_128', price: 128, baseGold: 1280, title: '1,280 金珠', desc: '雄姿英发 · 群英并起', icon: '💎' },
        { id: 'tier_328', price: 328, baseGold: 3280, title: '3,280 金珠', desc: '运筹帷幄 · 鼎足三分', icon: '👑' },
        { id: 'tier_648', price: 648, baseGold: 6480, title: '6,480 金珠', desc: '镇国玉玺 · 唯我独尊', icon: '👑', isPopular: true },
        { id: 'tier_1280', price: 1280, baseGold: 12800, title: '12,800 金珠', desc: '天下一统 · 至尊巨献', icon: '🌟' }
      ];

      tiers.forEach(tier => {
        const doubleBonus = tier.baseGold; // 始终双倍：买多少送多少
        const totalGet = tier.baseGold + doubleBonus;

        const card = document.createElement('div');
        card.className = `recharge-tier-card ${tier.isPopular ? 'popular' : ''}`;
        card.style.cssText = `
          background: ${tier.isPopular ? 'linear-gradient(145deg, #1f1a14 0%, #15110a 100%)' : '#141720'};
          border: 1px solid ${tier.isPopular ? '#d97706' : '#2d3340'};
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-shadow: ${tier.isPopular ? '0 0 12px rgba(217,119,6,0.3)' : 'none'};
        `;

        card.innerHTML = `
          <div>
            ${tier.isPopular ? '<div style="position:absolute; top:-9px; right:10px; background:#dc2626; color:#fff; font-size:10px; padding:1px 6px; border-radius:3px; font-weight:bold;">👑 镇国尊选</div>' : ''}
            <div class="card-row--split" style="margin-bottom:6px">
              <span style="font-size:22px;">${tier.icon}</span>
              <span style="font-size:11px; background:rgba(220,38,38,0.2); border:1px solid #dc2626; color:#fca5a5; padding:1px 6px; border-radius:3px; font-weight:bold;">
                🔥 始终双倍
              </span>
            </div>
            <div style="font-weight:bold; font-size:16px; color:#fbbf24;">${tier.title}</div>
            <div style="font-size:11px; color:#9ca3af; margin:3px 0 8px 0;">${tier.desc}</div>
            
            <div style="background:rgba(0,0,0,0.35); border-radius:6px; padding:6px 8px; font-size:11px; margin-bottom:10px;">
              <div style="color:#d1d5db;">基础金珠: <b>${tier.baseGold.toLocaleString()}</b></div>
              <div class="val-damage">双倍赠送: <b class="val-ok">+${doubleBonus.toLocaleString()}</b></div>
              <div style="color:#fde047; font-weight:bold; margin-top:2px; border-top:1px dashed #374151; padding-top:2px;">
                实际到账: <span style="font-size:13px; color:#fbbf24;">${totalGet.toLocaleString()}</span> 金珠
              </div>
            </div>
          </div>

          <button class="upgrade-btn btn-do-recharge" data-id="${tier.id}" style="width:100%; padding:6px 0; font-size:12px; font-weight:bold; background:${tier.isPopular ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)'}; cursor:pointer;">
            💳 模拟充值 ¥${tier.price}
          </button>
        `;

        card.querySelector('.btn-do-recharge').addEventListener('click', () => {
          this.executeRecharge(tier);
        });

        container.appendChild(card);
      });
    }

    // 渲染最近充值流水记录
    const historyList = document.getElementById('rechargeHistoryList');
    const historyCount = document.getElementById('rechargeHistoryCount');
    if (historyList) {
      const hist = this.state.rechargeStats.history || [];
      if (historyCount) historyCount.textContent = `共 ${hist.length} 笔记录`;

      if (hist.length === 0) {
        historyList.innerHTML = '<div style="color:#6b7280; text-align:center; padding:8px;">暂无充值记录，点击上方档位即可模拟充值</div>';
      } else {
        historyList.innerHTML = hist.slice(0, 5).map(item => `
          <div class="card-row--split" style="background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; border:1px solid #374151">
            <span class="val-muted">⏱️ ${item.time}</span>
            <span style="color:#e5e7eb;">模拟支付: <b class="val-ok">¥${item.price}</b></span>
            <span style="color:#fbbf24; font-weight:bold;">到账 +${item.gold.toLocaleString()} 金珠</span>
          </div>
        `).join('');
      }
    }
  }

  executeRecharge(tier) {
    if (!this.state.rechargeStats) {
      this.state.rechargeStats = { totalMoney: 0, totalGold: 0, count: 0, history: [] };
    }

    const doubleBonus = tier.baseGold;
    const totalGet = tier.baseGold + doubleBonus;

    // 充值金额与到账金珠累计
    this.state.rechargeStats.totalMoney = (this.state.rechargeStats.totalMoney || 0) + tier.price;
    this.state.rechargeStats.totalGold = (this.state.rechargeStats.totalGold || 0) + totalGet;
    this.state.rechargeStats.count = (this.state.rechargeStats.count || 0) + 1;

    // 当前账户金珠真实增加
    this.state.resources.gold = (this.state.resources.gold || 0) + totalGet;

    // 记录流水历史
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    this.state.rechargeStats.history.unshift({
      time: timeStr,
      price: tier.price,
      gold: totalGet,
      tierName: tier.title
    });
    if (this.state.rechargeStats.history.length > 30) {
      this.state.rechargeStats.history.pop();
    }

    sound.playGoldChime();
    this.renderHUD();
    this.renderRechargeModal();
    this.save();

    slgNotice({ title: '充值到账', body: `🎉【模拟充值到账】\n\n主公，已成功模拟支付 ¥${tier.price} 元！\n始终双倍特权生效：获得 ${tier.baseGold.toLocaleString()} + ${doubleBonus.toLocaleString()}(双倍赠送) = ${totalGet.toLocaleString()} 金珠！\n\n当前金珠余额：${this.state.resources.gold.toLocaleString()} 金珠`, seal: '💰', type: 'ok' });
  }

  doGacha(poolType, count) {
    const isFamous = (poolType === 'famous');
    const isFastBatch = (count >= 50);
    let cost = 0;
    if (isFamous) {
      if (count === 1) cost = GACHA_CONFIG.goldSingleCost;
      else if (count === 5) cost = GACHA_CONFIG.goldFiveCost;
      else if (count === 10) cost = GACHA_CONFIG.goldTenCost;
      else if (count === 50) cost = GACHA_CONFIG.goldFiftyCost;
      else if (count === 100) cost = GACHA_CONFIG.goldHundredCost;
      else cost = count * GACHA_CONFIG.goldSingleCost;
    } else {
      if (count === 1) cost = GACHA_CONFIG.copperSingleCost;
      else if (count === 10) cost = GACHA_CONFIG.copperTenCost;
      else if (count === 50) cost = GACHA_CONFIG.copperFiftyCost;
      else if (count === 100) cost = GACHA_CONFIG.copperHundredCost;
      else cost = count * GACHA_CONFIG.copperSingleCost;
    }

    // 严谨校验与扣减资源 (关闭无限金珠)
    if (isFamous) {
      const curGold = this.state.resources.gold || 0;
      if (curGold < cost) {
        sound.playDrum();
        slgNotice({
          title: '金铢不足',
          body: `⚠️ 招募 ${count} 次需要 ${cost.toLocaleString()} 金铢，当前拥有 ${curGold.toLocaleString()} 金铢。\n是否立即前往【金铢钱庄】模拟充值？(享受始终双倍金珠)`,
          seal: '⚠️',
          type: 'danger',
          okText: '前往充值',
          cancelText: '再思',
          onConfirm: () => { this.openRechargeModal(); }
        });
        return;
      }
      this.state.resources.gold -= cost;
    } else {
      const curCopper = this.state.resources.copper || 0;
      if (curCopper < cost) {
        sound.playDrum();
        slgNotice({ title: '良将招募', body: `⚠️ 铜币不足！良将招募 ${count} 次需要 ${cost.toLocaleString()} 铜币，当前拥有 ${curCopper.toLocaleString()} 铜币。\n可通过转化闲置武将或通关战役获取铜币！`, seal: '⚠️', type: 'warn' });
        return;
      }
      this.state.resources.copper -= cost;
    }

    // 清理上一轮未完成的自动翻牌定时器
    if (this.gachaAutoFlipTimers && this.gachaAutoFlipTimers.length > 0) {
      this.gachaAutoFlipTimers.forEach(tid => clearTimeout(tid));
      this.gachaAutoFlipTimers = [];
    }

    const pulledCards = [];
    const autoConvert3 = this.state.gachaAutoConvert?.star3 !== false;
    const autoConvert4 = !!this.state.gachaAutoConvert?.star4;
    const copperPerThreeStar = GACHA_CONFIG.threeStarCopperValue || 300;
    const copperPerFourStar = GACHA_CONFIG.fourStarCopperValue || 1000;
    let fiveStarCount = 0;
    let coreStarCount = 0;
    let fourStarCount = 0;
    let threeStarCount = 0;
    let convertedThreeStarCount = 0;
    let convertedFourStarCount = 0;

    for (let i = 0; i < count; i++) {
      this.state.totalGachaCount = (this.state.totalGachaCount || 0) + 1;
      const pityFive = this.state.gachaPity || 0;
      const pityFour = this.state.gachaFourPity || 0;
      const pityCore = this.state.gachaCorePity || 0;
      const res = pullGeneral(poolType, pityFive, pityFour, pityCore);

      if (isFamous) {
        if (res.general.star >= 5) {
          this.state.totalFiveStarCount = (this.state.totalFiveStarCount || 0) + 1;
          if (res.isCore) {
            this.state.totalCoreCount = (this.state.totalCoreCount || 0) + 1;
            this.state.gachaCorePity = 0; // 获得大核心名将，7+1暗保底计数清零
          } else {
            this.state.gachaCorePity = pityCore + 1; // 获得普通5星，连续普通橙计数+1 (满7张后第8张必出大核心)
          }
        }

        if (res.resetFivePity) {
          this.state.gachaPity = 0;
        } else {
          this.state.gachaPity = pityFive + 1;
        }

        if (res.resetFourPity) {
          this.state.gachaFourPity = 0;
        } else {
          this.state.gachaFourPity = pityFour + 1;
        }
      }

      if (res.general.star <= 3) {
        threeStarCount++;
        if (autoConvert3) {
          // ♻️ 勾选了自动转化 3★：自动转换为 300 铜币，不进入武将背包
          convertedThreeStarCount++;
          pulledCards.push({
            ...res.general,
            autoConvertedCopper: copperPerThreeStar
          });
        } else {
          // 未勾选自动转化 3★：正常生成 3★ 武将实例入库
          const instanceId = `${res.general.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const newHeroInstance = {
            ...res.general,
            id: instanceId,
            templateId: res.general.id,
            level: 1,
            exp: 0,
            currentSoldiers: 1000,
            maxSoldiers: 1000,
            equippedTactic1: null,
            equippedTactic2: null
          };
          this.state.ownedGenerals.push(newHeroInstance);
          pulledCards.push(newHeroInstance);
        }
      } else if (res.general.star === 4) {
        fourStarCount++;
        if (autoConvert4) {
          // ♻️ 勾选了自动转化 4★：自动转换为 1,000 铜币，不进入武将背包
          convertedFourStarCount++;
          pulledCards.push({
            ...res.general,
            autoConvertedCopper: copperPerFourStar
          });
        } else {
          // 未勾选自动转化 4★：正常生成 4★ 良将实例入库
          const instanceId = `${res.general.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const newHeroInstance = {
            ...res.general,
            id: instanceId,
            templateId: res.general.id,
            level: 5,
            exp: 0,
            currentSoldiers: 1000,
            maxSoldiers: 1000,
            equippedTactic1: null,
            equippedTactic2: null
          };
          this.state.ownedGenerals.push(newHeroInstance);
          pulledCards.push(newHeroInstance);
        }
      } else {
        fiveStarCount++;
        if (res.isCore) coreStarCount++;

        const instanceId = `${res.general.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newHeroInstance = {
          ...res.general,
          id: instanceId,
          templateId: res.general.id,
          level: 10,
          exp: 0,
          currentSoldiers: 2000,
          maxSoldiers: 2000,
          equippedTactic1: null,
          equippedTactic2: null
        };
        this.state.ownedGenerals.push(newHeroInstance);
        pulledCards.push(newHeroInstance);
      }
    }

    // 结算自动转化的铜币总额 (3★ + 4★)
    const convertedCopper3 = convertedThreeStarCount * copperPerThreeStar;
    const convertedCopper4 = convertedFourStarCount * copperPerFourStar;
    const convertedCopperTotal = convertedCopper3 + convertedCopper4;
    if (convertedCopperTotal > 0) {
      this.state.resources.copper = (this.state.resources.copper || 0) + convertedCopperTotal;
    }

    // 判定本次抽卡最高品质（出金 / 出紫）
    const hasFiveStar = (fiveStarCount > 0);
    const hasFourStar = (fourStarCount > 0);

    // 播放专属音效与视听反馈
    if (hasFiveStar) {
      sound.playGachaGold();
    } else if (hasFourStar) {
      sound.playGachaPurple();
    } else {
      sound.playGoldChime();
    }

    this.renderHUD();
    this.renderGenerals();
    this.save();

    // 调整开箱浮层整体氛围环境光（初始悬念状态）
    this.gachaShowcase.classList.remove('has-gold', 'has-purple');
    if (this.gachaShowcaseTitle) {
      this.gachaShowcaseTitle.className = 'gacha-title-banner';
      this.gachaShowcaseTitle.innerHTML = isFastBatch
        ? `⚡ 极速招募 ${count} 连抽 · 紫橙名将检阅`
        : '🎴 天命所归 · 点击翻开名将令';
    }

    // 50抽 / 100抽仅展示抽出来的紫卡(4★)和橙卡(5★)，并按 5★大核心 -> 5★普通 -> 4★良将 排序
    const displayCards = isFastBatch
      ? pulledCards
          .filter(c => c.star >= 4)
          .sort((a, b) => {
            if (b.star !== a.star) return b.star - a.star;
            if ((b.isCore ? 1 : 0) !== (a.isCore ? 1 : 0)) return (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0);
            return (b.cost || 0) - (a.cost || 0);
          })
      : pulledCards;

    // 渲染顶部战果汇总与 3★ / 4★ 自动转铜币提示栏
    if (this.gachaSummaryBar) {
      if (isFastBatch || threeStarCount > 0 || convertedFourStarCount > 0) {
        const fourConvertHint = fourStarCount > 0
          ? (autoConvert4 ? `（已自动转为 🪙 <b>+${convertedCopper4.toLocaleString()}</b> 铜币）` : '（已入库）')
          : '';
        const threeConvertHint = threeStarCount > 0
          ? (autoConvert3 ? `（已自动转为 🪙 <b>+${convertedCopper3.toLocaleString()}</b> 铜币）` : '（已入库）')
          : '';

        this.gachaSummaryBar.style.display = 'flex';
        this.gachaSummaryBar.innerHTML = `
          <div class="gacha-summary-stats">
            <span class="summary-chip chip-total">📊 招募 <b>${count}</b> 次</span>
            ${isFastBatch || fiveStarCount > 0 ? `<span class="summary-chip chip-five">🌟 5★橙卡: <b>${fiveStarCount}</b> 张${coreStarCount > 0 ? ` <em>(👑核心 ${coreStarCount})</em>` : ''}</span>` : ''}
            ${isFastBatch || fourStarCount > 0 ? `<span class="summary-chip chip-four">💜 4★紫卡: <b>${fourStarCount}</b> 张${fourConvertHint}</span>` : ''}
            <span class="summary-chip chip-three">♻️ 3★三星卡: <b>${threeStarCount}</b> 张${threeConvertHint}</span>
          </div>
          ${displayCards.length > 1 ? `
            <button type="button" class="gacha-fast-flip-btn" id="btnGachaFlipAll">⚡ 一键全翻</button>
          ` : ''}
        `;
      } else {
        this.gachaSummaryBar.style.display = 'none';
        this.gachaSummaryBar.innerHTML = '';
      }
    }

    // 弹出开箱展示，先展示神秘虎符卡背，支持手动点击翻牌或按序自动翻开
    this.gachaCardsContainer.innerHTML = '';
    // 重抽时先清掉上一轮残留粒子，否则新旧爆发会叠加在同一帧
    goldFX.clear();

    // 若 50/100 抽未抽出紫卡或橙卡（如铜币池全为3星），展示专属的3星结算卡
    if (isFastBatch && displayCards.length === 0) {
      this.gachaCardsContainer.innerHTML = `
        <div class="gacha-three-star-summary-card">
          <div style="font-size:48px; margin-bottom:8px;">🪙</div>
          <div style="font-size:17px; font-weight:900; color:#fbbf24;">本次 ${count} 连抽共获得 3★ 三星卡 ${threeStarCount} 张</div>
          <div style="font-size:13px; color:#94a3b8; margin-top:4px;">未产出 4★ 紫卡或 5★ 橙卡</div>
          <div style="margin-top:12px; padding:8px 16px; background:rgba(16,185,129,0.15); border:1px solid #10b981; border-radius:8px; color:#34d399; font-weight:800; font-size:14px;">
            ${autoConvert3
              ? `♻️ 全部 ${threeStarCount} 张三星卡已自动转化为 +${convertedCopper3.toLocaleString()} 铜币！`
              : `🎴 全部 ${threeStarCount} 张三星卡已收入麾下武将库！`}
          </div>
        </div>
      `;
      this.gachaShowcase.style.display = 'flex';
      return;
    }

    // 跟踪已翻牌状态
    const cardElements = [];

    displayCards.forEach((c, idx) => {
      const isFive = (c.star >= 5);
      const isCore = c.isCore;
      const isFour = (c.star === 4);
      const qualityClass = isFive ? 'gacha-card-gold' : (isFour ? 'gacha-card-purple' : '');

      const wrapper = document.createElement('div');
      wrapper.className = 'gacha-card-wrapper gacha-anim-card';
      wrapper.style.animationDelay = isFastBatch ? `${Math.min(idx * 0.025, 0.5)}s` : `${idx * 0.1}s`;

      const campInfo = CAMPS[c.camp] || { color: '#888', badge: '群' };
      const starStr = isFive ? '★★★★★' : (isFour ? '★★★★' : '★★★');
      const starClass = isFive ? 'color:#fbbf24; text-shadow:0 0 8px rgba(251,191,36,0.8);' : (isFour ? 'color:#c084fc; text-shadow:0 0 6px rgba(192,132,252,0.6);' : 'color:#9ca3af;');

      // ★ 仪式感特效元素：仅 4/5 星卡牌才注入，3 星卡保持朴素
      const SPARKLE_COUNT = isFastBatch ? 32 : 56;
      let sparkleHtml = '';
      if (isFive) {
        const bits = [];
        for (let i = 0; i < SPARKLE_COUNT; i++) {
          const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const dist = 70 + Math.random() * 130;
          const tx = Math.cos(angle) * dist;
          const ty = Math.abs(Math.sin(angle)) * dist * 0.55 + dist * 0.42 + Math.random() * 30;
          const delay = (Math.random() * 0.3).toFixed(3);
          const dur = (0.9 + Math.random() * 0.7).toFixed(2);
          const isBig = i % 4 === 0;
          const size = isBig ? 5 + Math.random() * 4 : 2 + Math.random() * 2.2;
          const sway = (Math.random() - 0.5) * 46;
          bits.push(
            `<div class="gacha-sparkle${isBig ? ' big' : ''}" style="--tx:${tx.toFixed(1)}px;--ty:${ty.toFixed(1)}px;--sway:${sway.toFixed(1)}px;--delay:${delay}s;--dur:${dur}s;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;"></div>`
          );
        }
        sparkleHtml = bits.join('');
      }

      const fxHtml = (isFive || isFour) ? `
        <div class="gacha-burst-ring${isFour ? ' purple' : ''}"></div>
        <div class="gacha-burst-ring ring-outer${isFour ? ' purple' : ''}"></div>
        ${isFive ? '<div class="gacha-flash-white"></div><div class="gacha-bloom"></div><div class="gacha-rays"></div>' + sparkleHtml : ''}
        ${isFive && isCore ? '<div class="gacha-core-banner">霸 业 名 将</div>' : ''}
      ` : '';

      wrapper.innerHTML = `
        <div class="gacha-card-inner">
          <!-- 🎴 背面：神秘古风虎符卡背 -->
          <div class="gacha-card-face card-back">
            <div class="card-back-emblem">🐯</div>
            <div class="card-back-title">英雄令</div>
            <div class="card-back-hint">点击翻开</div>
          </div>
          <!-- 🎴 正面：名将真容全息卡牌（全画幅竖版立绘） -->
          <div class="gacha-card-face card-front general-card ${qualityClass}">
            <div class="card-header gacha-front-header">
              <span class="camp-tag" style="background:${campInfo.color};">${campInfo.badge}</span>
              <span class="cost-badge">${c.cost}御</span>
            </div>
            <div class="avatar-box gacha-front-portrait">
              ${getGeneralAvatarHtml(c, { fontSize: '56px' })}
            </div>
            <div class="gacha-front-footer">
              <div class="stars-row" style="${starClass} font-size:13px; letter-spacing:2px; line-height:1;">${starStr}</div>
              <div class="hero-name">${c.name}</div>
              ${c.autoConvertedCopper ? `
                <div class="gacha-copper-badge">
                  🪙 已转 +${c.autoConvertedCopper} 铜币
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        ${fxHtml}
      `;

      // 翻开单张卡牌逻辑
      const flipCard = () => {
        if (wrapper.classList.contains('flipped')) {
          sound.playDrum();
          this.openHeroDetailModal(c);
          return;
        }
        wrapper.classList.add('flipped');
        sound.playCardFlip();

        if (isFive) {
          wrapper.classList.add('burst-five');
          if (isCore) wrapper.classList.add('burst-core');
          sound.playGoldBurst(isCore);

          requestAnimationFrame(() => {
            const rect = wrapper.getBoundingClientRect();
            if (!rect.width) return;
            goldFX.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { isCore });
          });

          this.gachaShowcase.classList.add('has-gold');
          if (this.gachaShowcaseTitle) {
            this.gachaShowcaseTitle.className = 'gacha-title-banner gold';
            this.gachaShowcaseTitle.innerHTML = isCore
              ? '👑 霸业既开 · 天命大核心名将降世！'
              : '🌟 华光万道 · 恭迎五星名将！';
          }

          setTimeout(() => {
            if (!wrapper.classList.contains('flipped')) return;
            sound.playGoldRay();
            const rect = wrapper.getBoundingClientRect();
            if (rect.width) {
              goldFX.shockwave(rect.left + rect.width / 2, rect.top + rect.height / 2, { isCore });
            }
          }, 180);

          setTimeout(() => {
            if (wrapper.classList.contains('flipped')) sound.playGoldSparkle();
          }, 300);

          setTimeout(() => {
            if (!wrapper.classList.contains('flipped')) return;
            sound.playScreenImpact(isCore);
            this.gachaShowcase.classList.add(isCore ? 'shake-core' : 'shake');
            setTimeout(() => {
              this.gachaShowcase.classList.remove('shake', 'shake-core');
            }, isCore ? 780 : 520);
          }, 450);

        } else if (isFour) {
          wrapper.classList.add('burst-four');
          setTimeout(() => {
            if (!wrapper.classList.contains('flipped')) return;
            if (!isFastBatch) sound.playPurpleBurst();
            if (!this.gachaShowcase.classList.contains('has-gold')) {
              this.gachaShowcase.classList.add('has-purple');
              if (this.gachaShowcaseTitle && !this.gachaShowcaseTitle.classList.contains('gold')) {
                this.gachaShowcaseTitle.className = 'gacha-title-banner purple';
                this.gachaShowcaseTitle.innerHTML = '💜 紫气东来 · 恭获四星良将！';
              }
            }
          }, isFastBatch ? 80 : 280);
        }
      };

      // 绑定手动点击翻开
      wrapper.addEventListener('click', flipCard);

      this.gachaCardsContainer.appendChild(wrapper);
      cardElements.push({ wrapper, flipCard });
    });

    // 绑定“一键全翻”快捷按钮
    const btnFlipAll = document.getElementById('btnGachaFlipAll');
    if (btnFlipAll) {
      btnFlipAll.addEventListener('click', () => {
        if (this.gachaAutoFlipTimers && this.gachaAutoFlipTimers.length > 0) {
          this.gachaAutoFlipTimers.forEach(tid => clearTimeout(tid));
          this.gachaAutoFlipTimers = [];
        }
        cardElements.forEach(({ wrapper, flipCard }) => {
          if (!wrapper.classList.contains('flipped')) {
            flipCard();
          }
        });
      });
    }

    this.gachaShowcase.style.display = 'flex';
    goldFX.mount(this.gachaShowcase);

    // 自动掀牌编排：50/100抽采用极速节奏（5★间隔260ms，4★间隔45ms），常规抽卡保持沉浸仪式感
    let autoDelay = isFastBatch ? 260 : 550;
    displayCards.forEach((c, i) => {
      const item = cardElements[i];
      if (!item) return;
      const isFive = (c.star >= 5);
      const tid = setTimeout(() => {
        if (!item.wrapper.classList.contains('flipped')) {
          item.flipCard();
        }
      }, autoDelay);
      this.gachaAutoFlipTimers.push(tid);
      autoDelay += isFastBatch ? (isFive ? 280 : 45) : (isFive ? 1150 : 320);
    });
  }

  // ================= 4.1 名将招募全景武将池预览 =================
  openGachaPoolPreview() {
    if (!this.gachaPoolPreviewModal) return;
    this.gachaPoolPreviewModal.style.display = 'flex';
    this.renderGachaPoolPreviewCards();
  }

  renderGachaPoolPreviewCards() {
    if (!this.gachaPoolPreviewGrid) return;
    this.gachaPoolPreviewGrid.innerHTML = '';

    // 名将招募池包含所有 5 星名将与 4 星良将
    const famousPoolHeroes = GENERALS_DATA.filter(g => g.star === 5 || g.star === 4);

    // 更新顶部总数统计徽章
    const fiveCount = famousPoolHeroes.filter(g => g.star === 5).length;
    const fourCount = famousPoolHeroes.filter(g => g.star === 4).length;
    if (this.previewPoolTotalBadge) {
      this.previewPoolTotalBadge.innerHTML = `可抽取：5★名将 ${fiveCount}位 · 4★良将 ${fourCount}位`;
    }

    // 多维过滤
    const filtered = famousPoolHeroes.filter(hero => {
      // 阵营筛选
      if (this.poolPreviewFilter.camp !== 'all' && hero.camp !== this.poolPreviewFilter.camp) {
        return false;
      }
      // 品质筛选
      if (this.poolPreviewFilter.star === '5') {
        if (hero.star !== 5) return false;
      } else if (this.poolPreviewFilter.star === '4') {
        if (hero.star !== 4) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.gachaPoolPreviewGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #9ca3af; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 14px; font-weight: bold; color: #e5e7eb;">未找到符合筛选条件的名将</div>
        </div>
      `;
      return;
    }

    // 排序：5星优先按 Cost 与星级排序 -> 4星
    const sorted = [...filtered].sort((a, b) => {
      if (a.star !== b.star) return b.star - a.star;
      if (b.cost !== a.cost) return b.cost - a.cost;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

    sorted.forEach(hero => {
      const isFive = (hero.star === 5);
      const camp = CAMPS[hero.camp] || { name: '群', color: '#a855f7', badge: '群' };
      const starStr = isFive ? '★★★★★' : '★★★★';
      const starColor = isFive ? '#fbbf24' : '#c084fc';
      const cardClass = isFive ? 'is-five' : 'is-four';

      // 自带战法信息
      const builtInTac = TACTICS_MAP.get(hero.builtInTacticId);
      const tacName = builtInTac?.name || '自带绝技';
      const tacTypeMap = { active: '主动', passive: '被动', command: '指挥', assault: '突击' };
      const tacType = tacTypeMap[builtInTac?.type] || '战法';

      // 兵种适性简要
      const apts = hero.aptitude || {};
      const sApts = Object.entries(apts).filter(([k, v]) => v === 'S').map(([k]) => {
        const armNameMap = { cavalry: '骑S', shield: '盾S', bow: '弓S', spear: '枪S', siege: '器S' };
        return armNameMap[k] || k;
      }).join(' ');

      const card = document.createElement('div');
      card.className = `pool-preview-card ${cardClass}`;
      card.style.cursor = 'pointer';
      card.title = `点击查阅【${hero.name}】全息军略大立绘档案`;
      card.innerHTML = `
        <div class="card-row--split">
          <span style="background: ${camp.color}; color: #fff; font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px;">
            ${camp.badge} · ${camp.name}
          </span>
          <span style="font-size: 11px; font-weight: bold; color: #fbbf24;">${hero.cost}御</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; margin: 4px 0;">
          <div style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); overflow: hidden; flex-shrink: 0;">
            ${getGeneralAvatarHtml(hero, { size: 44, borderRadius: '8px', fontSize: '30px' })}
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: bold; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 4px;">
              <span>${hero.name}</span>
            </div>
            <div style="color: ${starColor}; font-size: 12px; letter-spacing: 1px; margin-top: 1px;">
              ${starStr}
            </div>
          </div>
        </div>

        <div class="card-row--split" style="font-size: 11px; color: #9ca3af; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 4px">
          <span>武:${hero.force} 智:${hero.intel}</span>
          <span>统:${hero.command} 速:${hero.speed}</span>
        </div>

        <div style="font-size: 10px; color: #34d399; font-weight: bold; margin-top: 2px;">
          适性: ${sApts || '综合均衡'}
        </div>

        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px;">
          <div class="card-row--split" style="color: ${isFive ? '#fbbf24' : '#c084fc'}; font-weight: bold">
            <span>${tacName}</span>
            <span style="font-size: 9px; padding: 0 4px; border-radius: 3px; background: ${isFive ? 'rgba(251,191,36,0.15)' : 'rgba(192,132,252,0.15)'}; color: ${isFive ? '#fbbf24' : '#c084fc'}; border: 1px solid ${isFive ? 'rgba(251,191,36,0.3)' : 'rgba(192,132,252,0.3)'};">${isFive ? '🌟 S级' : '💜 A级'} · ${tacType}</span>
          </div>
          <div style="font-size: 10px; color: #9ca3af; margin-top: 2px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${builtInTac?.desc || hero.bio}">
            ${builtInTac?.desc || hero.bio}
          </div>
        </div>

        <div style="text-align: right; font-size: 9px; color: #9ca3af; margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 3px;">
          点击查看军略档案 🎴
        </div>
      `;

      card.addEventListener('click', () => {
        sound.playDrum();
        this.openHeroDetailModal(hero);
      });

      this.gachaPoolPreviewGrid.appendChild(card);
    });
  }

  // ================= 5. 战报全书与推演详情 =================
  renderReports() {
    this.battleReportsList.innerHTML = '';
    if (this.state.battleReports.length === 0) {
      this.battleReportsList.innerHTML = `<div style="text-align:center; color:#6b7280; padding:40px 0;">暂无战报记录，请前往【征战】发起历史战役或演武试炼！</div>`;
      return;
    }

    this.state.battleReports.forEach(rep => {
      const el = document.createElement('div');
      el.style.background = '#181b22';
      el.style.border = `1px solid ${rep.isVictory ? '#059669' : '#dc2626'}`;
      el.style.borderRadius = '10px';
      el.style.padding = '14px 18px';
      el.style.display = 'flex';
      el.style.justifyContent = 'space-between';
      el.style.alignItems = 'center';

      const starStr = rep.stars ? '⭐'.repeat(rep.stars) : '';

      el.innerHTML = `
        <div>
          <div style="font-weight:bold; font-size:15px; color:${rep.isVictory?'#34d399':'#f87171'}; display:flex; align-items:center; gap:8px;">
            <span>${rep.isVictory ? '🎉 战役大捷' : '💀 战事惜败'} · ${rep.tileName}</span>
            <span>${starStr}</span>
          </div>
          <div style="font-size:12px; color:#9ca3af; margin-top:4px;">
            时间: ${rep.time} | 鏖战 ${rep.summary.rounds} 回合 | 我方战损: <b>${rep.summary.playerLosses}</b> 兵力
          </div>
        </div>
        <button class="upgrade-btn btn-view-report" style="padding:4px 12px; font-size:12px;">查看回放详报</button>
      `;

      el.querySelector('.btn-view-report').addEventListener('click', () => {
        this.openBattleDetailModal(rep);
      });

      this.battleReportsList.appendChild(el);
    });
  }

  openBattleDetailModal(rep) {
    const s = rep.summary;
    this.battleDetailTitle.textContent = `${rep.isVictory ? '🎉 战役大捷' : '💀 战事惜败'} · ${rep.tileName} (${rep.time})`;

    // ★ 出征/扫荡结算条：替代原先的原生 alert，把奖励与突破信息集中呈现
    const rewardBanner = rep.reward ? `
      <div class="battle-reward-banner ${rep.isVictory ? 'win' : 'lose'}">
        <div class="brb-title">${rep.reward.title}</div>
        <ul class="brb-lines">
          ${rep.reward.lines.map(l => `<li>${l}</li>`).join('')}
        </ul>
        ${rep.reward.extras && rep.reward.extras.length
          ? `<div class="brb-extras">${rep.reward.extras.map(e => `<div>${e}</div>`).join('')}</div>`
          : ''}
      </div>
    ` : '';

    const pArmObj = ARMS[s.playerArm] || { name: '主力', icon: '⚔️' };
    const eArmObj = ARMS[s.enemyArm] || { name: '守军', icon: '🛡️' };

    // 提取双方武将姓名集合，用于日志容错兼容高亮
    const pNames = new Set((s.playerHeroStats || []).map(h => h.name));
    const eNames = new Set((s.enemyHeroStats || []).map(h => h.name));

    // 格式化单阵营武将卡片列表
    const renderHeroList = (heroes, isPlayer) => {
      return (heroes || []).map(h => {
        const starStr = '★'.repeat(h.star || 4);
        const campObj = CAMPS[h.camp] || { name: '群', color: '#888' };
        
        // 战法徽章（S级橙金 / A级紫晶 / B级湛蓝）
        const tacticsHtml = (h.tactics || []).map((t, idx) => {
          const isInnate = (idx === 0);
          const q = isInnate
            ? ((h.star || 4) >= 5 ? 'S' : ((h.star || 4) === 4 ? 'A' : 'B'))
            : (t.quality || 'A');
          const qClass = q === 'S' ? 'q-s' : (q === 'B' ? 'q-b' : 'q-a');
          return `<span class="lineup-tac-badge ${qClass}" title="${t.desc || ''}">[${isInnate ? '自带' : '配'}] ${t.name} Lv.${t.level || 1}</span>`;
        }).join('');

        return `
          <div class="lineup-hero-item ${h.isLeader ? 'leader' : ''}">
            <div class="lineup-hero-main">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:28px; height:28px; border-radius:4px; overflow:hidden; flex-shrink:0;">
                  ${getGeneralAvatarHtml(h, { size: 28, borderRadius: '4px', fontSize: '18px' })}
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-weight:bold; font-size:13px; color:#fff;">${h.name}</span>
                    <span style="font-size:9px; background:${campObj.color}; color:#fff; border-radius:3px; padding:0 3px;">${campObj.name}</span>
                    ${h.isLeader ? '<span style="font-size:9px; background:#d97706; color:#fff; border-radius:3px; padding:0 3px;">主将</span>' : ''}
                  </div>
                  <div class="card-micro">${starStr}</div>
                </div>
              </div>
              <div style="text-align:right; font-size:11px;">
                <div style="color:${isPlayer ? '#34d399' : '#f87171'}; font-weight:bold;">余兵: ${h.remaining} / ${h.initial}</div>
                <div style="color:#9ca3af; font-size:10px;">造成伤害: <b class="battle-num-dmg val-danger">${h.damage || 0}</b> | 治疗: <b class="battle-num-heal" style="color:#10b981;">${h.heals || 0}</b></div>
              </div>
            </div>
            <div class="lineup-hero-tactics">
              ${tacticsHtml || '<span style="color:#6b7280; font-size:10px;">暂未装配传承战法</span>'}
            </div>
          </div>
        `;
      }).join('');
    };

    // 格式化日志，自动标注 [我军] 与 [敌军]，并将伤害数字置红、治疗数字置绿 (三战原版经典战报呈现)
    // 格式化日志，自动标注 [我军] 与 [敌军]，并将伤害数字置红、治疗数字置绿 (三战原版经典战报呈现)
    const formattedLogs = (rep.logs || []).map(l => {
      let txt = l.text || '';
      // 1. 若日志已自带原生阵营前缀（我军·XX 或 敌军·XX），直接正则转换为高亮标签
      txt = txt.replace(/【我军·([^】]+)】/g, '【<span class="tag-player">我军·$1</span>】');
      txt = txt.replace(/【敌军·([^】]+)】/g, '【<span class="tag-enemy">敌军·$1</span>】');

      // 2. 兼容历史旧日志中未带前缀的武将名字（仅在非重名或特定上下文中补充）
      pNames.forEach(name => {
        if (eNames.has(name)) return;
        txt = txt.replaceAll(`【${name}】`, `【<span class="tag-player">我军·${name}</span>】`);
      });
      eNames.forEach(name => {
        if (pNames.has(name)) return;
        txt = txt.replaceAll(`【${name}】`, `【<span class="tag-enemy">敌军·${name}</span>】`);
      });

      // 3. 🎯 三战原版战报核心：精准将【造成/受到/承受伤害数字】标记为鲜红色
      txt = txt.replace(/(造成|受到|承受|反弹|转移(?:至.*?承受)?)\s*(\d+)\s*(点(?:兵刃|谋略|溃逃|叛逃|火攻|水攻|稳定|致命|反弹)?伤害)/g, '$1 <span class="battle-num-dmg">-$2</span> $3');
      txt = txt.replace(/(造成了)\s*(\d+)\s*(点(?:兵刃|谋略)?伤害)/g, '$1 <span class="battle-num-dmg">-$2</span> $3');

      // 4. 🎯 三战原版战报核心：精准将【治疗/恢复兵力数字】标记为翡翠绿色
      txt = txt.replace(/(恢复(?:自身|友军|群体|兵力)?|治愈|急救)\s*(\d+)\s*(点兵力|点伤兵|点气血)/g, '$1 <span class="battle-num-heal">+$2</span> $3');

      // 5. 🎯 三战原版战报核心：对关键 Buff 状态添加专属彩色徽章标签
      txt = txt.replace(/【洞察】/g, '<span class="buff-badge buff-insight">洞察</span>');
      txt = txt.replace(/【先攻】/g, '<span class="buff-badge buff-first-strike">先攻</span>');
      txt = txt.replace(/【必中】/g, '<span class="buff-badge buff-true-strike">必中</span>');
      txt = txt.replace(/【连击】/g, '<span class="buff-badge buff-continuous">连击</span>');
      txt = txt.replace(/【抵御】/g, '<span class="buff-badge buff-shield">抵御</span>');
      txt = txt.replace(/【(?:金丹)?规避】/g, '<span class="buff-badge buff-evasion">规避</span>');
      txt = txt.replace(/【会心(?:暴击)?】/g, '<span class="buff-badge buff-crit">会心暴击</span>');
      txt = txt.replace(/【奇谋(?:暴击)?】/g, '<span class="buff-badge buff-tactical-crit">奇谋暴击</span>');

      // 负面减益 Debuff
      txt = txt.replace(/【震慑】/g, '<span class="buff-badge debuff-stun">震慑</span>');
      txt = txt.replace(/【计穷】/g, '<span class="buff-badge debuff-silence">计穷</span>');
      txt = txt.replace(/【缴械】/g, '<span class="buff-badge debuff-disarm">缴械</span>');
      txt = txt.replace(/【虚弱】/g, '<span class="buff-badge debuff-weakness">虚弱</span>');
      txt = txt.replace(/【混乱】/g, '<span class="buff-badge debuff-confused">混乱</span>');
      txt = txt.replace(/【灼烧】/g, '<span class="buff-badge debuff-burn">灼烧</span>');
      txt = txt.replace(/【水攻】/g, '<span class="buff-badge debuff-water">水攻</span>');
      txt = txt.replace(/【禁疗】/g, '<span class="buff-badge debuff-cannot-heal">禁疗</span>');

      // 6. 增减伤 / 易伤
      txt = txt.replace(/【增伤\+(\d+)%】/g, '<span class="buff-badge buff-dmg-boost">增伤 +$1%</span>');
      txt = txt.replace(/【减伤(\d+)%】/g, '<span class="buff-badge buff-dmg-reduce">减伤 $1%</span>');
      txt = txt.replace(/【易伤\+(\d+)%】/g, '<span class="buff-badge debuff-dmg-taken">易伤 +$1%</span>');
      txt = txt.replace(/【伤害-(\d+)%】/g, '<span class="buff-badge debuff-dmg-nerf">伤害 -$1%</span>');

      // 7. 分类判定用于快筛
      const isSkill = (l.type === 'skill' || l.meta?.isSkillCast || /发动主动战法|连携发动突击战法|磅礴释放|施展指挥战法|触发被动战法|兵种战法|蓄力准备/.test(txt));
      const isDmg = (l.type === 'action' || /造成.*?点.*?伤害/.test(txt) || /会心暴击|奇谋暴击/.test(txt));
      const isHeal = (l.type === 'heal' || /恢复|治愈|急救|自愈/.test(txt));
      const isControl = (l.type === 'debuff' || /计穷|缴械|震慑|虚弱|混乱/.test(txt));
      const isRound = (l.type === 'round-start');

      let cat = 'normal';
      if (isSkill) cat = 'skill';
      else if (isDmg) cat = 'damage';
      else if (isHeal) cat = 'heal';
      else if (isControl) cat = 'control';
      else if (isRound) cat = 'round';

      // 8. 战法释放渲染为醒目的大招横幅
      if (isSkill) {
        const isPlayer = l.meta?.actor?.isPlayer ?? (/我军/.test(txt) && !/敌军·.*?发动/.test(txt));
        const campClass = isPlayer ? 'player' : 'enemy';
        return `
          <div class="battle-log-item skill-banner ${campClass}" data-cat="skill">
            <span class="skill-banner-badge ${campClass}">⚡ 战法释放</span>
            <div style="flex:1;">${txt}</div>
          </div>
        `;
      }

      return `<div class="battle-log-item ${l.type}" data-cat="${cat}">${txt}</div>`;
    }).join('');

    this.battleDetailBody.innerHTML = `
      ${rewardBanner}
      <!-- 双方全息阵容对决看板 -->
      <div class="battle-lineup-container">
        <!-- 我方军团 -->
        <div class="lineup-team-card player">
          <div class="lineup-team-header">
            <span style="font-weight:bold; color:#34d399; font-size:13px;">🛡️ 我军出征阵容</span>
            <span style="font-size:11px; color:#9ca3af; background:#1f2937; border:1px solid #374151; padding:1px 6px; border-radius:4px;">
              ${pArmObj.icon} ${pArmObj.name}
            </span>
          </div>
          <div class="lineup-hero-row">
            ${renderHeroList(s.playerHeroStats, true)}
          </div>
          <div class="card-row--split" style="margin-top:auto; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; color:#9ca3af">
            <span>总兵力: <b class="val-ok">${s.playerInitialSoldiers}</b></span>
            <span>总战损: <b class="val-danger">-${s.playerLosses}</b></span>
          </div>
        </div>

        <!-- 战局胜负与回合判定 -->
        <div class="battle-vs-badge">
          <div style="font-size:22px; font-weight:900; color:${rep.isVictory ? '#34d399' : '#f87171'};">
            ${rep.isVictory ? '大捷' : '惜败'}
          </div>
          <div style="font-size:16px;">⚔️</div>
          <div style="font-size:10px; color:#fbbf24; background:rgba(251,191,36,0.1); border:1px solid #d97706; padding:2px 6px; border-radius:4px;">
            ${s.rounds} 回合
          </div>
          ${rep.stars ? `<div style="font-size:11px; color:#fde047;">${'⭐'.repeat(rep.stars)}</div>` : ''}
        </div>

        <!-- 敌方军团 -->
        <div class="lineup-team-card enemy">
          <div class="lineup-team-header">
            <span style="font-weight:bold; color:#f87171; font-size:13px;">🏯 敌军驻防守备</span>
            <span style="font-size:11px; color:#9ca3af; background:#1f2937; border:1px solid #374151; padding:1px 6px; border-radius:4px;">
              ${eArmObj.icon} ${eArmObj.name}
            </span>
          </div>
          <div class="lineup-hero-row">
            ${renderHeroList(s.enemyHeroStats, false)}
          </div>
          <div class="card-row--split" style="margin-top:auto; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; color:#9ca3af">
            <span>守备兵力: <b class="val-damage">${s.enemyInitialSoldiers}</b></span>
            <span>被歼灭: <b class="val-ok">-${s.enemyLosses}</b></span>
          </div>
        </div>
      </div>

      <!-- 标签切换：8回合推演日志 VS 战报数据统计 (三战原版经典双重视角) -->
      <div class="modal-tab-nav" style="display:flex; gap:8px; margin: 12px 0 8px 0; border-bottom:1px solid #374151; padding-bottom:6px;">
        <button class="modal-tab-btn active" id="btnModalTabLogs" style="padding:6px 14px; font-size:12px; font-weight:bold; cursor:pointer;">
          📜 8回合实战推演日志
        </button>
        <button class="modal-tab-btn" id="btnModalTabStats" style="padding:6px 14px; font-size:12px; font-weight:bold; cursor:pointer; color:#fbbf24; border:1px solid #d97706; background:rgba(217,119,6,0.15); border-radius:4px;">
          📊 对战数据统计 (原版战报)
        </button>
      </div>

      <!-- 1. 实战日志容器 (包含快筛工具栏) -->
      <div id="modalLogsSection" style="display:flex; flex-direction:column;">
        <div class="battle-log-filter-bar" id="battleLogFilterBar">
          <span style="font-size:11px; color:#9ca3af; margin-right:4px;">🔍 战报快筛:</span>
          <button class="log-filter-btn active" data-filter="all">📜 全部推演</button>
          <button class="log-filter-btn" data-filter="skill">⚡ 战法发动</button>
          <button class="log-filter-btn" data-filter="damage">💥 关键杀伤</button>
          <button class="log-filter-btn" data-filter="heal">🩹 兵力恢复</button>
          <button class="log-filter-btn" data-filter="control">⛓️ 状态控制</button>
        </div>
        <div id="modalLogsContainer" style="display:flex; flex-direction:column; gap:3px;">
          ${formattedLogs}
        </div>
      </div>

      <!-- 2. 对战数据统计全息容器 (默认隐藏) -->
      <div id="modalStatsContainer" style="display:none;" class="battle-stats-container">
        <!-- 动态由内部构建填充 -->
      </div>
    `;

    // ========== 构建对战统计看板内容 ==========
    const statsContainer = this.battleDetailBody.querySelector('#modalStatsContainer');
    if (statsContainer) {
      const allHeroStats = [...(s.playerHeroStats || []), ...(s.enemyHeroStats || [])];
      
      // 1. 计算全场 MVP 称号
      let topDmgHero = null;
      let topHealHero = null;
      let topTankHero = null;

      allHeroStats.forEach(h => {
        if (!topDmgHero || (h.damage || 0) > (topDmgHero.damage || 0)) topDmgHero = h;
        if (!topHealHero || (h.heals || 0) > (topHealHero.heals || 0)) topHealHero = h;
        if (!topTankHero || (h.losses || 0) > (topTankHero.losses || 0)) topTankHero = h;
      });

      const maxDmgInMatch = Math.max(1, ...(allHeroStats.map(h => h.damage || 0)));
      const maxHealInMatch = Math.max(1, ...(allHeroStats.map(h => h.heals || 0)));
      const maxLossInMatch = Math.max(1, ...(allHeroStats.map(h => h.losses || 0)));

      // 战法明细数据表格渲染器 (三战原版经典战报明细)
      const renderTacticRows = (tacticStats, heroTotalDmg, heroTotalHeal, heroStar) => {
        if (!tacticStats || tacticStats.length === 0) {
          return `<tr><td colspan="7" style="color:#6b7280; font-size:11px; padding:6px;">暂无战法释放数据</td></tr>`;
        }
        return tacticStats.map(ts => {
          let typeName = '主动';
          let typeClass = 'active';
          if (ts.type === 'normal') { typeName = '普攻'; typeClass = 'normal'; }
          else if (ts.type === 'assault') { typeName = '突击'; typeClass = 'assault'; }
          else if (ts.type === 'passive') { typeName = '被动'; typeClass = 'passive'; }
          else if (ts.type === 'command') { typeName = '指挥'; typeClass = 'command'; }
          else if (ts.type === 'formation') { typeName = '阵法'; typeClass = 'formation'; }
          else if (ts.type === 'arm') { typeName = '兵种'; typeClass = 'arm'; }

          const isNormal = (ts.id === 'normal_attack');
          const isInnate = ts.isInnate;
          const effQuality = isInnate
            ? ((heroStar || 4) >= 5 ? 'S' : ((heroStar || 4) === 4 ? 'A' : 'B'))
            : (ts.quality || 'A');
          const qColor = isNormal ? '#e5e7eb' : (effQuality === 'S' ? '#fbbf24' : (effQuality === 'B' ? '#60a5fa' : '#c084fc'));
          const badgePrefix = isNormal ? '普攻' : (isInnate ? '自带' : '传承');
          const badgeClass = isNormal ? 'normal' : `q-${effQuality.toLowerCase()}`;
          const dmgPct = (heroTotalDmg > 0 && ts.damage > 0) ? Math.min(100, Math.round((ts.damage / heroTotalDmg) * 100)) : 0;

          return `
            <tr>
              <td style="text-align:left; padding-left:8px;">
                <div style="display:flex; align-items:center; gap:4px;">
                  <span class="tac-badge-tag ${badgeClass}">[${badgePrefix}]</span>
                  <span style="font-weight:600; color:${qColor};">${ts.name}</span>
                </div>
              </td>
              <td><span class="tac-type-pill ${typeClass}">${typeName}</span></td>
              <td style="font-size:10px; font-weight:bold; color:${isNormal ? '#6b7280' : qColor};">${isNormal ? '-' : (effQuality + '级 · Lv.' + (ts.level || 1))}</td>
              <td><b style="color:#60a5fa; font-size:12px;">${ts.casts}</b> 次</td>
              <td><b style="color:#ef4444; font-size:12px;">${(ts.damage || 0).toLocaleString()}</b></td>
              <td><b style="color:#10b981; font-size:12px;">${(ts.heals || 0).toLocaleString()}</b></td>
              <td>
                <div style="display:flex; align-items:center; gap:4px; justify-content:center;">
                  <span style="font-size:10px; color:#9ca3af; min-width:24px;">${dmgPct}%</span>
                  <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${dmgPct}%;"></div></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      };

      // 渲染单支队伍的武将数据行 (含战法明细面板)
      const renderTeamStatsRows = (heroList, isPlayer) => {
        return (heroList || []).map(h => {
          const campObj = CAMPS[h.camp] || { name: '群', color: '#888' };
          const dmgPct = Math.min(100, Math.round(((h.damage || 0) / maxDmgInMatch) * 100));
          const healPct = Math.min(100, Math.round(((h.heals || 0) / maxHealInMatch) * 100));
          const lossPct = Math.min(100, Math.round(((h.losses || 0) / maxLossInMatch) * 100));

          const heroTacticsColored = (h.tactics || []).map((t, idx) => {
            const q = (idx === 0)
              ? ((h.star || 4) >= 5 ? 'S' : ((h.star || 4) === 4 ? 'A' : 'B'))
              : (t.quality || 'A');
            const c = q === 'S' ? '#fbbf24' : (q === 'B' ? '#60a5fa' : '#c084fc');
            return `<span style="color:${c}; font-weight:600;">${t.name}</span>`;
          }).join('<span style="color:#6b7280; margin:0 3px;">·</span>');

          return `
            <tr>
              <td style="min-width:140px;">
                <div class="stats-hero-col">
                  <span style="font-size:20px;">${h.avatar || '👤'}</span>
                  <div>
                    <div style="display:flex; align-items:center; gap:4px;">
                      <span style="font-weight:bold; color:#fff;">${h.name}</span>
                      <span style="font-size:9px; background:${campObj.color}; color:#fff; border-radius:2px; padding:0 3px;">${campObj.name}</span>
                      ${h.isLeader ? '<span style="font-size:9px; background:#d97706; color:#fff; border-radius:2px; padding:0 2px;">主</span>' : ''}
                    </div>
                    <div class="card-note card-note--tight">
                      ${heroTacticsColored}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-weight:bold; color:${h.remaining > 0 ? (isPlayer ? '#34d399' : '#f87171') : '#6b7280'};">
                  ${h.remaining} <span style="font-size:10px; color:#6b7280;">/ ${h.initial}</span>
                </div>
                <div class="card-note">战损 -${h.losses}</div>
              </td>
              <td style="min-width:110px;">
                <div style="font-weight:800; color:#ef4444; font-size:13px;">${(h.damage || 0).toLocaleString()}</div>
                <div class="stats-bar-track" title="全场输出占比: ${dmgPct}%">
                  <div class="stats-bar-fill damage" style="width: ${dmgPct}%;"></div>
                </div>
              </td>
              <td style="min-width:100px;">
                <div style="font-weight:800; color:#10b981; font-size:13px;">${(h.heals || 0).toLocaleString()}</div>
                <div class="stats-bar-track" title="全场治疗占比: ${healPct}%">
                  <div class="stats-bar-fill heal" style="width: ${healPct}%;"></div>
                </div>
              </td>
              <td style="min-width:100px;">
                <div style="font-weight:bold; color:#93c5fd; font-size:12px;">-${(h.losses || 0).toLocaleString()}</div>
                <div class="stats-bar-track" title="承伤战损占比: ${lossPct}%">
                  <div class="stats-bar-fill tank" style="width: ${lossPct}%;"></div>
                </div>
              </td>
            </tr>
            <tr class="tactic-detail-row">
              <td colspan="5" style="padding: 2px 8px 10px 8px;">
                <div class="tactic-breakdown-card">
                  <div class="tactic-breakdown-header">
                    <span>⚔️ 【${h.name}】战法释放与杀伤明细</span>
                    <span style="font-size:10px; color:#9ca3af; font-weight:normal;">普通攻击与各装配战法释放追踪</span>
                  </div>
                  <table class="tactic-mini-table">
                    <thead>
                      <tr>
                        <th style="text-align:left; padding-left:8px;">战法名称</th>
                        <th>机制类型</th>
                        <th>品质研习</th>
                        <th>释放次数</th>
                        <th>杀敌伤害</th>
                        <th>救援恢复</th>
                        <th>输出占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${renderTacticRows(h.tacticStats, h.damage, h.heals, h.star)}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      };

      statsContainer.innerHTML = `
        <!-- 全场巅峰荣耀 MVP 展板 -->
        <div class="battle-mvp-banner">
          <div class="mvp-badge-item">
            <span class="mvp-tag damage">🗡️ 全场输出之王</span>
            <span style="font-size:16px;">${topDmgHero?.avatar || '👤'}</span>
            <span style="font-weight:bold; color:#fff; font-size:13px;">${topDmgHero?.name || '无'}</span>
            <b style="color:#ef4444; font-size:13px;">(${(topDmgHero?.damage || 0).toLocaleString()} 杀伤)</b>
          </div>
          ${(topHealHero && topHealHero.heals > 0) ? `
            <div class="mvp-badge-item">
              <span class="mvp-tag heal">🩹 妙手回春先驱</span>
              <span style="font-size:16px;">${topHealHero.avatar || '👤'}</span>
              <span style="font-weight:bold; color:#fff; font-size:13px;">${topHealHero.name}</span>
              <b style="color:#10b981; font-size:13px;">(+${topHealHero.heals.toLocaleString()} 恢复)</b>
            </div>
          ` : ''}
          <div class="mvp-badge-item">
            <span class="mvp-tag tank">🛡️ 铁壁金汤承伤</span>
            <span style="font-size:16px;">${topTankHero?.avatar || '👤'}</span>
            <span style="font-weight:bold; color:#fff; font-size:13px;">${topTankHero?.name || '无'}</span>
            <b style="color:#93c5fd; font-size:13px;">(-${(topTankHero?.losses || 0).toLocaleString()} 承受)</b>
          </div>
        </div>

        <!-- 🛡️ 我军数据统计表格 -->
        <div class="stats-table-wrapper">
          <div class="stats-table-header player">
            <span>🛡️ 我军出征军团 · 数据统计 (${pArmObj.icon} ${pArmObj.name})</span>
            <span style="font-size:11px; font-weight:normal; color:#a7f3d0;">
              总输出: <b class="val-danger">${(s.playerHeroStats || []).reduce((sum, h) => sum + (h.damage || 0), 0).toLocaleString()}</b> | 总恢复: <b style="color:#10b981;">${(s.playerHeroStats || []).reduce((sum, h) => sum + (h.heals || 0), 0).toLocaleString()}</b>
            </span>
          </div>
          <table class="stats-grid-table">
            <thead>
              <tr>
                <th style="text-align:left; padding-left:12px;">参战名将与战法</th>
                <th>剩余/总兵力</th>
                <th>造成伤害</th>
                <th>恢复兵力</th>
                <th>承受战损</th>
              </tr>
            </thead>
            <tbody>
              ${renderTeamStatsRows(s.playerHeroStats, true)}
            </tbody>
          </table>
        </div>

        <!-- 🏯 敌军数据统计表格 -->
        <div class="stats-table-wrapper">
          <div class="stats-table-header enemy">
            <span>🏯 敌军守备军团 · 数据统计 (${eArmObj.icon} ${eArmObj.name})</span>
            <span style="font-size:11px; font-weight:normal; color:#fca5a5;">
              总输出: <b class="val-danger">${(s.enemyHeroStats || []).reduce((sum, h) => sum + (h.damage || 0), 0).toLocaleString()}</b> | 总恢复: <b style="color:#10b981;">${(s.enemyHeroStats || []).reduce((sum, h) => sum + (h.heals || 0), 0).toLocaleString()}</b>
            </span>
          </div>
          <table class="stats-grid-table">
            <thead>
              <tr>
                <th style="text-align:left; padding-left:12px;">守军将领与战法</th>
                <th>剩余/总兵力</th>
                <th>造成伤害</th>
                <th>恢复兵力</th>
                <th>承受战损</th>
              </tr>
            </thead>
            <tbody>
              ${renderTeamStatsRows(s.enemyHeroStats, false)}
            </tbody>
          </table>
        </div>
      `;
    }

    // 绑定【实战日志】与【对战统计】选项卡切换
    const btnLogs = this.battleDetailBody.querySelector('#btnModalTabLogs');
    const btnStats = this.battleDetailBody.querySelector('#btnModalTabStats');
    const logsSection = this.battleDetailBody.querySelector('#modalLogsSection');

    if (btnLogs && btnStats && logsSection && statsContainer) {
      btnLogs.addEventListener('click', () => {
        btnLogs.classList.add('active');
        btnLogs.style.background = '';
        btnLogs.style.color = '#fff';
        btnStats.classList.remove('active');
        btnStats.style.background = 'rgba(217,119,6,0.15)';
        logsSection.style.display = 'flex';
        statsContainer.style.display = 'none';
        sound.playDrum();
      });

      btnStats.addEventListener('click', () => {
        btnStats.classList.add('active');
        btnStats.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
        btnStats.style.color = '#fff';
        btnLogs.classList.remove('active');
        btnLogs.style.background = '#1f2937';
        btnLogs.style.color = '#9ca3af';
        logsSection.style.display = 'none';
        statsContainer.style.display = 'flex';
        sound.playDrum();
      });
    }

    // 绑定战报日志快筛功能
    const filterBtns = this.battleDetailBody.querySelectorAll('.log-filter-btn');
    const logItems = this.battleDetailBody.querySelectorAll('.battle-log-item');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filterType = btn.getAttribute('data-filter');
        logItems.forEach(item => {
          if (filterType === 'all') {
            item.style.display = '';
          } else if (filterType === 'skill') {
            item.style.display = (item.classList.contains('skill-banner') || item.getAttribute('data-cat') === 'skill') ? '' : 'none';
          } else {
            item.style.display = (item.getAttribute('data-cat') === filterType) ? '' : 'none';
          }
        });
        sound.playDrum();
      });
    });

    this.battleDetailModal.style.display = 'flex';
  }

  save() {
    saveGameState(this.state);
  }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameApp();
});

// ============================================================
// 古典轻提示 slgNotice —— 统一替代原生 alert / 简易 confirm
//   slgNotice('文本')
//   slgNotice({ title, body, seal, type, okText, cancelText, onConfirm, onCancel })
//   type: 'info'(默认) | 'ok' | 'warn' | 'danger'（仅影响标题氛围）
//   非阻塞：确定/取消通过回调 onConfirm / onCancel 返回
// ============================================================
function slgNotice(opts) {
  const mask = document.getElementById('slgNotice');
  if (!mask) return;
  const o = (typeof opts === 'string') ? { body: opts } : (opts || {});
  const titleEl = document.getElementById('slgNoticeTitle');
  const bodyEl = document.getElementById('slgNoticeBody');
  const sealEl = document.getElementById('slgNoticeSeal');
  const okBtn = document.getElementById('slgNoticeOk');
  const cancelBtn = document.getElementById('slgNoticeCancel');

  titleEl.textContent = o.title || '主公启奏';
  bodyEl.textContent = (o.body != null) ? String(o.body) : '';
  sealEl.textContent = o.seal || '📜';
  mask.dataset.type = o.type || 'info';
  okBtn.textContent = o.okText || '遵命';

  const hasCancel = !!o.onCancel || o.cancelText != null;
  if (hasCancel) {
    cancelBtn.style.display = '';
    cancelBtn.textContent = o.cancelText || '再思';
    cancelBtn.onclick = () => { mask.style.display = 'none'; if (o.onCancel) o.onCancel(); };
  } else {
    cancelBtn.style.display = 'none';
    cancelBtn.onclick = null;
  }
  okBtn.onclick = () => { mask.style.display = 'none'; if (o.onConfirm) o.onConfirm(); };

  mask.style.display = 'flex';
}
