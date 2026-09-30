/**
 * 三国志·战略版 - 沙盘地图与开荒占地引擎 (Map & Conquest Engine)
 * 具备连地铺路、1~8级资源地、守军侦查、行军士气损耗、屯田丰收等机制
 */

export const MAP_CONFIG = {
  width: 9,
  height: 9,
  mainCityPos: { x: 4, y: 4 }
};

// 各级土地产出与守军难度配置 (1~10级完整阶梯)
export const LAND_TIERS = {
  1: { level: 1, name: '1级荒野', soldiers: 100, prodPerHour: 150, arm: 'spear', leaderName: '山贼小卒', star: 2 },
  2: { level: 2, name: '2级荒地', soldiers: 500, prodPerHour: 300, arm: 'cavalry', leaderName: '黄巾乱军', star: 3 },
  3: { level: 3, name: '3级地', soldiers: 1200, prodPerHour: 600, arm: 'shield', leaderName: '校尉守备', star: 3 },
  4: { level: 4, name: '4级地', soldiers: 3500, prodPerHour: 1000, arm: 'bow', leaderName: '韩当部曲', star: 4 },
  5: { level: 5, name: '5级地', soldiers: 9000, prodPerHour: 1800, arm: 'spear', leaderName: '关平前锋', star: 4 },
  6: { level: 6, name: '6级地', soldiers: 15000, prodPerHour: 2800, arm: 'cavalry', leaderName: '夏侯惇铁骑', star: 5 },
  7: { level: 7, name: '7级地', soldiers: 21000, prodPerHour: 4200, arm: 'shield', leaderName: '曹操中军', star: 5 },
  8: { level: 8, name: '8级名郡', soldiers: 27000, prodPerHour: 6000, arm: 'bow', leaderName: '周瑜水军', star: 5 },
  9: { level: 9, name: '9级名城', soldiers: 36000, prodPerHour: 8000, arm: 'spear', leaderName: '关羽关家军', star: 5 },
  10: { level: 10, name: '10级巨都', soldiers: 45000, prodPerHour: 10500, arm: 'shield', leaderName: '诸葛亮八阵营', star: 5 }
};

export const RESOURCE_TYPES = {
  wood: { key: 'wood', name: '苍翠林场', resName: '木材', icon: '🌲', color: '#16a34a', bgGrad: 'linear-gradient(135deg, rgba(22,163,74,0.18) 0%, rgba(5,46,22,0.6) 100%)', border: '#16a34a' },
  iron: { key: 'iron', name: '幽铁矿脉', resName: '铁矿', icon: '⛏️', color: '#94a3b8', bgGrad: 'linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(30,41,59,0.6) 100%)', border: '#64748b' },
  stone: { key: 'stone', name: '崇山石场', resName: '石料', icon: '🪨', color: '#f97316', bgGrad: 'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(67,20,7,0.6) 100%)', border: '#ea580c' },
  grain: { key: 'grain', name: '天府粮田', resName: '农粮', icon: '🌾', color: '#eab308', bgGrad: 'linear-gradient(135deg, rgba(234,179,8,0.18) 0%, rgba(66,32,6,0.6) 100%)', border: '#ca8a04' }
};

/**
 * 生成预设沙盘大地图 (保留兼容老存档)
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
 * 构造该地块或等级的守军部队 (统一 3 人满编队伍，每人 3 战法)
 */
export function createLandGuardTroop(tileOrLevel, resType = 'wood') {
  const level = typeof tileOrLevel === 'number' ? tileOrLevel : (tileOrLevel.level || 1);
  const cfg = LAND_TIERS[level] || LAND_TIERS[1];
  
  // 兵种对应各级特色，也可由 resType 或 level 决定
  const arm = cfg.arm || 'spear';
  
  // 兵力配比：主将 40%，副将各 30%
  const leadSoldiers = Math.round(cfg.soldiers * 0.4);
  const subSoldiers = Math.round(cfg.soldiers * 0.3);

  // 依据地块等级配置守将与战法
  const star = cfg.star;
  const isHighTier = level >= 6;
  const isBossTier = level >= 9;

  return {
    isPlayer: false,
    arm,
    heroes: [
      {
        id: `guard_lead_lv${level}_${resType}`,
        name: cfg.leaderName,
        camp: isBossTier ? (level === 10 ? 'shu' : 'shu') : (isHighTier ? (level === 7 ? 'wei' : (level === 8 ? 'wu' : 'wei')) : 'qun'),
        star,
        avatar: isBossTier ? '👑' : (isHighTier ? '🌟' : (star === 4 ? '🛡️' : '🗡️')),
        level: Math.min(50, level * 5),
        force: 60 + level * 6,
        intel: 55 + level * 5,
        command: 60 + level * 6,
        speed: 50 + level * 4,
        currentSoldiers: leadSoldiers,
        maxSoldiers: leadSoldiers,
        aptitude: { cavalry: 'S', shield: 'S', bow: 'S', spear: 'S', siege: 'A' },
        builtInTacticId: isBossTier ? 'tac_suo_xiang_pi_mi' : (isHighTier ? 'tac_luo_feng' : 'tac_shou_qi_dao_luo'),
        equippedTactic1: isHighTier ? 'tac_yu_di_ping_zhang' : 'tac_fen_fa',
        equippedTactic2: isBossTier ? 'tac_ba_men_jin_suo' : (isHighTier ? 'tac_zi_yu' : null)
      },
      {
        id: `guard_sub1_lv${level}_${resType}`,
        name: `${cfg.leaderName}左卫`,
        camp: 'qun',
        star: Math.max(3, star - (isHighTier ? 0 : 1)),
        avatar: '🏹',
        level: Math.min(50, Math.max(5, level * 4)),
        force: 50 + level * 5,
        intel: 50 + level * 4,
        command: 50 + level * 5,
        speed: 45 + level * 3,
        currentSoldiers: subSoldiers,
        maxSoldiers: subSoldiers,
        aptitude: { cavalry: 'A', shield: 'A', bow: 'A', spear: 'A', siege: 'B' },
        builtInTacticId: isHighTier ? 'tac_zuo_you_kai_gong' : 'tac_fen_fa',
        equippedTactic1: isHighTier ? 'tac_zi_yu' : null,
        equippedTactic2: isBossTier ? 'tac_shou_qi_dao_luo' : null
      },
      {
        id: `guard_sub2_lv${level}_${resType}`,
        name: `${cfg.leaderName}右翼`,
        camp: 'qun',
        star: Math.max(3, star - 1),
        avatar: '🛡️',
        level: Math.min(50, Math.max(5, level * 4)),
        force: 48 + level * 5,
        intel: 52 + level * 4,
        command: 52 + level * 5,
        speed: 44 + level * 3,
        currentSoldiers: subSoldiers,
        maxSoldiers: subSoldiers,
        aptitude: { cavalry: 'A', shield: 'A', bow: 'A', spear: 'A', siege: 'B' },
        builtInTacticId: 'tac_yu_di_ping_zhang',
        equippedTactic1: isHighTier ? 'tac_shou_qi_dao_luo' : null,
        equippedTactic2: isBossTier ? 'tac_fen_fa' : null
      }
    ]
  };
}
