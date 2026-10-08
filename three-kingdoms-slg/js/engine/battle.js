/**
 * 三国志·战略版 - 核心回合制战报推演引擎 (Battle Engine)
 * 严格按照 兵种克制、适性加成、阵营国家队加成、速度先手顺序、四类战法判定、状态控制与斩首机制执行
 */

import { GENERAL_APTITUDE_MODIFIERS, ARMS, CAMPS } from '../data/generals.js';
import { TACTICS_DATA, getTacticEffectiveProps } from '../data/tactics.js';
import { checkActiveBonds } from '../data/bonds.js';

const TACTICS_MAP = new Map(TACTICS_DATA.map(t => [t.id, t]));

// 模块级最近一次伤害上下文（供 applyDamageToTarget 与 log 跨作用域安全共享）
let lastDamageContext = null;

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
function createBattleHero(heroData, troopArm, isLeader, isPlayer, tacticLevels = {}, teamSeenTactics = new Set()) {
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

    // 装备战法 (按战法研习等级强化实际战法属性，同一队伍内严格唯一排重)
    tactics: [
      heroData.builtInTacticId,
      heroData.equippedTactic1,
      heroData.equippedTactic2
    ].filter(Boolean).filter(id => {
      if (teamSeenTactics.has(id)) {
        return false; // 同一队伍内已存在相同战法，忽略过滤
      }
      teamSeenTactics.add(id);
      return true;
    }).map(id => {
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
      water: 0,          // 水攻回合
      waterDmg: 0,       // 水攻伤害率
      continuousAttack: false, // 连击
      trueStrike: false,       // 必中 (无视规避与抵御)
      shieldLayers: 0,         // 抵御剩余次数 (不可无脑无限叠加，单次最多2层)
      shieldDuration: 0,       // 抵御剩余持续回合数
      shareDamageTarget: null, // 闭月伤害分担受击替身
      shareDamageRate: 0,      // 伤害分担比例
      shareDamageDuration: 0,  // 分担持续回合
      rescueCover: false,      // 千里驰援：援护友军普通攻击
      taunt: false,            // 固若金汤：嘲讽敌方普攻
      immuneBurn: false,       // 祝融夫人：免疫灼烧
      tacticalCritRate: 0,     // 奇谋暴击几率 (太平道法)
      tacticalCritDamage: 2.0, // 奇谋暴击倍率
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

  // 实例化双方战斗武将 (主将必须位于首位，同队战法严格唯一去重)
  const playerSeenTactics = new Set();
  const enemySeenTactics = new Set();
  const playerHeroes = playerTroop.heroes.map((h, i) => createBattleHero(h, pArm, i === 0, true, options.tacticLevels || {}, playerSeenTactics));
  const enemyHeroes = enemyTroop.heroes.map((h, i) => createBattleHero(h, eArm, i === 0, false, options.enemyTacticLevels || {}, enemySeenTactics));

  // 每次推演前清空最近伤害上下文
  lastDamageContext = null;

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

    // 🎯 增伤与减伤加成智能注入：若该日志为伤害类日志，且上一次结算存在增减伤加成
    if (lastDamageContext && lastDamageContext.modTags && /(造成|受到|承受|造成了)\s*\d+\s*点(?:兵刃|谋略|溃逃|叛逃|火攻|水攻|稳定|致命|反弹)?伤害/.test(processedText)) {
      if (!processedText.includes('【增伤+') && !processedText.includes('【减伤') && !processedText.includes('【易伤+') && !processedText.includes('【伤害-')) {
        // 在伤害数字语句之后或在余兵说明之前，自然追加增减伤加成标签
        if (processedText.includes('(余兵:')) {
          processedText = processedText.replace('(余兵:', `${lastDamageContext.modTags} (余兵:`);
        } else {
          processedText = `${processedText} ${lastDamageContext.modTags}`;
        }
      }
      // 消费完毕后重置上下文，避免误附加到后续治疗或其他状态日志中
      lastDamageContext = null;
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
      const campName = CAMPS[camp]?.name || '阵营';
      log(0, `🏰 ${teamName}激活【${campName}国家队】阵营加成！全员核心属性提升 10%！`, 'camp');
    }
  };
  checkCampBonus(playerHeroes, '我军');
  checkCampBonus(enemyHeroes, '敌军');

  // 🌟 全套武将缘分羁绊检测与属性注入 (桃园结义、五虎上将、西蜀之智、曹魏五谋臣、五子良将、江表虎臣、四大都督、国之栋梁、太师动乱等)
  const applyTeamBonds = (heroes, teamName) => {
    const heroNames = heroes.map(h => h.name);
    const activeBonds = checkActiveBonds(heroNames);
    heroes.activeBonds = activeBonds;

    activeBonds.forEach(bond => {
      // 1. 基础四维属性提升
      if (bond.statBonus) {
        heroes.forEach(h => {
          if (bond.statBonus.force) h.force += bond.statBonus.force;
          if (bond.statBonus.intel) h.intel += bond.statBonus.intel;
          if (bond.statBonus.command) h.command += bond.statBonus.command;
          if (bond.statBonus.speed) h.speed += bond.statBonus.speed;
        });
      }

      // 2. 特殊机制效果注入
      if (bond.effect) {
        // 会心暴击几率提升 (五虎上将 +8%，江表虎臣 +5%)
        if (bond.effect.critRateBonus) {
          heroes.forEach(h => {
            h.buffs.critRate = (h.buffs.critRate || 0) + bond.effect.critRateBonus;
            h.buffs.critDamage = h.buffs.critDamage || 1.5;
          });
        }
        // 谋略奇谋暴击提升 (曹魏五谋臣)
        if (bond.effect.tacticalCritBonus) {
          heroes.forEach(h => {
            h.buffs.tacticalCritRate = (h.buffs.tacticalCritRate || 0) + bond.effect.tacticalCritBonus;
          });
        }
        // 规避几率提升 (乱世三仙 +10%)
        if (bond.effect.evasionBonus) {
          heroes.forEach(h => {
            h.buffs.evasionRate = (h.buffs.evasionRate || 0) + bond.effect.evasionBonus;
          });
        }
        // 先攻 (五谋臣、国之栋梁)
        if (bond.effect.firstStrike) {
          heroes.forEach(h => {
            h.buffs.firstStrike = true;
          });
        }
        // 受到谋略伤害削减 (国之栋梁 -5%)
        if (bond.effect.tacticalDmgReduction) {
          heroes.forEach(h => {
            h.buffs.damageReceivedMod -= bond.effect.tacticalDmgReduction;
          });
        }
        // 主将首回合强化 (太师动乱)
        if (bond.effect.leaderFirstStrike || bond.effect.leaderSplash) {
          const leader = heroes.find(h => h.isLeader);
          if (leader) {
            leader.buffs.firstStrike = true;
            leader.buffs.hasSplash = true;
          }
        }
        // 战斗准备回合直接赋予抵御 (西蜀之智)
        if (bond.effect.prepShield) {
          heroes.forEach(h => {
            grantShield(0, h, bond.effect.prepShield.count || 2, bond.effect.prepShield.duration || 2, log, bond.name);
          });
        }
      }

      log(0, `✨ ${teamName}激活官方原版武将缘分【${bond.name}】！${bond.desc}`, 'buff');
    });
  };

  applyTeamBonds(playerHeroes, '我军');
  applyTeamBonds(enemyHeroes, '敌军');

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
            logFn(0, `【${actor.label}】触发指挥战法【${tactic.name}】：敌将【${opp.label}】陷入【缴械】，前2回合无法普通攻击！`, 'debuff', { target: opp });
          } else if (opp.buffs.insight) {
            logFn(0, `【${opp.label}】身具【洞察】护体，从容化解免疫了来自【${tactic.name}】的【缴械】效果！`, 'buff', { target: opp });
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
      // 奋发
      if (tactic.id === 'tac_fen_fa') {
        actor.force += 25;
        actor.speed += 25;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：武力与速度各提升 25 点！`, 'skill');
      }
      // 白眉
      if (tactic.id === 'tac_bai_mei') {
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：马氏白眉，主动战法发动几率提高 12%！`, 'skill');
      }
      // 国士之风 (凌统：前3回合先攻+必中+增伤28%)
      if (tactic.id === 'tac_guo_shi_zhi_feng') {
        actor.buffs.firstStrike = true;
        actor.buffs.trueStrike = true;
        actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) + 0.28;
        const teammates = team.filter(m => m !== actor);
        if (teammates.length > 0) {
          const friend = teammates[Math.floor(Math.random() * teammates.length)];
          friend.buffs.firstStrike = true;
          friend.buffs.trueStrike = true;
          friend.buffs.damageDealtMod = (friend.buffs.damageDealtMod || 1.0) + 0.28;
          logFn(0, `【${actor.label}】发动指挥【${tactic.name}】：令自身与【${friend.label}】获得前3回合【先攻】与【必中】(无视规避)，伤害提升 28%！`, 'skill', { target: friend });
        } else {
          logFn(0, `【${actor.label}】发动指挥【${tactic.name}】：获得前3回合【先攻】与【必中】(无视规避)，伤害提升 28%！`, 'skill');
        }
      }
      // 肉身铁壁 (周泰：增伤)
      if (tactic.id === 'tac_rou_shen_tie_bi') {
        team.forEach(m => {
          m.buffs.damageDealtMod = (m.buffs.damageDealtMod || 1.0) + 0.30;
        });
        logFn(0, `【${actor.label}】列阵【${tactic.name}】：江表虎臣舍生忘死，友军造成的伤害提升 30%！`, 'skill');
      }
      // 火神宁墒 (祝融夫人：免疫灼烧)
      if (tactic.id === 'tac_huo_shen_ning_shang') {
        actor.buffs.immuneBurn = true;
        logFn(0, `【${actor.label}】施展【${tactic.name}】：火神庇佑，自身免疫一切烈火灼烧！`, 'buff');
      }
      // 符命自立 (袁术：发动率与暴击暴增)
      if (tactic.id === 'tac_fu_ming_zi_li') {
        actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.25;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：受命于天既寿永昌！战法发动率与暴击率提升 25%！`, 'skill');
      }
      // 奇兵间道 (魏延)
      if (tactic.id === 'tac_qi_bing_jian_dao') {
        actor.buffs.skipPrepChance = 0.75;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：反骨奇谋，准备战法有 75% 几率跳过准备瞬间爆发！`, 'skill');
      }
      // 🌟 太平道法 (张角/于吉传承：奇谋暴击与自带主动战法发动率提高)
      if (tactic.id === 'tac_tai_ping_dao_fa') {
        actor.buffs.tacticalCritRate = (actor.buffs.tacticalCritRate || 0) + 0.28;
        logFn(0, `【${actor.label}】研习被动【${tactic.name}】：获得 28%【奇谋暴击几率】(谋略伤害造成200%暴击)，自带主动战法发动几率提升 12%！`, 'skill');
      }
      // 🌟 藤甲兵 (兀突骨传承：盾兵专属减伤)
      if (tactic.id === 'tac_teng_jia_bing') {
        team.forEach(m => {
          m.buffs.damageReceivedMod -= 0.40; // 兵刃大幅减伤40%
        });
        logFn(0, `【${actor.label}】列阵【${tactic.name}】：全军身披油浸藤甲！受到兵刃伤害大幅削减 40%，但遇火攻将受到猛烈灼烧蔓延！`, 'skill');
      }
      // 🌟 锋矢阵 (典韦传承：主将增伤，副将减伤)
      if (tactic.id === 'tac_feng_shi_zhen') {
        const leader = team.find(m => m.isLeader);
        const subHeroes = team.filter(m => !m.isLeader);
        if (leader) {
          leader.buffs.damageDealtMod = (leader.buffs.damageDealtMod || 1.0) + 0.30;
          leader.buffs.damageReceivedMod += 0.20;
          logFn(0, `【${actor.label}】施展阵法【${tactic.name}】：主将【${leader.label}】造成的伤害大幅提升 30%，但受到伤害增加 20%！`, 'skill', { target: leader });
        }
        subHeroes.forEach(sub => {
          sub.buffs.damageDealtMod = (sub.buffs.damageDealtMod || 1.0) - 0.15;
          sub.buffs.damageReceivedMod -= 0.25;
          logFn(0, `【${actor.label}】施展阵法【${tactic.name}】：副将【${sub.label}】受到伤害降低 25%！`, 'skill', { target: sub });
        });
      }
      // 🌟 兴云布雨 (于吉自带：准备阶段预备水攻玄术)
      if (tactic.id === 'tac_xing_yun_bu_yu') {
        logFn(0, `【${actor.label}】施展道家绝技【${tactic.name}】：借东海之雨，第 2 回合起将引动滔天水攻侵蚀敌军全体！`, 'skill');
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

    // 🌟 桃园结义专属触发：第 6 回合全军获得 2 次抵御护盾
    if (round === 6) {
      [playerHeroes, enemyHeroes].forEach(team => {
        if (team.activeBonds && team.activeBonds.some(b => b.id === 'bond_tao_yuan')) {
          team.filter(h => h.currentSoldiers > 0).forEach(h => {
            grantShield(round, h, 2, 2, log, '桃园结义');
          });
          log(round, `🛡️【桃园结义】千秋大义！第 6 回合天命庇佑，我军全体获得 2 次抵御护盾(持续2回合)！`, 'buff');
        }
      });
    }

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

      // 持续伤害结算 (如灼烧、沙暴) - 抵御可抵挡伤害 (祝融夫人火神免疫灼烧)
      if (actor.buffs.burn > 0) {
        if (actor.buffs.immuneBurn) {
          log(round, `🔥【${actor.label}】火神庇佑，免疫烈火灼烧伤害！`, 'buff', { actor });
          actor.buffs.burn = 0;
        } else {
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
      }

      // 💧 持续伤害结算：水攻状态 (兴云布雨 / 沉沙决水)
      if (actor.buffs.water > 0) {
        const dotDmg = Math.round(actor.buffs.waterDmg * (actor.currentSoldiers / actor.initialSoldiers + 0.5));
        const actualDot = applyDamageToTarget(round, actor, actor, dotDmg, log, '滔天水攻');
        if (actualDot > 0) {
          log(round, `🌊【${actor.label}】身陷滔天水攻，受到 ${actualDot} 点水浸谋略伤害！(余兵:${actor.currentSoldiers})`, 'dot', { actor });
        }
        actor.buffs.water--;
        if (actor.currentSoldiers <= 0) {
          log(round, `💀【${actor.label}】在滔天浪潮冲击下溃败阵亡！`, 'death', { actor });
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

      // 朱儁 镇压黄巾 (第2、3回合使敌军全体陷入溃逃真实谋略伤害)
      const zhenYaTac = actor.tactics.find(t => t.id === 'tac_zhen_ya_huang_jin');
      if (zhenYaTac && (round === 2 || round === 3)) {
        livingOpps.forEach(opp => {
          const rawDmg = Math.round(actor.intel * 1.35 * Math.sqrt(actor.currentSoldiers / 100) * (zhenYaTac.damageRate || 0.88));
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '镇压黄巾');
          if (actualDmg > 0) {
            log(round, `⚡ 镇压黄巾破阵！大将朱儁号令严明，溃逃真伤穿透【${opp.label}】造成 ${actualDmg} 点谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 姜维 义胆雄心 (奇数回合兵刃+破统，偶数回合谋略+削智)
      const yiDanTac = actor.tactics.find(t => t.id === 'tac_yi_dan_xiong_xin');
      if (yiDanTac && livingOpps.length > 0) {
        const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
        if (round % 2 === 1) {
          // 奇数回合：兵刃伤害 184% + 降低 64 点统率
          target.command = Math.max(10, target.command - 64);
          const rawDmg = Math.round((actor.force * 1.6 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.84);
          const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '义胆兵刃');
          if (actualDmg > 0) {
            log(round, `⚡ 义胆雄心奇数回合！【${actor.label}】剑斩【${target.label}】造成 ${actualDmg} 点兵刃伤害，并削弱其 64 点统率！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
          }
        } else {
          // 偶数回合：谋略伤害 184% + 降低 64 点智力
          target.intel = Math.max(10, target.intel - 64);
          const rawDmg = Math.round((actor.intel * 1.6 - target.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.84);
          const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '义胆谋略');
          if (actualDmg > 0) {
            log(round, `⚡ 义胆雄心偶数回合！【${actor.label}】神机轰炸【${target.label}】造成 ${actualDmg} 点谋略伤害，并削弱其 64 点智力！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
          }
        }
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 自愈 / 合军聚众 (每回合稳定休整恢复兵力)
      const healPassives = actor.tactics.filter(t => t.id === 'tac_zi_yu' || t.id === 'tac_he_jun_ju_zhong');
      healPassives.forEach(tac => {
        const healRate = tac.healRate || 1.0;
        const healVal = Math.round(actor.maxSoldiers * 0.08 * healRate);
        const actualHeal = Math.min(actor.maxSoldiers - actor.currentSoldiers, healVal);
        if (actualHeal > 0) {
          actor.currentSoldiers += actualHeal;
          actor.stats.healDone += actualHeal;
          log(round, `🌿【${actor.label}】触发【${tac.name}】休整生息，稳定恢复 ${actualHeal} 兵力！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
        }
      });

      // 🌟 于吉 兴云布雨 (第 2 回合起，使敌军全体持续陷入水攻，并使受到的谋略伤害提升 15%)
      const xingYunTac = actor.tactics.find(t => t.id === 'tac_xing_yun_bu_yu');
      if (xingYunTac && round >= 2) {
        livingOpps.forEach(opp => {
          if (!opp.buffs.waterApplied) {
            opp.buffs.water = 8; // 持续全场
            opp.buffs.waterDmg = Math.round(actor.intel * 0.72 * Math.sqrt(actor.currentSoldiers / 100));
            opp.buffs.waterApplied = true;
            opp.buffs.damageReceivedMod += 0.15; // 受谋略伤害提升 15%
            log(round, `🌧️ 兴云布雨引动天象！【${opp.label}】陷入持续【水攻】侵蚀，受到谋略伤害提升 15%！`, 'debuff', { actor, target: opp });
          }
        });
      }

      // 绑定当前行动方的上下文 Logger，自动注入 actor 实体信息，杜绝同名混淆
      const actorLog = (r, txt, type, meta = {}) => {
        log(r, txt, type, { actor, ...meta });
      };

      // 🌟 三战原版特色：行动前武将当前 Buff 状态清查与通报
      const activeBuffDescriptions = [];
      if (actor.buffs.firstStrike) activeBuffDescriptions.push('【先攻】抢占先机');
      if (actor.buffs.insight) activeBuffDescriptions.push('【洞察】免受控制');
      if (actor.buffs.continuousAttack) activeBuffDescriptions.push('【连击】双击');
      if (actor.buffs.trueStrike) activeBuffDescriptions.push('【必中】破壁');
      if (actor.buffs.tacticalCritRate > 0) activeBuffDescriptions.push('【奇谋暴击】加持');
      if (actor.buffs.shieldLayers > 0) activeBuffDescriptions.push(`【抵御】坚壁(${actor.buffs.shieldLayers}次)`);

      // 负面状态提示
      if (actor.buffs.silenced > 0) activeBuffDescriptions.push('【计穷】封禁主动战法');
      if (actor.buffs.disarmed > 0) activeBuffDescriptions.push('【缴械】无法普攻');
      if (actor.buffs.weakness > 0) activeBuffDescriptions.push('【虚弱】无法造成伤害');

      if (activeBuffDescriptions.length > 0) {
        log(round, `🚩【${actor.label}】行动开始，当前身负状态：${activeBuffDescriptions.join('、')}！`, 'status', { actor });
      }

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
      // 千里驰援援护状态仅持续 1 回合
      if (h.buffs.rescueCover) {
        h.buffs.rescueCover = false;
      }
      // 曹仁嘲讽状态仅持续 2 回合(每回合自然衰减或维护)
      if (h.buffs.taunt) {
        h.buffs.taunt = false;
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
      id: h.id,
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
      id: h.id,
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

  // 🎯 增伤与减伤标签计算 (精准展示加成数值)
  let modTags = '';
  // 1) 攻击方输出增减伤
  if (Math.abs(actorDealtMod - 1.0) >= 0.01) {
    const dealtPct = Math.round((actorDealtMod - 1.0) * 100);
    if (dealtPct > 0) {
      modTags += `【增伤+${dealtPct}%】`;
    } else if (dealtPct < 0) {
      modTags += `【伤害${dealtPct}%】`;
    }
  }
  // 2) 受击方防御减伤 / 易伤
  if (Math.abs(effectiveReceivedMod - 1.0) >= 0.01) {
    const receivedPct = Math.round((1.0 - effectiveReceivedMod) * 100);
    if (receivedPct > 0) {
      modTags += `【减伤${receivedPct}%】`;
    } else if (receivedPct < 0) {
      modTags += `【易伤+${Math.abs(receivedPct)}%】`;
    }
  }

  // 记录最近一次伤害结算的增减伤加成与目标信息，供战报 log 自动提取联动
  lastDamageContext = {
    actor,
    target,
    finalDmg,
    modTags,
    actorDealtMod,
    effectiveReceivedMod
  };

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
    modTags,
    actorDealtMod,
    effectiveReceivedMod,
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

  // 曹仁 固若金汤：嘲讽敌军强制攻击自身
  const taunter = oppTeam.find(h => h.currentSoldiers > 0 && h.buffs.taunt && h !== target);
  if (taunter) {
    log(round, `🛡️【${taunter.label}】固若金汤金刚不坏！强行嘲讽【${actor.label}】攻向自身！`, 'skill', { actor: taunter, target: actor });
    target = taunter;
  }

  // 千里驰援：为友军全体承担所有普通攻击 (援护状态)
  const rescuer = oppTeam.find(h => h.currentSoldiers > 0 && h.buffs.rescueCover && h !== target);
  if (rescuer) {
    log(round, `🛡️【${rescuer.label}】千里驰援！飞身架盾替友军【${target.label}】援护拦截普攻！`, 'skill', { actor: rescuer, target });
    target = rescuer;
  }

  // 孙尚香 弓腰姬：普通攻击前发动兵刃突袭
  if (actor.tactics.some(t => t.id === 'tac_gong_yao_ji') && target.currentSoldiers > 0) {
    let buffCount = 0;
    if (actor.buffs.firstStrike) buffCount++;
    if (actor.buffs.trueStrike) buffCount++;
    if (actor.buffs.continuousAttack) buffCount++;
    if (actor.buffs.insight) buffCount++;
    const bonusMult = 1.0 + buffCount * 0.20;
    const rawGongYao = Math.round((actor.force * 1.5 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.22 * bonusMult);
    const hitGY = applyDamageToTarget(round, actor, target, rawGongYao, log, '弓腰姬');
    if (hitGY.damage > 0) {
      log(round, `🏹 弓腰姬巾帼突袭！【${actor.label}】随身 ${buffCount} 层增益加持，普攻前射中【${target.label}】造成 ${hitGY.damage} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
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

    // 程普 勇烈持重：受到伤害时有35%几率净化自身所有负面并随机震慑敌军1回合
    const yongLie = target.tactics.find(t => t.id === 'tac_yong_lie_chi_zhong');
    if (yongLie && Math.random() < 0.35) {
      target.buffs.silenced = 0;
      target.buffs.disarmed = 0;
      target.buffs.burn = 0;
      target.buffs.confused = 0;
      const freshEnemies = team.filter(h => h.currentSoldiers > 0 && !h.buffs.insight);
      if (freshEnemies.length > 0) {
        const stunTarget = freshEnemies[Math.floor(Math.random() * freshEnemies.length)];
        stunTarget.buffs.stunned = 1;
        log(round, `🛡️【${target.label}】触发【勇烈持重】！净化自身所有负面状态，威武震慑【${stunTarget.label}】使其瘫痪 1 回合！`, 'skill', { actor: target, target: stunTarget });
      } else {
        log(round, `🛡️【${target.label}】触发【勇烈持重】！净化自身所有负面状态！`, 'skill', { actor: target });
      }
    }
  }

  // 大戟士 (张郃枪兵进阶)：普通攻击命中后，全体友军有35%几率协同突刺单体
  if (hitResult.wasHit && team.some(h => h.tactics.some(t => t.id === 'tac_da_ji_shi')) && target.currentSoldiers > 0) {
    if (Math.random() < 0.35) {
      const dajiDmg = Math.round((actor.force * 1.3 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.22);
      const hitDJ = applyDamageToTarget(round, actor, target, dajiDmg, log, '大戟士');
      if (hitDJ.damage > 0) {
        log(round, `🔱 大戟士列阵协同！长戟贯日对【${target.label}】追加造成 ${hitDJ.damage} 点协同兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }

  // 祝融夫人 火神宁墒：第3~5回合普攻后为全军恢复兵力
  if (actor.tactics.some(t => t.id === 'tac_huo_shen_ning_shang') && round >= 3 && round <= 5) {
    team.filter(h => h.currentSoldiers > 0).forEach(mate => {
      const heal = Math.round(actor.force * 1.25 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      actor.stats.healDone += heal;
      log(round, `🔥 火神宁墒圣火庇佑！【${actor.label}】普攻毕，为【${mate.label}】回复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
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
  } else if (tactic.id === 'tac_wan_gong_yin_yu') {
    // 弯弓饮羽：普通攻击后，使目标统率降低150点持续2回合，并使其陷入计穷1回合
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const debuffVal = tactic.statDebuff || 150;
      primaryTarget.command = Math.max(10, primaryTarget.command - debuffVal);
      if (!primaryTarget.buffs.insight) {
        primaryTarget.buffs.silenced = 1;
      }
      log(round, `🏹 弯弓饮羽破防穿心！令【${primaryTarget.label}】统率暴降 ${debuffVal} 点(持续2回合)，并陷入【计穷】无法施展主动战法！`, 'debuff', { actor, target: primaryTarget });
    }
  } else if (tactic.id === 'tac_jiang_xing_qi_ji') {
    // 夏侯渊 将行其疾：普通攻击后发动180%兵刃攻击，若命中主将则施加计穷2回合
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rawDmg = Math.round((actor.force * 1.7 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.80 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '将行其疾');
      if (actualDmg > 0) {
        log(round, `🏹⚡ 将行其疾疾风瞬杀！【${actor.label}】神箭贯穿【${primaryTarget.label}】造成 ${actualDmg} 点致命兵刃伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
      if (primaryTarget.isLeader && !primaryTarget.buffs.insight) {
        primaryTarget.buffs.silenced = 2;
        log(round, `🎯 将行其疾精准爆头！敌方主将【${primaryTarget.label}】咽喉中箭，陷入【计穷】2回合无法释放任何主动战法！`, 'debuff', { actor, target: primaryTarget });
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
    // 发动率加成 (白眉 +12%，白马义从 +10%，袁术符命自立 +25%，太平道法自带主动 +12%)
    let rateBonus = 0;
    if (actor.tactics.some(t => t.id === 'tac_bai_mei')) rateBonus += 12;
    if (team.some(h => h.tactics.some(t => t.id === 'tac_bai_ma_yi_cong'))) rateBonus += 10;
    if (actor.tactics.some(t => t.id === 'tac_fu_ming_zi_li') && round <= 2) rateBonus += 25;
    if (actor.tactics.some(t => t.id === 'tac_tai_ping_dao_fa') && tac.id === actor.tactics[0]?.id) rateBonus += 12;
    const finalRate = Math.min(100, (tac.rate || 35) + rateBonus);

    // 蓄力准备判定 (如威震华夏、所向披靡)
    if (tac.requiresPrep) {
      if (actor.buffs.isPreparingActive === tac.id) {
        actor.buffs.isPreparingActive = null;
        log(round, `🔥【${actor.label}】蓄力完成！撼世战法【${lvlTag}${tac.name}】磅礴释放！`, 'skill', { actor });
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
        return;
      } else {
        if (Math.random() * 100 < finalRate) {
          // 魏延 奇兵间道：有 75% 几率直接跳过准备回合瞬间爆发！
          if (actor.buffs.skipPrepChance && Math.random() < actor.buffs.skipPrepChance) {
            actor.stats.tacticsCast++;
            log(round, `⚡ 奇兵间道神谋瞬发！【${actor.label}】跳过蓄力，绝技【${lvlTag}${tac.name}】刹那间呼啸释放！`, 'skill', { actor });
            castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
            return;
          }
          actor.buffs.isPreparingActive = tac.id;
          log(round, `⌛【${actor.label}】沉声立定，开始蓄势准备绝技【${lvlTag}${tac.name}】！(下回合释放)`, 'prep', { actor });
          return;
        }
      }
    } else {
      if (Math.random() * 100 < finalRate) {
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
      
      // 奇谋暴击判定 (太平道法 28% 暴击率，200% 伤害)
      const isCrit = (actor.buffs.tacticalCritRate && Math.random() < actor.buffs.tacticalCritRate);
      const critMultiplier = isCrit ? (actor.buffs.tacticalCritDamage || 2.0) : 1.0;

      const rawDmg = Math.round((actor.intel * 1.55 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.36) * armAdv * critMultiplier);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, `五雷轰顶第${strike}道`);
      if (actualDmg > 0) {
        const critTag = isCrit ? '💥【奇谋暴击】' : '';
        log(round, `⚡ 第 ${strike} 道五雷轰顶！${critTag}天雷劈中【${target.label}】造成 ${actualDmg} 点狂暴谋略雷击伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }

      // 水攻联动：若目标身上已有水攻状态，震慑概率由 35% 跃升为 70%！
      const hasWater = target.buffs.water > 0;
      const stunChance = hasWater ? 0.70 : 0.35;
      if (!target.buffs.insight && Math.random() < stunChance) {
        target.buffs.stunned = 1;
        const waterTag = hasWater ? ' [水势引雷·震慑翻倍]' : '';
        log(round, `🌩️【${target.label}】被九天玄雷${waterTag}彻底震慑麻痹，陷入瘫痪！`, 'debuff', { actor, target });
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
  // 落凤 (A级神技：强力兵刃单体 + 计穷1回合)
  else if (tac.id === 'tac_luo_feng') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.7 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.50) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '落凤');
      if (actualDmg > 0) {
        log(round, `🦅 落凤破空穿杨！神箭射中【${target.label}】造成 ${actualDmg} 点狂暴兵刃重创！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
      if (!target.buffs.insight) {
        target.buffs.silenced = 1;
        log(round, `🤐【${target.label}】中箭负伤，陷入【计穷】1回合(无法发动主动战法)！`, 'debuff', { actor, target });
      }
    }
  }
  // 纵兵劫掠 (A级神技：兵刃单体 + 震慑1回合)
  else if (tac.id === 'tac_zong_bing_jie_lue') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.5 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.72) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '纵兵劫掠');
      if (actualDmg > 0) {
        log(round, `🔥 纵兵劫掠狂啸劈砍！对【${target.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
      if (!target.buffs.insight) {
        target.buffs.stunned = 1;
        log(round, `😵【${target.label}】被兵锋震慑，陷入【瘫痪震慑】1回合(无法行动)！`, 'debuff', { actor, target });
      }
    }
  }
  // 避实击虚 (锁定统率最低敌军点杀)
  else if (tac.id === 'tac_bi_shi_ji_xu') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const sorted = [...freshLiving].sort((a, b) => a.command - b.command);
      const target = sorted[0];
      const rawDmg = Math.round((actor.force * 1.6 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.85) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '避实击虚');
      if (actualDmg > 0) {
        log(round, `🎯 避实击虚精准打击！锁定统率最弱点【${target.label}】(统率:${target.command})，造成 ${actualDmg} 点致命兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }
  // 轻勇飞燕 (随机2~4段连续打击)
  else if (tac.id === 'tac_qing_yong_fei_yan') {
    const hitTimes = 2 + Math.floor(Math.random() * 3); // 2~4 次
    log(round, `🪶 轻勇飞燕灵动连环！【${actor.label}】身化飞燕连击 ${hitTimes} 段！`, 'skill', { actor });
    for (let h = 1; h <= hitTimes; h++) {
      const freshLiving = livingOpps.filter(o => o.currentSoldiers > 0);
      if (freshLiving.length === 0) break;
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.4 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 0.84) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, `轻勇飞燕第${h}段`);
      if (actualDmg > 0) {
        log(round, ` ⚡ 第 ${h} 段飞燕刺击命中【${target.label}】，造成 ${actualDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }
  // 强攻 (使自身获得连击)
  else if (tac.id === 'tac_qiang_gong') {
    actor.buffs.continuousAttack = true;
    log(round, `⚔️ 强攻战意暴涌！【${actor.label}】获得【连击】状态，本回合将进行 2 次普通攻击！`, 'buff', { actor });
  }
  // 坐守孤城 (我军群体2人治疗)
  else if (tac.id === 'tac_zuo_shou_gu_cheng') {
    const wounded = [...team].filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)).slice(0, 2);
    wounded.forEach(mate => {
      const heal = Math.round(actor.intel * 1.16 * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      actor.stats.healDone += heal;
      log(round, `🏰 坐守孤城安抚伤卒！治愈【${mate.label}】恢复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 料事如神 (群体2人谋略伤害 + 减伤)
  else if (tac.id === 'tac_liao_shi_ru_shen') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.06) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '料事如神');
      opp.buffs.damageDealtMod -= 0.16;
      if (actualDmg > 0) {
        log(round, `📜 料事如神奇策制敌！对【${opp.label}】造成 ${actualDmg} 点谋略伤害，并使其伤害降低 16%！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `📜 料事如神奇策制敌令【${opp.label}】造成的伤害降低 16%！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 机略纵横 (群体2人灼烧与中毒)
  else if (tac.id === 'tac_ji_lue_zong_heng') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.58);
      log(round, `🔥☠️ 机略纵横布施水火！令【${opp.label}】陷入灼烧与剧毒状态，每回合受到持续谋略重创！`, 'debuff', { actor, target: opp });
    });
  }
  // 千里驰援 (统率+40，承担全员普攻援护)
  else if (tac.id === 'tac_qian_li_chi_yuan') {
    actor.command += 40;
    actor.buffs.rescueCover = true;
    log(round, `🛡️ 千里驰援策马立阵！【${actor.label}】统率提升 40 点，挺身开启【援护】，本回合替全体友军承担所有普通攻击！`, 'buff', { actor });
  }
  // 暴敛四方 (群体2人兵刃攻击，若震慑则禁疗)
  else if (tac.id === 'tac_bao_lian_si_fang') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.45 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.02) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '暴敛四方');
      if (actualDmg > 0) {
        log(round, `🪓 暴敛四方秋风扫叶！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      if (opp.buffs.stunned > 0) {
        opp.buffs.cannotHeal = 2;
        log(round, `🩸【${opp.label}】处于震慑被撕裂伤口，陷入【禁疗】2回合！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 天降覆雨 (群体2人兵刃+灼烧)
  else if (tac.id === 'tac_tian_jiang_fu_yu') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.45 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.10) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '天降覆雨');
      opp.buffs.burn = 1;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.66);
      if (actualDmg > 0) {
        log(round, `🌧️🔥 天降覆雨疾风暴雨！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害并引燃 1 回合烈火！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 挫志怒袭 (群体2人虚弱)
  else if (tac.id === 'tac_cuo_zhi_nu_xi') {
    livingOpps.slice(0, 2).forEach(opp => {
      if (!opp.buffs.insight) {
        opp.buffs.weakness = 1;
        log(round, `⚡ 挫志怒袭威吓三军！【${opp.label}】陷入【虚弱】1回合(造成的伤害全部为0)！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 左右开弓 (弓兵单体兵刃+暴击)
  else if (tac.id === 'tac_zuo_you_kai_gong') {
    actor.buffs.critRate = (actor.buffs.critRate || 0) + 0.13;
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.55 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.80) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '左右开弓');
      if (actualDmg > 0) {
        log(round, `🏹 左右开弓连珠双箭！对【${target.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }
  // 妖术 (全体沙暴 + 自身抵御)
  else if (tac.id === 'tac_yao_shu') {
    grantShield(round, actor, 1, 2, log, '妖术');
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.3 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 0.72) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '妖术沙暴');
      if (actualDmg > 0) {
        log(round, `🌪️ 妖术黄天迷雾！漫天狂沙席卷【${opp.label}】造成 ${actualDmg} 点谋略沙暴伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 处兹不惑 (徐庶自带：群体2人灼烧、中毒、溃逃连续判定)
  else if (tac.id === 'tac_chu_zi_bu_huo') {
    livingOpps.slice(0, 2).forEach(opp => {
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 1.15);
      log(round, `📜 处兹不惑机谋神算！【${opp.label}】陷入【灼烧与毒素侵蚀】，每回合受到持续谋略重创！`, 'debuff', { actor, target: opp });
    });
  }
  // 将门虎女 (关银屏自带：群体2人兵刃打击并施加虎嗔与震慑)
  else if (tac.id === 'tac_jiang_men_hu_nv') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.28 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '将门虎女');
      if (actualDmg > 0) {
        log(round, `🐅 将门虎女刀芒凌厉！【${actor.label}】重斩【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      if (!opp.buffs.insight) {
        opp.buffs.stunned = 1;
        log(round, `⚡ 虎嗔震慑引爆！【${opp.label}】受到重创陷入【瘫痪震慑】1回合(无法行动)！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 临战先登 (乐进自带：100%发动高额兵刃，随后虚弱1回合)
  else if (tac.id === 'tac_lin_zhan_xian_deng') {
    livingOpps.slice(0, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.35 * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '临战先登');
      if (actualDmg > 0) {
        log(round, `⚔️ 临战先登每战必前！【${actor.label}】飞身登城暴击【${opp.label}】造成 ${actualDmg} 点狂暴兵刃重创！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    actor.buffs.weakness = 1;
    log(round, `💨【${actor.label}】先登斩将力竭，进入【虚弱】1回合(普攻伤害降为0)！`, 'debuff', { actor });
  }
  // 固若金汤 (曹仁自带：嘲讽+统率暴增150+洞察)
  else if (tac.id === 'tac_gu_ruo_jin_tang') {
    actor.command += 150;
    actor.buffs.insight = true;
    actor.buffs.taunt = true;
    log(round, `🛡️ 固若金汤铜墙铁壁！【${actor.label}】统率狂增 150 点并获得【洞察】免控，强行嘲讽敌军全体普通攻击自身！`, 'buff', { actor });
  }
  // 神机莫测 (贾诩自带：单体混乱+若已混乱引爆极刑谋略真伤)
  else if (tac.id === 'tac_shen_ji_mo_ce') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      const isAlreadyConfused = (target.buffs.confused > 0);
      if (!target.buffs.insight) {
        target.buffs.confused = 2;
        log(round, `🌀 神机莫测毒士操盘！【${actor.label}】令【${target.label}】陷入【混乱】2回合(敌我不分相互攻伐)！`, 'debuff', { actor, target });
      }
      if (isAlreadyConfused) {
        const rawDmg = Math.round((actor.intel * 1.7 - target.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.75 * armAdv);
        const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '乱武极刑');
        if (actualDmg > 0) {
          log(round, `☠️ 乱武引爆极刑诛灭！对已混乱的【${target.label}】造成 ${actualDmg} 点毁灭谋略伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
        }
      }
    }
  }
}
