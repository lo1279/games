/**
 * pages/about/index.js - 关于页
 * 说明移植边界与后续规划，避免用户误以为所有游戏都已在小程序内
 */
const { GAMES_DATA } = require('../../utils/games-data.js');

Page({
  data: {
    totalGames: GAMES_DATA.length,
    playableGames: GAMES_DATA.filter(g => g.playable).map(g => g.title),
    pendingGames: GAMES_DATA.filter(g => !g.playable).map(g => g.title)
  }
});