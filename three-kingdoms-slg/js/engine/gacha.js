/**
 * 三国志·战略版 - 点将招募系统 (Gacha Engine)
 * 名将招募(金铢)、良将招募(铜币)、5星保底计数、重复卡牌战法转化
 */

import { GENERALS_DATA } from '../data/generals.js';

export const GACHA_CONFIG = {
  goldSingleCost: 198,
  goldFiveCost: 948,
  copperSingleCost: 300,
  copperTenCost: 2700,
  hardPityFiveStar: 30, // 广州灵犀官方正统：30抽必出5星名将大保底
  hardPityFourStar: 5   // 广州灵犀官方正统：5抽必出4星良将小保底
};

export function pullGeneral(poolType = 'famous', pityFiveCounter = 0, pityFourCounter = 0) {
  const isFamous = (poolType === 'famous');
  const fiveStars = GENERALS_DATA.filter(g => g.star === 5);
  const fourStars = GENERALS_DATA.filter(g => g.star === 4);

  // 1. 触发 5 星大保底判定 (第 30 抽必出 5 星橙卡)
  if (isFamous && pityFiveCounter >= GACHA_CONFIG.hardPityFiveStar - 1) {
    const gen = fiveStars[Math.floor(Math.random() * fiveStars.length)];
    return { general: { ...gen }, isFivePity: true, resetFivePity: true, resetFourPity: true };
  }

  // 2. 触发 4 星小保底判定 (连续 4 抽未出紫橙，第 5 抽必出 4 星紫卡或 5 星橙卡)
  if (isFamous && pityFourCounter >= GACHA_CONFIG.hardPityFourStar - 1) {
    // 按 5.6% / (5.6% + 36.0%) = 13.5% 出 5 星，86.5% 出 4 星
    const isPityFive = (Math.random() * 100 < 13.5);
    if (isPityFive) {
      const gen = fiveStars[Math.floor(Math.random() * fiveStars.length)];
      return { general: { ...gen }, isFivePity: false, resetFivePity: true, resetFourPity: true };
    } else {
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen }, isFourPity: true, resetFivePity: false, resetFourPity: true };
    }
  }

  const roll = Math.random() * 100;

  if (isFamous) {
    // 广州灵犀官方正统公示概率：5星 5.6%, 4星 36.0%, 3星 58.4%
    if (roll < 5.6) {
      const gen = fiveStars[Math.floor(Math.random() * fiveStars.length)];
      return { general: { ...gen }, isFivePity: false, resetFivePity: true, resetFourPity: true };
    } else if (roll < 41.6) { // 5.6 + 36.0 = 41.6
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen }, isFourPity: false, resetFivePity: false, resetFourPity: true };
    } else {
      // 3星随军良将 (58.4%)
      const gen = createThreeStarGeneral();
      return { general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false };
    }
  } else {
    // 广州灵犀官方正统铜币良将池概率：4星 0.5% (极罕见), 3星 50.0%, 2星/杂兵 49.5%
    if (roll < 0.5) {
      const gen = fourStars[Math.floor(Math.random() * fourStars.length)];
      return { general: { ...gen }, isFivePity: false, resetFivePity: false, resetFourPity: true };
    } else {
      const gen = createThreeStarGeneral();
      return { general: gen, isFivePity: false, resetFivePity: false, resetFourPity: false };
    }
  }
}

function createThreeStarGeneral() {
  const threeStarNames = [
    { name: '潘凤', camp: 'qun', title: '无双上将', avatar: '🪓' },
    { name: '刘禅', camp: 'shu', title: '安乐公', avatar: '🐥' },
    { name: '曹休', camp: 'wei', title: '千里驹', avatar: '🐎' },
    { name: '孙静', camp: 'wu', title: '江东宿卫', avatar: '🛡️' },
    { name: '朱儁', camp: 'qun', title: '右中郎将', avatar: '🏹' },
    { name: '廖化', camp: 'shu', title: '先锋无敌', avatar: '🗡️' }
  ];
  const t = threeStarNames[Math.floor(Math.random() * threeStarNames.length)];
  return {
    id: `gen_3s_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: t.name,
    camp: t.camp,
    star: 3,
    cost: 3,
    title: t.title,
    avatar: t.avatar,
    avatarBg: '#475569',
    force: 65,
    forceGrowth: 1.2,
    intel: 60,
    intelGrowth: 1.1,
    command: 65,
    commandGrowth: 1.2,
    speed: 50,
    speedGrowth: 0.9,
    aptitude: { cavalry: 'B', shield: 'B', bow: 'B', spear: 'B', siege: 'B' },
    builtInTacticId: 'tac_fen_fa',
    bio: '随军宿将，可用作演练传承战法或强化进阶。'
  };
}
