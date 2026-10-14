/**
 * PvP 对战推演粘合层
 * 复用 battle.js 的 simulateBattle（双方规则对称、无隐性加成），
 * 通过 seed 保证同一场战斗在挑战方/防守方两端重算结果完全一致，从而可复现、防客户端篡改。
 */

const { simulateBattle } = require("./battle.js");
// 战报裁剪与单机共用同一实现，避免两份逻辑漂移（详见 report.js 的体积预算说明）
const { compactReport, MAX_LADDER_LOGS } = require("./report.js");

/**
 * 推演一场 PvP。
 * @param {object} challengerFormation 挑战方阵型（含 heroes + tacticLevels）
 * @param {object} defenderFormation 防守方阵型（含 heroes + tacticLevels）
 * @param {string} seed 共享种子（由对战双方同一公式生成并存储）
 * @returns {{winner:'challenger'|'defender'|'draw', report:{summary:object,logs:Array}}}
 */
function resolvePvpResult(challengerFormation, defenderFormation, seed) {
  const r = simulateBattle(challengerFormation, defenderFormation, {
    tacticLevels: (challengerFormation && challengerFormation.tacticLevels) || {},
    enemyTacticLevels: (defenderFormation && defenderFormation.tacticLevels) || {},
    seed
  });
  let winner = 'draw';
  if (r.summary.winner === 'player') winner = 'challenger';
  else if (r.summary.winner === 'enemy') winner = 'defender';
  // 战报含循环引用且体积巨大，存储前必须裁剪（天梯日志给到 MAX_LADDER_LOGS）
  return { winner, report: compactReport(r.summary, r.logs, MAX_LADDER_LOGS) };
}

/**
 * 校验已存储对战结果是否被篡改：用存储的 seed + 双方阵型重算，与存储的 result 比对。
 * @param {object} battle pvp_battles 行（含 challenger_formation / defender_formation / seed / result）
 * @returns {{ok:boolean, winner?:string, stored?:string, reason?:string}}
 */
function verifyBattleResult(battle) {
  if (!battle) return { ok: false, reason: 'empty' };
  try {
    const { winner } = resolvePvpResult(battle.challenger_formation, battle.defender_formation, battle.seed);
    return { ok: winner === battle.result, winner, stored: battle.result };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

module.exports = Object.assign(module.exports || {}, {
  resolvePvpResult,
  verifyBattleResult
});
