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
      gold: 999999, // 无限金铢 (支持随时畅抽5星名将)
      copper: 20000, // 初始战法研习铜币基金
      wood: 8000,
      iron: 8000,
      stone: 10000,
      grain: 8000,
      reserveSoldiers: 3000, // 初始预备兵
      challengeOrders: 50 // 征战令
    },
    infiniteGold: true,
    campaignProgress: {}, // 关卡ID -> { stars: 3, cleared: true }
    trialFloor: 1, // 当前演武层数
    mapTiles: generateWorldMap(), // 9x9沙盘大地图
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
        name: '第二军团·游骑',
        arm: 'bow',
        heroes: [],
        status: 'idle'
      }
    ],
    gachaPity: 0,
    battleReports: []
  };
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialGameState();
    const data = JSON.parse(raw);

    // 计算挂机收益
    const now = Date.now();
    const elapsedMinutes = Math.min(24 * 60, Math.max(0, Math.floor((now - (data.lastSavedTime || now)) / (1000 * 60))));

    if (elapsedMinutes > 5) {
      // 统计所有已占领领地的产出
      let woodPerHour = 600;
      let ironPerHour = 600;
      let stonePerHour = 600;
      let grainPerHour = 600;

      (data.mapTiles || []).forEach(tile => {
        if (tile.occupiedByPlayer && tile.level > 0) {
          const cfg = LAND_TIERS[tile.level];
          if (cfg) {
            if (tile.resType === 'wood') woodPerHour += cfg.prodPerHour;
            if (tile.resType === 'iron') ironPerHour += cfg.prodPerHour;
            if (tile.resType === 'stone') stonePerHour += cfg.prodPerHour;
            if (tile.resType === 'grain') grainPerHour += cfg.prodPerHour;
          }
        }
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

    // 保证武将 level 与 exp 兼容，并清洗历史重复装配战法的脏数据
    const seenTactics = new Set();
    (data.ownedGenerals || []).forEach(g => {
      if (!g.level) g.level = 1;
      if (g.exp === undefined || g.exp === null) g.exp = 0;

      if (g.equippedTactic1) {
        if (seenTactics.has(g.equippedTactic1)) {
          g.equippedTactic1 = null; // 重复占用，清空
        } else {
          seenTactics.add(g.equippedTactic1);
        }
      }

      if (g.equippedTactic2) {
        if (seenTactics.has(g.equippedTactic2) || g.equippedTactic2 === g.equippedTactic1) {
          g.equippedTactic2 = null; // 重复占用，清空
        } else {
          seenTactics.add(g.equippedTactic2);
        }
      }
    });

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
