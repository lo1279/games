/**
 * 三国志·战略版 - 主应用调度控制引擎 (App Controller - 路线B纯轻量战术卡牌模式)
 */

import { CAMPS, ARMS, GENERAL_APTITUDE_MODIFIERS, GENERALS_DATA, addGeneralExp, getExpRequiredForLevel, MAX_GENERAL_LEVEL } from './data/generals.js';
import { TACTICS_DATA, TACTIC_UPGRADE_COSTS, MAX_TACTIC_LEVEL, getTacticEffectiveProps, TACTIC_INHERIT_SOURCES, getHeroInheritTacticId } from './data/tactics.js';
import { CAMPAIGNS_DATA, TRIALS_DATA } from './data/campaigns.js';
import { simulateBattle } from './engine/battle.js';
import { GACHA_CONFIG, pullGeneral } from './engine/gacha.js';
import { sound } from './engine/audio.js';
import { loadGameState, saveGameState, resetGameState } from './engine/storage.js';
import { MAP_CONFIG, LAND_TIERS, RESOURCE_TYPES, isTileAdjacentToPlayer, calculateMarchMorale, createLandGuardTroop } from './engine/map.js';
import { BUILDINGS_CONFIG, hasEnoughResources, deductResources } from './engine/city.js';

const TACTICS_MAP = new Map(TACTICS_DATA.map(t => [t.id, t]));
const GENERALS_MAP = new Map(GENERALS_DATA.map(g => [g.id, g]));

class GameApp {
  constructor() {
    this.state = loadGameState();
    this.activeTab = 'tabMap'; // 默认沙盘开荒大地图
    this.battleSubTab = 'campaigns'; // 'campaigns' | 'trials'
    this.generalSubTab = 'generals'; // 'generals' | 'tactics'
    this.generalFilter = { camp: 'all', star: 'all' }; // 武将多维筛选状态
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
    this.gachaCardsContainer = document.getElementById('gachaCardsContainer');
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

    // 征战子选项卡切换 (历史战役 vs 演武试炼)
    const subTabCamp = document.getElementById('subTabCampaigns');
    const subTabTrial = document.getElementById('subTabTrials');
    if (subTabCamp && subTabTrial) {
      subTabCamp.addEventListener('click', () => {
        subTabCamp.classList.add('active');
        subTabTrial.classList.remove('active');
        this.campaignsContainer.style.display = 'flex';
        this.trialsContainer.style.display = 'none';
        this.battleSubTab = 'campaigns';
        sound.playDrum();
      });

      subTabTrial.addEventListener('click', () => {
        subTabTrial.classList.add('active');
        subTabCamp.classList.remove('active');
        this.campaignsContainer.style.display = 'none';
        this.trialsContainer.style.display = 'flex';
        this.battleSubTab = 'trials';
        sound.playDrum();
      });
    }

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

    // 确认并关闭抽卡开箱
    document.getElementById('btnGachaShowcaseConfirm').addEventListener('click', () => {
      this.gachaShowcase.style.display = 'none';
      this.renderGenerals();
      this.renderTroops();
      this.renderHUD();
    });

    // 清空战报历史
    document.getElementById('btnClearReports').addEventListener('click', () => {
      if (confirm('确认清空所有历史战报吗？')) {
        this.state.battleReports = [];
        this.renderReports();
        this.save();
      }
    });

    // 招募按钮绑定
    document.getElementById('btnGachaFamousSingle').addEventListener('click', () => this.doGacha('famous', 1));
    document.getElementById('btnGachaFamousFive').addEventListener('click', () => this.doGacha('famous', 5));
    document.getElementById('btnGachaCopperSingle').addEventListener('click', () => this.doGacha('copper', 1));
    document.getElementById('btnGachaCopperTen').addEventListener('click', () => this.doGacha('copper', 10));

    // 无限金铢特权按钮绑定
    const badgeGold = document.getElementById('badgeGold');
    if (badgeGold) {
      badgeGold.addEventListener('click', () => this.fillInfiniteGold());
    }
    const btnFillGoldMax = document.getElementById('btnFillGoldMax');
    if (btnFillGoldMax) {
      btnFillGoldMax.addEventListener('click', () => this.fillInfiniteGold());
    }

    // 重置存档按钮
    const btnResetGame = document.getElementById('btnResetGame');
    if (btnResetGame) {
      btnResetGame.addEventListener('click', () => {
        if (confirm('⚠️【重置开局确认】\n\n主公，确认清除当前所有战绩、麾下武将与战法研习进度吗？\n将重置为初始开局（赠送【关平(主将)+郭淮+张宝+韩当】经典良将开荒团、999,999 无限金铢及 20,000 启动铜币）！')) {
          this.state = resetGameState();
          this.activeTab = 'tabBattle';
          this.battleSubTab = 'campaigns';
          this.generalSubTab = 'generals';
          sound.playVictoryHorn();
          this.renderAll();
          alert('🔄 恭祝主公重振旗鼓！天下格局已重置，先锋开荒营已整装待发！');
        }
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
    // 地块操作弹窗关闭
    const btnTileModalClose = document.getElementById('btnTileModalClose');
    if (btnTileModalClose) {
      btnTileModalClose.addEventListener('click', () => {
        if (this.tileActionModal) this.tileActionModal.style.display = 'none';
      });
    }
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.tabPages.forEach(p => p.classList.toggle('active', p.id === tabId));
    this.navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
    if (tabId === 'tabMap') this.renderWorldMap();
    if (tabId === 'tabCity') this.renderCityBuildings();
    if (tabId === 'tabBattle') {
      this.renderCampaigns();
      this.renderTrials();
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
    this.renderHUD();
    this.renderWorldMap();
    this.renderCityBuildings();
    this.renderCampaigns();
    this.renderTrials();
    this.renderTroops();
    this.renderGenerals();
    this.renderTacticsUpgrade();
    this.renderReports();
  }

  renderHUD() {
    this.domRes.gold.textContent = (this.state.resources.gold || 999999).toLocaleString();
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

    // 城建状态横幅
    if (this.cityStatsBanner) {
      const palaceLvl = this.state.buildings?.palace || 1;
      const barracksLvl = this.state.buildings?.barracks || 0;
      this.cityStatsBanner.innerHTML = `部队统御上限: <b style="color:#fde047;">Cost ${14 + palaceLvl}</b> · 兵营加成: <b style="color:#6ee7b7;">+${barracksLvl * 300} 兵/将</b>`;
    }
  }

  // ================= 0. 沙盘大地图系统 (9x9 连地铺路、出征攻占、侦查与屯田) =================
  renderWorldMap() {
    if (!this.worldMapGrid) return;
    this.worldMapGrid.innerHTML = '';

    const tiles = this.state.mapTiles || [];

    tiles.forEach(tile => {
      const tileEl = document.createElement('div');
      tileEl.className = 'map-tile';
      if (tile.occupiedByPlayer) tileEl.classList.add('player-owned');
      if (tile.isMainCity) tileEl.classList.add('main-city');

      const resMeta = RESOURCE_TYPES[tile.resType] || { name: '荒地', icon: '🌾' };

      let innerHtml = '';
      if (tile.isMainCity) {
        innerHtml = `
          <div class="tile-icon" style="font-size:26px;">🏯</div>
          <div class="tile-name" style="color:#fbbf24; font-weight:bold;">主都(4,4)</div>
          <div class="tile-flag" style="background:#d97706;">王都</div>
        `;
      } else {
        const tierCfg = LAND_TIERS[tile.level] || LAND_TIERS[1];
        innerHtml = `
          <div class="tile-level">Lv.${tile.level}</div>
          <div class="tile-icon">${resMeta.icon}</div>
          <div class="tile-name">${resMeta.name}</div>
          ${tile.occupiedByPlayer ? '<div class="tile-flag">占领</div>' : ''}
        `;
      }

      tileEl.innerHTML = innerHtml;
      tileEl.addEventListener('click', () => {
        sound.playDrum();
        this.openTileActionModal(tile);
      });

      this.worldMapGrid.appendChild(tileEl);
    });
  }

  // 打开地块全息操作弹窗
  openTileActionModal(tile) {
    if (!this.tileActionModal) return;

    const isAdjacent = isTileAdjacentToPlayer(tile, this.state.mapTiles);
    const resMeta = RESOURCE_TYPES[tile.resType] || { name: '荒地', icon: '🌾' };
    const tierCfg = LAND_TIERS[tile.level] || LAND_TIERS[1];
    const marchInfo = calculateMarchMorale(MAP_CONFIG.mainCityPos, { x: tile.x, y: tile.y });
    const guardTroop = createLandGuardTroop(tile);
    const guardLeader = guardTroop.heroes[0];
    const guardArm = ARMS[guardTroop.arm] || { name: guardTroop.arm, icon: '⚔️' };

    this.tileModalTitle.innerHTML = tile.isMainCity 
      ? '🏯 洛阳王都 · 皇城中枢' 
      : `${resMeta.icon} ${LAND_TIERS[tile.level]?.name || '领地'} (${tile.x}, ${tile.y})`;

    let contentHtml = '';

    if (tile.isMainCity) {
      contentHtml = `
        <div style="background:rgba(251,191,36,0.1); border:1px solid #d97706; padding:12px; border-radius:8px;">
          <div style="font-weight:bold; color:#fbbf24; font-size:15px; margin-bottom:4px;">👑 您的中央王都行省</div>
          <div style="font-size:12px; color:#cbd5e1; line-height:1.5;">
            主城坐镇中原核心坐标 (4, 4)，掌控全境开荒铺路命脉。所有对外出征均从主都发兵！<br>
            可前往【主城】标签升级君王殿与兵营建筑。
          </div>
        </div>
      `;
    } else {
      const isPlayerOwned = tile.occupiedByPlayer;

      contentHtml = `
        <!-- 地块产出与状态信息 -->
        <div style="background:#11141a; border:1px solid #374151; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:14px; font-weight:bold; color:#fff;">
              ${tile.name} · <span style="color:#fbbf24;">Lv.${tile.level}级地</span>
            </div>
            <div style="font-size:12px; color:#9ca3af; margin-top:2px;">
              每小时产出: <b style="color:#6ee7b7;">+${tierCfg.prodPerHour}</b> ${resMeta.name} (${resMeta.icon})
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:${isPlayerOwned ? '#34d399' : '#f87171'}; font-weight:bold;">
              ${isPlayerOwned ? '🟩 我方领地' : (isAdjacent ? '⚡ 可直接出征' : '🔒 需相邻连地')}
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
              距主都: ${marchInfo.dist} 格 (士气: ${marchInfo.morale})
            </div>
          </div>
        </div>

        <!-- 守军军情侦查看板 -->
        <div style="background:#181b22; border:1px solid #374151; border-radius:8px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:13px; color:#f87171;">⚔️ 守军防御驻守情报</span>
            <span style="font-size:11px; color:#fbbf24; background:rgba(251,191,36,0.1); border:1px solid #d97706; padding:1px 6px; border-radius:4px;">
              ${tile.scouted ? '👁️ 已探明虚实' : '🌫️ 粗略探知'}
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:6px;">
            <div>
              <div style="font-size:13px; color:#fff; font-weight:bold;">
                守军首领: ${tile.scouted ? guardLeader.name : '未知守备 (侦查可现)'}
              </div>
              <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
                驻守兵种: <b style="color:#38bdf8;">${guardArm.icon} ${guardArm.name}</b> · 守备总兵力: <b style="color:#f87171;">${tierCfg.soldiers.toLocaleString()}</b>
              </div>
            </div>
            <div style="font-size:24px;">
              ${guardLeader.avatar}
            </div>
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div style="display:flex; gap:10px; margin-top:6px;">
          ${!isPlayerOwned ? `
            <button class="upgrade-btn" id="btnModalAttackTile" style="flex:1; background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding:8px; font-weight:bold; font-size:13px; ${!isAdjacent ? 'opacity:0.5;' : ''}">
              ⚔️ 发兵出征攻占
            </button>
            <button class="upgrade-btn" id="btnModalScoutTile" style="flex:1; background:#2563eb; padding:8px; font-size:13px;">
              🔍 派斥候侦查
            </button>
          ` : `
            <button class="upgrade-btn" id="btnModalFarmTile" style="flex:1; background:linear-gradient(135deg, #059669 0%, #047857 100%); padding:8px; font-size:13px;">
              🌾 屯田大丰收 (获3小时产出)
            </button>
            <button class="upgrade-btn" id="btnModalAbandonTile" style="flex:1; background:#4b5563; padding:8px; font-size:13px;">
              🏳️ 放弃该领地
            </button>
          `}
        </div>
      `;
    }

    this.tileModalBody.innerHTML = contentHtml;
    this.tileActionModal.style.display = 'flex';

    // 绑定出征攻打
    const btnAttack = document.getElementById('btnModalAttackTile');
    if (btnAttack) {
      btnAttack.addEventListener('click', () => {
        if (!isAdjacent) {
          alert('⚠️【铺路限制】SLG 核心规则：只能攻打与我方已占领地块（或主都）上下左右直接相邻的地块！');
          return;
        }
        this.tileActionModal.style.display = 'none';
        this.launchTileAttack(tile);
      });
    }

    // 绑定侦查
    const btnScout = document.getElementById('btnModalScoutTile');
    if (btnScout) {
      btnScout.addEventListener('click', () => {
        tile.scouted = true;
        sound.playDrum();
        alert(`🔍【斥候军报】探得情报：守将【${guardLeader.name}】，统领【${guardArm.name}】，兵力 ${tierCfg.soldiers}！请根据骑克盾、盾克弓、弓克枪、枪克骑调整兵种克制出战！`);
        this.openTileActionModal(tile);
        this.save();
      });
    }

    // 绑定屯田
    const btnFarm = document.getElementById('btnModalFarmTile');
    if (btnFarm) {
      btnFarm.addEventListener('click', () => {
        const harvest = tierCfg.prodPerHour * 3;
        const resKey = tile.resType;
        this.state.resources[resKey] = (this.state.resources[resKey] || 0) + harvest;
        sound.playVictoryHorn();
        alert(`🌾【屯田大丰收】主公下令军士开垦屯田，瞬间收获 3 小时储备！获得 ${resMeta.name} +${harvest.toLocaleString()}！`);
        this.tileActionModal.style.display = 'none';
        this.renderHUD();
        this.save();
      });
    }

    // 绑定放弃领地
    const btnAbandon = document.getElementById('btnModalAbandonTile');
    if (btnAbandon) {
      btnAbandon.addEventListener('click', () => {
        if (confirm(`确定要放弃该块 ${tile.name} 吗？放弃后不再享受该地资源产出。`)) {
          tile.occupiedByPlayer = false;
          tile.scouted = false;
          sound.playDrum();
          this.tileActionModal.style.display = 'none';
          this.renderWorldMap();
          this.renderHUD();
          this.save();
        }
      });
    }
  }

  // 发起沙盘攻占出征推演
  launchTileAttack(tile) {
    const playerTroop = this.state.troops[0];
    if (!playerTroop || playerTroop.heroes.length === 0) {
      alert('您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！');
      return;
    }

    sound.playDrum();

    // 守军与行军士气
    const guardTroop = createLandGuardTroop(tile);
    const marchInfo = calculateMarchMorale(MAP_CONFIG.mainCityPos, { x: tile.x, y: tile.y });

    // 执行 8 回合沙盘战斗推演 (代入行军士气与战法等级)
    const result = simulateBattle(playerTroop, guardTroop, {
      playerMorale: marchInfo.morale,
      tacticLevels: this.state.tacticLevels || {}
    });

    const isWin = (result.summary.winner === 'player');

    if (isWin) {
      sound.playVictoryHorn();
      tile.occupiedByPlayer = true;
      tile.scouted = true;

      // 攻占成功奖励
      const tierCfg = LAND_TIERS[tile.level] || LAND_TIERS[1];
      const copperReward = tile.level * 800;
      this.state.resources.copper = (this.state.resources.copper || 0) + copperReward;

      // 🌟 参战武将获得战斗历练经验 (依据土地等级与守军兵力计算)
      const baseExp = Math.round(tierCfg.soldiers * 0.8);
      const levelUpMessages = [];
      playerTroop.heroes.forEach(h => {
        // 同步更新 ownedGenerals 中的真实对象
        const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
        const res = addGeneralExp(realHero, baseExp);
        h.level = realHero.level;
        h.exp = realHero.exp;
        if (res.leveledUp) {
          levelUpMessages.push(`【${realHero.name}】晋升至 Lv.${res.newLevel} (带兵上限提升)！`);
        }
      });

      const levelUpStr = levelUpMessages.length > 0 ? `\n\n🌟 武将突破升级：\n${levelUpMessages.join('\n')}` : '';
      alert(`🎉【攻占大捷】恭贺主公！我军顺利攻克 ${tile.name} (Lv.${tile.level})！插上主公王旗！\n获得铜币 🪙 +${copperReward.toLocaleString()} · 参战武将历练经验 +${baseExp.toLocaleString()}${levelUpStr}`);
    } else {
      sound.playSwordClash();
      alert(`⚠️【出征失利】我军未能击溃守备敌军，领地攻占失败！请检查兵种克制或研习战法提升实力！`);
    }

    // 战报沉淀
    const reportItem = {
      id: `rep_${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      tileName: `沙盘攻占 · ${tile.name}(${tile.x},${tile.y})`,
      isVictory: isWin,
      summary: result.summary,
      logs: result.logs
    };
    this.state.battleReports.unshift(reportItem);
    if (this.state.battleReports.length > 20) this.state.battleReports.pop();

    this.save();
    this.renderHUD();
    this.renderWorldMap();
    this.openBattleDetailModal(reportItem);
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
              ${!isMax ? ` ➔ 下级: <b style="color:#fde047;">${cfg.effect(nextLvl)}</b>` : ''}
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
      alert('该建筑已升至最高等级！');
      return;
    }

    const nextLvl = currentLvl + 1;
    const cost = cfg.cost(nextLvl);

    if (!hasEnoughResources(this.state.resources, cost)) {
      alert('⚠️ 资源不足！请占领更多对应资源地块或屯田积攒战略储备！');
      return;
    }

    // 扣减资源并升级
    this.state.resources = deductResources(this.state.resources, cost);
    this.state.buildings[bId] = nextLvl;

    sound.playVictoryHorn();
    alert(`🎉【城建告捷】恭贺主公！【${cfg.name}】成功营建升级至 Lv.${nextLvl}！\n生效收益：${cfg.effect(nextLvl)}！`);

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

  // 发起历史战役对战
  launchCampaignBattle(camp) {
    const playerTroop = this.state.troops[0];
    if (!playerTroop || playerTroop.heroes.length === 0) {
      alert('您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！');
      return;
    }

    sound.playDrum();

    // 敌方标准部队
    const enemyTroop = {
      isPlayer: false,
      arm: camp.enemyArm,
      heroes: camp.enemyHeroes.map(h => ({
        ...h,
        currentSoldiers: h.currentSoldiers || 10000,
        maxSoldiers: h.maxSoldiers || 10000
      }))
    };

    // 执行8回合战斗推演 (应用战法真实等级属性)
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

      // 🌟 参战武将获得战役海量经验 (每颗星 1500 经验)
      const campExp = 1500 * starsEarned;
      const levelUpMessages = [];
      playerTroop.heroes.forEach(h => {
        const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
        const res = addGeneralExp(realHero, campExp);
        h.level = realHero.level;
        h.exp = realHero.exp;
        if (res.leveledUp) {
          levelUpMessages.push(`【${realHero.name}】突破升至 Lv.${res.newLevel}！`);
        }
      });
      if (levelUpMessages.length > 0) {
        alert(`🌟【武将突破升级】\n${levelUpMessages.join('\n')}`);
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

  // 发起演武试炼对战
  launchTrialBattle(trial) {
    const playerTroop = this.state.troops[0];
    if (!playerTroop || playerTroop.heroes.length === 0) {
      alert('您的出征军团尚未配置武将，请先前往【编队】配置出战阵容！');
      return;
    }

    sound.playDrum();

    const enemyHeroes = trial.heroes.map(h => {
      const template = GENERALS_DATA.find(g => g.name === h.name) || h;
      return {
        ...template,
        ...h,
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

    // 执行8回合战斗推演
    const result = simulateBattle(playerTroop, enemyTroop, { tacticLevels: this.state.tacticLevels || {} });
    const isWin = (result.summary.winner === 'player');

    if (isWin) {
      sound.playVictoryHorn();
      this.state.trialFloor = (this.state.trialFloor || 1) + 1;
      const copperReward = trial.floor * 3000;
      this.state.resources.copper = (this.state.resources.copper || 0) + copperReward;

      // 🌟 参战武将获得演武阁历练经验
      const trialExp = trial.floor * 1000;
      const levelUpMessages = [];
      playerTroop.heroes.forEach(h => {
        const realHero = this.state.ownedGenerals.find(g => g.id === h.id) || h;
        const res = addGeneralExp(realHero, trialExp);
        h.level = realHero.level;
        h.exp = realHero.exp;
        if (res.leveledUp) {
          levelUpMessages.push(`【${realHero.name}】突破升至 Lv.${res.newLevel}！`);
        }
      });

      const levelUpStr = levelUpMessages.length > 0 ? `\n\n🌟 武将突破升级：\n${levelUpMessages.join('\n')}` : '';
      alert(`🎉 恭贺主公！力克强敌，斩获演武第 ${trial.floor} 层胜利！获赠 🪙 ${copperReward.toLocaleString()} 铜币 · 历练经验 +${trialExp.toLocaleString()}！晋级至第 ${this.state.trialFloor} 层！${levelUpStr}`);
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
    this.openBattleDetailModal(reportItem);
  }

  // ================= 2. 军团编制配置与武将上阵 =================
  renderTroops() {
    this.troopsContainer.innerHTML = '';
    const troop = this.state.troops[0];
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

    // 3位武将槽位
    const heroesHtml = [0, 1, 2].map(slotIdx => {
      const hero = troop.heroes[slotIdx];
      if (hero) {
        const apt = hero.aptitude[troop.arm] || 'C';
        const aptMod = GENERAL_APTITUDE_MODIFIERS[apt] || 1.0;
        const hLvl = hero.level || 1;
        const hExp = hero.exp || 0;
        const reqExp = getExpRequiredForLevel(hLvl);
        const expPct = reqExp > 0 ? Math.min(100, Math.round((hExp / reqExp) * 100)) : 100;

        return `
          <div class="troop-hero-card clickable" style="background:#11141a; border:1px solid ${hero.star===5?'#d97706':'#374151'}; border-radius:10px; padding:14px; width:220px; display:flex; flex-direction:column; align-items:center; position:relative;">
            <div style="font-size:12px; color:#fbbf24; font-weight:bold; margin-bottom:4px;">${slotIdx===0?'★ 主将位 (核心) ★':`副将位 ${slotIdx}`}</div>
            
            <!-- 可点击查看详情的武将核心主体 -->
            <div class="hero-click-area" data-slot="${slotIdx}" title="点击查看【${hero.name}】军略全息详情">
              <div style="font-size:40px;">${hero.avatar}</div>
              <div style="font-size:15px; font-weight:bold; margin-top:2px; color:#fff; display:flex; align-items:center; gap:6px;">
                <span>${hero.name}</span>
                <span class="hero-level-badge">Lv.${hLvl}</span>
              </div>
              
              <!-- 经验条 -->
              <div style="width:100%; margin:4px 0 2px 0;">
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#9ca3af;">
                  <span>历练经验</span>
                  <span>${hLvl>=MAX_GENERAL_LEVEL?'已达满级':`${hExp}/${reqExp}`}</span>
                </div>
                <div class="hero-exp-track" style="margin-top:2px;">
                  <div class="hero-exp-progress" style="width:${expPct}%;"></div>
                </div>
              </div>

              <div style="font-size:11px; color:#9ca3af; margin:2px 0;">${CAMPS[hero.camp].name} · ${troop.arm.toUpperCase()}适性:<b class="apt-tag ${apt}">${apt} (${Math.round(aptMod*100)}%)</b></div>
              <div style="font-size:12px; color:#34d399; margin:4px 0;">带兵量: <b>${(hero.maxSoldiers || 3000).toLocaleString()}</b></div>
              <div style="font-size:10px; color:#38bdf8; margin-top:1px;">🔍 点击查看全息属性</div>
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:17px; font-weight:bold; color:#fbbf24;">${troop.name}</span>
          ${campBonusHtml}
        </div>
        <div style="display:flex; gap:6px;">${armsHtml}</div>
      </div>
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

    const hLvl = realHero.level || 1;
    const hExp = realHero.exp || 0;
    const reqExp = getExpRequiredForLevel(hLvl);
    const expPct = reqExp > 0 ? Math.min(100, Math.round((hExp / reqExp) * 100)) : 100;
    const redStars = realHero.redStars || 0;

    // 星级渲染
    let starsHtml = '';
    for (let s = 1; s <= realHero.star; s++) {
      starsHtml += (s <= redStars) ? `<span class="star-red">★</span>` : `<span class="star-gold">★</span>`;
    }
    if (redStars > 0) starsHtml += ` <span style="font-size:11px; color:#ef4444; font-weight:bold;">(+${redStars}红)</span>`;

    // 模态弹窗构建
    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:580px;">
        <div class="modal-header">
          <div class="modal-title">🎴 武将全息军略档案 · ${realHero.name}</div>
          <button class="modal-close-btn" id="btnHeroDetailClose">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
          
          <!-- 基础信息卡片 -->
          <div class="hero-detail-section" style="display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.4) 100%);">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="font-size:46px; background:#0f1217; padding:6px 12px; border-radius:10px; border:1px solid #374151;">${realHero.avatar}</div>
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:18px; font-weight:bold; color:#fff;">${realHero.name}</span>
                  <span class="camp-tag" style="background:${campInfo.color};">${campInfo.badge}国</span>
                  <span class="cost-badge" style="font-size:12px;">Cost ${realHero.cost}</span>
                  <span class="hero-level-badge">Lv.${hLvl}</span>
                </div>
                <div style="margin:4px 0;">${starsHtml}</div>
                <div style="font-size:12px; color:#9ca3af;">${realHero.title || '三国名宿'}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px; color:#9ca3af;">带兵上限</div>
              <div style="font-size:16px; font-weight:bold; color:#34d399;">${(realHero.maxSoldiers || 3000).toLocaleString()}</div>
            </div>
          </div>

          <!-- 历练等级与经验进度 -->
          <div class="hero-detail-section">
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
              <span style="color:#fbbf24; font-weight:bold;">⚔️ 历练等级进度</span>
              <span style="color:#9ca3af;">${hLvl>=MAX_GENERAL_LEVEL?'已达最高境界 (Lv.50 满级)':`当前经验: ${hExp} / ${reqExp} (${expPct}%)`}</span>
            </div>
            <div class="hero-exp-track" style="height:6px;">
              <div class="hero-exp-progress" style="width:${expPct}%;"></div>
            </div>
            <div style="font-size:10px; color:#6b7280; margin-top:4px;">提示：通过开荒攻打沙盘领地、征战历史名役或演武试炼可积攒历练经验提升等级。</div>
          </div>

          <!-- 四维核心战斗属性与成长率 -->
          <div class="hero-detail-section">
            <div class="hero-detail-title">📊 四维实战属性与成长</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border:1px solid #2d3340; display:flex; justify-content:space-between;">
                <span>🗡️ 武力: <b style="color:#fde047; font-size:14px;">${realHero.force}</b></span>
                <span class="hero-growth-tag">(+${realHero.forceGrowth || 1.0}/级)</span>
              </div>
              <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border:1px solid #2d3340; display:flex; justify-content:space-between;">
                <span>🧠 智力: <b style="color:#60a5fa; font-size:14px;">${realHero.intel}</b></span>
                <span class="hero-growth-tag">(+${realHero.intelGrowth || 1.0}/级)</span>
              </div>
              <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border:1px solid #2d3340; display:flex; justify-content:space-between;">
                <span>🛡️ 统率: <b style="color:#34d399; font-size:14px;">${realHero.command}</b></span>
                <span class="hero-growth-tag">(+${realHero.commandGrowth || 1.0}/级)</span>
              </div>
              <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border:1px solid #2d3340; display:flex; justify-content:space-between;">
                <span>⚡ 速度: <b style="color:#f472b6; font-size:14px;">${realHero.speed}</b></span>
                <span class="hero-growth-tag">(+${realHero.speedGrowth || 1.0}/级)</span>
              </div>
            </div>
          </div>

          <!-- 五大兵种适性面板 -->
          <div class="hero-detail-section">
            <div class="hero-detail-title">🛡️ 兵种统领适性</div>
            <div class="apt-row" style="padding:8px 12px; font-size:12px;">
              <span>骑兵 <b class="apt-tag ${realHero.aptitude.cavalry}">${realHero.aptitude.cavalry}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.cavalry]||1)*100)}%)</span>
              <span>盾兵 <b class="apt-tag ${realHero.aptitude.shield}">${realHero.aptitude.shield}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.shield]||1)*100)}%)</span>
              <span>弓兵 <b class="apt-tag ${realHero.aptitude.bow}">${realHero.aptitude.bow}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.bow]||1)*100)}%)</span>
              <span>枪兵 <b class="apt-tag ${realHero.aptitude.spear}">${realHero.aptitude.spear}</b> (${Math.round((GENERAL_APTITUDE_MODIFIERS[realHero.aptitude.spear]||1)*100)}%)</span>
              <span>器械 <b class="apt-tag ${realHero.aptitude.siege || 'B'}">${realHero.aptitude.siege || 'B'}</b></span>
            </div>
            <div style="font-size:10px; color:#9ca3af; margin-top:4px;">适性加成说明：S级 120% 全属性 · A级 100% · B级 85% · C级 70%</div>
          </div>

          <!-- 三大战法配置槽位 -->
          <div class="hero-detail-section">
            <div class="hero-detail-title">📚 战法装配与研习</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              
              <!-- 自带战法 -->
              <div style="background:rgba(0,0,0,0.3); border:1px solid #d97706; padding:8px 12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:#fbbf24; font-weight:bold; font-size:12px;">[自带战法] ${builtInTac ? builtInTac.name : '军略'}</span>
                  <span style="font-size:10px; color:#fde047; background:rgba(217,119,6,0.2); border:1px solid #d97706; padding:1px 5px; border-radius:3px;">
                    ${builtInTac?.type || '被动'}
                  </span>
                </div>
                <div style="font-size:11px; color:#cbd5e1; margin-top:3px; line-height:1.4;">${builtInTac ? builtInTac.desc : '名将核心自带军略'}</div>
              </div>

              <!-- 战法槽位 1 -->
              <div style="background:rgba(0,0,0,0.3); border:1px solid #374151; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="color:#fbbf24; font-weight:bold; font-size:12px;">[传承战法①]</span>
                    <span style="color:#fff; font-size:12px;">${tac1 ? tac1.name : '<span style="color:#9ca3af;">未装配</span>'}</span>
                    ${tac1 ? `<span style="font-size:10px; color:#6ee7b7; background:rgba(5,150,105,0.2); border:1px solid #059669; padding:0 4px; border-radius:3px;">Lv.${this.state.tacticLevels?.[tac1.id] || 1}</span>` : ''}
                  </div>
                  <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${tac1 ? tac1.desc.substring(0, 36) + '...' : '点击右侧按钮装配传承战法'}</div>
                </div>
                <button class="upgrade-btn btn-modal-change-tac1" style="padding:4px 10px; font-size:11px; white-space:nowrap;">换配</button>
              </div>

              <!-- 战法槽位 2 -->
              <div style="background:rgba(0,0,0,0.3); border:1px solid #374151; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="color:#60a5fa; font-weight:bold; font-size:12px;">[传承战法②]</span>
                    <span style="color:#fff; font-size:12px;">${tac2 ? tac2.name : '<span style="color:#9ca3af;">未装配</span>'}</span>
                    ${tac2 ? `<span style="font-size:10px; color:#6ee7b7; background:rgba(5,150,105,0.2); border:1px solid #059669; padding:0 4px; border-radius:3px;">Lv.${this.state.tacticLevels?.[tac2.id] || 1}</span>` : ''}
                  </div>
                  <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${tac2 ? tac2.desc.substring(0, 36) + '...' : '点击右侧按钮装配第二战法'}</div>
                </div>
                <button class="upgrade-btn btn-modal-change-tac2" style="padding:4px 10px; font-size:11px; background:#2563eb; white-space:nowrap;">换配</button>
              </div>
            </div>
          </div>

          <!-- 生平列传 -->
          ${realHero.bio ? `
            <div class="hero-detail-section" style="font-size:11px; color:#9ca3af; line-height:1.5;">
              <span style="color:#fbbf24; font-weight:bold;">📜 将领列传：</span>${realHero.bio}
            </div>
          ` : ''}

        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btnHeroDetailClose').addEventListener('click', () => modal.remove());

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
  }

  // 选拔上阵弹窗
  openAssignHeroModal(troop, slotIdx) {
    const assignedIds = new Set(troop.heroes.map(h => h.id));
    const candidates = this.state.ownedGenerals.filter(g => !assignedIds.has(g.id));

    if (candidates.length === 0) {
      alert('您没有未上阵的武将！请前往【招募】拜将台招揽名将。');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-mask';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:560px;">
        <div class="modal-header">
          <div class="modal-title">选拔上阵 · ${slotIdx===0?'★ 主将位 ★':`副将位 ${slotIdx}`}</div>
          <button class="modal-close-btn" id="btnAssignModalClose">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:10px;">
          ${candidates.map(c => `
            <div style="background:#11141a; border:1px solid #374151; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:32px;">${c.avatar}</span>
                <div>
                  <div style="font-weight:bold; color:#fff; font-size:15px;">
                    ${c.name} (${'★'.repeat(c.star)}) · <span style="color:#fbbf24;">${CAMPS[c.camp].name}</span>
                  </div>
                  <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
                    武力:${c.force} 智力:${c.intel} 统率:${c.command} 速度:${c.speed}
                  </div>
                </div>
              </div>
              <button class="upgrade-btn btn-choose-candidate" data-id="${c.id}" style="padding:6px 14px;">上阵出征</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#btnAssignModalClose').addEventListener('click', () => modal.remove());

    modal.querySelectorAll('.btn-choose-candidate').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const chosen = this.state.ownedGenerals.find(g => g.id === id);
        if (chosen) {
          troop.heroes[slotIdx] = chosen;
          sound.playDrum();
          this.renderTroops();
          this.save();
        }
        modal.remove();
      });
    });
  }

  // ================= 3. 武将图鉴、升星进阶与双战法装配 =================
  renderGenerals() {
    this.ownedGeneralsGrid.innerHTML = '';
    const campFilter = this.generalFilter?.camp || 'all';
    const starFilter = this.generalFilter?.star || 'all';

    // 联合筛选过滤
    const list = (this.state.ownedGenerals || []).filter(g => {
      if (campFilter !== 'all' && g.camp !== campFilter) return false;
      if (starFilter !== 'all' && g.star !== starFilter) return false;
      return true;
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

    const currentTroopHeroIds = new Set((this.state.troops[0]?.heroes || []).map(h => h.id));

    list.forEach(g => {
      const card = document.createElement('div');
      const redStars = g.redStars || 0;
      const isFullRed = (redStars >= 5);

      card.className = `general-card ${g.star===5?'star-5':''} ${isFullRed?'full-red':''}`;
      const campInfo = CAMPS[g.camp] || CAMPS.qun;
      const builtInTac = TACTICS_MAP.get(g.builtInTacticId);
      const tac1 = TACTICS_MAP.get(g.equippedTactic1);
      const tac2 = TACTICS_MAP.get(g.equippedTactic2);
      const inheritTacId = getHeroInheritTacticId(g);
      const inheritTac = TACTICS_MAP.get(inheritTacId);
      const isInherited = this.state.ownedTactics.includes(inheritTacId);

      // 统计可进阶同名卡数量 (未上阵且不是自身)
      const duplicateCards = this.state.ownedGenerals.filter(other => 
        other.name === g.name && other.id !== g.id && !currentTroopHeroIds.has(other.id)
      );
      const canPromote = (redStars < 5 && duplicateCards.length > 0);
      const isInTroop = currentTroopHeroIds.has(g.id);

      // 星级渲染 (红星 + 金星)
      let starsHtml = '';
      for (let s = 1; s <= g.star; s++) {
        if (s <= redStars) {
          starsHtml += `<span class="star-red">★</span>`;
        } else {
          starsHtml += `<span class="star-gold">★</span>`;
        }
      }
      if (redStars > 0) {
        starsHtml += ` <span style="font-size:10px; color:#ef4444; font-weight:bold;">(+${redStars}红)</span>`;
      }

      const gLvl = g.level || 1;
      const gExp = g.exp || 0;
      const reqExp = getExpRequiredForLevel(gLvl);
      const expPct = reqExp > 0 ? Math.min(100, Math.round((gExp / reqExp) * 100)) : 100;

      card.innerHTML = `
        <div class="card-header">
          <span class="camp-tag" style="background:${campInfo.color};">${campInfo.badge}</span>
          <span class="cost-badge">Cost ${g.cost}</span>
        </div>
        <div class="avatar-box">${g.avatar}</div>
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
        <div class="stats-grid">
          <div>武力: <b style="color:#fde047;">${g.force}</b></div>
          <div>智力: <b style="color:#fde047;">${g.intel}</b></div>
          <div>统率: <b style="color:#fde047;">${g.command}</b></div>
          <div>速度: <b style="color:#fde047;">${g.speed}</b></div>
        </div>
        <div class="tactic-desc" style="margin-bottom:4px;">
          <b>[自带] ${builtInTac ? builtInTac.name : '军略'}</b><br>
          ${builtInTac ? builtInTac.desc.substring(0, 32) + '...' : ''}
        </div>

        <!-- 双配装战法槽位 -->
        <div style="font-size:10px; color:#fbbf24; background:rgba(0,0,0,0.3); padding:3px 6px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <span>[战法①] ${tac1 ? `${tac1.name} <b style="color:#6ee7b7;">(Lv.${this.state.tacticLevels?.[tac1.id] || 1})</b>` : '<span style="color:#9ca3af;">空置</span>'}</span>
          <button class="upgrade-btn btn-equip-tactic1" style="padding:1px 5px; font-size:9px;">换配</button>
        </div>
        <div style="font-size:10px; color:#60a5fa; background:rgba(0,0,0,0.3); padding:3px 6px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <span>[战法②] ${tac2 ? `${tac2.name} <b style="color:#6ee7b7;">(Lv.${this.state.tacticLevels?.[tac2.id] || 1})</b>` : '<span style="color:#9ca3af;">空置</span>'}</span>
          <button class="upgrade-btn btn-equip-tactic2" style="padding:1px 5px; font-size:9px; background:#2563eb;">换配</button>
        </div>

        <!-- 武将传承战法栏 -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:3px 6px; border-radius:4px; margin-bottom:5px; font-size:10px;">
          <span style="color:#d8b4fe;">传承: <b>${inheritTac ? inheritTac.name : '未知'}</b></span>
          ${isInherited ? `
            <span style="color:#10b981; font-weight:bold; font-size:9px;">✔已领悟</span>
          ` : `
            <button class="upgrade-btn btn-inherit-hero" style="padding:1px 6px; font-size:9px; background:linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);" ${isInTroop?'disabled title="已在出征阵容中，不可传承"':''}>
              📖传承
            </button>
          `}
        </div>

        <!-- 进阶升星与售出操作 -->
        <div style="display:flex; gap:4px; width:100%;">
          ${canPromote ? `
            <button class="upgrade-btn btn-promote-hero" style="flex:1; padding:3px 0; font-size:10px; background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);">
              🌟 升星(${duplicateCards.length})
            </button>
          ` : isFullRed ? `
            <span style="flex:1; text-align:center; font-size:10px; color:#ef4444; font-weight:bold; padding:3px 0; background:rgba(239,68,68,0.1); border-radius:4px;">
              👑 已达满红
            </span>
          ` : `
            <span style="flex:1; text-align:center; font-size:10px; color:#6b7280; padding:3px 0;">
              暂无同名卡
            </span>
          `}
          <button class="upgrade-btn btn-sell-hero" style="padding:3px 8px; font-size:10px; background:${isInTroop?'#374151':'#4b5563'};" ${isInTroop?'disabled title="已在出征军团中，不可售出"':''}>
            ${isInTroop ? '出征中' : '售出'}
          </button>
        </div>
      `;

        // 绑定第1战法槽更换
        card.querySelector('.btn-equip-tactic1').addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEquipTacticModal(g, 1);
        });

        // 绑定第2战法槽更换
        card.querySelector('.btn-equip-tactic2').addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEquipTacticModal(g, 2);
        });

        // 绑定传承战法
        const btnInherit = card.querySelector('.btn-inherit-hero');
        if (btnInherit && !isInTroop) {
          btnInherit.addEventListener('click', (e) => {
            e.stopPropagation();
            this.inheritTacticFromHero(g);
          });
        }

        // 绑定进阶升星
        const btnPromote = card.querySelector('.btn-promote-hero');
        if (btnPromote) {
          btnPromote.addEventListener('click', (e) => {
            e.stopPropagation();
            this.promoteHero(g, duplicateCards[0]);
          });
        }

        // 绑定售出
        const btnSell = card.querySelector('.btn-sell-hero');
        if (btnSell && !isInTroop) {
          btnSell.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sellHero(g);
          });
        }

        // 绑定点击头像/名字直接查看全息档案详情
        card.querySelector('.avatar-box').style.cursor = 'pointer';
        card.querySelector('.avatar-box').title = `点击查看【${g.name}】全息军略档案`;
        card.querySelector('.avatar-box').addEventListener('click', () => {
          sound.playDrum();
          this.openHeroDetailModal(g);
        });
        card.querySelector('.hero-name').style.cursor = 'pointer';
        card.querySelector('.hero-name').title = `点击查看【${g.name}】全息军略档案`;
        card.querySelector('.hero-name').addEventListener('click', () => {
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
      alert(`战法【${tac.name}】已在战法库中解锁，无需重复传承！`);
      return;
    }

    const currentTroopHeroIds = new Set((this.state.troops[0]?.heroes || []).map(h => h.id));
    if (currentTroopHeroIds.has(hero.id)) {
      alert(`武将【${hero.name}】正在主力出征军团中，不可献祭传承！`);
      return;
    }

    if (!confirm(`📖【武将战法传承确认】\n\n主公，确认消耗 1 位闲置武将【${hero.name} (${hero.star}★)】吗？\n传承后将永久领悟解锁 ${tac.quality}级 战法【${tac.name}】(${tac.type})，可为麾下任意武将装配并研习升级！`)) {
      return;
    }

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
      alert(`🎉 恭喜主公！成功献祭武将【${hero.name}】，领悟并解锁 ${tac.quality}级绝技【${tac.name}】！已永久加入战法研习库！`);
    }
  }

  // 升星进阶单个武将
  promoteHero(targetHero, materialCard) {
    if (!materialCard) return;
    const matIdx = this.state.ownedGenerals.findIndex(x => x.id === materialCard.id);
    if (matIdx < 0) return;

    // 消耗材料卡
    this.state.ownedGenerals.splice(matIdx, 1);

    // 进阶属性暴涨
    targetHero.redStars = (targetHero.redStars || 0) + 1;
    targetHero.force += 5;
    targetHero.intel += 5;
    targetHero.command += 5;
    targetHero.speed += 5;

    sound.playVictoryHorn();
    this.save();
    this.renderGenerals();
    this.renderTroops();
    this.renderHUD();
    alert(`🌟【升星大捷】消耗 1 张同名卡，【${targetHero.name}】成功进阶为 ${targetHero.redStars} 红！\n武力/智力/统率/速度全面提升 5 点！`);
  }

  // 一键同名卡升星进阶
  quickAutoPromote() {
    let promotedCount = 0;
    const currentTroopHeroIds = new Set((this.state.troops[0]?.heroes || []).map(h => h.id));

    // 优先以已上阵或高星卡作为进阶主体
    for (const mainHero of this.state.ownedGenerals) {
      if ((mainHero.redStars || 0) >= 5) continue;

      while ((mainHero.redStars || 0) < 5) {
        const matIdx = this.state.ownedGenerals.findIndex(other => 
          other.name === mainHero.name && other.id !== mainHero.id && !currentTroopHeroIds.has(other.id)
        );
        if (matIdx >= 0) {
          this.state.ownedGenerals.splice(matIdx, 1);
          mainHero.redStars = (mainHero.redStars || 0) + 1;
          mainHero.force += 5;
          mainHero.intel += 5;
          mainHero.command += 5;
          mainHero.speed += 5;
          promotedCount++;
        } else {
          break;
        }
      }
    }

    if (promotedCount === 0) {
      alert('背包中暂无满足条件的重复同名武将卡！');
      return;
    }

    sound.playVictoryHorn();
    this.save();
    this.renderGenerals();
    this.renderTroops();
    this.renderHUD();
    alert(`🎉【一键升星圆满】共计完成 ${promotedCount} 次红度进阶！麾下核心武将战力大幅跃升！`);
  }

  // 单卡售出
  sellHero(hero) {
    const goldBack = (hero.star === 5 ? 5000 : hero.star === 4 ? 1000 : 300);
    if (!confirm(`确认遣散武将【${hero.name} (${hero.star}★)】解甲归田吗？\n将返还主公 ${goldBack} 铜币！`)) return;

    const idx = this.state.ownedGenerals.findIndex(x => x.id === hero.id);
    if (idx >= 0) {
      this.state.ownedGenerals.splice(idx, 1);
      this.state.resources.copper = (this.state.resources.copper || 0) + goldBack;
      sound.playGoldChime();
      this.save();
      this.renderGenerals();
      this.renderHUD();
    }
  }

  // 一键解甲全部3星将
  quickSellThreeStars() {
    const currentTroopHeroIds = new Set((this.state.troops[0]?.heroes || []).map(h => h.id));
    const threeStars = this.state.ownedGenerals.filter(g => g.star === 3 && !currentTroopHeroIds.has(g.id));

    if (threeStars.length === 0) {
      alert('当前背包中没有未上阵的 3 星武将！');
      return;
    }

    if (!confirm(`确认一键解甲全部 ${threeStars.length} 位 3 星随军武将吗？\n将获得 ${threeStars.length * 300} 铜币，并清空闲置卡牌。`)) return;

    this.state.ownedGenerals = this.state.ownedGenerals.filter(g => !(g.star === 3 && !currentTroopHeroIds.has(g.id)));
    this.state.resources.copper = (this.state.resources.copper || 0) + threeStars.length * 300;

    sound.playGoldChime();
    this.save();
    this.renderGenerals();
    this.renderHUD();
    alert(`🪙【一键清包完成】成功遣散 ${threeStars.length} 位 3 星武将，获得 ${threeStars.length * 300} 铜币！`);
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
      <div class="modal-content" style="max-width:560px;">
        <div class="modal-header">
          <div class="modal-title">换配传承战法 · ${hero.name} (槽位 ${slot})</div>
          <button class="modal-close-btn" id="btnTacModalClose">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:10px;">
          
          <!-- 卸下当前战法选项 -->
          <div style="background:rgba(239, 68, 68, 0.08); border:1px dashed #ef4444; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:bold; color:#fca5a5; font-size:13px;">🚫 卸下当前战法</div>
              <div style="font-size:11px; color:#9ca3af; margin-top:2px;">卸下后槽位空置，可供其他武将研习装配该战法。</div>
            </div>
            <button class="upgrade-btn btn-unequip-tactic" style="background:#4b5563; padding:5px 14px; font-size:11px;" ${!currentEquippedId ? 'disabled' : ''}>
              ${currentEquippedId ? '立即卸下' : '当前已空置'}
            </button>
          </div>

          <!-- 可装配战法列表 -->
          ${this.state.ownedTactics.map(tId => {
            const tac = TACTICS_MAP.get(tId);
            if (!tac) return '';

            const isCurrentSlot = (currentEquippedId === tId);
            const isOtherSlot = (otherSlotEquippedId === tId);
            const occupier = tacticOccupiedMap.get(tId);
            const isOccupiedByOther = occupier && occupier.heroId !== hero.id;
            const currentTacticLvl = this.state.tacticLevels?.[tId] || 1;

            let btnText = '装配此战法';
            let btnStyle = 'background:linear-gradient(135deg, #10b981 0%, #059669 100%);';
            let btnDisabled = false;
            let statusBadge = '';

            if (isCurrentSlot) {
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
              <div style="background:#11141a; border:1px solid ${isCurrentSlot?'#059669':'#374151'}; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1; padding-right:12px;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="font-weight:bold; color:#fbbf24; font-size:14px;">${tac.name}</span>
                    <span style="font-size:11px; color:#6ee7b7; background:rgba(110,231,183,0.15); border:1px solid #059669; padding:0 4px; border-radius:3px; font-weight:bold;">Lv.${currentTacticLvl}</span>
                    <span style="font-size:11px; color:#9ca3af;">(${tac.type})</span>
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
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#btnTacModalClose').addEventListener('click', () => modal.remove());

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
        alert(`✔ 已成功将【${hero.name}】槽位 ${slot} 的战法卸下！该战法现已处于闲置状态，可供其他名将装配！`);
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

        // 装配到当前武将
        const realHero = this.state.ownedGenerals.find(g => g.id === hero.id) || hero;
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
        alert(tipMsg);
      });
    });
  }

  // 同步部队槽位中的武将战法
  syncTroopHeroTactics(heroId) {
    (this.state.troops || []).forEach(troop => {
      (troop.heroes || []).forEach(h => {
        if (h && h.id === heroId) {
          const real = this.state.ownedGenerals.find(g => g.id === heroId);
          if (real) {
            h.equippedTactic1 = real.equippedTactic1;
            h.equippedTactic2 = real.equippedTactic2;
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

    // 获取全部传承战法列表
    const allInheritableTactics = Object.keys(TACTIC_INHERIT_SOURCES).map(id => TACTICS_MAP.get(id)).filter(Boolean);

    allInheritableTactics.forEach(tac => {
      const isUnlocked = ownedTacticsSet.has(tac.id);
      const sourceInfo = TACTIC_INHERIT_SOURCES[tac.id];
      const sourceNames = sourceInfo ? sourceInfo.names : [];

      // 类型标签
      const typeMap = { command: '指挥', passive: '被动', active: '主动', assault: '突击' };
      const typeClass = `tactic-type-${tac.type}`;

      const card = document.createElement('div');

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
          statCompareHtml += `<div>伤害率: <b style="color:#fde047;">${(currentProps.damageRate * 100).toFixed(0)}%</b> ${isMax ? '' : `<span style="color:#34d399;">➜ ${(nextProps.damageRate * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.healRate) {
          statCompareHtml += `<div>治疗率: <b style="color:#6ee7b7;">${(currentProps.healRate * 100).toFixed(0)}%</b> ${isMax ? '' : `<span style="color:#34d399;">➜ ${(nextProps.healRate * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.damageReduction || tac.teamDamageReduction) {
          const curRed = currentProps.damageReduction || currentProps.teamDamageReduction;
          const nextRed = nextProps ? (nextProps.damageReduction || nextProps.teamDamageReduction) : 0;
          statCompareHtml += `<div>减伤率: <b style="color:#60a5fa;">${(curRed * 100).toFixed(0)}%</b> ${isMax ? '' : `<span style="color:#34d399;">➜ ${(nextRed * 100).toFixed(0)}%</span>`}</div>`;
        }
        if (tac.rate && tac.rate < 100) {
          statCompareHtml += `<div>发动几率: <b style="color:#f472b6;">${currentProps.rate}%</b> ${isMax ? '' : `<span style="color:#34d399;">➜ ${nextProps.rate}%</span>`}</div>`;
        }

        const canAfford = (this.state.resources.copper || 0) >= nextCost;

        card.innerHTML = `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:bold; color:#fbbf24; font-size:15px;">${tac.name}</span>
              <div style="display:flex; gap:4px; align-items:center;">
                <span class="tactic-type-tag ${typeClass}">${typeMap[tac.type] || tac.type}</span>
                <span style="font-size:11px; font-weight:bold; color:${tac.quality==='S'?'#fbbf24':'#c084fc'}; border:1px solid currentColor; padding:1px 4px; border-radius:3px;">${tac.quality}级</span>
              </div>
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-bottom:8px; line-height:1.4;">${tac.desc}</div>

            <!-- 等级进度条 -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
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
              ${statCompareHtml || '<div style="color:#9ca3af;">持续战术生效中，属性随等级提升</div>'}
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:bold; color:#9ca3af; font-size:15px;">🔒 ${tac.name}</span>
              <div style="display:flex; gap:4px; align-items:center;">
                <span class="tactic-type-tag ${typeClass}">${typeMap[tac.type] || tac.type}</span>
                <span style="font-size:11px; font-weight:bold; color:#6b7280; border:1px solid currentColor; padding:1px 4px; border-radius:3px;">${tac.quality}级</span>
              </div>
            </div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:10px; line-height:1.4;">${tac.desc}</div>

            <div style="background:rgba(0,0,0,0.4); border:1px dashed #4b5563; border-radius:6px; padding:8px 10px; font-size:11px; margin-bottom:12px;">
              <div style="color:#d8b4fe; font-weight:bold; margin-bottom:3px;">📖 传承来源武将：</div>
              <div style="color:#e5e7eb;">【${sourceNames.join('】、【')}】</div>
              <div style="font-size:10px; color:#9ca3af; margin-top:4px;">献祭 1 位对应闲置武将即可领悟传承该战法！</div>
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
      alert(`主公，您的铜币不足！\n升级该战法需要 🪙 ${cost.toLocaleString()} 铜币，当前拥有 🪙 ${currentCopper.toLocaleString()} 铜币。\n您可在【麾下名将】中一键解甲闲置3星武将，或通过通关历史战役获取丰厚铜币！`);
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

  // ================= 4. 无限金铢招募 =================
  fillInfiniteGold() {
    this.state.resources.gold = 999999;
    this.state.infiniteGold = true;
    sound.playGoldChime();
    this.renderHUD();
    this.save();
    alert('👑【GM特权】999,999 无限金铢已注入！拜将台随心畅抽！');
  }

  doGacha(poolType, count) {
    const isFamous = (poolType === 'famous');
    const cost = isFamous 
      ? (count === 1 ? GACHA_CONFIG.goldSingleCost : GACHA_CONFIG.goldFiveCost)
      : (count === 1 ? GACHA_CONFIG.copperSingleCost : GACHA_CONFIG.copperTenCost);

    // 无限金铢加持
    this.state.resources.gold = 999999;
    const pulledCards = [];

    for (let i = 0; i < count; i++) {
      const pityFive = this.state.gachaPity || 0;
      const pityFour = this.state.gachaFourPity || 0;
      const res = pullGeneral(poolType, pityFive, pityFour);

      if (isFamous) {
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

      pulledCards.push(res.general);
      this.state.ownedGenerals.push({
        ...res.general,
        level: res.general.star >= 5 ? 10 : 5,
        exp: 0,
        currentSoldiers: (res.general.star >= 5 ? 10 : 5) * 200,
        maxSoldiers: (res.general.star >= 5 ? 10 : 5) * 200,
        equippedTactic1: null,
        equippedTactic2: null
      });
    }

    // 判定本次抽卡最高品质（出金 / 出紫）
    const hasFiveStar = pulledCards.some(c => c.star >= 5);
    const hasFourStar = pulledCards.some(c => c.star === 4);

    // 播放专属音效与视听反馈
    if (hasFiveStar) {
      sound.playGachaGold();
    } else if (hasFourStar) {
      sound.playGachaPurple();
    } else {
      sound.playGoldChime();
    }

    this.renderHUD();
    this.save();

    // 调整开箱浮层整体氛围环境光（初始悬念状态）
    this.gachaShowcase.classList.remove('has-gold', 'has-purple');
    if (this.gachaShowcaseTitle) {
      this.gachaShowcaseTitle.className = 'gacha-title-banner';
      this.gachaShowcaseTitle.innerHTML = '🎴 天命所归 · 点击翻开名将令';
    }

    // 弹出开箱展示，先展示神秘虎符卡背，支持手动点击翻牌或按序自动翻开
    this.gachaCardsContainer.innerHTML = '';
    
    // 跟踪已翻牌状态
    const cardElements = [];

    pulledCards.forEach((c, idx) => {
      const isFive = (c.star >= 5);
      const isFour = (c.star === 4);
      const qualityClass = isFive ? 'gacha-card-gold' : (isFour ? 'gacha-card-purple' : '');

      const wrapper = document.createElement('div');
      wrapper.className = 'gacha-card-wrapper gacha-anim-card';
      wrapper.style.animationDelay = `${idx * 0.1}s`;

      const campInfo = CAMPS[c.camp] || { color: '#888', badge: '群' };
      const starStr = isFive ? '★★★★★' : (isFour ? '★★★★' : '★★★');
      const starClass = isFive ? 'color:#fbbf24; text-shadow:0 0 8px rgba(251,191,36,0.8);' : (isFour ? 'color:#c084fc; text-shadow:0 0 6px rgba(192,132,252,0.6);' : 'color:#9ca3af;');

      wrapper.innerHTML = `
        <div class="gacha-card-inner">
          <!-- 🎴 背面：神秘古风虎符卡背 -->
          <div class="gacha-card-face card-back">
            <div class="card-back-emblem">🐯</div>
            <div class="card-back-title">英雄令</div>
            <div class="card-back-hint">点击翻开</div>
          </div>
          <!-- 🎴 正面：名将真容全息卡牌 -->
          <div class="gacha-card-face card-front general-card ${qualityClass}">
            <div class="card-header">
              <span class="camp-tag" style="background:${campInfo.color};">${campInfo.badge}</span>
              <span class="cost-badge">Cost ${c.cost}</span>
            </div>
            <div class="avatar-box" style="font-size:46px;">${c.avatar}</div>
            <div class="hero-name" style="font-size:15px; margin:4px 0;">${c.name}</div>
            <div class="stars-row" style="${starClass} font-size:14px; letter-spacing:2px; margin-bottom:4px;">${starStr}</div>
            ${isFive ? '<div class="gacha-gold-badge">5★神将</div>' : ''}
            ${isFour ? '<div class="gacha-purple-badge">4★良将</div>' : ''}
          </div>
        </div>
      `;

      // 翻开单张卡牌逻辑
      const flipCard = () => {
        if (wrapper.classList.contains('flipped')) return;
        wrapper.classList.add('flipped');
        sound.playCardFlip();

        // 翻到半途（300ms）触发金光/紫光音效与环境光增强
        setTimeout(() => {
          if (isFive) {
            sound.playGachaGold();
            this.gachaShowcase.classList.add('has-gold');
            if (this.gachaShowcaseTitle) {
              this.gachaShowcaseTitle.className = 'gacha-title-banner gold';
              this.gachaShowcaseTitle.innerHTML = '🌟 华光万道 · 恭迎五星神将！';
            }
          } else if (isFour && !this.gachaShowcase.classList.contains('has-gold')) {
            sound.playGachaPurple();
            this.gachaShowcase.classList.add('has-purple');
            if (this.gachaShowcaseTitle && !this.gachaShowcaseTitle.classList.contains('gold')) {
              this.gachaShowcaseTitle.className = 'gacha-title-banner purple';
              this.gachaShowcaseTitle.innerHTML = '💜 紫气东来 · 恭获四星良将！';
            }
          }
        }, 280);
      };

      // 绑定手动点击翻开
      wrapper.addEventListener('click', flipCard);

      this.gachaCardsContainer.appendChild(wrapper);
      cardElements.push(flipCard);
    });

    this.gachaShowcase.style.display = 'flex';

    // 优雅体验：入场完成后，如果主公未点击，依次按序自动掀起翻开（带来丝滑连环揭晓仪式）
    cardElements.forEach((doFlip, i) => {
      setTimeout(() => {
        doFlip();
      }, 550 + i * 280);
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

    const pArmObj = ARMS[s.playerArm] || { name: '主力', icon: '⚔️' };
    const eArmObj = ARMS[s.enemyArm] || { name: '守军', icon: '🛡️' };

    // 格式化单阵营武将卡片列表
    const renderHeroList = (heroes, isPlayer) => {
      return (heroes || []).map(h => {
        const starStr = '★'.repeat(h.star || 4);
        const campObj = CAMPS[h.camp] || { name: '群', color: '#888' };
        
        // 战法徽章
        const tacticsHtml = (h.tactics || []).map((t, idx) => {
          const isInnate = (idx === 0);
          const badgeClass = isInnate ? 'lineup-tac-badge innate' : (t.quality === 'S' ? 'lineup-tac-badge s-rank' : 'lineup-tac-badge');
          return `<span class="${badgeClass}" title="${t.desc || ''}">[${isInnate ? '自带' : '配'}] ${t.name} Lv.${t.level || 1}</span>`;
        }).join('');

        return `
          <div class="lineup-hero-item ${h.isLeader ? 'leader' : ''}">
            <div class="lineup-hero-main">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:18px;">${h.avatar || '👤'}</span>
                <div>
                  <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-weight:bold; font-size:13px; color:#fff;">${h.name}</span>
                    <span style="font-size:9px; background:${campObj.color}; color:#fff; border-radius:3px; padding:0 3px;">${campObj.name}</span>
                    ${h.isLeader ? '<span style="font-size:9px; background:#d97706; color:#fff; border-radius:3px; padding:0 3px;">主将</span>' : ''}
                  </div>
                  <div style="font-size:10px; color:#fbbf24;">${starStr}</div>
                </div>
              </div>
              <div style="text-align:right; font-size:11px;">
                <div style="color:${isPlayer ? '#34d399' : '#f87171'}; font-weight:bold;">余兵: ${h.remaining} / ${h.initial}</div>
                <div style="color:#9ca3af; font-size:10px;">造成伤害: <b style="color:#fde047;">${h.damage || 0}</b> | 治疗: <b style="color:#6ee7b7;">${h.heals || 0}</b></div>
              </div>
            </div>
            <div class="lineup-hero-tactics">
              ${tacticsHtml || '<span style="color:#6b7280; font-size:10px;">暂未装配传承战法</span>'}
            </div>
          </div>
        `;
      }).join('');
    };

    // 格式化日志，自动标注 [我军] 与 [敌军]
    const pNames = new Set((s.playerHeroStats || []).map(h => h.name));
    const eNames = new Set((s.enemyHeroStats || []).map(h => h.name));

    const formattedLogs = (rep.logs || []).map(l => {
      let txt = l.text;
      pNames.forEach(name => {
        txt = txt.replaceAll(`【${name}】`, `【<span class="tag-player">我军·${name}</span>】`);
      });
      eNames.forEach(name => {
        txt = txt.replaceAll(`【${name}】`, `【<span class="tag-enemy">敌军·${name}</span>】`);
      });
      return `<div class="battle-log-item ${l.type}">${txt}</div>`;
    }).join('');

    this.battleDetailBody.innerHTML = `
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
          <div style="margin-top:auto; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; display:flex; justify-content:space-between; color:#9ca3af;">
            <span>总兵力: <b style="color:#34d399;">${s.playerInitialSoldiers}</b></span>
            <span>总战损: <b style="color:#ef4444;">-${s.playerLosses}</b></span>
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
          <div style="margin-top:auto; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); font-size:11px; display:flex; justify-content:space-between; color:#9ca3af;">
            <span>守备兵力: <b style="color:#f87171;">${s.enemyInitialSoldiers}</b></span>
            <span>被歼灭: <b style="color:#34d399;">-${s.enemyLosses}</b></span>
          </div>
        </div>
      </div>

      <!-- 标签切换：阵容概要与8回合推演日志 -->
      <div class="modal-tab-nav">
        <button class="modal-tab-btn active" id="btnModalTabLogs">📜 8回合沙盘实战推演日志</button>
      </div>

      <div id="modalLogsContainer" style="display:flex; flex-direction:column; gap:3px;">
        ${formattedLogs}
      </div>
    `;

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
