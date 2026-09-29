import { StageConfig } from '../types/game';

export const STAGES: StageConfig[] = [
  {
    id: 'stage_1',
    name: '第一回：曲阳平乱',
    subtitle: '剿灭黄巾·荡平贼寇',
    description: '黄巾贼党蜂起，张角自号天公将军聚众作乱。主公当依山傍水，安扎义勇营寨，阻截贼寇突围！',
    bgTheme: 'yellow_sand',
    initialGold: 260,
    initialLives: 20,
    // 路径：双 U 型回龙弯盘旋设计，大幅强化中场回环交叉火力
    path: [
      { x: 30, y: 140 },
      { x: 260, y: 140 },
      { x: 260, y: 460 },
      { x: 500, y: 460 },
      { x: 500, y: 160 },
      { x: 740, y: 160 },
      { x: 740, y: 460 },
      { x: 970, y: 460 },
    ],
    // 推荐优质塔位（完美布局在各个回环马蹄弯核心，射程全覆盖）
    towerSlots: [
      { col: 2, row: 1 },
      { col: 3, row: 4 },
      { col: 3, row: 7 },
      { col: 7, row: 4 },
      { col: 7, row: 7 },
      { col: 8, row: 5 },
      { col: 12, row: 4 },
      { col: 12, row: 7 },
      { col: 16, row: 5 },
      { col: 17, row: 8 },
    ],
    waves: [
      {
        waveNumber: 1,
        name: '黄巾探哨',
        spawns: [
          { enemyId: 'yellow_turban_scout', count: 8, interval: 1.4, delayBefore: 0.5 },
        ],
      },
      {
        waveNumber: 2,
        name: '长枪结阵',
        spawns: [
          { enemyId: 'yellow_turban_scout', count: 6, interval: 1.2, delayBefore: 0 },
          { enemyId: 'yellow_turban_spearman', count: 6, interval: 1.5, delayBefore: 2 },
        ],
      },
      {
        waveNumber: 3,
        name: '突骑奔袭',
        spawns: [
          { enemyId: 'xiliang_cavalry', count: 6, interval: 1.1, delayBefore: 0.5 },
          { enemyId: 'yellow_turban_scout', count: 10, interval: 0.8, delayBefore: 2 },
        ],
      },
      {
        waveNumber: 4,
        name: '坚盾前行',
        spawns: [
          { enemyId: 'shield_guard', count: 5, interval: 2.0, delayBefore: 0 },
          { enemyId: 'yellow_turban_spearman', count: 8, interval: 1.0, delayBefore: 1 },
        ],
      },
      {
        waveNumber: 5,
        name: '太平妖术',
        spawns: [
          { enemyId: 'evil_sorcerer', count: 6, interval: 1.6, delayBefore: 0 },
          { enemyId: 'shield_guard', count: 4, interval: 1.8, delayBefore: 1 },
          { enemyId: 'xiliang_cavalry', count: 8, interval: 0.9, delayBefore: 2 },
        ],
      },
      {
        waveNumber: 6,
        name: '破阵冲城',
        spawns: [
          { enemyId: 'siege_ram', count: 2, interval: 3.5, delayBefore: 0 },
          { enemyId: 'yellow_turban_spearman', count: 12, interval: 0.8, delayBefore: 1 },
        ],
      },
      {
        waveNumber: 7,
        name: '决死狂潮',
        spawns: [
          { enemyId: 'shield_guard', count: 8, interval: 1.2, delayBefore: 0 },
          { enemyId: 'xiliang_cavalry', count: 10, interval: 0.8, delayBefore: 1.5 },
          { enemyId: 'evil_sorcerer', count: 6, interval: 1.2, delayBefore: 2 },
        ],
      },
      {
        waveNumber: 8,
        name: '黄天当立·张角降临',
        spawns: [
          { enemyId: 'boss_zhangjiao', count: 1, interval: 0, delayBefore: 0 },
          { enemyId: 'shield_guard', count: 6, interval: 1.5, delayBefore: 2 },
          { enemyId: 'xiliang_cavalry', count: 8, interval: 1.0, delayBefore: 4 },
        ],
      },
    ],
  },
  {
    id: 'stage_2',
    name: '第二回：虎牢雄关',
    subtitle: '关东盟军·力战华雄',
    description: '董卓乱京，挟天子以令诸侯。西凉军骁勇善战，更有大将华雄镇守雄关，请主公善用火计与军师控场！',
    bgTheme: 'stone_fortress',
    initialGold: 320,
    initialLives: 20,
    // 路径：虎牢关天堑蛇形三折盘旋，打造险要扼守关隘
    path: [
      { x: 30, y: 120 },
      { x: 280, y: 120 },
      { x: 280, y: 320 },
      { x: 120, y: 320 },
      { x: 120, y: 500 },
      { x: 520, y: 500 },
      { x: 520, y: 180 },
      { x: 780, y: 180 },
      { x: 780, y: 460 },
      { x: 970, y: 460 },
    ],
    // 推荐塔位：中央险关与多重夹道黄金点
    towerSlots: [
      { col: 1, row: 1 },
      { col: 4, row: 4 },
      { col: 5, row: 8 },
      { col: 8, row: 4 },
      { col: 8, row: 8 },
      { col: 12, row: 5 },
      { col: 13, row: 2 },
      { col: 14, row: 7 },
      { col: 17, row: 5 },
      { col: 17, row: 8 },
    ],
    waves: [
      {
        waveNumber: 1,
        name: '西凉先锋',
        spawns: [{ enemyId: 'xiliang_cavalry', count: 8, interval: 1.2, delayBefore: 0.5 }],
      },
      {
        waveNumber: 2,
        name: '重甲铁骑',
        spawns: [
          { enemyId: 'shield_guard', count: 6, interval: 1.4, delayBefore: 0 },
          { enemyId: 'xiliang_cavalry', count: 8, interval: 0.9, delayBefore: 1.5 },
        ],
      },
      {
        waveNumber: 3,
        name: '冲城攻坚',
        spawns: [
          { enemyId: 'siege_ram', count: 3, interval: 2.8, delayBefore: 0 },
          { enemyId: 'yellow_turban_spearman', count: 12, interval: 0.8, delayBefore: 1 },
        ],
      },
      {
        waveNumber: 4,
        name: '邪法祭祀',
        spawns: [
          { enemyId: 'evil_sorcerer', count: 8, interval: 1.2, delayBefore: 0 },
          { enemyId: 'shield_guard', count: 6, interval: 1.5, delayBefore: 1 },
        ],
      },
      {
        waveNumber: 5,
        name: '急行奔袭',
        spawns: [
          { enemyId: 'xiliang_cavalry', count: 15, interval: 0.7, delayBefore: 0 },
        ],
      },
      {
        waveNumber: 6,
        name: '关西狂澜·华雄压境',
        spawns: [
          { enemyId: 'boss_huaxiong', count: 1, interval: 0, delayBefore: 0 },
          { enemyId: 'shield_guard', count: 8, interval: 1.2, delayBefore: 2 },
          { enemyId: 'siege_ram', count: 2, interval: 3.0, delayBefore: 4 },
        ],
      },
    ],
  },
  {
    id: 'stage_3',
    name: '第三回：下邳围城',
    subtitle: '鏖战下邳·生擒吕布',
    description: '人中吕布，马中赤兔！方天画戟势不可挡，下邳城外水淹七军，各路猛将齐出，方能克制鬼神之威！',
    bgTheme: 'water_margin',
    initialGold: 380,
    initialLives: 20,
    // 路径：下邳外城护城河螺旋包围深入中军大营，极大扩充战术拦截与周旋纵深
    path: [
      { x: 30, y: 100 },
      { x: 920, y: 100 },
      { x: 920, y: 520 },
      { x: 200, y: 520 },
      { x: 200, y: 260 },
      { x: 680, y: 260 },
      { x: 680, y: 390 },
      { x: 440, y: 390 },
    ],
    // 推荐塔位：内城中枢与护城河外环核心夹攻位
    towerSlots: [
      { col: 4, row: 1 },
      { col: 8, row: 1 },
      { col: 14, row: 1 },
      { col: 16, row: 4 },
      { col: 16, row: 8 },
      { col: 6, row: 4 },
      { col: 8, row: 6 },
      { col: 11, row: 6 },
      { col: 11, row: 9 },
      { col: 6, row: 9 },
    ],
    waves: [
      {
        waveNumber: 1,
        name: '并州铁骑',
        spawns: [{ enemyId: 'xiliang_cavalry', count: 12, interval: 0.9, delayBefore: 0.5 }],
      },
      {
        waveNumber: 2,
        name: '陷阵死士',
        spawns: [
          { enemyId: 'shield_guard', count: 10, interval: 1.2, delayBefore: 0 },
          { enemyId: 'siege_ram', count: 3, interval: 2.5, delayBefore: 2 },
        ],
      },
      {
        waveNumber: 3,
        name: '群魔乱舞',
        spawns: [
          { enemyId: 'evil_sorcerer', count: 10, interval: 1.0, delayBefore: 0 },
          { enemyId: 'xiliang_cavalry', count: 12, interval: 0.8, delayBefore: 1 },
        ],
      },
      {
        waveNumber: 4,
        name: '双雄呼应',
        spawns: [
          { enemyId: 'boss_zhangjiao', count: 1, interval: 0, delayBefore: 0 },
          { enemyId: 'boss_huaxiong', count: 1, interval: 0, delayBefore: 6 },
          { enemyId: 'shield_guard', count: 8, interval: 1.0, delayBefore: 3 },
        ],
      },
      {
        waveNumber: 5,
        name: '天下无双·战神吕布',
        spawns: [
          { enemyId: 'boss_lvbu', count: 1, interval: 0, delayBefore: 0 },
          { enemyId: 'siege_ram', count: 4, interval: 2.5, delayBefore: 3 },
          { enemyId: 'xiliang_cavalry', count: 16, interval: 0.6, delayBefore: 5 },
        ],
      },
    ],
  },
];
