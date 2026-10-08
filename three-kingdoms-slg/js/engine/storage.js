/**
 * 三国志·战略版 - 存档管理器与离线挂机收益引擎 (Storage Engine)
 */

import { GENERALS_DATA } from '../data/generals.js';
import { generateWorldMap, LAND_TIERS } from './map.js';

const STORAGE_KEY = 'three_kingdoms_slg_save_v1';

export function createInitialGameState() {
  const allGeneralsMap = new Map(GENERALS_DATA.map(g => [g.id, g]));
  
  // 初始平民开荒战队 (5星以下良将：关平主将 + 郭淮神盾 + 张宝法核 + 韩当弓神)
  const ownedGenerals = [
    { ...allGeneralsMap.get('gen_guan_ping'), level: 10, exp: 0, currentSoldiers: 3000, maxSoldiers: 3000, equippedTactic1: 'tac_shou_qi_dao_luo', equippedTactic2: null },
    { ...allGeneralsMap.get('gen_guo_huai'), level: 10, exp: 0, currentSoldiers: 3000, maxSoldiers: 3000, equippedTactic1: 'tac_zi_yu', equippedTactic2: null },
    { ...allGeneralsMap.get('gen_zhang_bao'), level: 10, exp: 0, currentSoldiers: 3000, maxSoldiers: 3000, equippedTactic1: 'tac_zuo_you_kai_gong', equippedTactic2: null },
    { ...allGeneralsMap.get('gen_han_dang'), level: 10, exp: 0, currentSoldiers: 3000, maxSoldiers: 3000, equippedTactic1: null, equippedTactic2: null }
  ];

  return {
    version: 3,
    lastSavedTime: Date.now(),
    resources: {
      gold: 3000, // 初始开局赠送金铢 (关闭无限金珠，支持模拟充值)
      copper: 20000, // 初始战法研习铜币基金
      wood: 8000,
      iron: 8000,
      stone: 10000,
      grain: 8000,
      reserveSoldiers: 3000, // 初始预备兵
      challengeOrders: 50 // 征战令
    },
    rechargeStats: {
      totalMoney: 0,
      totalGold: 0,
      count: 0,
      history: []
    },
    campaignProgress: {}, // 关卡ID -> { stars: 3, cleared: true }
    trialFloor: 1, // 当前演武层数
    mapTiles: generateWorldMap(), // 9x9沙盘大地图 (兼顾兼容)
    resourceLands: { // 战棋版四大资源领地开拓进度 (木/铁/石/粮)
      wood: { maxOccupiedLevel: 1 },
      iron: { maxOccupiedLevel: 1 },
      stone: { maxOccupiedLevel: 1 },
      grain: { maxOccupiedLevel: 1 }
    },
    buildings: {
      palace: 1, // 君王殿 Lv.1
      barracks: 0, // 兵营
      militaryCamp: 1, // 军舍
      conscription: 1, // 征兵处
      quarry: 1, // 采石处
      ironMine: 1, // 冶铁所
      lumberMill: 1, // 伐木场
      farm: 1 // 军屯农田
    },
    ownedGenerals,
    tacticLevels: {
      'tac_yu_di_ping_zhang': 1,
      'tac_shou_qi_dao_luo': 1,
      'tac_zi_yu': 1,
      'tac_zuo_you_kai_gong': 1,
      'tac_fen_fa': 1
    },
    ownedTactics: [
      'tac_yu_di_ping_zhang', // 御敌屏障
      'tac_shou_qi_dao_luo', // 手起刀落
      'tac_zi_yu', // 自愈
      'tac_zuo_you_kai_gong', // 左右开弓
      'tac_fen_fa' // 奋发
    ],
    troops: [
      {
        id: 'troop_1',
        name: '第一军团·先锋开荒营',
        arm: 'shield', // 郭淮S盾，张宝A盾，关平A盾
        heroes: [ownedGenerals[0], ownedGenerals[1], ownedGenerals[2]], // 关平(主将) + 郭淮 + 张宝
        status: 'idle'
      },
      {
        id: 'troop_2',
        name: '第二军团·神射营',
        arm: 'bow',
        heroes: [ownedGenerals[3]], // 韩当(弓神)
        status: 'idle'
      },
      {
        id: 'troop_3',
        name: '第三军团·铁骑营',
        arm: 'cavalry',
        heroes: [],
        status: 'idle'
      },
      {
        id: 'troop_4',
        name: '第四军团·陷阵营',
        arm: 'spear',
        heroes: [],
        status: 'idle'
      },
      {
        id: 'troop_5',
        name: '第五军团·器械宿卫',
        arm: 'siege',
        heroes: [],
        status: 'idle'
      }
    ],
    currentTroopIndex: 0, // 当前出征选中的军团索引 (0~4)
    gachaPity: 0, // 距离5星保底已抽次数
    gachaPityFour: 0, // 距离4星保底已抽次数
    gachaCorePity: 0, // 连续获得普通5星橙卡计数 (用于7+1大核心暗保底)
    totalGachaCount: 0, // 历史累计抽卡总次数
    totalFiveStarCount: 0, // 历史累计获得5星总数
    totalCoreCount: 0, // 历史累计获得大核心总数
    customEnemyTroop: { // 自定义敌方演习阵容 (默认预设经典名将阵容：诸葛亮+刘备+关羽)
      name: '演习假想敌·天王神武军',
      arm: 'spear',
      heroes: [
        {
          generalId: 'gen_zhu_ge_liang', // 主将诸葛亮
          level: 50,
          currentSoldiers: 10000,
          maxSoldiers: 10000,
          tactic1Id: 'tac_ba_men_jin_suo',
          tactic2Id: 'tac_chen_huo_da_jie'
        },
        {
          generalId: 'gen_liu_bei', // 副将刘备
          level: 50,
          currentSoldiers: 10000,
          maxSoldiers: 10000,
          tactic1Id: 'tac_yu_di_ping_zhang',
          tactic2Id: 'tac_zi_yu'
        },
        {
          generalId: 'gen_guan_yu', // 副将关羽
          level: 50,
          currentSoldiers: 10000,
          maxSoldiers: 10000,
          tactic1Id: 'tac_suo_xiang_pi_mi',
          tactic2Id: 'tac_po_zhen_cui_jian'
        }
      ]
    },
    battleReports: []
  };
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialGameState();
    const data = JSON.parse(raw);

    // 确保 5 支军团槽位完整
    if (!data.troops || data.troops.length < 5) {
      const defaultNames = ['第一军团·先锋营', '第二军团·神射营', '第三军团·铁骑营', '第四军团·陷阵营', '第五军团·器械营'];
      const defaultArms = ['shield', 'bow', 'cavalry', 'spear', 'siege'];
      const existing = data.troops || [];
      for (let i = existing.length; i < 5; i++) {
        existing.push({
          id: `troop_${i + 1}`,
          name: defaultNames[i] || `第${i + 1}军团`,
          arm: defaultArms[i] || 'spear',
          heroes: [],
          status: 'idle'
        });
      }
      data.troops = existing;
    }

    if (data.currentTroopIndex === undefined) data.currentTroopIndex = 0;

    // 确保抽卡累计次数完整
    if (data.totalGachaCount === undefined) data.totalGachaCount = 0;
    if (data.totalFiveStarCount === undefined) data.totalFiveStarCount = 0;
    if (data.totalCoreCount === undefined) data.totalCoreCount = 0;
    if (data.gachaPityFour === undefined) data.gachaPityFour = 0;
    if (data.gachaCorePity === undefined) data.gachaCorePity = 0;

    // 确保模拟充值数据结构完整
    if (!data.rechargeStats) {
      data.rechargeStats = { totalMoney: 0, totalGold: 0, count: 0, history: [] };
    }

    // 确保演习假想敌结构完整
    if (!data.customEnemyTroop) {
      data.customEnemyTroop = {
        name: '演习假想敌·天王神武军',
        arm: 'spear',
        heroes: [
          { generalId: 'gen_zhu_ge_liang', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_ba_men_jin_suo', tactic2Id: 'tac_chen_huo_da_jie' },
          { generalId: 'gen_liu_bei', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_yu_di_ping_zhang', tactic2Id: 'tac_zi_yu' },
          { generalId: 'gen_guan_yu', level: 50, currentSoldiers: 10000, maxSoldiers: 10000, tactic1Id: 'tac_suo_xiang_pi_mi', tactic2Id: 'tac_po_zhen_cui_jian' }
        ]
      };
    }

    // 确保 resourceLands 结构存在
    if (!data.resourceLands) {
      data.resourceLands = {
        wood: { maxOccupiedLevel: 1 },
        iron: { maxOccupiedLevel: 1 },
        stone: { maxOccupiedLevel: 1 },
        grain: { maxOccupiedLevel: 1 }
      };
      // 从老 mapTiles 中继承最高等级
      (data.mapTiles || []).forEach(tile => {
        if (tile.occupiedByPlayer && tile.level > 0 && data.resourceLands[tile.resType]) {
          data.resourceLands[tile.resType].maxOccupiedLevel = Math.max(
            data.resourceLands[tile.resType].maxOccupiedLevel,
            tile.level
          );
        }
      });
    }

    // 计算挂机收益
    const now = Date.now();
    const elapsedMinutes = Math.min(24 * 60, Math.max(0, Math.floor((now - (data.lastSavedTime || now)) / (1000 * 60))));

    if (elapsedMinutes > 5) {
      // 统计所有已占领领地的产出
      let woodPerHour = 600;
      let ironPerHour = 600;
      let stonePerHour = 600;
      let grainPerHour = 600;

      // 四大资源领地产能
      const resTypes = ['wood', 'iron', 'stone', 'grain'];
      resTypes.forEach(rt => {
        const land = data.resourceLands[rt];
        const maxLv = land ? land.maxOccupiedLevel : 1;
        // 累计已通关等级产能或最高等级产能
        let prod = 0;
        for (let l = 1; l <= maxLv; l++) {
          prod += (LAND_TIERS[l]?.prodPerHour || 150);
        }
        if (rt === 'wood') woodPerHour += prod;
        if (rt === 'iron') ironPerHour += prod;
        if (rt === 'stone') stonePerHour += prod;
        if (rt === 'grain') grainPerHour += prod;
      });

      const hours = elapsedMinutes / 60;
      data.resources.wood = Math.round(data.resources.wood + woodPerHour * hours);
      data.resources.iron = Math.round(data.resources.iron + ironPerHour * hours);
      data.resources.stone = Math.round(data.resources.stone + stonePerHour * hours);
      data.resources.grain = Math.round(data.resources.grain + grainPerHour * hours);
      data.offlineReport = {
        minutes: elapsedMinutes,
        wood: Math.round(woodPerHour * hours),
        iron: Math.round(ironPerHour * hours),
        stone: Math.round(stonePerHour * hours),
        grain: Math.round(grainPerHour * hours)
      };
    }

    // 无限金铢模式加持
    data.infiniteGold = true;
    if (!data.resources.gold || data.resources.gold < 999999) {
      data.resources.gold = 999999;
    }
    if (!data.campaignProgress) {
      data.campaignProgress = {};
    }
    if (!data.trialFloor) {
      data.trialFloor = 1;
    }
    // 铜币与金铢确保充盈
    if (!data.resources.copper || data.resources.copper < 5000) {
      data.resources.copper = Math.max(data.resources.copper || 0, 20000);
    }
    // 确保基础传承战法已解锁 (A级良品起步)
    const baseTactics = ['tac_yu_di_ping_zhang', 'tac_shou_qi_dao_luo', 'tac_zi_yu'];
    data.ownedTactics = Array.from(new Set([...(data.ownedTactics || []), ...baseTactics]));

    // 战法等级记录 (Lv.1 ~ Lv.10)
    if (!data.tacticLevels || typeof data.tacticLevels !== 'object') {
      data.tacticLevels = {};
    }
    data.ownedTactics.forEach(tId => {
      if (!data.tacticLevels[tId]) {
        data.tacticLevels[tId] = 1;
      }
    });

    // 确保大地图与城建存在
    if (!data.mapTiles || !Array.isArray(data.mapTiles) || data.mapTiles.length === 0) {
      data.mapTiles = generateWorldMap();
    }
    if (!data.buildings || typeof data.buildings !== 'object') {
      data.buildings = {
        palace: 1,
        barracks: 0,
        militaryCamp: 1,
        conscription: 1,
        quarry: 1,
        ironMine: 1,
        lumberMill: 1,
        farm: 1
      };
    }
    if (!data.resources.wood) data.resources.wood = 8000;
    if (!data.resources.iron) data.resources.iron = 8000;
    if (!data.resources.stone) data.resources.stone = 10000;
    if (!data.resources.grain) data.resources.grain = 8000;

    // 保证武将 level 与 exp 兼容，并清洗历史重复装配战法的脏数据与同 ID 冲突
    const seenTactics = new Set();
    const seenGeneralIds = new Set();

    (data.ownedGenerals || []).forEach((g, idx) => {
      if (!g.level) g.level = 1;
      if (g.exp === undefined || g.exp === null) g.exp = 0;

      // 修复存量历史重复卡 ID 冲突问题 (赋予每张卡独立的实体身份)
      if (!g.id || seenGeneralIds.has(g.id)) {
        const oldId = g.id;
        g.id = `${g.id || 'gen'}_auto_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
      } else {
        seenGeneralIds.add(g.id);
      }

      if (g.equippedTactic1) {
        if (seenTactics.has(g.equippedTactic1)) {
          g.equippedTactic1 = null; // 重复占用，清空
        } else {
          seenTactics.add(g.equippedTactic1);
        }
      }

      // 🌟 红星进阶上限与数据自愈校准 (严格上限: 5星限5红、4星限4红、3星限3红)
      const maxRed = g.star || 5;
      if (g.redStars !== undefined && g.redStars !== null) {
        if (g.redStars > maxRed) {
          const over = g.redStars - maxRed;
          g.redStars = maxRed;
          g.force = Math.max(1, (g.force || 50) - over * 5);
          g.intel = Math.max(1, (g.intel || 50) - over * 5);
          g.command = Math.max(1, (g.command || 50) - over * 5);
          g.speed = Math.max(1, (g.speed || 50) - over * 5);
        }
      }
    });

    // 🌟 针对因一键进阶反向吞噬Bug受损的关平进行无损补偿修复：
    // 若玩家拥有关平且关平红星小于 4，自动恢复至 4 星满红 (4红)，并补齐应有的进阶属性
    const guanPingList = (data.ownedGenerals || []).filter(g => g.name === '关平');
    if (guanPingList.length > 0) {
      const mainGuanPing = guanPingList.reduce((prev, curr) => ((curr.level || 1) > (prev.level || 1) ? curr : prev), guanPingList[0]);
      if ((mainGuanPing.redStars || 0) < 4) {
        const addedRed = 4 - (mainGuanPing.redStars || 0);
        mainGuanPing.redStars = 4;
        mainGuanPing.force = (mainGuanPing.force || 82) + addedRed * 5;
        mainGuanPing.intel = (mainGuanPing.intel || 65) + addedRed * 5;
        mainGuanPing.command = (mainGuanPing.command || 80) + addedRed * 5;
        mainGuanPing.speed = (mainGuanPing.speed || 60) + addedRed * 5;
        console.log(`[数据补偿] 成功将因Bug受损的【关平】无损修复至 4 星满红 (+4红)！属性已补偿到位！`);
      }
    }

    data.lastSavedTime = now;
    return data;
  } catch (e) {
    console.warn('读取存档失败，初始化新游戏:', e);
    return createInitialGameState();
  }
}

export function saveGameState(state) {
  try {
    state.lastSavedTime = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('存档失败:', e);
  }
}

export function resetGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return createInitialGameState();
  } catch (e) {
    console.error('清除存档失败:', e);
    return createInitialGameState();
  }
}
