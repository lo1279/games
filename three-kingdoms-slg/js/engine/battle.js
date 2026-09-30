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

  const heroBattleId = isPlayer ? `p_${heroData.id || heroData.name}` : `e_${heroData.id || heroData.name}`;
  const teamPrefix = isPlayer ? '我军' : '敌军';

  return {
    id: heroData.id,
    battleId: heroBattleId,
    name: heroData.name,
    label: `${teamPrefix}·${heroData.name}`,
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
      // 若武将自身显式指定了统一战法等级(如试炼模式强制拉满10级)，优先采用；否则按配置字典或默认值读取
      const lvl = heroData.tacticLevel || (isPlayer ? (tacticLevels[id] || 1) : (tacticLevels[id] || 5));
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
      confused: 0,       // 混乱回合
      burn: 0,           // 灼烧回合
      burnDmg: 0,
      continuousAttack: false, // 连击
      trueStrike: false,       // 必中 (无视规避与抵御)
      shieldLayers: 0,         // 抵御剩余次数 (不可无脑无限叠加，单次最多2层)
      shieldDuration: 0,       // 抵御剩余持续回合数
      shareDamageTarget: null, // 闭月伤害分担受击替身
      shareDamageRate: 0,      // 伤害分担比例
      shareDamageDuration: 0,  // 分担持续回合
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
  const pArm = playerTroop.arm || 'spear';
  const eArm = enemyTroop.arm || 'cavalry';
  const pArmName = ARMS[pArm]?.name || pArm;
  const eArmName = ARMS[eArm]?.name || eArm;

  // 实例化双方战斗武将 (主将必须位于首位)
  const playerHeroes = playerTroop.heroes.map((h, i) => createBattleHero(h, pArm, i === 0, true, options.tacticLevels || {}));
  const enemyHeroes = enemyTroop.heroes.map((h, i) => createBattleHero(h, eArm, i === 0, false, options.enemyTacticLevels || {}));

  const battleLogs = [];
  const log = (round, text, type = 'normal', meta = {}) => {
    let processedText = text;

    // 安全兜底逻辑：仅针对未带阵营前缀的武将名补充阵营标签
    // 若模板中已原生使用【我军·XXX】或【敌军·XXX】，则完全保持原貌
    if (meta.actor && !meta.target) {
      processedText = processedText.replaceAll(`【${meta.actor.name}】`, `【${meta.actor.label}】`);
    } else if (meta.target && !meta.actor) {
      processedText = processedText.replaceAll(`【${meta.target.name}】`, `【${meta.target.label}】`);
    } else if (meta.actor && meta.target && meta.actor.name !== meta.target.name) {
      processedText = processedText.replaceAll(`【${meta.actor.name}】`, `【${meta.actor.label}】`);
      processedText = processedText.replaceAll(`【${meta.target.name}】`, `【${meta.target.label}】`);
    }
    // 同名武将交锋时，由于调用处模板均已直接采用 actor.label 与 target.label，杜绝任何模糊猜测

    if (meta.targets && Array.isArray(meta.targets)) {
      meta.targets.forEach(tgt => {
        processedText = processedText.replaceAll(`【${tgt.name}】`, `【${tgt.label}】`);
      });
    }
    battleLogs.push({ round, text: processedText, type, meta });
  };

  log(0, `⚔️ 战斗爆发！我军【${pArmName}】与敌军【${eArmName}】在沙盘交锋！`, 'header');

  // 兵种克制
  const pArmAdv = getArmAdvantageMultiplier(pArm, eArm);
  const eArmAdv = getArmAdvantageMultiplier(eArm, pArm);

  if (pArmAdv > 1.0) {
    log(0, `🔺 我军【${pArmName}】克制敌军【${eArmName}】！兵刃与谋略伤害提升 15%！`, 'advantage');
  } else if (eArmAdv > 1.0) {
    log(0, `🔻 敌军【${eArmName}】克制我军【${pArmName}】！敌军获得克制增益！`, 'disadvantage');
  }

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

  const executePrepTactics = (actor, team, opposingTeam, logFn = log) => {
    actor.tactics.forEach(tactic => {
      // 诸如一身是胆
      if (tactic.insight) {
        actor.buffs.insight = true;
        actor.force += tactic.statBoost || 0;
        actor.intel += tactic.statBoost || 0;
        actor.command += tactic.statBoost || 0;
        actor.speed += tactic.statBoost || 0;
        logFn(0, `【${actor.label}】触发被动战法【${tactic.name}】：获得洞察之身，四大属性全面暴涨 ${tactic.statBoost} 点！`, 'skill');
      }
      // 八门金锁
      if (tactic.id === 'tac_ba_men_jin_suo') {
        const leader = team.find(h => h.isLeader);
        if (leader) leader.buffs.firstStrike = true;
        opposingTeam.slice(0, 2).forEach(opp => {
          opp.buffs.damageDealtMod -= tactic.damageReduction || 0.3;
        });
        logFn(0, `【${actor.label}】施展指挥战法【${tactic.name}】：我方主将获得先攻，敌方群体伤害降低 30%！`, 'skill');
      }
      // 盛气凌敌
      if (tactic.id === 'tac_sheng_qi_ling_di') {
        opposingTeam.slice(0, 2).forEach(opp => {
          if (!opp.buffs.insight && Math.random() * 100 < (tactic.disarmRate || 90)) {
            opp.buffs.disarmed = tactic.firstRounds || 2;
            logFn(0, `【${actor.label}】触发指挥战法【${tactic.name}】：敌将【${opp.label}】陷入缴械，前2回合无法普通攻击！`, 'debuff', { target: opp });
          }
        });
      }
      // 曹操 乱世奸雄
      if (tactic.id === 'tac_luan_shi_jian_xiong') {
        team.forEach(mate => mate.buffs.damageDealtMod += tactic.teamDamageBonus || 0.16);
        actor.buffs.damageReceivedMod -= tactic.selfDamageReduction || 0.18;
        logFn(0, `【${actor.label}】发动指挥战法【${tactic.name}】：友军伤害增加 16%，自身减伤 18%！`, 'skill');
      }
      // 白马义从
      if (tactic.id === 'tac_bai_ma_yi_cong') {
        team.forEach(mate => {
          mate.buffs.firstStrike = true;
        });
        logFn(0, `【${actor.label}】列阵【${tactic.name}】：弓兵进阶！全员获得先攻与战法发动增益！`, 'skill');
      }
      // 御敌屏障
      if (tactic.id === 'tac_yu_di_ping_zhang') {
        team.slice(0, 2).forEach(mate => {
          mate.buffs.damageReceivedMod -= tactic.teamDamageReduction || 0.25;
        });
        logFn(0, `【${actor.label}】施展指挥战法【${tactic.name}】：我军群体受伤害降低 25%！`, 'skill');
      }
      // 青囊相助
      if (tactic.id === 'tac_qing_nang_xiang_zhu') {
        team.forEach(mate => mate.command += (tactic.statBoostCmd || 40));
        logFn(0, `【${actor.label}】施展指挥战法【${tactic.name}】：群体统率提升 40 点并开启受创急救！`, 'skill');
      }
      // 太史慈 神射
      if (tactic.doubleAttack) {
        actor.buffs.continuousAttack = true;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：获得每回合稳定连击，双箭齐发！`, 'skill');
      }
      // 郭嘉 十胜十败
      if (tactic.id === 'tac_shi_sheng_shi_bai') {
        const leader = team.find(h => h.isLeader);
        if (leader) {
          leader.buffs.insight = true;
          leader.buffs.damageReceivedMod -= 0.50;
          logFn(0, `【${actor.label}】施展指挥【${tactic.name}】：主将【${leader.label}】前2回合获得洞察免疫控制，减伤50%！`, 'skill', { target: leader });
        }
      }
      // 吕蒙 白衣渡江
      if (tactic.id === 'tac_bai_yi_du_jiang') {
        team.forEach(mate => {
          grantShield(0, mate, 1, 1, logFn, '白衣渡江');
        });
      }
      // 左慈 金丹秘术
      if (tactic.id === 'tac_jin_dan_mi_shu') {
        team.forEach(mate => {
          mate.buffs.evasionRate = 0.60;
        });
        logFn(0, `【${actor.label}】施展仙术【${tactic.name}】：前2回合我军全体获得 60%【金丹规避】！`, 'buff');
      }
      // 马超 槊血复骑
      if (tactic.id === 'tac_shuo_xue_fu_qi') {
        actor.force += 34;
        actor.buffs.hasSplash = true;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：武力提升 34 点，普攻附带全军溅射！`, 'skill');
      }
      // 甘宁 锦帆百狩
      if (tactic.id === 'tac_jin_fan_bai_shou') {
        actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.50;
        actor.buffs.critDamage = (actor.buffs.critDamage || 1.5) + 0.70;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：会心几率暴涨 50%，暴击伤害提升 120%！`, 'skill');
      }
      // 百炼成钢
      if (tactic.id === 'tac_bai_lian_cheng_gang') {
        actor.force += 36;
        actor.intel += 36;
        actor.command += 36;
        actor.speed += 36;
        logFn(0, `【${actor.label}】百炼成钢：四维属性全方位提升 36 点！`, 'skill');
      }
    });
  };

  [...playerHeroes, ...enemyHeroes].forEach(h => {
    const team = h.isPlayer ? playerHeroes : enemyHeroes;
    const opp = h.isPlayer ? enemyHeroes : playerHeroes;
    const prepLog = (r, txt, type, meta = {}) => {
      log(r, txt, type, { actor: h, ...meta });
    };
    executePrepTactics(h, team, opp, prepLog);
  });

  // ================= 正式战斗 (最多 8 回合) =================
  let winner = null; // 'player' | 'enemy' | 'draw'
  const playerLeader = playerHeroes[0];
  const enemyLeader = enemyHeroes[0];

  // 斩首即时检查判定 (三战原版规则：一旦任何一方主将兵力归0，战斗立刻终局，绝不进入后续行动或下一回合)
  const checkLeaderDeath = (currentRound) => {
    if (playerLeader.currentSoldiers <= 0) {
      log(currentRound, `💥 我军主将【${playerLeader.label}】兵败溃围！全军失去指挥大败！`, 'defeat');
      winner = 'enemy';
      return true;
    }
    if (enemyLeader.currentSoldiers <= 0) {
      log(currentRound, `🎉 敌军主将【${enemyLeader.label}】被斩落马下！敌军阵型瓦解崩溃！`, 'victory');
      winner = 'player';
      return true;
    }
    return false;
  };

  battleLoop:
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
      if (checkLeaderDeath(round)) break battleLoop;

      const team = actor.isPlayer ? playerHeroes : enemyHeroes;
      const oppTeam = actor.isPlayer ? enemyHeroes : playerHeroes;
      const livingOpps = oppTeam.filter(h => h.currentSoldiers > 0);

      if (livingOpps.length === 0) break;

      // 持续伤害结算 (如灼烧、沙暴) - 抵御可抵挡伤害
      if (actor.buffs.burn > 0) {
        const dotDmg = Math.round(actor.buffs.burnDmg * (actor.currentSoldiers / actor.initialSoldiers + 0.5));
        const actualDot = applyDamageToTarget(round, actor, actor, dotDmg, log, '烈火灼烧');
        if (actualDot > 0) {
          log(round, `🔥【${actor.label}】受到烈火灼烧，受到 ${actualDot} 点谋略灼烧伤害！(余兵:${actor.currentSoldiers})`, 'dot', { actor });
        }
        actor.buffs.burn--;
        if (actor.currentSoldiers <= 0) {
          log(round, `💀【${actor.label}】在火海中溃败阵亡！`, 'death', { actor });
          if (checkLeaderDeath(round)) break battleLoop;
          continue;
        }
      }

      // 检查震慑 (无法行动) - 若处于震慑，行动结束前跳过本回合并扣减1回合
      if (actor.buffs.stunned > 0) {
        log(round, `😵【${actor.label}】处于震慑状态，动弹不得，跳过本回合！`, 'status', { actor });
        actor.buffs.stunned--;
        // 处于震慑时，其他控制状态也同步在回合结束时递减
        if (actor.buffs.silenced > 0) actor.buffs.silenced--;
        if (actor.buffs.disarmed > 0) actor.buffs.disarmed--;
        continue;
      }

      // 持续战法触发 (如用武通神、绝地反击)
      const yongWuTac = actor.tactics.find(t => t.id === 'tac_yong_wu_tong_shen');
      if (yongWuTac && (round === 2 || round === 4 || round === 6 || round === 8)) {
        const mult = (round === 2 ? 0.75 : round === 4 ? 1.05 : round === 6 ? 1.35 : 1.65);
        livingOpps.forEach(opp => {
          const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * mult);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '用武通神');
          if (actualDmg > 0) {
            log(round, `⚡ 用武通神第 ${round} 回合爆发！对【${opp.label}】造成 ${actualDmg} 点稳定谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      const jueDiTac = actor.tactics.find(t => t.id === 'tac_jue_di_fan_ji');
      if (jueDiTac && round === 5) {
        const rawDmg = Math.round((actor.force * 2.2 - 50) * Math.sqrt(actor.currentSoldiers / 100));
        livingOpps.forEach(opp => {
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '绝地反击');
          if (actualDmg > 0) {
            log(round, `🛡️💥 绝地反击第 5 回合蓄力爆发！对【${opp.label}】发动致命反击造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 绑定当前行动方的上下文 Logger，自动注入 actor 实体信息，杜绝同名混淆
      const actorLog = (r, txt, type, meta = {}) => {
        log(r, txt, type, { actor, ...meta });
      };

      // 1. 发动主动战法
      executeActiveTactics(round, actor, team, livingOpps, actorLog, pMoraleMod, pArmAdv, eArmAdv);
      if (checkLeaderDeath(round)) break battleLoop;

      // 再次检查敌方是否全灭
      const freshLivingOpps = oppTeam.filter(h => h.currentSoldiers > 0);
      if (freshLivingOpps.length === 0) {
        // 敌方已全灭，结算控制回合后中断
        if (actor.buffs.silenced > 0) actor.buffs.silenced--;
        if (actor.buffs.disarmed > 0) actor.buffs.disarmed--;
        break;
      }

      // 2. 普通攻击
      if (actor.buffs.disarmed > 0) {
        log(round, `🚫【${actor.label}】处于缴械状态，无法进行普通攻击！`, 'status', { actor });
      } else {
        // 普通攻击次数 (连击则为 2 次)
        const attackCount = actor.buffs.continuousAttack ? 2 : 1;
        for (let i = 0; i < attackCount; i++) {
          if (oppTeam.filter(h => h.currentSoldiers > 0).length === 0) break;
          performNormalAttack(round, actor, team, oppTeam, log, pMoraleMod, pArmAdv, eArmAdv);
          if (checkLeaderDeath(round)) break battleLoop;
        }
      }

      // 3. 武将整轮行动结束（Turn End）：安全扣减本回合控制状态持续时间
      if (actor.buffs.silenced > 0) actor.buffs.silenced--;
      if (actor.buffs.disarmed > 0) actor.buffs.disarmed--;
      if (actor.buffs.confused > 0) actor.buffs.confused--;
      if (actor.buffs.weakness > 0) actor.buffs.weakness--;
      if (actor.buffs.shareDamageDuration > 0) {
        actor.buffs.shareDamageDuration--;
        if (actor.buffs.shareDamageDuration <= 0) {
          actor.buffs.shareDamageTarget = null;
          actor.buffs.shareDamageRate = 0;
        }
      }

      // 检查斩首：如果任何一方主将阵亡，战斗直接提前终结！
      if (checkLeaderDeath(round)) break battleLoop;
    }

    // 每回合末：维护全员【抵御】等有持续时间限制的状态
    [...playerHeroes, ...enemyHeroes].filter(h => h.currentSoldiers > 0).forEach(h => {
      if (h.buffs.shieldDuration > 0) {
        h.buffs.shieldDuration--;
        if (h.buffs.shieldDuration <= 0 && h.buffs.shieldLayers > 0) {
          log(round, `🛡️【${h.label}】身上的【抵御】坚壁时效已过，自然消散。`, 'status', { actor: h });
          h.buffs.shieldLayers = 0;
        }
      }
    });

    // 检查是否有任何一方主将或全员被剿灭
    if (winner || checkLeaderDeath(round)) break battleLoop;
    const playerAlive = playerHeroes.some(h => h.currentSoldiers > 0);
    const enemyAlive = enemyHeroes.some(h => h.currentSoldiers > 0);
    if (!playerAlive) { winner = 'enemy'; break battleLoop; }
    if (!enemyAlive) { winner = 'player'; break battleLoop; }
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
 * 统一施加或刷新【抵御】效果 (严格遵循三战官方：不可无脑叠层，同类刷新机制)
 * @param {number} round 当前回合数
 * @param {Object} target 目标武将
 * @param {number} layers 给予层数 (通常为 1 或 折冲的 2)
 * @param {number} duration 持续回合 (如折冲持续 2 回合)
 * @param {Function} log 日志函数
 * @param {string} sourceName 战法来源名称
 */
function grantShield(round, target, layers = 1, duration = 2, log, sourceName = '战法') {
  if (!target || target.currentSoldiers <= 0) return;

  const currentLayers = target.buffs.shieldLayers || 0;
  if (currentLayers > 0) {
    // 已有抵御：层数不累加，取两者较大值(上限2层)，同时刷新持续回合
    const newLayers = Math.max(currentLayers, layers);
    target.buffs.shieldLayers = newLayers;
    target.buffs.shieldDuration = Math.max(target.buffs.shieldDuration || 0, duration);
    log(round || 0, `🛡️【${target.label}】受到【${sourceName}】加持，刷新【抵御】状态(${newLayers}次，持续${duration}回合，不叠加层数)！`, 'buff', { target });
  } else {
    target.buffs.shieldLayers = layers;
    target.buffs.shieldDuration = duration;
    log(round || 0, `🛡️【${target.label}】获得【${sourceName}】赋予的 ${layers} 次【抵御】护盾，持续 ${duration} 回合！`, 'buff', { target });
  }
}

/**
 * 通用目标伤害结算与防御减免 (全面覆盖必中穿透、规避、抵御与战损记录)
 * @returns {{ damage: number, wasHit: boolean, shielded: boolean }} 结算结果
 */
function applyDamageToTarget(round, actor, target, rawDmg, log, damageDesc = '', options = {}) {
  if (target.currentSoldiers <= 0) return { damage: 0, wasHit: false, shielded: false };

  // 1. 虚弱判定 (攻击方处于虚弱，无法造成伤害，但依然算攻击动作)
  if (actor.buffs.weakness > 0) {
    return { damage: 0, wasHit: true, shielded: false, valueOf() { return 0; }, toString() { return '0'; } };
  }

  const hasTrueStrike = Boolean(actor.buffs.trueStrike);

  // 2. 规避判定 (如左慈金丹秘术，必中可直接无视规避)
  if (!hasTrueStrike && target.buffs.evasionRate && Math.random() < target.buffs.evasionRate) {
    log(round, `✨【${target.label}】身法鬼魅，凭借【金丹规避】完全避开了【${actor.label}】的攻击！`, 'buff', { actor, target });
    return { damage: 0, wasHit: false, shielded: false, valueOf() { return 0; }, toString() { return '0'; } };
  }

  // 3. 必中判定提示
  if (hasTrueStrike && (target.buffs.shieldLayers > 0 || target.buffs.evasionRate > 0)) {
    log(round, `🎯【${actor.label}】身具【必中】之势，利刃破空，无视规避与抵御坚壁！`, 'skill', { actor, target });
  }

  // 4. 抵御判定 (无必中时，抵御化解全部伤害，但依然算作受击 On Damaged)
  if (!hasTrueStrike && target.buffs.shieldLayers > 0) {
    target.buffs.shieldLayers--;
    if (target.buffs.shieldLayers <= 0) {
      target.buffs.shieldDuration = 0;
    }
    const desc = damageDesc ? `【${damageDesc}】` : '攻势';
    log(round, `🛡️【${target.label}】周身浮现【抵御】坚壁，本次伤害化为 0，完全化解了来自【${actor.label}】的${desc}！(剩余抵御: ${target.buffs.shieldLayers}次)`, 'action', { actor, target });
    return { damage: 0, wasHit: true, shielded: true, valueOf() { return 0; }, toString() { return '0'; } };
  }

  // 5. 计算并扣减实际伤害 (严格契合三战原版：增伤与减伤乘区、90%最大减伤封顶保护 + ±5%战场自然浮动)
  // 获取攻击方的增伤乘区
  const actorDealtMod = actor.buffs?.damageDealtMod ?? 1.0;
  // 获取防御方的有效减伤系数，并限制最大减伤幅度不超过 90% (即最少保留 10% 伤害底线)
  const rawReceivedMod = target.buffs?.damageReceivedMod ?? 1.0;
  const effectiveReceivedMod = Math.max(0.10, rawReceivedMod);

  // 计算战场真实浮动系数 (0.95 ~ 1.05)
  const floatMod = 0.95 + Math.random() * 0.10;

  // 基础伤害结算
  let finalDmg = Math.max(1, Math.round(rawDmg * actorDealtMod * effectiveReceivedMod * floatMod));

  // 貂蝉【闭月】伤害分担机制 (受击时将一定比例伤害转移给敌军替身目标承受)
  if (finalDmg > 0 && target.buffs.shareDamageTarget && target.buffs.shareDamageTarget.currentSoldiers > 0 && target.buffs.shareDamageRate > 0) {
    const proxy = target.buffs.shareDamageTarget;
    const shareRate = target.buffs.shareDamageRate;
    const sharedDmg = Math.min(proxy.currentSoldiers, Math.max(1, Math.round(finalDmg * shareRate)));
    finalDmg = Math.max(0, finalDmg - sharedDmg);
    proxy.currentSoldiers = Math.max(0, proxy.currentSoldiers - sharedDmg);
    proxy.stats.damageTaken += sharedDmg;
    log(round, `🌹【${target.label}】闭月倾城！借力化解，将 ${sharedDmg} 点伤害转移至【${proxy.label}】承受！(余兵:${proxy.currentSoldiers})`, 'buff', { actor: target, target: proxy });
  }

  target.currentSoldiers = Math.max(0, target.currentSoldiers - finalDmg);
  actor.stats.damageDealt += finalDmg;
  target.stats.damageTaken += finalDmg;

  const result = {
    damage: finalDmg,
    wasHit: true,
    shielded: false,
    valueOf() { return this.damage; },
    toString() { return String(this.damage); }
  };
  return result;
}

/**
 * 普通攻击逻辑 (包含张辽锁敌、突击战法联动与反击判定)
 */
function performNormalAttack(round, actor, team, oppTeam, log, moraleMod, pArmAdv, eArmAdv) {
  const livingOpps = oppTeam.filter(h => h.currentSoldiers > 0);
  if (livingOpps.length === 0) return;

  // 目标选取：若处于【混乱】状态，有 50% 概率敌我不分将攻击转向友军存活单位！
  let target;
  const livingTeammates = team.filter(h => h.currentSoldiers > 0 && h !== actor);
  if (actor.buffs.confused > 0 && livingTeammates.length > 0 && Math.random() < 0.5) {
    target = livingTeammates[Math.floor(Math.random() * livingTeammates.length)];
    log(round, `🌀【${actor.label}】心神迷乱陷入【混乱】，敌我不分，反手攻向友军【${target.label}】！`, 'status', { actor, target });
  } else {
    // 正常选取敌军目标：若有锁主将概率则打主将，否则随机打击
    target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    const hasLockLeader = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi');
    if (hasLockLeader && Math.random() < 0.68) {
      const oppLeader = oppTeam.find(h => h.isLeader && h.currentSoldiers > 0);
      if (oppLeader) target = oppLeader;
    }
  }

  // 典韦 古之恶来：替主将承担普攻
  if (target.isLeader) {
    const protector = oppTeam.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_gu_zhi_e_lai'));
    if (protector && protector !== target) {
      log(round, `🪓【${protector.label}】挺身而出！舍身替主将【${target.label}】格挡拦截此次攻势！`, 'skill', { actor: protector, target });
      target = protector;
    }
  }

  // 孙权 坐断东南：自身及友军普攻时，孙权有75%概率获得连击、洞察、先攻、必中、破阵状态之一
  team.filter(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_zuo_duan_dong_nan')).forEach(sunQuan => {
    if (Math.random() < 0.75) {
      const buffPool = ['continuousAttack', 'insight', 'firstStrike', 'trueStrike'];
      const picked = buffPool[Math.floor(Math.random() * buffPool.length)];
      sunQuan.buffs[picked] = true;
      const buffNameMap = { continuousAttack: '连击', insight: '洞察', firstStrike: '先攻', trueStrike: '必中' };
      log(round, `👑 坐断东南！【${sunQuan.label}】获得【${buffNameMap[picked]}】状态，战意如虹！`, 'buff', { actor: sunQuan });
    }
  });

  // 伤害计算 (基础兵刃普攻)
  const armAdv = actor.isPlayer ? pArmAdv : eArmAdv;
  const baseDmg = Math.max(20, (actor.force * 1.5 - target.command * 0.75));
  const soldierRatio = Math.sqrt(actor.currentSoldiers / 100);
  let finalDmg = Math.round(baseDmg * soldierRatio * armAdv * (actor.isPlayer ? moraleMod : 1.0));

  // 会心暴击判定 (甘宁 / 黄忠)
  let isCrit = false;
  if (actor.buffs.critRate && Math.random() < actor.buffs.critRate) {
    isCrit = true;
    const critMult = actor.buffs.critDamage || 2.0;
    finalDmg = Math.round(finalDmg * critMult);
  }

  // 虚弱判断
  if (actor.buffs.weakness > 0) finalDmg = 0;

  // 抵御、规避与真实伤害结算
  const hitResult = applyDamageToTarget(round, actor, target, finalDmg, log, '普通攻击');
  const actualDmg = hitResult.damage;
  if (actualDmg > 0) {
    const critText = isCrit ? '💥 触发【会心暴击】！' : '';
    log(round, `🗡️【${actor.label}】挥戈突刺，${critText}对【${target.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });

    // 马超 槊血复骑：普攻群体溅射
    if (actor.buffs.hasSplash) {
      const splashDmg = Math.round(actualDmg * 0.54);
      oppTeam.filter(h => h.currentSoldiers > 0 && h !== target).forEach(other => {
        const splashResult = applyDamageToTarget(round, actor, other, splashDmg, log, '槊血溅射');
        if (splashResult.damage > 0) {
          log(round, `🐎 槊血溅射！狂暴枪芒波及【${other.label}】造成 ${splashResult.damage} 点兵刃溅射伤害！(余兵:${other.currentSoldiers})`, 'action', { actor, target: other });
        }
      });
    }
  }

  // 受到伤害后的急救判定 (青囊相助：受到实质扣血伤害时触发)
  if (actualDmg > 0 && target.currentSoldiers > 0) {
    const hasQingNang = target.tactics.some(t => t.id === 'tac_qing_nang_xiang_zhu');
    if (hasQingNang && Math.random() < 0.5) {
      const heal = Math.round(target.intel * 1.2);
      target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
      target.stats.healDone += heal;
      log(round, `🧪【${target.label}】受创触发【青囊急救】，瞬时稳住阵脚，恢复 ${heal} 兵力！(余兵:${target.currentSoldiers})`, 'heal', { target });
    }
  }

  // 反击判定 (夏侯惇 刚烈不屈：三战原版规则，只要受击成功，即便被抵御化解为0伤害，依然算受击并能判定反击)
  if (hitResult.wasHit && target.currentSoldiers > 0) {
    const retaliateTactic = target.tactics.find(t => t.id === 'tac_gang_lie_bu_qu');
    if (retaliateTactic && Math.random() * 100 < retaliateTactic.retaliateRate) {
      const retDmg = Math.round(target.force * 1.1 * Math.sqrt(target.currentSoldiers / 100));
      const retResult = applyDamageToTarget(round, target, actor, retDmg, log, '刚烈反击');
      if (retResult.damage > 0) {
        log(round, `⚡【${target.label}】刚烈狂怒！拔矢啖睛触发反击，轰击【${actor.label}】造成 ${retResult.damage} 点兵刃反击伤害！(余兵:${actor.currentSoldiers})`, 'skill', { actor: target, target: actor });
      }
    }
  }

  // 突击战法触发判定 (仅在普攻后判定)
  if (actor.currentSoldiers > 0) {
    actor.tactics.filter(t => t.type === 'assault').forEach(tac => {
      const bonusRate = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi') ? 15 : 0;
      if (Math.random() * 100 < (tac.rate + bonusRate)) {
        actor.stats.tacticsCast++;
        executeAssaultTactic(round, actor, tac, target, oppTeam, team, log, moraleMod, armAdv);
      }
    });
  }
}

/**
 * 突击战法执行 (一骑当千、手起刀落、折冲御侮、勇者得前等)
 */
function executeAssaultTactic(round, actor, tactic, primaryTarget, oppTeam, myTeam, log, moraleMod, armAdv) {
  const lvlTag = tactic.level ? `Lv.${tactic.level} ` : '';
  log(round, `⚡【${actor.label}】普攻破阵，连携发动突击战法【${lvlTag}${tactic.name}】！`, 'skill', { actor });

  if (tactic.id === 'tac_yi_qi_dang_qian') {
    const baseRate = tactic.damageRate || 1.08;
    const rate = actor.isLeader ? (baseRate * 1.33) : baseRate;
    oppTeam.filter(h => h.currentSoldiers > 0).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.4 - opp.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1));
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '一骑当千');
      if (actualDmg > 0) {
        log(round, `🌪️ 一骑当千横扫八荒！对【${opp.label}】造成 ${actualDmg} 点巨额兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  } else if (tactic.id === 'tac_shou_qi_dao_luo') {
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.84;
      const rawDmg = Math.round((actor.force * 1.8 - primaryTarget.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate / 1.84 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '手起刀落');
      if (actualDmg > 0) {
        log(round, `🗡️ 手起刀落迅疾斩杀！对【${primaryTarget.label}】造成 ${actualDmg} 点致命兵刃伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_zhe_chong_yu_wu') {
    // 太史慈正统传承：折冲御侮 (普攻后触发：削弱敌方统率智力各100点持续2回合；若非主将则使我军主将获得2次抵御持续2回合)
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const debuffVal = tactic.statDebuff || 100;
      primaryTarget.command = Math.max(10, primaryTarget.command - debuffVal);
      primaryTarget.intel = Math.max(10, primaryTarget.intel - debuffVal);
      log(round, `🛡️ 折冲御侮双重破防！令【${primaryTarget.label}】统率与智力大幅削减 ${debuffVal} 点(持续2回合)！`, 'debuff', { actor, target: primaryTarget });
    }
    // 保护主将：如果携带者不是主将，为主将施加2次抵御(持续2回合，不可叠加，已有时刷新)
    const teamLeader = myTeam ? myTeam.find(h => h.isLeader) : null;
    if (teamLeader && teamLeader !== actor && teamLeader.currentSoldiers > 0) {
      grantShield(round, teamLeader, tactic.shieldCount || 2, tactic.shieldDuration || 2, log, '折冲御侮');
    }
  } else if (tactic.id === 'tac_yong_zhe_de_qian') {
    // 张辽正统传承：勇者得前 (获得1次抵御，下次主动战法伤害暴增)
    grantShield(round, actor, 1, 2, log, '勇者得前');
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * 1.5;
    log(round, `⚡ 勇者得前！【${actor.label}】下次输出造成的伤害暴增 50%！`, 'buff', { actor });
  } else if (tactic.id === 'tac_bao_li_wu_ren') {
    // 董卓正统传承：暴戾无仁
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rawDmg = Math.round((actor.force * 1.9 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tactic.damageRate || 1.96) / 1.96 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '暴戾无仁');
      if (actualDmg > 0) {
        primaryTarget.buffs.confused = 1;
        log(round, `🩸 暴戾无仁狂残劈击！对【${primaryTarget.label}】造成 ${actualDmg} 点毁灭兵刃伤害并使其陷入【混乱】！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_jiang_dong_xiao_ba_wang') {
    // 孙策自带：江东小霸王
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rawDmg = Math.round((actor.force * 1.7 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.92 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '江东小霸王');
      const heal = Math.round(actor.force * 1.16 * Math.sqrt(actor.currentSoldiers / 100));
      actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
      actor.stats.healDone += heal;
      if (actualDmg > 0) {
        log(round, `🐯 江东小霸王霸道破阵！对【${primaryTarget.label}】造成 ${actualDmg} 点兵刃伤害，并破血自愈 ${heal} 兵力！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      } else {
        log(round, `🐯 江东小霸王势大力沉破血自愈 ${heal} 兵力！`, 'heal', { actor });
      }
    }
  }
}

/**
 * 主动战法触发与执行
 */
function executeActiveTactics(round, actor, team, livingOpps, log, moraleMod, pArmAdv, eArmAdv) {
  // 计穷检查 (无法发动任何主动战法，若有正在准备中的战法也会被直接打断)
  if (actor.buffs.silenced > 0) {
    if (actor.buffs.isPreparingActive) {
      log(round, `🤐【${actor.label}】处于计穷状态，正在准备中的战法被打断！`, 'status', { actor });
      actor.buffs.isPreparingActive = null;
    } else {
      log(round, `🤐【${actor.label}】处于计穷状态，无法发动任何主动战法！`, 'status', { actor });
    }
    return;
  }

  const armAdv = actor.isPlayer ? pArmAdv : eArmAdv;

  actor.tactics.filter(t => t.type === 'active').forEach(tac => {
    const lvlTag = tac.level ? `Lv.${tac.level} ` : '';
    // 蓄力准备判定 (如威震华夏、所向披靡)
    if (tac.requiresPrep) {
      if (actor.buffs.isPreparingActive === tac.id) {
        actor.buffs.isPreparingActive = null;
        log(round, `🔥【${actor.label}】蓄力完成！撼世战法【${lvlTag}${tac.name}】磅礴释放！`, 'skill', { actor });
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
        return;
      } else {
        if (Math.random() * 100 < tac.rate) {
          actor.buffs.isPreparingActive = tac.id;
          log(round, `⌛【${actor.label}】沉声立定，开始蓄势准备绝技【${lvlTag}${tac.name}】！(下回合释放)`, 'prep', { actor });
          return;
        }
      }
    } else {
      if (Math.random() * 100 < tac.rate) {
        actor.stats.tacticsCast++;
        log(round, `✨【${actor.label}】大喝一声，发动主动战法【${lvlTag}${tac.name}】！`, 'skill', { actor });
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
      const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '威震华夏');
      if (actualDmg > 0) {
        log(round, `🐉 青龙偃月威震华夏！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      if (!opp.buffs.insight && Math.random() < 0.5) {
        opp.buffs.silenced = 1;
        log(round, `⛓️【${opp.label}】被关羽威势震慑，陷入计穷 1 回合！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 所向披靡
  else if (tac.id === 'tac_suo_xiang_pi_mi') {
    livingOpps.forEach(opp => {
      const dmgRate = tac.damageRate || 2.06;
      const rawDmg = Math.round((actor.force * 1.7 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '所向披靡');
      if (actualDmg > 0) {
        log(round, `💥 所向披靡席卷全场！对【${opp.label}】造成 ${actualDmg} 点毁灭性兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
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
      log(round, `🩹 刮骨疗毒圣手回春！清除【${wounded.label}】所有负面状态，大幅疗愈 ${heal} 兵力！(余兵:${wounded.currentSoldiers})`, 'heal', { actor, target: wounded });
    }
  }
  // 火烧连营
  else if (tac.id === 'tac_huo_shao_lian_ying') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      target.buffs.burn = 2;
      target.buffs.burnDmg = Math.round(actor.intel * 1.18);
      log(round, `🌋 夷陵烽火连天！对【${target.label}】点燃火势，附带 2 回合谋略灼烧伤害！`, 'debuff', { actor, target });
    }
  }
  // 天下无双
  else if (tac.id === 'tac_tian_xia_wu_shuang') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      log(round, `🔥 方天画戟怒指！【${actor.label}】强行邀战【${target.label}】进行绝命单挑 3 连击！`, 'skill', { actor, target });
      for (let s = 1; s <= 3; s++) {
        if (target.currentSoldiers <= 0 || actor.currentSoldiers <= 0) break;
        const rawD = Math.round((actor.force * 1.6 - target.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * armAdv);
        const actualD = applyDamageToTarget(round, actor, target, rawD, log, `天下无双第${s}击`);
        if (actualD > 0) {
          log(round, ` ⚡ 第 ${s} 击：狂猛重斩，削去【${target.label}】 ${actualD} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
        }
      }
    }
  }
  // 横扫千军 (关羽/赵云官方传承)
  else if (tac.id === 'tac_heng_sao_qian_jun') {
    livingOpps.forEach(opp => {
      const dmgRate = tac.damageRate || 1.60;
      const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '横扫千军');
      if (actualDmg > 0) {
        log(round, `⚔️ 横扫千军破阵横劈！对【${opp.label}】造成 ${actualDmg} 点狂暴兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      // 若敌处于缴械或计穷，30%概率陷入震慑
      if ((opp.buffs.disarmed > 0 || opp.buffs.silenced > 0) && !opp.buffs.insight && Math.random() < 0.35) {
        opp.buffs.stunned = 1;
        log(round, `⚡【${opp.label}】伤势引爆，被震慑陷入瘫痪，下回合动弹不得！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 嗔目横矛 (张飞官方传承)
  else if (tac.id === 'tac_chen_mu_heng_mao') {
    actor.force += 50;
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * 1.35;
    log(round, `🐅 嗔目横矛虎啸！【${actor.label}】武力暴涨 50 点，开启 2 回合群攻溅射重劈！`, 'buff', { actor });
  }
  // 风助火势 (周瑜官方传承)
  else if (tac.id === 'tac_feng_zhu_huo_shi') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      let dmgRate = tac.damageRate || 1.54;
      const isBurning = (target.buffs.burn > 0);
      if (isBurning) dmgRate += 1.98; // 灼烧引爆额外追加198%
      const rawDmg = Math.round((actor.intel * 1.6 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '风助火势');
      if (actualDmg > 0) {
        if (isBurning) {
          log(round, `🌪️🔥 借东风势引爆火海！【风助火势】对【${target.label}】造成 ${actualDmg} 点毁灭连环谋略伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
        } else {
          log(round, `🌪️ 风助火势疾风骤起！对【${target.label}】造成 ${actualDmg} 点谋略伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
        }
      }
    }
  }
  // 熯天炽地 (陆逊官方传承)
  else if (tac.id === 'tac_han_tian_chi_di') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.02) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '熯天炽地');
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.72);
      if (actualDmg > 0) {
        log(round, `🌋 熯天炽地焦土千里！对【${opp.label}】造成 ${actualDmg} 点谋略伤害并点燃 2 回合大火！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `🌋 熯天炽地焦土千里！对【${opp.label}】点燃 2 回合大火！`, 'debuff', { actor, target: opp });
      }
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
      const rawDmg = Math.round((actor.force * 1.3 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 0.96) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '卧薪尝胆');
      if (actualDmg > 0) {
        log(round, `⚔️ 卧薪尝胆坚毅奋战！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      if (!opp.buffs.insight && Math.random() < stunChance) {
        opp.buffs.stunned = 1;
        log(round, `❄️【${opp.label}】被孙权帝王雄姿震慑，陷入瘫痪！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 倾国倾城 (貂蝉官方传承)
  else if (tac.id === 'tac_qing_guo_qing_cheng') {
    const targets = livingOpps.slice(0, 2);
    targets.forEach(opp => {
      opp.buffs.silenced = 1;
      log(round, `🌹 倾国倾城红颜祸水！【${opp.label}】心神迷乱，陷入计穷无法施展战法！`, 'debuff', { actor, target: opp });
    });
  }
  // 百步穿杨 (黄忠自带)
  else if (tac.id === 'tac_bai_bu_chuan_yang') {
    actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.25;
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.80) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '百步穿杨');
      if (actualDmg > 0) {
        log(round, `🏹 百步穿杨万钧开弓！对【${opp.label}】造成 ${actualDmg} 点极速暴击兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 以逸待劳 (法正自带)
  else if (tac.id === 'tac_yi_yi_dai_lao') {
    team.slice(0, 2).forEach(mate => {
      const heal = Math.round(actor.intel * 1.58 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      mate.buffs.damageReceivedMod -= 0.40;
      actor.stats.healDone += heal;
      log(round, `📜 以逸待劳神机安澜！为【${mate.label}】回复 ${heal} 兵力并附加 40% 强效减伤！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 铁索连环 (庞统自带)
  else if (tac.id === 'tac_tie_suo_lian_huan') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.56) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '铁索连环');
      if (actualDmg > 0) {
        log(round, `⛓️ 铁索连环大计！锁困【${opp.label}】造成 ${actualDmg} 点谋略伤害并连带全场！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 十面埋伏 (程昱自带)
  else if (tac.id === 'tac_shi_mian_mai_fu') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round(actor.intel * 1.65 * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26));
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '十面埋伏');
      opp.buffs.cannotHeal = 2;
      if (actualDmg > 0) {
        log(round, `🔮 十面埋伏叛逃真伤！对【${opp.label}】无视统御造成 ${actualDmg} 点谋略伤害，并施加 2 回合禁疗！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `🔮 十面埋伏叛逃真伤对【${opp.label}】施加 2 回合禁疗！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 五雷轰顶 (张角自带)
  else if (tac.id === 'tac_wu_lei_hong_ding') {
    for (let strike = 1; strike <= 5; strike++) {
      const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
      if (freshLiving.length === 0) break;
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.intel * 1.55 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.36) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, `五雷轰顶第${strike}道`);
      if (actualDmg > 0) {
        log(round, `⚡ 第 ${strike} 道五雷轰顶！天雷劈中【${target.label}】造成 ${actualDmg} 点狂暴谋略雷击伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
      if (!target.buffs.insight && Math.random() < 0.35) {
        target.buffs.stunned = 1;
        log(round, `🌩️【${target.label}】被九天玄雷震慑麻痹陷入瘫痪！`, 'debuff', { actor, target });
      }
    }
  }
  // 累世立名 (袁绍自带)
  else if (tac.id === 'tac_lei_shi_li_ming') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round(((actor.force + actor.intel) * 0.9 - (opp.command + opp.intel) * 0.4) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '累世立名');
      if (actualDmg > 0) {
        log(round, `👑 累世立名诸侯联军！对【${opp.label}】造成 ${actualDmg} 点兵刃与谋略双重混合伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    team.forEach(mate => mate.command += 80);
    log(round, `🛡️ 四世三公号令三军！全军统率大幅提升 80 点！`, 'buff', { actor });
  }
  // 万箭齐发 (黄忠官方传承)
  else if (tac.id === 'tac_wan_jian_qi_fa') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.4 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.40) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '万箭齐发');
      if (actualDmg > 0) {
        log(round, `🏹 万箭齐发漫天箭雨！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 沉沙决水 (法正/郭嘉官方传承)
  else if (tac.id === 'tac_chen_sha_jue_shui') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.45 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '沉沙决水');
      opp.buffs.damageReceivedMod += 0.25;
      if (actualDmg > 0) {
        log(round, `🌊 沉沙决水汪洋水攻！对【${opp.label}】造成 ${actualDmg} 点谋略水攻伤害，且使其受到谋略伤害提升 25%！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `🌊 沉沙决水汪洋水攻令【${opp.label}】受到谋略伤害提升 25%！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 破阵摧坚 (孙策/庞统官方传承)
  else if (tac.id === 'tac_po_zhen_cui_jian') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.command = Math.max(10, opp.command - 80);
      opp.intel = Math.max(10, opp.intel - 80);
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.58) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '破阵摧坚');
      if (actualDmg > 0) {
        log(round, `💥 破阵摧坚削弱统智！重砍【${opp.label}】造成 ${actualDmg} 点毁灭兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `💥 破阵摧坚重创【${opp.label}】削弱统率与智力 80 点！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 杯蛇鬼车 (左慈官方传承)
  else if (tac.id === 'tac_bei_she_gui_che') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.53) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '杯蛇鬼车');
      if (actualDmg > 0) {
        log(round, `🐍 杯蛇鬼车幽冥幻法！对【${opp.label}】造成 ${actualDmg} 点奇门谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    team.slice(0, 2).forEach(mate => {
      const heal = Math.round(actor.intel * 1.02 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      actor.stats.healDone += heal;
      log(round, `✨ 杯蛇生息！治愈【${mate.label}】恢复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 黄天泰平 (张角官方传承)
  else if (tac.id === 'tac_huang_tian_tai_ping') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.buffs.silenced = 2;
      log(round, `🕊️ 黄天泰平咒印封禁！【${opp.label}】陷入计穷 2 回合，无法释放主动战法！`, 'debuff', { actor, target: opp });
    });
  }
  // 一力拒守 (典韦官方传承)
  else if (tac.id === 'tac_yi_li_ju_shou') {
    const heal = Math.round(actor.force * 2.68 * Math.sqrt(actor.currentSoldiers / 100));
    actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
    actor.command += 42;
    actor.stats.healDone += heal;
    log(round, `🛡️ 一力拒守铜墙铁壁！【${actor.label}】自愈狂增 ${heal} 兵力，统率提升 42 点！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
  }
  // 闭月 (貂蝉官方自带S级战法)
  else if (tac.id === 'tac_bi_yue') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      // 计算分担率 (受智力加成，基础25%~35%，最高50%)
      const baseShare = tac.shareDamageRate || 0.25;
      const shareRate = Math.min(0.50, baseShare * (1 + Math.max(0, (actor.intel - 80) / 200)));
      actor.buffs.shareDamageTarget = target;
      actor.buffs.shareDamageRate = shareRate;
      actor.buffs.shareDamageDuration = 1;

      const sharePct = Math.round(shareRate * 100);

      // 三战原版定向克制判定：
      // 1. 若目标武力最高 -> 陷入混乱
      // 2. 若目标智力最高 -> 陷入计穷
      // 3. 否则(统率或速度最高) -> 陷入虚弱
      if (target.force >= target.intel && target.force >= target.command) {
        if (!target.buffs.insight) {
          target.buffs.confused = 1;
        }
        log(round, `🌹 闭月倾心！【${actor.label}】选定【${target.label}】分担 ${sharePct}% 所受伤害，并令其因情致乱陷入【混乱】1回合！`, 'debuff', { actor, target });
      } else if (target.intel >= target.force && target.intel >= target.command) {
        if (!target.buffs.insight) {
          target.buffs.silenced = 1;
        }
        log(round, `🌹 闭月倾心！【${actor.label}】选定【${target.label}】分担 ${sharePct}% 所受伤害，并令其心旌摇曳陷入【计穷】1回合(无法施展主动战法)！`, 'debuff', { actor, target });
      } else {
        if (!target.buffs.insight) {
          target.buffs.weakness = 1;
        }
        log(round, `🌹 闭月倾心！【${actor.label}】选定【${target.label}】分担 ${sharePct}% 所受伤害，并令其气力衰竭陷入【虚弱】1回合(造成的伤害变为0)！`, 'debuff', { actor, target });
      }
    }
  }
}
