/**
 * 三国志·战略版 - 沙盘地图与开荒占地引擎 (Map & Conquest Engine)
 * 具备连地铺路、1~8级资源地、守军侦查、行军士气损耗、屯田丰收等机制
 */

export const MAP_CONFIG = {
  width: 9,
  height: 9,
  mainCityPos: { x: 4, y: 4 }
};

// 各级土地产出与守军难度配置
export const LAND_TIERS = {
  1: { level: 1, name: '1级荒野', soldiers: 100, prodPerHour: 100, arm: 'spear', leaderName: '山贼小卒', star: 2 },
  2: { level: 2, name: '2级荒地', soldiers: 500, prodPerHour: 200, arm: 'cavalry', leaderName: '黄巾乱军', star: 3 },
  3: { level: 3, name: '3级地', soldiers: 1200, prodPerHour: 400, arm: 'shield', leaderName: '校尉守备', star: 3 },
  4: { level: 4, name: '4级地', soldiers: 3500, prodPerHour: 800, arm: 'bow', leaderName: '韩当部曲', star: 4 },
  5: { level: 5, name: '5级地', soldiers: 9000, prodPerHour: 1500, arm: 'spear', leaderName: '关平前锋', star: 4 },
  6: { level: 6, name: '6级地', soldiers: 15000, prodPerHour: 2400, arm: 'cavalry', leaderName: '夏侯惇铁骑', star: 5 },
  7: { level: 7, name: '7级地', soldiers: 21000, prodPerHour: 3500, arm: 'shield', leaderName: '曹操中军', star: 5 },
  8: { level: 8, name: '8级名郡', soldiers: 27000, prodPerHour: 5000, arm: 'bow', leaderName: '周瑜水军', star: 5 }
};

export const RESOURCE_TYPES = {
  wood: { name: '伐木场', icon: '🌲', color: '#16a34a' },
  iron: { name: '冶铁矿', icon: '⛏️', color: '#64748b' },
  stone: { name: '采石场', icon: '🪨', color: '#ea580c' },
  grain: { name: '农粮田', icon: '🌾', color: '#eab308' }
};

/**
 * 生成预设沙盘大地图
 */
export function generateWorldMap() {
  const tiles = [];
  const resKeys = Object.keys(RESOURCE_TYPES);

  for (let y = 0; y < MAP_CONFIG.height; y++) {
    for (let x = 0; x < MAP_CONFIG.width; x++) {
      const isMainCity = (x === MAP_CONFIG.mainCityPos.x && y === MAP_CONFIG.mainCityPos.y);
      const distFromCity = Math.max(Math.abs(x - MAP_CONFIG.mainCityPos.x), Math.abs(y - MAP_CONFIG.mainCityPos.y));
      
      let level = 1;
      if (distFromCity === 1) level = Math.random() < 0.6 ? 1 : 2;
      else if (distFromCity === 2) level = Math.random() < 0.5 ? 2 : 3;
      else if (distFromCity === 3) level = Math.random() < 0.4 ? 3 : (Math.random() < 0.7 ? 4 : 5);
      else level = Math.random() < 0.3 ? 5 : (Math.random() < 0.6 ? 6 : (Math.random() < 0.85 ? 7 : 8));

      const resType = resKeys[(x * 3 + y * 7) % resKeys.length];

      tiles.push({
        id: `tile_${x}_${y}`,
        x,
        y,
        isMainCity,
        resType,
        level: isMainCity ? 0 : level,
        occupiedByPlayer: isMainCity, // 主城默认占领
        scouted: false,
        name: isMainCity ? '洛阳主都' : LAND_TIERS[level]?.name || '未名荒地'
      });
    }
  }

  return tiles;
}

/**
 * 判断指定地块是否与我方已有领地相邻（铺路判定）
 */
export function isTileAdjacentToPlayer(targetTile, allTiles) {
  const neighbors = [
    { x: targetTile.x - 1, y: targetTile.y },
    { x: targetTile.x + 1, y: targetTile.y },
    { x: targetTile.x, y: targetTile.y - 1 },
    { x: targetTile.x, y: targetTile.y + 1 }
  ];

  return neighbors.some(n => {
    const tile = allTiles.find(t => t.x === n.x && t.y === n.y);
    return tile && tile.occupiedByPlayer;
  });
}

/**
 * 计算行军距离与士气衰减
 */
export function calculateMarchMorale(startPos, targetPos) {
  const dist = Math.abs(startPos.x - targetPos.x) + Math.abs(startPos.y - targetPos.y);
  // 每格距离衰减 4 点士气
  const morale = Math.max(20, 100 - dist * 4);
  const travelSeconds = Math.max(3, dist * 2);
  return { dist, morale, travelSeconds };
}

/**
 * 构造该地块的守军部队
 */
export function createLandGuardTroop(tile) {
  const cfg = LAND_TIERS[tile.level] || LAND_TIERS[1];
  const armsList = ['cavalry', 'shield', 'bow', 'spear'];
  // 按照地块坐标固定一种兵种，方便侦查与兵种克制
  const seed = (tile.x * 13 + tile.y * 37) % armsList.length;
  const arm = cfg.arm || armsList[seed];

  return {
    isPlayer: false,
    arm,
    heroes: [
      {
        id: `guard_lead_${tile.x}_${tile.y}`,
        name: cfg.leaderName,
        camp: 'qun',
        star: cfg.star,
        avatar: cfg.star >= 5 ? '👑' : (cfg.star === 4 ? '🛡️' : '🗡️'),
        level: tile.level * 5,
        force: 60 + tile.level * 5,
        intel: 55 + tile.level * 4,
        command: 60 + tile.level * 5,
        speed: 50 + tile.level * 3,
        currentSoldiers: Math.round(cfg.soldiers * 0.5),
        maxSoldiers: Math.round(cfg.soldiers * 0.5),
        aptitude: { cavalry: 'A', shield: 'A', bow: 'A', spear: 'A', siege: 'B' },
        builtInTacticId: cfg.star >= 5 ? 'tac_suo_xiang_pi_mi' : 'tac_shou_qi_dao_luo'
      },
      {
        id: `guard_sub_${tile.x}_${tile.y}`,
        name: `${cfg.leaderName}副将`,
        camp: 'qun',
        star: Math.max(3, cfg.star - 1),
        avatar: '🏹',
        level: tile.level * 4,
        force: 50 + tile.level * 4,
        intel: 50 + tile.level * 4,
        command: 50 + tile.level * 4,
        speed: 45 + tile.level * 3,
        currentSoldiers: Math.round(cfg.soldiers * 0.5),
        maxSoldiers: Math.round(cfg.soldiers * 0.5),
        aptitude: { cavalry: 'B', shield: 'B', bow: 'B', spear: 'B', siege: 'B' },
        builtInTacticId: 'tac_fen_fa'
      }
    ]
  };
}
