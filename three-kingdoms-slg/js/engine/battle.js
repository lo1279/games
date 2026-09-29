/**
 * 三国志·战略版 - 核心回合制战报推演引擎 (Battle Engine)
 * 严格按照 兵种克制、适性加成、阵营国家队加成、速度先手顺序、四类战法判定、状态控制与斩首机制执行
 */

import { GENERAL_APTITUDE_MODIFIERS, ARMS } from '../data/generals.js';
import { TACTICS_DATA, getTacticEffectiveProps } from '../data/tactics.js';

const TACTICS_MAP = new Map(TACTICS_DATA.map(t => [t.id, t]));

/**
 * 兵种克制判定
 * 骑克盾、盾克弓、弓克枪、枪克骑；器械被四大常规兵种克制
 */
export function getArmAdvantageMultiplier(attackerArm, defenderArm) {
  if (attackerArm === defenderArm) return 1.0;
  
  if (attackerArm === 'cavalry' && defenderArm === 'shield') return 1.15;
  if (attackerArm === 'shield' && defenderArm === 'bow') return 1.15;
  if (attackerArm === 'bow' && defenderArm === 'spear') return 1.15;
  if (attackerArm === 'spear' && defenderArm === 'cavalry') return 1.15;

  if (defenderArm === 'siege' && attackerArm !== 'siege') return 1.25;
  if (attackerArm === 'siege' && defenderArm !== 'siege') return 0.80;

  // 被克制
  if (attackerArm === 'shield' && defenderArm === 'cavalry') return 0.85;
  if (attackerArm === 'bow' && defenderArm === 'shield') return 0.85;
  if (attackerArm === 'spear' && defenderArm === 'bow') return 0.85;
  if (attackerArm === 'cavalry' && defenderArm === 'spear') return 0.85;

  return 1.0;
}

/**
 * 战前部队实例初始化
 */
function createBattleHero(heroData, troopArm, isLeader, isPlayer, tacticLevels = {}) {
  const aptGrade = heroData.aptitude[troopArm] || 'C';
  const aptMod = GENERAL_APTITUDE_MODIFIERS[aptGrade] || 1.0;

  const currentLevel = heroData.level || 1;
  const rawForce = heroData.force + (heroData.forceGrowth || 1) * (currentLevel - 1);
  const rawIntel = heroData.intel + (heroData.intelGrowth || 1) * (currentLevel - 1);
  const rawCommand = heroData.command + (heroData.commandGrowth || 1) * (currentLevel - 1);
  const rawSpeed = heroData.speed + (heroData.speedGrowth || 1) * (currentLevel - 1);

  const defaultSoldiers = (heroData.currentSoldiers !== undefined && heroData.currentSoldiers !== null) 
    ? heroData.currentSoldiers 
    : 10000;

  return {
    id: heroData.id,
    name: heroData.name,
    camp: heroData.camp,
    star: heroData.star,
    avatar: heroData.avatar,
    isLeader,
    isPlayer,
    aptGrade,
    aptMod,
    currentSoldiers: defaultSoldiers,
    maxSoldiers: defaultSoldiers,
    initialSoldiers: defaultSoldiers,
    
    // 实战属性（受适性修正）
    force: Math.round(rawForce * aptMod),
    intel: Math.round(rawIntel * aptMod),
    command: Math.round(rawCommand * aptMod),
    speed: Math.round(rawSpeed * aptMod),

    // 装备战法 (按战法研习等级强化实际战法属性)
    tactics: [
      heroData.builtInTacticId,
      heroData.equippedTactic1,
      heroData.equippedTactic2
    ].filter(Boolean).map(id => {
      const raw = TACTICS_MAP.get(id);
      if (!raw) return null;
      const lvl = isPlayer ? (tacticLevels[id] || 1) : 5;
      return getTacticEffectiveProps(raw, lvl);
    }).filter(Boolean),

    // 战斗内临时状态
    buffs: {
      damageDealtMod: 1.0,
      damageReceivedMod: 1.0,
      firstStrike: false, // 先攻
      insight: false,    // 洞察 (免疫控制)
      disarmed: 0,       // 缴械回合
      silenced: 0,       // 计穷回合
      stunned: 0,        // 震慑回合
      weakness: 0,       // 虚弱回合
      burn: 0,           // 灼烧回合
      burnDmg: 0,
      sandstorm: 0,      // 沙暴回合
      continuousAttack: false, // 连击
      shieldLayers: 0,   // 抵御层数
      isPreparingActive: null // 准备战法中
    },

    // 战报统计数据
    stats: {
      damageDealt: 0,
      healDone: 0,
      kills: 0,
      damageTaken: 0,
      tacticsCast: 0
    }
  };
}

/**
 * 模拟推演一场完整战斗 (8回合)
 * @param {Object} playerTroop 玩家部队
 * @param {Object} enemyTroop 敌方守军部队
 * @param {Object} options 包含士气、攻守城等选项
 */
export function simulateBattle(playerTroop, enemyTroop, options = {}) {
  const battleLogs = [];
  const log = (round, text, type = 'normal', meta = {}) => {
    battleLogs.push({ round, text, type, meta });
  };

  const pArm = playerTroop.arm || 'spear';
  const eArm = enemyTroop.arm || 'cavalry';
  const pArmName = ARMS[pArm]?.name || pArm;
  const eArmName = ARMS[eArm]?.name || eArm;

  log(0, `⚔️ 战斗爆发！我军【${pArmName}】与敌军【${eArmName}】在沙盘交锋！`, 'header');

  // 兵种克制
  const pArmAdv = getArmAdvantageMultiplier(pArm, eArm);
  const eArmAdv = getArmAdvantageMultiplier(eArm, pArm);

  if (pArmAdv > 1.0) {
    log(0, `🔺 我军【${pArmName}】克制敌军【${eArmName}】！兵刃与谋略伤害提升 15%！`, 'advantage');
  } else if (eArmAdv > 1.0) {
    log(0, `🔻 敌军【${eArmName}】克制我军【${pArmName}】！敌军获得克制增益！`, 'disadvantage');
  }

  // 实例化双方战斗武将 (主将必须位于首位)
  const playerHeroes = playerTroop.heroes.map((h, i) => createBattleHero(h, pArm, i === 0, true, options.tacticLevels || {}));
  const enemyHeroes = enemyTroop.heroes.map((h, i) => createBattleHero(h, eArm, i === 0, false, {}));

  // 阵营加成检查 (若上阵3人均为同阵营，获得10%全属性提升)
  const checkCampBonus = (heroes, teamName) => {
    if (heroes.length >= 3 && heroes.every(h => h.camp === heroes[0].camp)) {
      const camp = heroes[0].camp;
      heroes.forEach(h => {
        h.force = Math.round(h.force * 1.1);
        h.intel = Math.round(h.intel * 1.1);
        h.command = Math.round(h.command * 1.1);
        h.speed = Math.round(h.speed * 1.1);
      });
      log(0, `🏰 ${teamName}激活【${camp.toUpperCase()}国国家队】阵营加成！全员核心属性提升 10%！`, 'camp');
    }
  };
  checkCampBonus(playerHeroes, '我军');
  checkCampBonus(enemyHeroes, '敌军');

  // 士气系统修正 (士气低于100时，每降1点降低0.7%伤害)
  const pMorale = Math.max(0, Math.min(100, options.playerMorale ?? 100));
  const pMoraleMod = 0.3 + 0.7 * (pMorale / 100);
  if (pMorale < 100) {
    log(0, `🚩 我军士气当前为 ${pMorale}，部队战斗力修正为 ${(pMoraleMod * 100).toFixed(0)}%`, 'morale');
  }

  // ================= 阶段 0: 准备回合 (执行指挥与被动战法) =================
  log(0, `【准备回合】双方将领施展军略阵法……`, 'sub-header');

  const executePrepTactics = (actor, team, opposingTeam) => {
    actor.tactics.forEach(tactic => {
      // 诸如一身是胆
      if (tactic.insight) {
        actor.buffs.insight = true;
        actor.force += tactic.statBoost || 0;
        actor.intel += tactic.statBoost || 0;
        actor.command += tactic.statBoost || 0;
        actor.speed += tactic.statBoost || 0;
        log(0, `【${actor.name}】触发被动战法【${tactic.name}】：获得洞察之身，四大属性全面暴涨 ${tactic.statBoost} 点！`, 'skill');
      }
      // 八门金锁
      if (tactic.id === 'tac_ba_men_jin_suo') {
        const leader = team.find(h => h.isLeader);
        if (leader) leader.buffs.firstStrike = true;
        opposingTeam.slice(0, 2).forEach(opp => {
          opp.buffs.damageDealtMod -= tactic.damageReduction || 0.3;
        });
        log(0, `【${actor.name}】施展指挥战法【${tactic.name}】：我方主将获得先攻，敌方群体伤害降低 30%！`, 'skill');
      }
      // 盛气凌敌
      if (tactic.id === 'tac_sheng_qi_ling_di') {
        opposingTeam.slice(0, 2).forEach(opp => {
          if (!opp.buffs.insight && Math.random() * 100 < (tactic.disarmRate || 90)) {
            opp.buffs.disarmed = tactic.firstRounds || 2;
            log(0, `【${actor.name}】触发指挥战法【${tactic.name}】：敌将【${opp.name}】陷入缴械，前2回合无法普通攻击！`, 'debuff');
          }
        });
      }
      // 曹操 乱世奸雄
      if (tactic.id === 'tac_luan_shi_jian_xiong') {
        team.forEach(mate => mate.buffs.damageDealtMod += tactic.teamDamageBonus || 0.16);
        actor.buffs.damageReceivedMod -= tactic.selfDamageReduction || 0.18;
        log(0, `【${actor.name}】发动指挥战法【${tactic.name}】：友军伤害增加 16%，自身减伤 18%！`, 'skill');
      }
      // 白马义从
      if (tactic.id === 'tac_bai_ma_yi_cong') {
        team.forEach(mate => {
          mate.buffs.firstStrike = true;
        });
        log(0, `【${actor.name}】列阵【${tactic.name}】：弓兵进阶！全员获得先攻与战法发动增益！`, 'skill');
      }
      // 御敌屏障
      if (tactic.id === 'tac_yu_di_ping_zhang') {
        team.slice(0, 2).forEach(mate => {
          mate.buffs.damageReceivedMod -= tactic.teamDamageReduction || 0.25;
        });
        log(0, `【${actor.name}】施展指挥战法【${tactic.name}】：我军群体受伤害降低 25%！`, 'skill');
      }
      // 青囊相助
      if (tactic.id === 'tac_qing_nang_xiang_zhu') {
        team.forEach(mate => mate.command += (tactic.statBoostCmd || 40));
        log(0, `【${actor.name}】施展指挥战法【${tactic.name}】：群体统率提升 40 点并开启受创急救！`, 'skill');
      }
      // 太史慈 神射
      if (tactic.doubleAttack) {
        actor.buffs.continuousAttack = true;
        log(0, `【${actor.name}】触发被动【${tactic.name}】：获得每回合稳定连击，双箭齐发！`, 'skill');
      }
      // 郭嘉 十胜十败
      if (tactic.id === 'tac_shi_sheng_shi_bai') {
        const leader = team.find(h => h.isLeader);
        if (leader) {
          leader.buffs.insight = true;
          leader.buffs.damageReceivedMod -= 0.50;
          log(0, `【${actor.name}】施展指挥【${tactic.name}】：主将【${leader.name}】前2回合获得洞察免疫控制，减伤50%！`, 'skill');
        }
      }
      // 吕蒙 白衣渡江
      if (tactic.id === 'tac_bai_yi_du_jiang') {
        team.forEach(mate => {
          mate.buffs.shieldLayers = (mate.buffs.shieldLayers || 0) + 1;
        });
        log(0, `【${actor.name}】施展指挥【${tactic.name}】：我军全体首回合获得 1 层【抵御】！`, 'buff');
      }
      // 左慈 金丹秘术
      if (tactic.id === 'tac_jin_dan_mi_shu') {
        team.forEach(mate => {
          mate.buffs.evasionRate = 0.60;
        });
        log(0, `【${actor.name}】施展仙术【${tactic.name}】：前2回合我军全体获得 60%【金丹规避】！`, 'buff');
      }
      // 马超 槊血复骑
      if (tactic.id === 'tac_shuo_xue_fu_qi') {
        actor.force += 34;
        actor.buffs.hasSplash = true;
        log(0, `【${actor.name}】触发被动【${tactic.name}】：武力提升 34 点，普攻附带全军溅射！`, 'skill');
      }
      // 甘宁 锦帆百狩
      if (tactic.id === 'tac_jin_fan_bai_shou') {
        actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.50;
        actor.buffs.critDamage = (actor.buffs.critDamage || 1.5) + 0.70;
        log(0, `【${actor.name}】触发被动【${tactic.name}】：会心几率暴涨 50%，暴击伤害提升 120%！`, 'skill');
      }
      // 百炼成钢
      if (tactic.id === 'tac_bai_lian_cheng_gang') {
        actor.force += 36;
        actor.intel += 36;
        actor.command += 36;
        actor.speed += 36;
        log(0, `【${actor.name}】百炼成钢：四维属性全方位提升 36 点！`, 'skill');
      }
    });
  };

  [...playerHeroes, ...enemyHeroes].forEach(h => {
    const team = h.isPlayer ? playerHeroes : enemyHeroes;
    const opp = h.isPlayer ? enemyHeroes : playerHeroes;
    executePrepTactics(h, team, opp);
  });

  // ================= 正式战斗 (最多 8 回合) =================
  let winner = null; // 'player' | 'enemy' | 'draw'

  for (let round = 1; round <= 8; round++) {
    log(round, `▶ ====== 第 ${round} 回合 ====== ◀`, 'round-start');

    // 存活人员按先攻与速度排序
    const allLiving = [...playerHeroes, ...enemyHeroes].filter(h => h.currentSoldiers > 0);
    allLiving.sort((a, b) => {
      if (a.buffs.firstStrike !== b.buffs.firstStrike) {
        return a.buffs.firstStrike ? -1 : 1;
      }
      return b.speed - a.speed;
    });

    for (const actor of allLiving) {
      if (actor.currentSoldiers <= 0) continue; // 中途阵亡

      const team = actor.isPlayer ? playerHeroes : enemyHeroes;
      const oppTeam = actor.isPlayer ? enemyHeroes : playerHeroes;
      const livingOpps = oppTeam.filter(h => h.currentSoldiers > 0);

      if (livingOpps.length === 0) break;

      // 持续伤害结算 (如灼烧、沙暴)
      if (actor.buffs.burn > 0) {
        const dotDmg = Math.round(actor.buffs.burnDmg * (actor.currentSoldiers / actor.initialSoldiers + 0.5));
        actor.currentSoldiers = Math.max(0, actor.currentSoldiers - dotDmg);
        actor.stats.damageTaken += dotDmg;
        log(round, `🔥【${actor.name}】受到烈火灼烧，溃散 ${dotDmg} 兵力！`, 'dot');
        actor.buffs.burn--;
        if (actor.currentSoldiers <= 0) {
          log(round, `💀【${actor.name}】在火海中溃败阵亡！`, 'death');
          continue;
        }
      }

      // 检查震慑 (无法行动)
      if (actor.buffs.stunned > 0) {
        log(round, `😵【${actor.name}】处于震慑状态，动弹不得，跳过本回合！`, 'status');
        actor.buffs.stunned--;
        continue;
      }

      // 持续战法触发 (如用武通神、绝地反击)
      const yongWuTac = actor.tactics.find(t => t.id === 'tac_yong_wu_tong_shen');
      if (yongWuTac && (round === 2 || round === 4 || round === 6 || round === 8)) {
        const mult = (round === 2 ? 0.75 : round === 4 ? 1.05 : round === 6 ? 1.35 : 1.65);
        livingOpps.forEach(opp => {
          const dmg = Math.round((actor.intel * 1.4 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * mult);
          opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
          actor.stats.damageDealt += dmg;
          log(round, `⚡ 用武通神第 ${round} 回合爆发！对【${opp.name}】造成 ${dmg} 稳定谋略轰击！`, 'action');
        });
      }

      const jueDiTac = actor.tactics.find(t => t.id === 'tac_jue_di_fan_ji');
      if (jueDiTac && round === 5) {
        const dmg = Math.round((actor.force * 2.2 - 50) * Math.sqrt(actor.currentSoldiers / 100));
        livingOpps.forEach(opp => {
          opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
          actor.stats.damageDealt += dmg;
          log(round, `🛡️💥 绝地反击第 5 回合蓄力爆发！对【${opp.name}】发动致命反击轰杀 ${dmg} 兵力！`, 'action');
        });
      }

      // 1. 发动主动战法
      executeActiveTactics(round, actor, team, livingOpps, log, pMoraleMod, pArmAdv, eArmAdv);

      // 再次检查敌方是否全灭
      const freshLivingOpps = oppTeam.filter(h => h.currentSoldiers > 0);
      if (freshLivingOpps.length === 0) break;

      // 2. 普通攻击
      if (actor.buffs.disarmed > 0) {
        log(round, `🚫【${actor.name}】处于缴械状态，无法进行普通攻击！`, 'status');
        actor.buffs.disarmed--;
      } else {
        // 普通攻击次数 (连击则为 2 次)
        const attackCount = actor.buffs.continuousAttack ? 2 : 1;
        for (let i = 0; i < attackCount; i++) {
          if (oppTeam.filter(h => h.currentSoldiers > 0).length === 0) break;
          performNormalAttack(round, actor, oppTeam, log, pMoraleMod, pArmAdv, eArmAdv);
        }
      }

      // 检查斩首：如果任何一方主将阵亡，战斗直接提前终结！
      const playerLeader = playerHeroes[0];
      const enemyLeader = enemyHeroes[0];
      if (playerLeader.currentSoldiers <= 0) {
        log(round, `💥 我军主将【${playerLeader.name}】兵败溃围！全军失去指挥大败！`, 'defeat');
        winner = 'enemy';
        break;
      }
      if (enemyLeader.currentSoldiers <= 0) {
        log(round, `🎉 敌军主将【${enemyLeader.name}】被斩落马下！敌军阵型瓦解崩溃！`, 'victory');
        winner = 'player';
        break;
      }
    }

    if (winner) break;

    // 检查是否有任何一方全员被剿灭
    const playerAlive = playerHeroes.some(h => h.currentSoldiers > 0);
    const enemyAlive = enemyHeroes.some(h => h.currentSoldiers > 0);
    if (!playerAlive) { winner = 'enemy'; break; }
    if (!enemyAlive) { winner = 'player'; break; }
  }

  // 8回合结束判定胜负 (若未斩首，对比双方残存兵力百分比)
  if (!winner) {
    const pRemPct = playerHeroes.reduce((s, h) => s + h.currentSoldiers, 0) / playerHeroes.reduce((s, h) => s + h.initialSoldiers, 0);
    const eRemPct = enemyHeroes.reduce((s, h) => s + h.currentSoldiers, 0) / enemyHeroes.reduce((s, h) => s + h.initialSoldiers, 0);
    if (pRemPct > eRemPct + 0.1) {
      winner = 'player';
      log(8, `🏁 8 回合战罢，我军兵力占据绝对优势，斩获战役胜利！`, 'victory');
    } else if (eRemPct > pRemPct + 0.1) {
      winner = 'enemy';
      log(8, `🏁 8 回合战罢，敌军守备严密，我军攻势受阻遗憾退兵！`, 'defeat');
    } else {
      winner = 'draw';
      log(8, `🏁 8 回合战罢，双方势均力敌，战成平局！`, 'draw');
    }
  }

  // 计算双方总战损与阵亡统计
  const summary = {
    winner,
    rounds: battleLogs.filter(l => l.type === 'round-start').length,
    playerInitialSoldiers: playerHeroes.reduce((s, h) => s + h.initialSoldiers, 0),
    playerFinalSoldiers: playerHeroes.reduce((s, h) => s + h.currentSoldiers, 0),
    playerLosses: playerHeroes.reduce((s, h) => s + (h.initialSoldiers - h.currentSoldiers), 0),
    enemyInitialSoldiers: enemyHeroes.reduce((s, h) => s + h.initialSoldiers, 0),
    enemyFinalSoldiers: enemyHeroes.reduce((s, h) => s + h.currentSoldiers, 0),
    enemyLosses: enemyHeroes.reduce((s, h) => s + (h.initialSoldiers - h.currentSoldiers), 0),
    playerArm: pArm,
    enemyArm: eArm,
    playerHeroStats: playerHeroes.map(h => ({
      name: h.name,
      avatar: h.avatar,
      camp: h.camp,
      star: h.star,
      isLeader: h.isLeader,
      initial: h.initialSoldiers,
      remaining: h.currentSoldiers,
      losses: h.initialSoldiers - h.currentSoldiers,
      damage: h.stats.damageDealt,
      kills: h.stats.kills,
      heals: h.stats.healDone,
      tactics: h.tactics.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        quality: t.quality,
        level: t.level || 1
      }))
    })),
    enemyHeroStats: enemyHeroes.map(h => ({
      name: h.name,
      avatar: h.avatar,
      camp: h.camp,
      star: h.star,
      isLeader: h.isLeader,
      initial: h.initialSoldiers,
      remaining: h.currentSoldiers,
      losses: h.initialSoldiers - h.currentSoldiers,
      damage: h.stats.damageDealt,
      kills: h.stats.kills,
      heals: h.stats.healDone,
      tactics: h.tactics.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        quality: t.quality,
        level: t.level || 1
      }))
    }))
  };

  // 通关星级判定 (1~3星)
  let stars = 0;
  if (winner === 'player') {
    stars = 1;
    const pLossRatio = summary.playerLosses / Math.max(1, summary.playerInitialSoldiers);
    if (summary.rounds <= 5) stars++;
    if (pLossRatio <= 0.40) stars++;
  }
  summary.stars = stars;

  return { logs: battleLogs, summary };
}

/**
 * 普通攻击逻辑 (包含张辽锁敌、突击战法联动与反击判定)
 */
function performNormalAttack(round, actor, oppTeam, log, moraleMod, pArmAdv, eArmAdv) {
  const livingOpps = oppTeam.filter(h => h.currentSoldiers > 0);
  if (livingOpps.length === 0) return;

  // 目标选取：若有锁主将概率则打主将，否则随机打击
  let target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
  const hasLockLeader = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi');
  if (hasLockLeader && Math.random() < 0.68) {
    const oppLeader = oppTeam.find(h => h.isLeader && h.currentSoldiers > 0);
    if (oppLeader) target = oppLeader;
  }

  // 典韦 古之恶来：替主将承担普攻
  if (target.isLeader) {
    const protector = oppTeam.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_gu_zhi_e_lai'));
    if (protector && protector !== target) {
      log(round, `🪓【典韦】挺身而出！舍身替主将【${target.name}】格挡拦截此次攻势！`, 'skill');
      target = protector;
    }
  }

  // 伤害计算 (基础兵刃普攻)
  const armAdv = actor.isPlayer ? pArmAdv : eArmAdv;
  const baseDmg = Math.max(20, (actor.force * 1.5 - target.command * 0.75));
  const soldierRatio = Math.sqrt(actor.currentSoldiers / 100);
  let finalDmg = Math.round(baseDmg * soldierRatio * armAdv * (actor.isPlayer ? moraleMod : 1.0) * actor.buffs.damageDealtMod * target.buffs.damageReceivedMod);

  // 会心暴击判定 (甘宁 / 黄忠)
  let isCrit = false;
  if (actor.buffs.critRate && Math.random() < actor.buffs.critRate) {
    isCrit = true;
    const critMult = actor.buffs.critDamage || 2.0;
    finalDmg = Math.round(finalDmg * critMult);
  }

  // 虚弱判断
  if (actor.buffs.weakness > 0) finalDmg = 0;

  // 抵御与规避判定
  if (target.buffs.evasionRate && Math.random() < target.buffs.evasionRate) {
    log(round, `✨【${target.name}】身法鬼魅，凭借【金丹规避】完全避开了致命攻击！`, 'buff');
    finalDmg = 0;
  } else if (target.buffs.shieldLayers > 0) {
    target.buffs.shieldLayers--;
    log(round, `🛡️【${actor.name}】对【${target.name}】发起普攻，但被【抵御】完全化解！`, 'action');
    finalDmg = 0;
  } else {
    target.currentSoldiers = Math.max(0, target.currentSoldiers - finalDmg);
    actor.stats.damageDealt += finalDmg;
    target.stats.damageTaken += finalDmg;
    const critText = isCrit ? '💥 触发【会心暴击】！' : '';
    log(round, `🗡️【${actor.name}】挥戈突刺，${critText}对【${target.name}】造成 ${finalDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action');

    // 马超 槊血复骑：普攻群体溅射
    if (actor.buffs.hasSplash && finalDmg > 0) {
      const splashDmg = Math.round(finalDmg * 0.54);
      oppTeam.filter(h => h.currentSoldiers > 0 && h !== target).forEach(other => {
        other.currentSoldiers = Math.max(0, other.currentSoldiers - splashDmg);
        actor.stats.damageDealt += splashDmg;
        log(round, `🐎 槊血溅射！狂暴枪芒波及【${other.name}】造成 ${splashDmg} 兵刃溅射！`, 'action');
      });
    }
  }

  // 受到伤害后的急救判定 (青囊相助)
  if (finalDmg > 0 && target.currentSoldiers > 0) {
    const hasQingNang = target.tactics.some(t => t.id === 'tac_qing_nang_xiang_zhu');
    if (hasQingNang && Math.random() < 0.5) {
      const heal = Math.round(target.intel * 1.2);
      target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
      target.stats.healDone += heal;
      log(round, `🧪【${target.name}】受创触发【青囊急救】，瞬时稳住阵脚，恢复 ${heal} 兵力！`, 'heal');
    }
  }

  // 反击判定 (夏侯惇 刚烈不屈)
  if (finalDmg > 0 && target.currentSoldiers > 0) {
    const retaliateTactic = target.tactics.find(t => t.id === 'tac_gang_lie_bu_qu');
    if (retaliateTactic && Math.random() * 100 < retaliateTactic.retaliateRate) {
      const retDmg = Math.round(target.force * 1.1 * Math.sqrt(target.currentSoldiers / 100));
      actor.currentSoldiers = Math.max(0, actor.currentSoldiers - retDmg);
      target.stats.damageDealt += retDmg;
      log(round, `⚡【${target.name}】刚烈狂怒！拔矢啖睛触发反击，轰击【${actor.name}】造成 ${retDmg} 兵刃反伤！`, 'skill');
    }
  }

  // 突击战法触发判定 (仅在普攻后判定)
  if (actor.currentSoldiers > 0) {
    actor.tactics.filter(t => t.type === 'assault').forEach(tac => {
      const bonusRate = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi') ? 15 : 0;
      if (Math.random() * 100 < (tac.rate + bonusRate)) {
        actor.stats.tacticsCast++;
        executeAssaultTactic(round, actor, tac, target, oppTeam, log, moraleMod, armAdv);
      }
    });
  }
}

/**
 * 突击战法执行 (一骑当千、手起刀落)
 */
function executeAssaultTactic(round, actor, tactic, primaryTarget, oppTeam, log, moraleMod, armAdv) {
  const lvlTag = tactic.level ? `Lv.${tactic.level} ` : '';
  log(round, `⚡【${actor.name}】普攻破阵，连携发动突击战法【${lvlTag}${tactic.name}】！`, 'skill');

  if (tactic.id === 'tac_yi_qi_dang_qian') {
    const baseRate = tactic.damageRate || 1.08;
    const rate = actor.isLeader ? (baseRate * 1.33) : baseRate;
    oppTeam.filter(h => h.currentSoldiers > 0).forEach(opp => {
      const dmg = Math.round((actor.force * 1.4 - opp.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1));
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🌪️ 一骑当千横扫八荒！对【${opp.name}】造成 ${dmg} 巨额兵刃轰击！`, 'action');
    });
  } else if (tactic.id === 'tac_shou_qi_dao_luo') {
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.84;
      const dmg = Math.round((actor.force * 1.8 - primaryTarget.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate / 1.84 * armAdv);
      primaryTarget.currentSoldiers = Math.max(0, primaryTarget.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🗡️ 手起刀落迅疾斩杀！对【${primaryTarget.name}】造成 ${dmg} 致命追击！`, 'action');
    }
  } else if (tactic.id === 'tac_zhe_chong_yu_wu') {
    // 太史慈正统传承：折冲御侮
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      primaryTarget.command = Math.max(10, primaryTarget.command - 60);
      primaryTarget.intel = Math.max(10, primaryTarget.intel - 60);
      log(round, `🛡️ 折冲御侮双重破防！令【${primaryTarget.name}】统率与智力大幅削减 60 点！`, 'debuff');
    }
    const team = actor.isPlayer ? oppTeam : oppTeam; // 主将获取抵御
    // 给友军主将套2层抵御
    const myTeam = actor.isPlayer ? (actor.buffs.isPreparingActive ? oppTeam : null) : null;
    // 寻找主将
    const leader = (actor.isPlayer ? document?.game?.state?.troops?.[0]?.heroes?.[0] : null);
    actor.buffs.shieldLayers = (actor.buffs.shieldLayers || 0) + 2;
    log(round, `🛡️【${actor.name}】誓死卫主！为主将施加 2 层【抵御】坚壁护盾(免疫2次伤害)！`, 'buff');
  } else if (tactic.id === 'tac_yong_zhe_de_qian') {
    // 张辽正统传承：勇者得前
    actor.buffs.shieldLayers = (actor.buffs.shieldLayers || 0) + 1;
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * 1.5;
    log(round, `⚡ 勇者得前！【${actor.name}】获得 1 层【抵御】，下次输出造成的伤害暴增 50%！`, 'buff');
  } else if (tactic.id === 'tac_bao_li_wu_ren') {
    // 董卓正统传承：暴戾无仁
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const dmg = Math.round((actor.force * 1.9 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tactic.damageRate || 1.96) / 1.96 * armAdv);
      primaryTarget.currentSoldiers = Math.max(0, primaryTarget.currentSoldiers - dmg);
      primaryTarget.buffs.confused = 1;
      actor.stats.damageDealt += dmg;
      log(round, `🩸 暴戾无仁狂残劈击！对【${primaryTarget.name}】造成 ${dmg} 毁灭兵刃痛击并使其陷入【混乱】！`, 'action');
    }
  } else if (tactic.id === 'tac_jiang_dong_xiao_ba_wang') {
    // 孙策自带：江东小霸王
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const dmg = Math.round((actor.force * 1.7 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.92 * armAdv);
      primaryTarget.currentSoldiers = Math.max(0, primaryTarget.currentSoldiers - dmg);
      const heal = Math.round(actor.force * 1.16 * Math.sqrt(actor.currentSoldiers / 100));
      actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
      actor.stats.damageDealt += dmg;
      actor.stats.healDone += heal;
      log(round, `🐯 江东小霸王霸道破阵！对【${primaryTarget.name}】造成 ${dmg} 兵刃暴击，并破血自愈 ${heal} 兵力！`, 'action');
    }
  }
}

/**
 * 主动战法触发与执行
 */
function executeActiveTactics(round, actor, team, livingOpps, log, moraleMod, pArmAdv, eArmAdv) {
  if (actor.buffs.silenced > 0) {
    log(round, `🤐【${actor.name}】处于计穷状态，无法发动任何主动战法！`, 'status');
    actor.buffs.silenced--;
    return;
  }

  const armAdv = actor.isPlayer ? pArmAdv : eArmAdv;

  actor.tactics.filter(t => t.type === 'active').forEach(tac => {
    const lvlTag = tac.level ? `Lv.${tac.level} ` : '';
    // 蓄力准备判定 (如威震华夏、所向披靡)
    if (tac.requiresPrep) {
      if (actor.buffs.isPreparingActive === tac.id) {
        actor.buffs.isPreparingActive = null;
        log(round, `🔥【${actor.name}】蓄力完成！撼世战法【${lvlTag}${tac.name}】磅礴释放！`, 'skill');
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
        return;
      } else {
        if (Math.random() * 100 < tac.rate) {
          actor.buffs.isPreparingActive = tac.id;
          log(round, `⌛【${actor.name}】沉声立定，开始蓄势准备绝技【${lvlTag}${tac.name}】！(下回合释放)`, 'prep');
          return;
        }
      }
    } else {
      if (Math.random() * 100 < tac.rate) {
        actor.stats.tacticsCast++;
        log(round, `✨【${actor.name}】大喝一声，发动主动战法【${lvlTag}${tac.name}】！`, 'skill');
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
      }
    }
  });
}

function castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv) {
  const lvlTag = tac.level ? `Lv.${tac.level} ` : '';
  // 威震华夏
  if (tac.id === 'tac_wei_zhen_hua_xia') {
    livingOpps.forEach(opp => {
      const dmgRate = tac.damageRate || 1.46;
      const dmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🐉 青龙偃月威震华夏！对【${opp.name}】造成 ${dmg} 兵刃暴击！`, 'action');
      if (!opp.buffs.insight && Math.random() < 0.5) {
        opp.buffs.silenced = 1;
        log(round, `⛓️【${opp.name}】被关羽威势震慑，陷入计穷 1 回合！`, 'debuff');
      }
    });
  }
  // 所向披靡
  else if (tac.id === 'tac_suo_xiang_pi_mi') {
    livingOpps.forEach(opp => {
      const dmgRate = tac.damageRate || 2.06;
      const dmg = Math.round((actor.force * 1.7 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `💥 所向披靡席卷全场！对【${opp.name}】造成 ${dmg} 毁灭性兵刃打击！`, 'action');
    });
  }
  // 刮骨疗毒
  else if (tac.id === 'tac_gua_gu_liao_du') {
    const wounded = [...team].filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers))[0];
    if (wounded) {
      wounded.buffs.silenced = 0;
      wounded.buffs.disarmed = 0;
      wounded.buffs.burn = 0;
      const healRate = tac.healRate || 2.56;
      const heal = Math.round(actor.intel * healRate * Math.sqrt(actor.currentSoldiers / 100));
      wounded.currentSoldiers = Math.min(wounded.maxSoldiers, wounded.currentSoldiers + heal);
      actor.stats.healDone += heal;
      log(round, `🩹 刮骨疗毒圣手回春！清除【${wounded.name}】所有负面状态，大幅疗愈 ${heal} 兵力！`, 'heal');
    }
  }
  // 火烧连营
  else if (tac.id === 'tac_huo_shao_lian_ying') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      target.buffs.burn = 2;
      target.buffs.burnDmg = Math.round(actor.intel * 1.18);
      log(round, `🌋 夷陵烽火连天！对【${target.name}】点燃火势，附带 2 回合灼烧溃逃！`, 'debuff');
    }
  }
  // 天下无双
  else if (tac.id === 'tac_tian_xia_wu_shuang') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      log(round, `🔥 方天画戟怒指！【${actor.name}】强行邀战【${target.name}】进行绝命单挑 3 连击！`, 'skill');
      for (let s = 1; s <= 3; s++) {
        if (target.currentSoldiers <= 0 || actor.currentSoldiers <= 0) break;
        const d = Math.round((actor.force * 1.6 - target.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * armAdv);
        target.currentSoldiers = Math.max(0, target.currentSoldiers - d);
        actor.stats.damageDealt += d;
        log(round, ` ⚡ 第 ${s} 击：狂猛重斩，削去【${target.name}】 ${d} 兵力！`, 'action');
      }
    }
  }
  // 横扫千军 (关羽/赵云官方传承)
  else if (tac.id === 'tac_heng_sao_qian_jun') {
    livingOpps.forEach(opp => {
      const dmgRate = tac.damageRate || 1.60;
      const dmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `⚔️ 横扫千军破阵横劈！对【${opp.name}】造成 ${dmg} 点狂暴兵刃轰击！`, 'action');
      // 若敌处于缴械或计穷，30%概率陷入震慑
      if ((opp.buffs.disarmed > 0 || opp.buffs.silenced > 0) && !opp.buffs.insight && Math.random() < 0.35) {
        opp.buffs.stunned = 1;
        log(round, `⚡【${opp.name}】伤势引爆，被震慑陷入瘫痪，下回合动弹不得！`, 'debuff');
      }
    });
  }
  // 嗔目横矛 (张飞官方传承)
  else if (tac.id === 'tac_chen_mu_heng_mao') {
    actor.force += 50;
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * 1.35;
    log(round, `🐅 嗔目横矛虎啸！【${actor.name}】武力暴涨 50 点，开启 2 回合群攻溅射重劈！`, 'buff');
  }
  // 风助火势 (周瑜官方传承)
  else if (tac.id === 'tac_feng_zhu_huo_shi') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      let dmgRate = tac.damageRate || 1.54;
      const isBurning = (target.buffs.burn > 0);
      if (isBurning) dmgRate += 1.98; // 灼烧引爆额外追加198%
      const dmg = Math.round((actor.intel * 1.6 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      target.currentSoldiers = Math.max(0, target.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      if (isBurning) {
        log(round, `🌪️🔥 借东风势引爆火海！【风助火势】对【${target.name}】造成 ${dmg} 毁灭连环烈焰谋轰！`, 'action');
      } else {
        log(round, `🌪️ 风助火势疾风骤起！对【${target.name}】造成 ${dmg} 谋略狂击！`, 'action');
      }
    }
  }
  // 熯天炽地 (陆逊官方传承)
  else if (tac.id === 'tac_han_tian_chi_di') {
    livingOpps.forEach(opp => {
      const dmg = Math.round((actor.intel * 1.4 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.02) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.72);
      actor.stats.damageDealt += dmg;
      log(round, `🌋 熯天炽地焦土千里！对【${opp.name}】造成 ${dmg} 烈火轰炸并点燃 2 回合大火！`, 'action');
    });
  }
  // 卧薪尝胆 (孙权官方传承)
  else if (tac.id === 'tac_wo_xin_chang_dan') {
    const targets = livingOpps.slice(0, 2);
    // 根据自身连击、先攻、洞察等Buff层数提高震慑几率
    let buffCount = 0;
    if (actor.buffs.continuousAttack) buffCount++;
    if (actor.buffs.firstStrike) buffCount++;
    if (actor.buffs.insight) buffCount++;
    const stunChance = 0.25 + buffCount * 0.15; // 最高 70% 震慑

    targets.forEach(opp => {
      const dmg = Math.round((actor.force * 1.3 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 0.96) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `⚔️ 卧薪尝胆坚毅奋战！对【${opp.name}】造成 ${dmg} 兵刃重创！`, 'action');
      if (!opp.buffs.insight && Math.random() < stunChance) {
        opp.buffs.stunned = 1;
        log(round, `❄️【${opp.name}】被孙权帝王雄姿震慑，陷入瘫痪！`, 'debuff');
      }
    });
  }
  // 倾国倾城 (貂蝉官方传承)
  else if (tac.id === 'tac_qing_guo_qing_cheng') {
    const targets = livingOpps.slice(0, 2);
    targets.forEach(opp => {
      opp.buffs.silenced = 1;
      log(round, `🌹 倾国倾城红颜祸水！【${opp.name}】心神迷乱，陷入计穷无法施展战法！`, 'debuff');
    });
  }
  // 百步穿杨 (黄忠自带)
  else if (tac.id === 'tac_bai_bu_chuan_yang') {
    actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.25;
    livingOpps.forEach(opp => {
      const dmg = Math.round((actor.force * 1.6 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.80) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🏹 百步穿杨万钧开弓！对【${opp.name}】造成 ${dmg} 极速暴击箭雨轰击！`, 'action');
    });
  }
  // 以逸待劳 (法正自带)
  else if (tac.id === 'tac_yi_yi_dai_lao') {
    team.slice(0, 2).forEach(mate => {
      const heal = Math.round(actor.intel * 1.58 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      mate.buffs.damageReceivedMod -= 0.40;
      actor.stats.healDone += heal;
      log(round, `📜 以逸待劳神机安澜！为【${mate.name}】回复 ${heal} 兵力并附加 40% 强效减伤！`, 'heal');
    });
  }
  // 铁索连环 (庞统自带)
  else if (tac.id === 'tac_tie_suo_lian_huan') {
    livingOpps.forEach(opp => {
      const dmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.56) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `⛓️ 铁索连环大计！锁困【${opp.name}】造成 ${dmg} 谋略狂轰，并连带全场！`, 'action');
    });
  }
  // 十面埋伏 (程昱自带)
  else if (tac.id === 'tac_shi_mian_mai_fu') {
    livingOpps.forEach(opp => {
      const dmg = Math.round(actor.intel * 1.65 * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26));
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      opp.buffs.cannotHeal = 2;
      actor.stats.damageDealt += dmg;
      log(round, `🔮 十面埋伏叛逃真伤！对【${opp.name}】无视统御贯穿 ${dmg} 兵力，并施加 2 回合禁疗！`, 'action');
    });
  }
  // 五雷轰顶 (张角自带)
  else if (tac.id === 'tac_wu_lei_hong_ding') {
    for (let strike = 1; strike <= 5; strike++) {
      const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
      if (freshLiving.length === 0) break;
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const dmg = Math.round((actor.intel * 1.55 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.36) * armAdv);
      target.currentSoldiers = Math.max(0, target.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `⚡ 第 ${strike} 道五雷轰顶！天雷劈中【${target.name}】造成 ${dmg} 狂暴雷击！`, 'action');
      if (!target.buffs.insight && Math.random() < 0.35) {
        target.buffs.stunned = 1;
        log(round, `🌩️【${target.name}】被九天玄雷震慑麻痹陷入瘫痪！`, 'debuff');
      }
    }
  }
  // 累世立名 (袁绍自带)
  else if (tac.id === 'tac_lei_shi_li_ming') {
    livingOpps.slice(0, 2).forEach(opp => {
      const dmg = Math.round(((actor.force + actor.intel) * 0.9 - (opp.command + opp.intel) * 0.4) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `👑 累世立名诸侯联军！对【${opp.name}】造成 ${dmg} 兵刃谋略兼备重击！`, 'action');
    });
    team.forEach(mate => mate.command += 80);
    log(round, `🛡️ 四世三公号令三军！全军统率大幅提升 80 点！`, 'buff');
  }
  // 万箭齐发 (黄忠官方传承)
  else if (tac.id === 'tac_wan_jian_qi_fa') {
    livingOpps.forEach(opp => {
      const dmg = Math.round((actor.force * 1.4 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.40) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🏹 万箭齐发漫天箭雨！对【${opp.name}】造成 ${dmg} 兵刃重创！`, 'action');
    });
  }
  // 沉沙决水 (法正/郭嘉官方传承)
  else if (tac.id === 'tac_chen_sha_jue_shui') {
    livingOpps.slice(0, 2).forEach(opp => {
      const dmg = Math.round((actor.intel * 1.45 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      opp.buffs.damageReceivedMod += 0.25;
      actor.stats.damageDealt += dmg;
      log(round, `🌊 沉沙决水汪洋水攻！对【${opp.name}】造成 ${dmg} 水攻，且使其受到谋略伤害提升 25%！`, 'action');
    });
  }
  // 破阵摧坚 (孙策/庞统官方传承)
  else if (tac.id === 'tac_po_zhen_cui_jian') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.command = Math.max(10, opp.command - 80);
      opp.intel = Math.max(10, opp.intel - 80);
      const dmg = Math.round((actor.force * 1.6 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.58) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `💥 破阵摧坚削弱统智！重砍【${opp.name}】造成 ${dmg} 毁灭兵刃打击！`, 'action');
    });
  }
  // 杯蛇鬼车 (左慈官方传承)
  else if (tac.id === 'tac_bei_she_gui_che') {
    livingOpps.slice(0, 2).forEach(opp => {
      const dmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.53) * armAdv);
      opp.currentSoldiers = Math.max(0, opp.currentSoldiers - dmg);
      actor.stats.damageDealt += dmg;
      log(round, `🐍 杯蛇鬼车幽冥幻法！对【${opp.name}】造成 ${dmg} 奇门谋略伤害！`, 'action');
    });
    team.slice(0, 2).forEach(mate => {
      const heal = Math.round(actor.intel * 1.02 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      actor.stats.healDone += heal;
      log(round, `✨ 杯蛇生息！治愈【${mate.name}】恢复 ${heal} 兵力！`, 'heal');
    });
  }
  // 黄天泰平 (张角官方传承)
  else if (tac.id === 'tac_huang_tian_tai_ping') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.buffs.silenced = 2;
      log(round, `🕊️ 黄天泰平咒印封禁！【${opp.name}】陷入计穷 2 回合，无法释放主动战法！`, 'debuff');
    });
  }
  // 一力拒守 (典韦官方传承)
  else if (tac.id === 'tac_yi_li_ju_shou') {
    const heal = Math.round(actor.force * 2.68 * Math.sqrt(actor.currentSoldiers / 100));
    actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
    actor.command += 42;
    actor.stats.healDone += heal;
    log(round, `🛡️ 一力拒守铜墙铁壁！【${actor.name}】自愈狂增 ${heal} 兵力，统率提升 42 点！`, 'heal');
  }
}
