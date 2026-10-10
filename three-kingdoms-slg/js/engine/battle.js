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

export const FEMALE_GENERAL_IDS = new Set([
  'gen_diao_chan', 'gen_sun_shang_xiang', 'gen_da_qiao', 'gen_xiao_qiao',
  'gen_zhu_rong', 'gen_guan_yin_ping', 'gen_huang_yue_ying', 'gen_ma_yun_lu',
  'gen_cai_wen_ji', 'gen_lv_ling_qi', 'gen_zou_shi', 'gen_zhen_ji',
  'gen_zhang_chun_hua', 'gen_wang_yuan_ji', 'gen_bu_lian_shi', 'gen_zhang_xing_cai'
]);

export function isFemaleGeneral(hero) {
  if (!hero) return false;
  return hero.gender === 'female' || FEMALE_GENERAL_IDS.has(hero.id);
}

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
 * 从数组中随机抽取指定数量的不重复元素 (Fisher-Yates 纯随机算法，彻底根除写死 slice(0, 2) 缺陷)
 */
export function getRandomElements(arr, count) {
  if (!arr || arr.length === 0) return [];
  if (arr.length <= count) return [...arr];
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
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

  // 装备战法 (按战法研习等级强化实际战法属性，同一队伍内严格唯一排重)
  const rawTacticIds = [
    heroData.builtInTacticId,
    heroData.equippedTactic1,
    heroData.equippedTactic2
  ];
  if (Array.isArray(heroData.tactics)) {
    heroData.tactics.forEach(t => {
      const tid = (typeof t === 'string') ? t : t?.id;
      if (tid && !rawTacticIds.includes(tid)) rawTacticIds.push(tid);
    });
  }

  const equippedTactics = rawTacticIds.filter(Boolean).filter(id => {
    if (teamSeenTactics.has(id)) {
      return false; // 同一队伍内已存在相同战法，忽略过滤
    }
    teamSeenTactics.add(id);
    return true;
  }).map(id => {
    const raw = TACTICS_MAP.get(id);
    if (!raw) return null;
    // 若武将自身显式指定了统一战法等级(如试炼/演习模式强制拉满10级)，优先采用；自带战法优先读取武将实例的 builtInTacticLevel
    const isBuiltIn = (id === heroData.builtInTacticId);
    const playerTacLvl = isBuiltIn
      ? (heroData.builtInTacticLevel || tacticLevels[id] || 1)
      : (tacticLevels[id] || 1);
    const lvl = heroData.tacticLevel || (isPlayer ? playerTacLvl : (tacticLevels[id] || 5));
    return getTacticEffectiveProps(raw, lvl);
  }).filter(Boolean);

    // 初始化战法统计字典 (普通攻击 + 装配战法)
    const tacticStats = {
      normal_attack: {
        id: 'normal_attack',
        name: '普通攻击',
        type: 'normal',
        quality: 'B',
        level: 1,
        isInnate: false,
        casts: 0,
        damage: 0,
        heals: 0
      }
    };
    equippedTactics.forEach((tac, idx) => {
      const tacQuality = (idx === 0)
        ? ((heroData.star || 4) >= 5 ? 'S' : ((heroData.star || 4) === 4 ? 'A' : 'B'))
        : (tac.quality || 'A');
      tacticStats[tac.id] = {
        id: tac.id,
        name: tac.name,
        type: tac.type || 'active',
        quality: tacQuality,
        level: tac.level || 1,
        isInnate: (idx === 0),
        casts: 0,
        damage: 0,
        heals: 0
      };
    });

    return {
      id: heroData.id,
      battleId: heroBattleId,
      name: heroData.name,
      avatar: heroData.avatar,
      camp: heroData.camp,
      star: heroData.star || 4,
      isLeader,
      isPlayer,
      label: `${isPlayer ? '我军·' : '敌军·'}${heroData.name}`,
      gender: heroData.gender || (FEMALE_GENERAL_IDS.has(heroData.id) ? 'female' : 'male'),
      troopArm,
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

      tactics: equippedTactics,
      tacticStats,

      // 战斗内临时状态
      buffs: {
        damageDealtMod: 1.0,
        damageReceivedMod: 1.0,
        bladeDealtMod: 1.0,     // 兵刃输出乘区
        bladeReceivedMod: 1.0,  // 兵刃受伤乘区 (藤甲兵减免)
        tacticalDealtMod: 1.0,  // 谋略输出乘区
        tacticalReceivedMod: 1.0, // 谋略受伤乘区 (水攻易伤 / 谋略减伤)
        hasTengJia: false,      // 油浸藤甲标记 (遇火攻受巨额引燃)
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
        isPreparingActive: null, // 准备战法中
        yiYiCharges: 0,          // 以逸待劳：受下几次伤害减免剩余次数
        yiYiReduction: 0,        // 以逸待劳：单次减伤幅度
        zhouTaiProtector: null,  // 肉身铁壁：替自身分摊伤害的守护者武将
        zhouTaiShareRate: 0,     // 肉身铁壁：分摊比例 (如 0.40)
        liaoShiDebuffs: [],      // 料事如神等限时降伤待恢复记录

        // === 2026年度神技巅峰状态 ===
        weiBao: 0,               // 当锋摧决【伪报】：禁用所有指挥与被动战法持续回合
        cannotHeal: 0,           // 禁疗状态持续回合
        baiErBing: false,        // 白毦兵：普攻追加谋略雷击
        jinFanJun: false,        // 锦帆军：普攻溃逃与回血
        xianZhenEmergency: false,// 陷阵营：前3回合受创急救
        jingJianCharges: 0,      // 荀彧机鉴先识【警戒】：减伤50%剩余可用次数(最多4次)
        caoChuanEmergency: 0,    // 草船借箭【急救】：受击35%急救持续回合
        changQuStacks: 0,        // 徐晃长驱直入：兵刃增伤层数(最多5层，每层15%)
        wenWuForceStacks: 0,     // 文武双全：武力层数(最多5层，每层30点)
        wenWuIntelStacks: 0,     // 文武双全：智力层数(最多5层，每层30点)
        nanManBonusRate: 0,      // 孟获南蛮渠魁：受击累加发动几率
        luKangProtector: null,   // 陆抗校胜帷幄：替主将分担30%所受伤害
        sanShiDealtBonus: 0,     // 三势阵副将增伤(25%)
        sanShiReceivedRed: 0,    // 三势阵副将减伤(30%)

        // === 2026年度新名将专属状态 ===
        activeRateBonus: 0,      // 主动战法几率额外加成(狮子奋迅、十二奇策)
        anFuEmergency: 0,        // 步练师安抚军心急救持续回合
        aoNiCharges: 0,          // 诸葛恪傲睨冲天抵御可用次数
        aoNiActor: null,         // 诸葛恪傲睨冲天来源武将
        chengShengStacks: 0,     // 于禁乘胜长驱每回合伤害提升叠加
        daoPiVamp: 0,            // 关兴刀劈千军倒戈吸血状态
        panTao: 0,               // 威谋靡亢/鸩毒叛逃真实伤害剩余回合
        panTaoDmg: 0,            // 叛逃真实伤害基础量
        shenDeRenXin: false,     // 张星彩甚得人心反弹与抵御标记
        tianXiang: false,        // 小乔天香移花接木标记
        guPanShengZi: false,     // 邹氏顾盼生姿偷属性与虚弱标记
        meiHuo: false            // 甄姬魅惑受普攻反制标记
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

  playerHeroes.forEach(h => {
    h.buffs.myTeam = playerHeroes;
    h.buffs.oppTeam = enemyHeroes;
  });
  enemyHeroes.forEach(h => {
    h.buffs.myTeam = enemyHeroes;
    h.buffs.oppTeam = playerHeroes;
  });

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
            h.buffs.tacticalReceivedMod -= bond.effect.tacticalDmgReduction;
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
        // 战斗准备回合直接赋予抵御 (西蜀之智、双雄破阵)
        if (bond.effect.prepShield) {
          heroes.forEach(h => {
            grantShield(0, h, bond.effect.prepShield.count || 2, bond.effect.prepShield.duration || 2, log, bond.name);
          });
        }
        // 受到兵刃伤害削减 (南蛮之乱 -8%，虎卫神威 -12%，曹魏宗族 -8%)
        if (bond.effect.bladeDmgReduction) {
          heroes.forEach(h => {
            h.buffs.bladeReceivedMod = Math.max(0.1, (h.buffs.bladeReceivedMod || 1.0) - bond.effect.bladeDmgReduction);
          });
        }
        // 造成的兵刃伤害提升 (将门虎女 +5%)
        if (bond.effect.bladeDmgBonus) {
          heroes.forEach(h => {
            h.buffs.bladeDealtMod = (h.buffs.bladeDealtMod || 1.0) + bond.effect.bladeDmgBonus;
          });
        }
        // 造成的主动谋略伤害提升 (四大都督 +6%)
        if (bond.effect.activeTacticalDmgBonus) {
          heroes.forEach(h => {
            h.buffs.tacticalDealtMod = (h.buffs.tacticalDealtMod || 1.0) + bond.effect.activeTacticalDmgBonus;
          });
        }
        // 主将谋略伤害提升 (赤壁之战 +10%)
        if (bond.effect.leaderTacticalDmgBonus) {
          const leader = heroes.find(h => h.isLeader);
          if (leader) {
            leader.buffs.tacticalDealtMod = (leader.buffs.tacticalDealtMod || 1.0) + bond.effect.leaderTacticalDmgBonus;
          }
        }
        // 前2回合获得必中 (西凉霸雄)
        if (bond.effect.trueStrike) {
          heroes.forEach(h => {
            h.buffs.trueStrike = true;
          });
        }
        // 战斗前2回合攻防双增 (三足鼎立：造成伤害+16%，受伤害-16%)
        if (bond.effect.firstTwoRoundsDmgBonus) {
          heroes.forEach(h => {
            h.buffs.damageDealtMod = (h.buffs.damageDealtMod || 1.0) + bond.effect.firstTwoRoundsDmgBonus;
            h.buffs.damageReceivedMod = Math.max(0.1, (h.buffs.damageReceivedMod || 1.0) - (bond.effect.firstTwoRoundsDmgReduction || 0.16));
          });
        }
        // 受到暴击伤害降低 (老当益壮 -15%)
        if (bond.effect.critDmgReduction) {
          heroes.forEach(h => {
            h.buffs.critDmgReduction = (h.buffs.critDmgReduction || 0) + bond.effect.critDmgReduction;
          });
        }
        // 受到伤害削减 (国色天香 -6%)
        if (bond.effect.damageReduction) {
          heroes.forEach(h => {
            h.buffs.damageReceivedMod = Math.max(0.1, (h.buffs.damageReceivedMod || 1.0) - bond.effect.damageReduction);
          });
        }
        // 受到男性武将伤害削减 (乱世红颜 -10%)
        if (bond.effect.maleDmgReduction) {
          heroes.forEach(h => {
            h.buffs.maleDmgReduction = bond.effect.maleDmgReduction;
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
  const eMoraleMod = options.enemyMoraleMod ?? 1.0;
  playerHeroes.forEach(h => h.moraleMod = pMoraleMod);
  enemyHeroes.forEach(h => h.moraleMod = eMoraleMod);
  if (pMorale < 100) {
    log(0, `🚩 我军士气当前为 ${pMorale}，部队战斗力修正为 ${(pMoraleMod * 100).toFixed(0)}%`, 'morale');
  }

  // ================= 阶段 0: 准备回合 (执行指挥与被动战法) =================
  log(0, `【准备回合】双方将领施展军略阵法……`, 'sub-header');

  const executePrepTactics = (actor, team, opposingTeam, logFn = log) => {
    actor.tactics.forEach(tactic => {
      // 准备回合战法生效计数 (指挥、被动、阵法、兵种)
      if (['command', 'passive', 'formation', 'arm'].includes(tactic.type)) {
        if (actor.tacticStats && actor.tacticStats[tactic.id]) {
          actor.tacticStats[tactic.id].casts = Math.max(1, actor.tacticStats[tactic.id].casts);
        }
      }
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
        const baseRed = tactic.damageReduction || 0.30;
        const redVal = Math.min(0.85, baseRed * (1 + Math.max(0, actor.intel - 80) * 0.0035));
        const targets = getRandomElements(opposingTeam, 2);
        targets.forEach(opp => {
          opp.buffs.damageDealtMod -= redVal;
          opp.buffs.baMenActive = true;
          opp.buffs.baMenVal = redVal;
        });
        const targetNames = targets.map(t => `【${t.label}】`).join('、');
        logFn(0, `【${actor.label}】施展指挥战法【${tactic.name}】：我方主将获得先攻，敌方群体${targetNames}造成的伤害大幅降低 ${(redVal * 100).toFixed(1)}%(受智力加成，持续3回合)！`, 'skill');
      }
      // 盛气凌敌
      if (tactic.id === 'tac_sheng_qi_ling_di') {
        const targets = getRandomElements(opposingTeam, 2);
        targets.forEach(opp => {
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
        const baseTeamBonus = tactic.teamDamageBonus || 0.16;
        const teamBonus = Math.min(0.40, baseTeamBonus * (1 + Math.max(0, actor.intel - 80) * 0.0025));
        const baseSelfRed = tactic.selfDamageReduction || 0.18;
        const selfRed = Math.min(0.50, baseSelfRed * (1 + Math.max(0, actor.command - 80) * 0.0025));
        team.forEach(mate => {
          if (mate !== actor) {
            mate.buffs.damageDealtMod += teamBonus;
          }
        });
        actor.buffs.damageReceivedMod -= selfRed;
        logFn(0, `【${actor.label}】发动指挥战法【${tactic.name}】：友军伤害提升 ${(teamBonus * 100).toFixed(1)}%(受智力加成)，自身受到伤害降低 ${(selfRed * 100).toFixed(1)}%(受统率加成)！`, 'skill');
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
        const targets = getRandomElements(team, 2);
        const redVal = tactic.teamDamageReduction || 0.25;
        targets.forEach(mate => {
          mate.buffs.damageReceivedMod -= redVal;
          mate.buffs.yuDiActive = true;
          mate.buffs.yuDiVal = redVal;
        });
        const targetNames = targets.map(t => `【${t.label}】`).join('、');
        logFn(0, `【${actor.label}】施展指挥战法【${tactic.name}】：我军群体${targetNames}受到伤害降低 ${(redVal * 100).toFixed(1)}%(持续4回合)！`, 'skill');
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
          const redVal = tactic.damageReduction || 0.50;
          leader.buffs.insight = true;
          leader.buffs.damageReceivedMod -= redVal;
          leader.buffs.shiShengActive = true;
          leader.buffs.shiShengVal = redVal;
          logFn(0, `【${actor.label}】施展指挥【${tactic.name}】：主将【${leader.label}】前2回合获得洞察免疫控制，受到伤害降低 ${(redVal * 100).toFixed(1)}%！`, 'skill', { target: leader });
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
        const evaRate = tactic.evasionRate || 0.60;
        team.forEach(mate => {
          mate.buffs.jinDanEvasion = evaRate;
          mate.buffs.evasionRate = (mate.buffs.evasionRate || 0) + evaRate;
        });
        logFn(0, `【${actor.label}】施展仙术【${tactic.name}】：前2回合我军全体获得 ${(evaRate * 100).toFixed(0)}%【金丹规避】！`, 'buff');
      }
      // 马超 槊血复骑
      if (tactic.id === 'tac_shuo_xue_fu_qi') {
        const boostF = tactic.statBoostForce || 34;
        actor.force += boostF;
        actor.buffs.hasSplash = true;
        actor.buffs.splashRate = tactic.splashRate || 0.54;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：武力提升 ${boostF} 点，普攻附带全军溅射！`, 'skill');
      }
      // 甘宁 锦帆百狩
      if (tactic.id === 'tac_jin_fan_bai_shou') {
        const cRate = tactic.critRateBonus || 0.50;
        const cDmg = tactic.critDamageBonus || 0.70;
        actor.buffs.critRate = (actor.buffs.critRate || 0) + cRate;
        actor.buffs.critDamage = (actor.buffs.critDamage || 1.5) + cDmg;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：会心几率暴涨 ${(cRate * 100).toFixed(0)}%，暴击伤害提升 ${(cDmg * 100 + 50).toFixed(0)}%！`, 'skill');
      }
      // 百炼成钢
      if (tactic.id === 'tac_bai_lian_cheng_gang') {
        const boost = tactic.statBuff || 36;
        actor.force += boost;
        actor.intel += boost;
        actor.command += boost;
        actor.speed += boost;
        logFn(0, `【${actor.label}】百炼成钢：四维属性全方位提升 ${boost} 点！`, 'skill');
      }
      // 奋发
      if (tactic.id === 'tac_fen_fa') {
        const boostF = tactic.statBoostForce || 25;
        const boostS = tactic.statBoostSpeed || 25;
        actor.force += boostF;
        actor.speed += boostS;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：武力与速度各提升 ${boostF} 点！`, 'skill');
      }
      // 守而必固 (开局提升统率并嘲讽敌主将)
      if (tactic.id === 'tac_shou_er_bi_gu') {
        const boost = tactic.statBuff || 40;
        actor.command += boost;
        const oppLeader = opposingTeam.find(h => h.isLeader);
        if (oppLeader) {
          oppLeader.buffs.tauntTarget = actor;
          oppLeader.buffs.tauntExpireRound = 4;
          logFn(0, `【${actor.label}】施展指挥【${tactic.name}】：统率暴涨 ${boost} 点，锁定并嘲讽敌方主将【${oppLeader.label}】前4回合强制攻击自身！`, 'skill', { target: oppLeader });
        }
      }
      // 梦中弑臣 (曹操传承：统率提升并开启前2回合反击)
      if (tactic.id === 'tac_meng_zhong_shi_chen') {
        const boost = tactic.statBuff || 40;
        actor.command += boost;
        actor.buffs.mengZhongCounter = true;
        logFn(0, `【${actor.label}】施展指挥【${tactic.name}】：统率提升 ${boost} 点，前2回合自身获得致命反击反伤！`, 'skill');
      }
      // 白眉
      if (tactic.id === 'tac_bai_mei') {
        const bonus = tactic.activeRateBonus || 12;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：马氏白眉，主动战法发动几率提高 ${bonus}%！`, 'skill');
      }
      // 国士之风 (凌统：前3回合先攻+必中+增伤)
      if (tactic.id === 'tac_guo_shi_zhi_feng') {
        const bonus = tactic.damageBonus || 0.28;
        actor.buffs.firstStrike = true;
        actor.buffs.trueStrike = true;
        actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) + bonus;
        actor.buffs.guoShiActive = true;
        actor.buffs.guoShiBonus = bonus;
        const teammates = team.filter(m => m !== actor);
        if (teammates.length > 0) {
          const friend = teammates[Math.floor(Math.random() * teammates.length)];
          friend.buffs.firstStrike = true;
          friend.buffs.trueStrike = true;
          friend.buffs.damageDealtMod = (friend.buffs.damageDealtMod || 1.0) + bonus;
          friend.buffs.guoShiActive = true;
          friend.buffs.guoShiBonus = bonus;
          logFn(0, `【${actor.label}】发动指挥【${tactic.name}】：令自身与【${friend.label}】获得前3回合【先攻】与【必中】(无视规避)，伤害提升 ${(bonus * 100).toFixed(0)}%！`, 'skill', { target: friend });
        } else {
          logFn(0, `【${actor.label}】发动指挥【${tactic.name}】：获得前3回合【先攻】与【必中】(无视规避)，伤害提升 ${(bonus * 100).toFixed(0)}%！`, 'skill');
        }
      }
      // 士别三日 (准备阶段：前3回合规避30%)
      if (tactic.id === 'tac_shi_bie_san_ri') {
        actor.buffs.shiBieEvasion = 0.30;
        actor.buffs.evasionRate = (actor.buffs.evasionRate || 0) + 0.30;
        logFn(0, `【${actor.label}】研习被动【${tactic.name}】：前3回合韬光养晦专注研读，无法进行普通攻击，但获得 30% 规避几率！`, 'buff');
      }
      // 许褚 虎痴 (准备阶段锁定强化)
      if (tactic.id === 'tac_hu_chi') {
        actor.buffs.hasHuChi = true;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：虎痴猛力，每回合锁定敌军单体增伤 33%，击杀目标将获得破阵！`, 'skill');
      }
      // 董卓 酒池肉林 (自身获得50%倒戈吸血)
      if (tactic.id === 'tac_jiu_chi_rou_lin') {
        actor.buffs.vampRate = 0.50;
        actor.buffs.vampireForce = 0.50;
        actor.buffs.hasJiuChi = true;
        logFn(0, `【${actor.label}】触发被动【${tactic.name}】：酒池肉林倒戈吸血 50%，第 5 回合起狂暴爆发！`, 'skill');
      }
      // 肉身铁壁 (周泰：增伤 + 友军伤害分摊承受)
      if (tactic.id === 'tac_rou_shen_tie_bi') {
        const teamBonus = tactic.teamDamageBonus || 0.30;
        const shareRate = tactic.shareDamageRate || 0.40;
        team.forEach(m => {
          if (m !== actor) {
            m.buffs.damageDealtMod = (m.buffs.damageDealtMod || 1.0) + teamBonus;
            m.buffs.zhouTaiProtector = actor;
            m.buffs.zhouTaiShareRate = shareRate;
          }
        });
        logFn(0, `【${actor.label}】列阵【${tactic.name}】：江表虎臣舍生忘死！友军伤害提升 ${(teamBonus * 100).toFixed(1)}%，周泰将挺身替友军分摊承受 ${(shareRate * 100).toFixed(1)}% 所受伤害！`, 'skill');
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
      // 🌟 藤甲兵 (兀突骨传承：盾兵专属减伤，受统率加成)
      if (tactic.id === 'tac_teng_jia_bing') {
        const baseRed = tactic.damageReduction || 0.40;
        const red = Math.min(0.85, baseRed * (1 + Math.max(0, actor.command - 80) * 0.0025));
        team.forEach(m => {
          m.buffs.hasTengJia = true;
          m.buffs.bladeReceivedMod -= red; // 兵刃专属大幅减伤
        });
        logFn(0, `【${actor.label}】列阵【${tactic.name}】：全军身披油浸藤甲！受到兵刃伤害大幅削减 ${(red * 100).toFixed(1)}%(受统率加成)，但遇火攻将受到猛烈灼烧蔓延！`, 'skill');
      }
      // 🌟 锋矢阵 (典韦传承：主将增伤，副将减伤)
      if (tactic.id === 'tac_feng_shi_zhen') {
        const leader = team.find(m => m.isLeader);
        const subHeroes = team.filter(m => !m.isLeader);
        const bonus = tactic.damageBonus || 0.30;
        const subDealtNerf = tactic.subDamageNerf || 0.15;
        const subRed = tactic.damageReduction || tactic.teamDamageReduction || 0.25;
        if (leader) {
          leader.buffs.damageDealtMod = (leader.buffs.damageDealtMod || 1.0) + bonus;
          leader.buffs.damageReceivedMod += 0.20;
          logFn(0, `【${actor.label}】施展阵法【${tactic.name}】：主将【${leader.label}】造成的伤害大幅提升 ${(bonus * 100).toFixed(0)}%，但受到伤害增加 20%！`, 'skill', { target: leader });
        }
        subHeroes.forEach(sub => {
          sub.buffs.damageDealtMod = (sub.buffs.damageDealtMod || 1.0) - subDealtNerf;
          sub.buffs.damageReceivedMod -= subRed;
          logFn(0, `【${actor.label}】施展阵法【${tactic.name}】：副将【${sub.label}】造成伤害降低 ${(subDealtNerf * 100).toFixed(0)}%，受到伤害降低 ${(subRed * 100).toFixed(0)}%！`, 'skill', { target: sub });
        });
      }
      // 🌟 兴云布雨 (于吉自带：准备阶段预备水攻玄术)
      if (tactic.id === 'tac_xing_yun_bu_yu') {
        logFn(0, `【${actor.label}】施展道家绝技【${tactic.name}】：借东海之雨，第 2 回合起将引动滔天水攻侵蚀敌军全体！`, 'skill');
      }

      // 🌟 三势阵 (跨阵营组队灵魂大核)
      if (tactic.id === 'tac_san_shi_zhen') {
        const camps = new Set(team.map(m => m.camp));
        if (camps.size === 3) {
          team.hasSanShi = true;
          team.sanShiActor = actor;
          const leader = team.find(m => m.isLeader);
          if (leader) {
            leader.buffs.sanShiActiveRateBonus = 16;
            logFn(0, `🏛️【${actor.label}】结阵【${tactic.name}】：三将异域同心！主将【${leader.label}】自带主动战法发动几率提升 16%，副将攻防分流轮动展开！`, 'skill', { target: leader });
          }
        } else {
          logFn(0, `⚠️【${actor.label}】阵法【${tactic.name}】未能激活：我军阵营未满3个不同势力(需三名不同阵营武将)！`, 'status');
        }
      }

      // 🌟 虎豹骑 (曹纯传承·骑兵进阶：突击发动率+10%，武力+40)
      if (tactic.id === 'tac_hu_bao_qi') {
        const statBoost = tactic.statBuff || 40;
        const assaultBonus = tactic.assaultRateBonus || 10;
        team.forEach(m => {
          m.force += statBoost;
          m.buffs.huBaoActive = true;
          m.buffs.huBaoAssaultBonus = assaultBonus;
          m.buffs.huBaoStatForce = statBoost;
        });
        logFn(0, `🐎【${actor.label}】进阶兵种【${tactic.name}】：精锐突骑列阵！前3回合全军突击战法几率提升 ${assaultBonus}%，武力暴涨 ${statBoost} 点！`, 'skill');
      }

      // 🌟 西凉铁骑 (马腾传承·骑兵进阶：全军获得25%会心几率)
      if (tactic.id === 'tac_xi_liang_tie_qi') {
        const critRate = tactic.critRateBonus || 0.25;
        team.forEach(m => {
          m.buffs.critRate = (m.buffs.critRate || 0) + critRate;
          m.buffs.xiLiangActive = true;
          m.buffs.xiLiangCritRate = critRate;
        });
        logFn(0, `🐎【${actor.label}】进阶兵种【${tactic.name}】：西凉剽悍铁骑！前3回合全军获得 ${(critRate * 100).toFixed(0)}% 会心暴击率！`, 'skill');
      }

      // 🌟 陷阵营 (高顺自带·盾兵进阶：全军统率武力+30，前3回合受创急救)
      if (tactic.id === 'tac_xian_zhen_ying') {
        const statBoost = tactic.statBuff || 30;
        team.forEach(m => {
          m.command += statBoost;
          m.force += statBoost;
          m.buffs.xianZhenEmergency = true;
        });
        logFn(0, `🛡️【${actor.label}】进阶兵种【${tactic.name}】：攻无不克！全军统率与武力提升 ${statBoost} 点，前3回合受创享受35%几率急救回血！`, 'skill');
      }

      // 🌟 白毦兵 (陈到自带·枪兵进阶：普攻后40%追加谋略雷击)
      if (tactic.id === 'tac_bai_er_bing') {
        team.forEach(m => {
          m.buffs.baiErBing = true;
        });
        logFn(0, `🔱【${actor.label}】进阶兵种【${tactic.name}】：先主亲兵白毦！全军普通攻击后40%几率追加狂暴谋略法伤轰炸！`, 'skill');
      }

      // 🌟 锦帆军 (甘宁专属·弓兵进阶：普攻溃逃与兵刃回血)
      if (tactic.id === 'tac_jin_fan_jun') {
        team.forEach(m => {
          m.buffs.jinFanJun = true;
        });
        logFn(0, `🏹【${actor.label}】进阶兵种【${tactic.name}】：锦帆贼扬帆破浪！全军普攻40%几率附加溃逃，遇溃逃目标发动斩杀吸血！`, 'skill');
      }

      // 🌟 工神 (黄月英自带：前3回合先攻+增伤30%，第4回合减伤15%)
      if (tactic.id === 'tac_gong_shen') {
        const bonus = tactic.damageBonus || 0.30;
        team.forEach(m => {
          m.buffs.firstStrike = true;
          m.buffs.damageDealtMod = (m.buffs.damageDealtMod || 1.0) + bonus;
          m.buffs.gongShenActive = true;
          m.buffs.gongShenBonus = bonus;
        });
        logFn(0, `⚙️【${actor.label}】施展奇谋【${tactic.name}】：木牛流马神机先动！前3回合全军获得【先攻】且伤害暴增 ${(bonus * 100).toFixed(0)}%！`, 'skill');
      }

      // 🌟 抚辑军民 (刘备/鲁肃传承：前3回合群体减伤40%，第4回合恢复兵力)
      if (tactic.id === 'tac_fu_ji_jun_min') {
        const targets = getRandomElements(team, 2);
        const baseRed = tactic.damageReduction || 0.40;
        const redVal = Math.min(0.80, baseRed * (1 + Math.max(0, actor.command - 80) * 0.0025));
        targets.forEach(m => {
          m.buffs.damageReceivedMod -= redVal;
          m.buffs.fuJiActive = true;
          m.buffs.fuJiRed = redVal;
          m.buffs.fuJiActor = actor;
        });
        const targetNames = targets.map(t => `【${t.label}】`).join('、');
        logFn(0, `🕊️【${actor.label}】施展指挥【${tactic.name}】：宽厚仁民，我军群体${targetNames}前3回合受伤害降低 ${(redVal * 100).toFixed(1)}%(受统率加成)，第4回合将获巨量兵力恢复！`, 'skill');
      }

      // 🌟 机鉴先识 (荀彧自带：全军获得4次警戒减伤50%，受击谋略反噬)
      if (tactic.id === 'tac_ji_jian_xian_shi') {
        team.forEach(m => {
          m.buffs.jingJianCharges = 4;
          m.buffs.jingJianActor = actor;
        });
        logFn(0, `📜【${actor.label}】施展王佐大谋【${tactic.name}】：机鉴先识！全军获得4次【警戒】(受到伤害减免50%)，且受创触发谋略神罚反噬！`, 'skill');
      }

      // 🌟 校胜帷幄 (陆抗自带：主将奇谋率+20%、暴伤+35%，陆抗替主将分担30%伤害)
      if (tactic.id === 'tac_xiao_sheng_wei_wo') {
        const leader = team.find(m => m.isLeader);
        if (leader) {
          leader.buffs.tacticalCritRate = (leader.buffs.tacticalCritRate || 0) + 0.20;
          leader.buffs.tacticalCritDamage = (leader.buffs.tacticalCritDamage || 2.0) + 0.35;
          leader.buffs.luKangProtector = actor;
          logFn(0, `🦊【${actor.label}】发动被动【${tactic.name}】：为主将【${leader.label}】提供20%奇谋暴击率与35%奇谋暴伤，并立阵替主将分担30%伤害！`, 'skill', { target: leader });
        }
      }

      // 🌟 监统震军 (沮授自带：控制负面状态延长机制标记)
      if (tactic.id === 'tac_jian_tong_zhen_jun') {
        team.hasJuShou = actor;
        logFn(0, `🦅【${actor.label}】立阵指挥【${tactic.name}】：监统震军！友军施加的所有异常负面状态有65%几率延长1回合！`, 'skill');
      }

      // 🌟 持节自守 (于禁自带：自身受到伤害降低15%，兵刃伤害提升40%)
      if (tactic.id === 'tac_chi_jie_zi_shou') {
        actor.buffs.damageReceivedMod = Math.max(0.2, (actor.buffs.damageReceivedMod || 1.0) - 0.15);
        actor.buffs.bladeDealtMod = (actor.buffs.bladeDealtMod || 1.0) + 0.40;
        logFn(0, `🛡️【${actor.label}】触发被动【${tactic.name}】：持节毅重！自身受到伤害降低 15%，造成兵刃伤害提升 40%！`, 'buff');
      }

      // 🌟 垂心万物 (王元姬自带：奇偶轮动治愈与连击辅助)
      if (tactic.id === 'tac_chui_xin_wan_wu') {
        team.hasChuiXin = actor;
        logFn(0, `🪷【${actor.label}】施展指挥【${tactic.name}】：垂心万物！奇数回合施予大治愈，偶数回合令武力最高友军爆发【连击】！`, 'buff');
      }

      // 🌟 傲睨冲天 (诸葛恪自带·东吴神辅：前3回合友军受创赋予抵御，抵御抵消伤害时群体回血)
      if (tactic.id === 'tac_ao_ni_chong_tian') {
        team.forEach(m => {
          m.buffs.aoNiCharges = 3;
          m.buffs.aoNiActor = actor;
        });
        logFn(0, `📜【${actor.label}】施展指挥【${tactic.name}】：傲睨冲天！前3回合友军受击概率赋予【抵御】，抵御抵消伤害时群体回血！`, 'buff');
      }

      // 🌟 甚得人心 (张星彩自带：受击反弹与全军抵御)
      if (tactic.id === 'tac_shen_de_ren_xin') {
        actor.buffs.shenDeRenXin = true;
        logFn(0, `🛡️【${actor.label}】立阵被动【${tactic.name}】：甚得人心！受兵刃伤害反弹 30%，并概率为全军披覆【抵御】坚盾！`, 'buff');
      }

      // 🌟 天香 (小乔自带：移花接木转移伤害与负面)
      if (tactic.id === 'tac_tian_xiang') {
        actor.buffs.tianXiang = true;
        logFn(0, `🪭【${actor.label}】轻摇羽扇【${tactic.name}】：国色天香！受创与受控时40%几率将伤害与负面移花接木给敌军！`, 'buff');
      }

      // 🌟 顾盼生姿 (邹氏自带：偷取属性与虚弱男性)
      if (tactic.id === 'tac_gu_pan_sheng_zi') {
        actor.buffs.guPanShengZi = true;
        logFn(0, `💄【${actor.label}】施展绝技【${tactic.name}】：顾盼生姿！战斗中偷取敌方最高属性，并使敌军男性武将心荡神摇陷入虚弱！`, 'debuff');
      }

      // 🌟 魅惑 (甄姬传承：受到普通攻击时反制)
      if (tactic.id === 'tac_mei_huo') {
        actor.buffs.meiHuo = true;
        logFn(0, `🌸【${actor.label}】身负秘策【${tactic.name}】：受到普通攻击时将使攻击者陷入混乱、计穷、缴械或虚弱！`, 'buff');
      }

      // 🌟 士争先赴 (乐进/张辽传承：自带主动战法伤害提升20%)
      if (tactic.id === 'tac_shi_zheng_xian_fu') {
        actor.buffs.ownActiveBonus = 0.20;
        logFn(0, `【${actor.label}】研习被动【${tactic.name}】：自身自带主动战法伤害提升 20%，发动前有 50% 几率对敌全体发动兵刃轰击！`, 'skill');
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

    // 🌟 限时战法与属性削弱到期结算与状态恢复
    [playerHeroes, enemyHeroes].forEach(team => {
      team.forEach(hero => {
        // 1. 郭嘉【十胜十败】：前2回合洞察与减伤，第3回合开始失效恢复
        if (hero.buffs.shiShengActive && round > 2) {
          hero.buffs.insight = false;
          const restoredVal = hero.buffs.shiShengVal || 0.50;
          hero.buffs.damageReceivedMod = (hero.buffs.damageReceivedMod || 1.0) + restoredVal;
          hero.buffs.shiShengActive = false;
          log(round, `⌛【${hero.label}】身上【十胜十败】洞察与减伤效果持续时间结束，恢复正常防御！`, 'buff', { actor: hero });
        }
        // 2. 八门金锁阵：前3回合减伤，第4回合开始失效恢复
        if (hero.buffs.baMenActive && round > 3) {
          const restoredVal = hero.buffs.baMenVal || 0.30;
          hero.buffs.damageDealtMod = (hero.buffs.damageDealtMod || 1.0) + restoredVal;
          hero.buffs.baMenActive = false;
          log(round, `⌛【${hero.label}】身上【八门金锁】压制效果结束，伤害恢复正常！`, 'buff', { actor: hero });
        }
        // 3. 御敌屏障：前4回合减伤，第5回合开始失效恢复
        if (hero.buffs.yuDiActive && round > 4) {
          const restoredVal = hero.buffs.yuDiVal || 0.25;
          hero.buffs.damageReceivedMod = (hero.buffs.damageReceivedMod || 1.0) + restoredVal;
          hero.buffs.yuDiActive = false;
          log(round, `⌛【${hero.label}】身上【御敌屏障】减伤屏障到期消散！`, 'buff', { actor: hero });
        }
        // 4. 凌统【国士之风】：前3回合先攻、必中与增伤，第4回合失效恢复
        if (hero.buffs.guoShiActive && round > 3) {
          const bonus = hero.buffs.guoShiBonus || 0.28;
          hero.buffs.damageDealtMod = Math.max(0.1, (hero.buffs.damageDealtMod || 1.0) - bonus);
          hero.buffs.firstStrike = false;
          hero.buffs.trueStrike = false;
          hero.buffs.guoShiActive = false;
          log(round, `⌛【${hero.label}】身上【国士之风】先攻、必中与增伤增益结束！`, 'buff', { actor: hero });
        }
        // 5. 左慈【金丹秘术】：前2回合规避，第3回合开始失效；第3~5回合触发全军休整
        if (hero.buffs.jinDanEvasion && round > 2) {
          hero.buffs.evasionRate = Math.max(0, (hero.buffs.evasionRate || 0) - hero.buffs.jinDanEvasion);
          hero.buffs.jinDanEvasion = null;
          log(round, `⌛【${hero.label}】身上【金丹规避】时效已过消散！`, 'buff', { actor: hero });
        }
        if (round >= 3 && round <= 5 && hero.currentSoldiers > 0) {
          const zuoCi = team.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_jin_dan_mi_shu'));
          if (zuoCi) {
            const heal = Math.round(zuoCi.intel * 0.58 * Math.sqrt(zuoCi.currentSoldiers / 100));
            const actualHeal = Math.min(hero.maxSoldiers - hero.currentSoldiers, heal);
            if (actualHeal > 0) {
              hero.currentSoldiers += actualHeal;
              recordHeroHeal(zuoCi, actualHeal, 'tac_jin_dan_mi_shu');
              log(round, `🌿【${zuoCi.label}】金丹秘术休整生息，治愈【${hero.label}】恢复 ${actualHeal} 兵力！(余兵:${hero.currentSoldiers})`, 'heal', { actor: zuoCi, target: hero });
            }
          }
        }
        // 6. 守而必固：嘲讽敌方主将前4回合有效，第5回合恢复
        if (hero.buffs.tauntTarget && round > (hero.buffs.tauntExpireRound || 4)) {
          hero.buffs.tauntTarget = null;
          log(round, `⌛【${hero.label}】摆脱了【守而必固】的嘲讽挑衅，恢复自由锁敌！`, 'buff', { actor: hero });
        }
        // 7. 士别三日：前3回合规避30%，第4回合规避消散
        if (hero.buffs.shiBieEvasion && round > 3) {
          hero.buffs.evasionRate = Math.max(0, (hero.buffs.evasionRate || 0) - hero.buffs.shiBieEvasion);
          hero.buffs.shiBieEvasion = null;
        }
        // 8. 折冲御侮 / 弯弓饮羽等属性削弱限时恢复 (持续2回合)
        if (hero.buffs.statRestorations && hero.buffs.statRestorations.length > 0) {
          hero.buffs.statRestorations = hero.buffs.statRestorations.filter(item => {
            if (round >= item.roundExpire) {
              if (item.command) hero.command += item.command;
              if (item.intel) hero.intel += item.intel;
              log(round, `🛡️【${hero.label}】从【${item.name}】的削弱中恢复，重整防线！`, 'buff', { actor: hero });
              return false; // 已恢复，从列表中移除
            }
            return true;
          });
        }
        // 9. 料事如神等限时降伤到期恢复 (持续2回合)
        if (hero.buffs.liaoShiDebuffs && hero.buffs.liaoShiDebuffs.length > 0) {
          hero.buffs.liaoShiDebuffs = hero.buffs.liaoShiDebuffs.filter(item => {
            if (round >= item.expireRound) {
              hero.buffs.damageDealtMod = (hero.buffs.damageDealtMod || 1.0) + item.val;
              log(round, `⌛【${hero.label}】身上【料事如神】降伤压制到期失效，伤害输出恢复正常！`, 'buff', { actor: hero });
              return false; // 已恢复，从列表中移除
            }
            return true;
          });
        }
        // 🌟 限时造成的伤害增益到期恢复 (如胡笳十八拍)
        if (hero.buffs.timedDealtModBuffs && hero.buffs.timedDealtModBuffs.length > 0) {
          hero.buffs.timedDealtModBuffs = hero.buffs.timedDealtModBuffs.filter(item => {
            if (round >= item.expireRound) {
              hero.buffs.damageDealtMod = Math.max(0.1, (hero.buffs.damageDealtMod || 1.0) - item.val);
              log(round, `⌛【${hero.label}】身上【${item.name}】增伤效果到期失效！`, 'buff', { actor: hero });
              return false;
            }
            return true;
          });
        }
        // 🌟 限时受到的伤害减免到期恢复 (如胡笳十八拍)
        if (hero.buffs.timedReceivedModBuffs && hero.buffs.timedReceivedModBuffs.length > 0) {
          hero.buffs.timedReceivedModBuffs = hero.buffs.timedReceivedModBuffs.filter(item => {
            if (round >= item.expireRound) {
              hero.buffs.damageReceivedMod = (hero.buffs.damageReceivedMod || 1.0) + item.val;
              log(round, `⌛【${hero.label}】身上【${item.name}】减伤护佑到期失效！`, 'buff', { actor: hero });
              return false;
            }
            return true;
          });
        }
        // 🌟 限时兵刃易伤到期恢复 (如狮子奋迅)
        if (hero.buffs.timedBladeReceivedBuffs && hero.buffs.timedBladeReceivedBuffs.length > 0) {
          hero.buffs.timedBladeReceivedBuffs = hero.buffs.timedBladeReceivedBuffs.filter(item => {
            if (round >= item.expireRound) {
              hero.buffs.bladeReceivedMod = Math.max(0.1, (hero.buffs.bladeReceivedMod || 1.0) - item.val);
              log(round, `⌛【${hero.label}】身上【${item.name}】兵刃易伤破绽愈合，受到兵刃伤害恢复正常！`, 'buff', { actor: hero });
              return false;
            }
            return true;
          });
        }
        // 🌟 限时主动战法发动率到期恢复 (如狮子奋迅、十二奇策)
        if (hero.buffs.timedActiveRateBuffs && hero.buffs.timedActiveRateBuffs.length > 0) {
          hero.buffs.timedActiveRateBuffs = hero.buffs.timedActiveRateBuffs.filter(item => {
            if (round >= item.expireRound) {
              hero.buffs.activeRateBonus = Math.max(0, (hero.buffs.activeRateBonus || 0) - item.val);
              log(round, `⌛【${hero.label}】身上【${item.name}】战法发动率加成时效已过！`, 'buff', { actor: hero });
              return false;
            }
            return true;
          });
        }
        // 10. 虎豹骑：前3回合突击几率与武力加成，第4回合结束
        if (hero.buffs.huBaoActive && round > 3) {
          hero.force -= (hero.buffs.huBaoStatForce || 40);
          hero.buffs.huBaoActive = false;
          log(round, `⌛【${hero.label}】身上【虎豹骑】突击加成与武力爆发到期！`, 'buff', { actor: hero });
        }
        // 11. 西凉铁骑：前3回合会心暴击，第4回合结束
        if (hero.buffs.xiLiangActive && round > 3) {
          hero.buffs.critRate = Math.max(0, (hero.buffs.critRate || 0) - hero.buffs.xiLiangCritRate);
          hero.buffs.xiLiangActive = false;
          log(round, `⌛【${hero.label}】身上【西凉铁骑】会心暴击增益到期！`, 'buff', { actor: hero });
        }
        // 12. 陷阵营急救到期：前3回合受创急救，第4回合失效
        if (hero.buffs.xianZhenEmergency && round > 3) {
          hero.buffs.xianZhenEmergency = false;
          log(round, `⌛【${hero.label}】身上【陷阵营】受创急救加持期满！`, 'buff', { actor: hero });
        }
        // 13. 工神：前3回合增伤30%，第4回合转为永久减伤15%
        if (hero.buffs.gongShenActive && round === 4) {
          const bonus = hero.buffs.gongShenBonus || 0.30;
          hero.buffs.damageDealtMod = Math.max(0.1, (hero.buffs.damageDealtMod || 1.0) - bonus - 0.15);
          hero.buffs.firstStrike = false;
          hero.buffs.gongShenActive = false;
          log(round, `⌛ 工神机巧竭尽！【${hero.label}】先攻消散，造成的伤害降低 15%！`, 'status', { actor: hero });
        }
        // 14. 抚辑军民：第4回合减伤解除并触发巨量兵力恢复
        if (hero.buffs.fuJiActive && round === 4) {
          hero.buffs.damageReceivedMod = (hero.buffs.damageReceivedMod || 1.0) + (hero.buffs.fuJiRed || 0.40);
          hero.buffs.fuJiActive = false;
          const actorDoc = hero.buffs.fuJiActor;
          if (actorDoc && hero.currentSoldiers > 0) {
            const heal = Math.round(actorDoc.intel * 1.26 * Math.sqrt(actorDoc.currentSoldiers / 100));
            const actualHeal = Math.min(hero.maxSoldiers - hero.currentSoldiers, heal);
            if (actualHeal > 0) {
              hero.currentSoldiers += actualHeal;
              recordHeroHeal(actorDoc, actualHeal, 'tac_fu_ji_jun_min');
              log(round, `🕊️ 抚辑军民泽润三军！【${actorDoc.label}】军民休养，为【${hero.label}】大幅恢复 ${actualHeal} 兵力！(余兵:${hero.currentSoldiers})`, 'heal', { actor: actorDoc, target: hero });
            }
          }
        }
        // 15. 状态持续回合递减 (伪报、禁疗、草船借箭急救)
        if (hero.buffs.weiBao > 0) {
          hero.buffs.weiBao--;
          if (hero.buffs.weiBao === 0) {
            log(round, `✨【${hero.label}】脱离【伪报】封禁，指挥与被动战法全部恢复生效！`, 'buff', { actor: hero });
          }
        }
        if (hero.buffs.cannotHeal > 0) {
          hero.buffs.cannotHeal--;
          if (hero.buffs.cannotHeal === 0) {
            log(round, `✨【${hero.label}】摆脱【禁疗】束缚，恢复受疗能力！`, 'buff', { actor: hero });
          }
        }
        if (hero.buffs.caoChuanEmergency > 0) {
          hero.buffs.caoChuanEmergency--;
        }
      });
    });

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
          const burnSource = actor.buffs.burnSourceActor || oppTeam.find(h => h.currentSoldiers > 0) || actor;
          const dotDmg = Math.round(actor.buffs.burnDmg * (actor.currentSoldiers / actor.initialSoldiers + 0.5));
          const actualDot = applyDamageToTarget(round, burnSource, actor, dotDmg, log, '烈火灼烧', { damageType: 'tactical', isFire: true });
          if (actualDot > 0) {
            log(round, `🔥【${actor.label}】身陷烈火，承受来自【${burnSource.label}】施加的 ${actualDot} 点谋略灼烧伤害！(余兵:${actor.currentSoldiers})`, 'dot', { actor: burnSource, target: actor });
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
        const waterSource = actor.buffs.waterSourceActor || oppTeam.find(h => h.currentSoldiers > 0) || actor;
        const dotDmg = Math.round(actor.buffs.waterDmg * (actor.currentSoldiers / actor.initialSoldiers + 0.5));
        const actualDot = applyDamageToTarget(round, waterSource, actor, dotDmg, log, '滔天水攻', { damageType: 'tactical' });
        if (actualDot > 0) {
          log(round, `🌊【${actor.label}】身陷滔天浪潮，承受来自【${waterSource.label}】施加的 ${actualDot} 点水浸谋略伤害！(余兵:${actor.currentSoldiers})`, 'dot', { actor: waterSource, target: actor });
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

      // 持续战法触发 (如用武通神、绝地反击、士别三日)
      const yongWuTac = actor.tactics.find(t => t.id === 'tac_yong_wu_tong_shen');
      if (yongWuTac && (round === 2 || round === 4 || round === 6 || round === 8)) {
        const baseMult = (round === 2 ? 0.75 : round === 4 ? 1.05 : round === 6 ? 1.35 : 1.65);
        const scale = yongWuTac.scale || (yongWuTac.damageRate ? (yongWuTac.damageRate / 1.65) : 1);
        const mult = baseMult * scale;
        livingOpps.forEach(opp => {
          const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * mult);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '用武通神', { damageType: 'tactical' });
          if (actualDmg > 0) {
            log(round, `⚡ 用武通神第 ${round} 回合爆发(伤害率${(mult * 100).toFixed(0)}%)！对【${opp.label}】造成 ${actualDmg} 点稳定谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      const jueDiTac = actor.tactics.find(t => t.id === 'tac_jue_di_fan_ji');
      if (jueDiTac && round === 5) {
        const stacks = actor.buffs.jueDiStacks || 0;
        const maxRate = jueDiTac.damageRate || 2.80;
        const baseRate = maxRate * 0.5;
        const currentRate = baseRate + (maxRate - baseRate) * (stacks / 10);
        livingOpps.forEach(opp => {
          const rawDmg = Math.round(Math.max(20, actor.force * 1.6 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * currentRate);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '绝地反击', { damageType: 'blade' });
          if (actualDmg > 0) {
            log(round, `🛡️💥 绝地反击第 5 回合蓄力爆发(蓄力${stacks}层·伤害率${(currentRate * 100).toFixed(0)}%)！对【${opp.label}】发动致命反击造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 士别三日 (第4回合提高智力并对敌军全体发动谋略轰炸)
      const shiBieTac = actor.tactics.find(t => t.id === 'tac_shi_bie_san_ri');
      if (shiBieTac && round === 4 && !actor.buffs.shiBieTriggered) {
        actor.buffs.shiBieTriggered = true;
        const intelBoost = shiBieTac.statBuff || 68;
        actor.intel += intelBoost;
        const dmgRate = shiBieTac.damageRate || 1.80;
        log(round, `📖 士别三日非复阿蒙！【${actor.label}】智力暴增 ${intelBoost} 点，全体谋略轰炸引爆！`, 'buff', { actor });
        livingOpps.forEach(opp => {
          const rawDmg = Math.round((actor.intel * 1.5 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '士别三日', { damageType: 'tactical' });
          if (actualDmg > 0) {
            log(round, `📖💥 士别三日雷霆轰顶！对【${opp.label}】造成 ${actualDmg} 点狂暴谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 朱儁 镇压黄巾 (第2、3回合使敌军全体陷入溃逃真实谋略伤害)
      const zhenYaTac = actor.tactics.find(t => t.id === 'tac_zhen_ya_huang_jin');
      if (zhenYaTac && (round === 2 || round === 3)) {
        livingOpps.forEach(opp => {
          const rawDmg = Math.round(actor.intel * 1.35 * Math.sqrt(actor.currentSoldiers / 100) * (zhenYaTac.damageRate || 0.88));
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '镇压黄巾', { damageType: 'true' });
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
          const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '义胆兵刃', { damageType: 'blade' });
          if (actualDmg > 0) {
            log(round, `⚡ 义胆雄心奇数回合！【${actor.label}】剑斩【${target.label}】造成 ${actualDmg} 点兵刃伤害，并削弱其 64 点统率！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
          }
        } else {
          // 偶数回合：谋略伤害 184% + 降低 64 点智力
          target.intel = Math.max(10, target.intel - 64);
          const rawDmg = Math.round((actor.intel * 1.6 - target.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.84);
          const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '义胆谋略', { damageType: 'tactical' });
          if (actualDmg > 0) {
            log(round, `⚡ 义胆雄心偶数回合！【${actor.label}】神机轰炸【${target.label}】造成 ${actualDmg} 点谋略伤害，并削弱其 64 点智力！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
          }
        }
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 🌟 刘备 仁德载世 (每回合恢复我军群体2人兵力，25%概率使敌军单体陷入虚弱1回合)
      const renDeTac = actor.tactics.find(t => t.id === 'tac_ren_de_zai_shi');
      if (renDeTac && actor.currentSoldiers > 0) {
        const livingMates = team.filter(h => h.currentSoldiers > 0);
        const targets = getRandomElements(livingMates, 2);
        const healRate = renDeTac.healRate || 1.28;
        targets.forEach(mate => {
          const heal = Math.round((actor.intel * healRate + 20) * Math.sqrt(actor.currentSoldiers / 100));
          const actualHeal = Math.min(mate.maxSoldiers - mate.currentSoldiers, heal);
          if (actualHeal > 0) {
            mate.currentSoldiers += actualHeal;
            recordHeroHeal(actor, actualHeal, renDeTac.id);
            log(round, `🌿 仁德载世昭烈仁心！【${actor.label}】为【${mate.label}】疗愈恢复 ${actualHeal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
          }
        });
        // 25% 概率使敌军单体陷入虚弱
        if (livingOpps.length > 0 && Math.random() < 0.25) {
          const debuffTarget = livingOpps[Math.floor(Math.random() * livingOpps.length)];
          if (!debuffTarget.buffs.insight) {
            debuffTarget.buffs.weakness = 1;
            log(round, `🕊️ 仁德感召！【${debuffTarget.label}】受刘皇叔浩然正气感化，陷入【虚弱】1回合(无法造成伤害)！`, 'debuff', { actor, target: debuffTarget });
          }
        }
      }

      // 🌟 张飞 燕人咆哮 (第2、4回合对敌军全体发动兵刃攻击；若目标处于缴械，额外降低其统率50%持续2回合)
      const yanRenTac = actor.tactics.find(t => t.id === 'tac_yan_ren_pao_xiao');
      if (yanRenTac && (round === 2 || round === 4) && actor.currentSoldiers > 0) {
        const dmgRate = yanRenTac.damageRate || 1.04;
        log(round, `🐅 燕人咆哮撼天动地！【${actor.label}】当阳桥前雷霆怒吼，对敌军全体发动兵刃轰击！`, 'skill', { actor, tactic: yanRenTac, isSkillCast: true });
        livingOpps.forEach(opp => {
          const rawDmg = Math.round(Math.max(20, actor.force * 1.5 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '燕人咆哮', { damageType: 'blade', tacticId: yanRenTac.id });
          if (actualDmg > 0) {
            log(round, `💥 燕人咆哮音浪撕裂！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
          if (opp.buffs.disarmed > 0 && opp.currentSoldiers > 0) {
            const debuffVal = Math.round(opp.command * 0.50);
            opp.command = Math.max(10, opp.command - debuffVal);
            if (!opp.buffs.statRestorations) opp.buffs.statRestorations = [];
            opp.buffs.statRestorations.push({ roundExpire: round + 2, command: debuffVal, intel: 0, name: '燕人咆哮' });
            log(round, `⚡【${opp.label}】受制于缴械复遭吼击，胆裂心惊，统率暴跌 50%(降低${debuffVal}点，持续2回合)！`, 'debuff', { actor, target: opp });
          }
        });
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 🌟 司马懿 鹰视狼顾 (前4回合自身获得攻心吸血并叠加奇谋概率；第5回合起每回合对敌军全体造成强力谋略伤害)
      const yingShiTac = actor.tactics.find(t => t.id === 'tac_ying_shi_lang_gu');
      if (yingShiTac && actor.currentSoldiers > 0) {
        if (round <= 4) {
          actor.buffs.vampireTactical = 0.20; // 攻心谋略吸血20%
          actor.buffs.tacticalCritRate = (actor.buffs.tacticalCritRate || 0) + 0.07;
          log(round, `🦅 鹰视狼顾隐忍蓄力！【${actor.label}】第 ${round} 回合奇谋几率提升 7%(当前:${Math.round((actor.buffs.tacticalCritRate || 0) * 100)}%)，获攻心吸血加持！`, 'buff', { actor });
        } else {
          const dmgRate = yingShiTac.damageRate || 1.54;
          log(round, `🦅 鹰视狼顾谋动天下！【${actor.label}】后期杀招完全解放，对敌军全体发动毁灭性谋略轰炸！`, 'skill', { actor, tactic: yingShiTac, isSkillCast: true });
          livingOpps.forEach(opp => {
            const rawDmg = Math.round((actor.intel * 1.55 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate);
            const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '鹰视狼顾', { damageType: 'tactical', tacticId: yingShiTac.id });
            if (actualDmg > 0) {
              log(round, `⚡ 狼顾轰杀！对【${opp.label}】造成 ${actualDmg} 点狂暴谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
            }
          });
          if (checkLeaderDeath(round)) break battleLoop;
        }
      }

      // 🌟 鲁肃 济贫好施 (第2回合移交40%自身属性给我军兵力最低友军；后续回合为其提供42%减伤与持续回血)
      const jiPinTac = actor.tactics.find(t => t.id === 'tac_ji_pin_hao_shi');
      if (jiPinTac && actor.currentSoldiers > 0) {
        if (round === 2 && !actor.buffs.jiPinTransferred) {
          const otherLivingMates = team.filter(h => h.currentSoldiers > 0 && h !== actor);
          if (otherLivingMates.length > 0) {
            otherLivingMates.sort((a, b) => a.currentSoldiers - b.currentSoldiers);
            const beneficiary = otherLivingMates[0];
            actor.buffs.jiPinTransferred = true;
            actor.buffs.jiPinBeneficiary = beneficiary;
            const fShare = Math.round(actor.force * 0.40);
            const iShare = Math.round(actor.intel * 0.40);
            const cShare = Math.round(actor.command * 0.40);
            const sShare = Math.round(actor.speed * 0.40);
            actor.force -= fShare;
            actor.intel -= iShare;
            actor.command -= cShare;
            actor.speed -= sShare;
            beneficiary.force += fShare;
            beneficiary.intel += iShare;
            beneficiary.command += cShare;
            beneficiary.speed += sShare;
            log(round, `🤝 济贫好施倾囊相赠！【${actor.label}】移交自身 40% 属性予【${beneficiary.label}】(武+${fShare}/智+${iShare}/统+${cShare}/速+${sShare})！`, 'buff', { actor, target: beneficiary });
          }
        } else if (round >= 3 && actor.buffs.jiPinBeneficiary && actor.buffs.jiPinBeneficiary.currentSoldiers > 0) {
          const ben = actor.buffs.jiPinBeneficiary;
          ben.buffs.damageReduction = Math.max(ben.buffs.damageReduction || 0, 0.42);
          const heal = Math.round(actor.intel * (jiPinTac.healRate || 1.0) * Math.sqrt(actor.currentSoldiers / 100));
          const actualHeal = Math.min(ben.maxSoldiers - ben.currentSoldiers, heal);
          if (actualHeal > 0) {
            ben.currentSoldiers += actualHeal;
            recordHeroHeal(actor, actualHeal, jiPinTac.id);
            log(round, `🌿 济贫好施仁厚润物！【${actor.label}】为受助友军【${ben.label}】回复 ${actualHeal} 兵力并赋予 42% 巨额减伤！(余兵:${ben.currentSoldiers})`, 'heal', { actor, target: ben });
          }
        }
      }

      // 🌟 董卓 酒池肉林 (第5回合起每回合对敌我全体除自身外造成毁灭性兵刃轰击 120%)
      const jiuChiTac = actor.tactics.find(t => t.id === 'tac_jiu_chi_rou_lin');
      if (jiuChiTac && round >= 5 && actor.currentSoldiers > 0) {
        const dmgRate = jiuChiTac.damageRate || 1.20;
        log(round, `🥩 酒池肉林狂暴嗜杀！【${actor.label}】魔威暴走，对全场敌我单位发动无差别兵刃轰击！`, 'skill', { actor, tactic: jiuChiTac, isSkillCast: true });
        const allTargets = [...team, ...oppTeam].filter(h => h.currentSoldiers > 0 && h !== actor);
        allTargets.forEach(tgt => {
          const rawDmg = Math.round((actor.force * 1.5 - tgt.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate);
          const actualDmg = applyDamageToTarget(round, actor, tgt, rawDmg, log, '酒池肉林', { damageType: 'blade', tacticId: jiuChiTac.id });
          if (actualDmg > 0) {
            log(round, `💥 魔王狂碾！对【${tgt.label}】造成 ${actualDmg} 点狂暴兵刃重创！(余兵:${tgt.currentSoldiers})`, 'action', { actor, target: tgt });
          }
        });
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
          recordHeroHeal(actor, actualHeal, tac.id);
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
            opp.buffs.waterSourceActor = actor;
            opp.buffs.waterApplied = true;
            opp.buffs.tacticalReceivedMod += 0.15; // 受谋略伤害提升 15%
            log(round, `🌧️ 兴云布雨引动天象！【${opp.label}】陷入持续【水攻】侵蚀，受到谋略伤害提升 15%！`, 'debuff', { actor, target: opp });
          }
        });
      }

      // 🌟 三势阵副将攻防分流轮动 (前5回合每回合行动前结算)
      if (team.hasSanShi && actor.isLeader && round <= 5) {
        const subHeroes = team.filter(h => !h.isLeader && h.currentSoldiers > 0);
        if (subHeroes.length >= 2) {
          // 清空上一回合三势阵副将轮动
          subHeroes.forEach(s => {
            if (s.buffs.sanShiDealtBonus) {
              s.buffs.damageDealtMod = Math.max(0.1, (s.buffs.damageDealtMod || 1.0) - s.buffs.sanShiDealtBonus);
              s.buffs.sanShiDealtBonus = 0;
            }
            if (s.buffs.sanShiReceivedRed) {
              s.buffs.damageReceivedMod = (s.buffs.damageReceivedMod || 1.0) + s.buffs.sanShiReceivedRed;
              s.buffs.sanShiReceivedRed = 0;
            }
          });
          // 按损失兵力比例排序 (损失率较高者在前)
          subHeroes.sort((a, b) => (1 - a.currentSoldiers / a.maxSoldiers) - (1 - b.currentSoldiers / b.maxSoldiers));
          const tankSub = subHeroes[subHeroes.length - 1]; // 损兵最多
          const dpsSub = subHeroes[0]; // 损兵较少
          tankSub.buffs.damageReceivedMod = Math.max(0.1, (tankSub.buffs.damageReceivedMod || 1.0) - 0.30);
          tankSub.buffs.sanShiReceivedRed = 0.30;
          dpsSub.buffs.damageDealtMod = (dpsSub.buffs.damageDealtMod || 1.0) + 0.25;
          dpsSub.buffs.sanShiDealtBonus = 0.25;
          log(round, `🏛️ 三势阵天机流转！【${tankSub.label}】损兵较重获得 30% 减伤庇护；【${dpsSub.label}】蓄势增伤 25%！`, 'buff', { actor });
        }
      }

      // 🌟 郝昭 金城汤池 (无法普攻；奇数回合群体治疗，偶数回合烈火真伤)
      const jinChengTac = actor.tactics.find(t => t.id === 'tac_jin_cheng_tang_chi');
      if (jinChengTac && actor.currentSoldiers > 0) {
        actor.buffs.disarmed = Math.max(actor.buffs.disarmed || 0, 1); // 战法专属：无法进行普通攻击
        if (round % 2 === 1) {
          // 奇数回合：治疗群体2人
          const wounded = team.filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)).slice(0, 2);
          wounded.forEach(m => {
            const heal = Math.round(actor.intel * 0.98 * Math.sqrt(actor.currentSoldiers / 100));
            const actualHeal = Math.min(m.maxSoldiers - m.currentSoldiers, heal);
            if (actualHeal > 0) {
              m.currentSoldiers += actualHeal;
              recordHeroHeal(actor, actualHeal, jinChengTac.id);
              log(round, `🏰 金城汤池奇数回合！【${actor.label}】修缮城堑，为【${m.label}】恢复 ${actualHeal} 兵力！(余兵:${m.currentSoldiers})`, 'heal', { actor, target: m });
            }
          });
        } else {
          // 偶数回合：敌军全体无视防御烈火真伤
          log(round, `🔥 金城汤池偶数回合！【${actor.label}】陈仓烈火喷涌，对敌军全体倾泻无视防御真伤！`, 'skill', { actor, tactic: jinChengTac, isSkillCast: true });
          livingOpps.forEach(opp => {
            const rawDmg = Math.round(actor.intel * 1.02 * Math.sqrt(actor.currentSoldiers / 100));
            const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '金城烈火', { damageType: 'true', tacticId: jinChengTac.id });
            if (actualDmg > 0) {
              log(round, `🔥 陈仓烈火真伤焚敌！对【${opp.label}】造成 ${actualDmg} 点烈火真实谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
            }
          });
          if (checkLeaderDeath(round)) break battleLoop;
        }
      }

      // 🌟 满宠 镇扼防拒 (每回合50%几率使副将援护友军)
      const zhenETac = actor.tactics.find(t => t.id === 'tac_zhen_e_fang_ju');
      if (zhenETac && actor.currentSoldiers > 0) {
        if (Math.random() < 0.50) {
          const subHeroes = team.filter(h => !h.isLeader && h.currentSoldiers > 0);
          if (subHeroes.length > 0) {
            const coverHero = subHeroes[Math.floor(Math.random() * subHeroes.length)];
            coverHero.buffs.rescueCover = true;
            coverHero.buffs.manChongCover = actor;
            log(round, `🏛️ 镇扼防拒调兵遣将！【${actor.label}】令副将【${coverHero.label}】进入【援护】状态，本回合替全体友军承担所有普攻！`, 'buff', { actor, target: coverHero });
          }
        }
      }

      // 🌟 孟获 南蛮渠魁 (行动时全体兵刃，受击增加几率)
      const nanManTac = actor.tactics.find(t => t.id === 'tac_nan_man_qu_kui');
      if (nanManTac && actor.currentSoldiers > 0) {
        const triggerRate = Math.min(100, 28 + (actor.buffs.nanManBonusRate || 0));
        if (Math.random() * 100 < triggerRate) {
          actor.buffs.nanManBonusRate = 0; // 触发后重置
          log(round, `👑 南蛮渠魁战意咆哮！【${actor.label}】蛮王之怒(几率${triggerRate}%)，对敌军全体发动野性兵刃轰击！`, 'skill', { actor, tactic: nanManTac, isSkillCast: true });
          livingOpps.forEach(opp => {
            const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.06);
            const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '南蛮渠魁', { damageType: 'blade', tacticId: nanManTac.id });
            if (actualDmg > 0) {
              log(round, `💥 蛮王重击！对【${opp.label}】造成 ${actualDmg} 点狂暴兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
            }
          });
          if (checkLeaderDeath(round)) break battleLoop;
        }
      }

      // 🌟 于禁/陆抗传承 乘胜长驱 (每回合造成伤害提升11%，最多8层)
      const chengShengTac = actor.tactics.find(t => t.id === 'tac_cheng_sheng_chang_qu');
      if (chengShengTac && actor.currentSoldiers > 0) {
        if ((actor.buffs.chengShengStacks || 0) < 8) {
          actor.buffs.chengShengStacks = (actor.buffs.chengShengStacks || 0) + 1;
          actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) + 0.11;
          log(round, `⚔️ 乘胜长驱愈战愈勇！【${actor.label}】战意叠加第${actor.buffs.chengShengStacks}层，造成伤害提升 ${(actor.buffs.chengShengStacks * 11)}%！`, 'buff', { actor });
        }
      }

      // 🌟 邹氏 顾盼生姿 (行动前偷取最高属性，敌男性45%虚弱)
      const guPanTac = actor.tactics.find(t => t.id === 'tac_gu_pan_sheng_zi');
      if (guPanTac && actor.currentSoldiers > 0 && livingOpps.length > 0) {
        const highestEnemy = livingOpps.slice().sort((a, b) => (b.intel + b.command) - (a.intel + a.command))[0];
        if (highestEnemy) {
          const stealVal = Math.round(35 * (1 + Math.max(0, actor.intel - 80) * 0.002));
          highestEnemy.intel = Math.max(10, highestEnemy.intel - stealVal);
          highestEnemy.command = Math.max(10, highestEnemy.command - stealVal);
          actor.intel += stealVal;
          actor.command += stealVal;
          log(round, `💄 顾盼生姿惑敌摄魄！【${actor.label}】偷取【${highestEnemy.label}】${stealVal}点智力与统率加持自身！`, 'debuff', { actor, target: highestEnemy });
        }
        livingOpps.forEach(opp => {
          if (!isFemaleGeneral(opp) && Math.random() < 0.45 && !opp.buffs.insight) {
            opp.buffs.weakness = Math.max(opp.buffs.weakness || 0, 1);
            log(round, `💔【${opp.label}】为美色所惑神魂颠倒，陷入【虚弱】无法造成伤害1回合！`, 'debuff', { actor, target: opp });
          }
        });
      }

      // 🌟 王元姬 垂心万物 (奇数回合群体治疗，偶数回合连击增伤)
      const chuiXinTac = actor.tactics.find(t => t.id === 'tac_chui_xin_wan_wu');
      if (chuiXinTac && actor.currentSoldiers > 0) {
        if (round % 2 === 1) {
          const wounded = team.filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers))[0];
          if (wounded) {
            const heal = Math.round(actor.intel * 1.28 * Math.sqrt(actor.currentSoldiers / 100));
            const actualHeal = Math.min(wounded.maxSoldiers - wounded.currentSoldiers, heal);
            if (actualHeal > 0) {
              wounded.currentSoldiers += actualHeal;
              recordHeroHeal(actor, actualHeal, chuiXinTac.id);
              log(round, `🪷 垂心万物奇数治愈！【${actor.label}】温言抚军，为【${wounded.label}】恢复 ${actualHeal} 兵力！(余兵:${wounded.currentSoldiers})`, 'heal', { actor, target: wounded });
            }
          }
        } else {
          const highestForce = team.filter(h => h.currentSoldiers > 0).sort((a, b) => b.force - a.force)[0];
          if (highestForce) {
            highestForce.buffs.continuousAttack = true;
            highestForce.buffs.damageDealtMod = (highestForce.buffs.damageDealtMod || 1.0) + 0.20;
            highestForce.buffs.chuiXinTempBonus = 0.20;
            log(round, `🪷 垂心万物偶数破阵！【${actor.label}】指引军锋，令【${highestForce.label}】获得【连击】并增伤 20%！`, 'buff', { actor, target: highestForce });
          }
        }
      }

      // 🌟 身负【叛逃】真实破防伤害回合初扣除
      if (actor.buffs.panTao > 0 && actor.currentSoldiers > 0) {
        const panTaoDmg = Math.max(50, Math.round((actor.buffs.panTaoDmg || 1200) * Math.sqrt(actor.currentSoldiers / 100)));
        actor.currentSoldiers = Math.max(0, actor.currentSoldiers - panTaoDmg);
        actor.stats.damageTaken += panTaoDmg;
        if (actor.buffs.panTaoSourceActor) {
          actor.buffs.panTaoSourceActor.stats.damageDealt += panTaoDmg;
        }
        log(round, `🩸【${actor.label}】身中剧毒叛逃侵蚀，受到 ${panTaoDmg} 点真实破防崩解伤害！(余兵:${actor.currentSoldiers})`, 'action', { target: actor });
        actor.buffs.panTao--;
        if (checkLeaderDeath(round)) break battleLoop;
      }

      // 步练师安抚军心急救回合递减
      if (actor.buffs.anFuEmergency > 0) actor.buffs.anFuEmergency--;

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
          actor.buffs.shareDamageIsGuanXing = false;
        }
      }

      // 🌟 王元姬【垂心万物】临时连击与增伤在行动结束后安全回收
      if (actor.buffs.chuiXinTempBonus) {
        actor.buffs.damageDealtMod = Math.max(0.1, (actor.buffs.damageDealtMod || 1.0) - actor.buffs.chuiXinTempBonus);
        actor.buffs.chuiXinTempBonus = 0;
        if (!actor.tactics.some(t => t.id === 'tac_shen_she')) {
          actor.buffs.continuousAttack = false;
        }
      }

      // 检查斩首：如果任何一方主将阵亡，战斗直接提前终结！
      if (checkLeaderDeath(round)) break battleLoop;
    }

    // 每回合末：维护全员【抵御】等有持续时间限制的状态
    [...playerHeroes, ...enemyHeroes].filter(h => h.currentSoldiers > 0).forEach(h => {
      // 🌟 王元姬偶数回合连击增伤保底回收 (防止行动顺序滞后武将跨回合驻留)
      if (h.buffs.chuiXinTempBonus) {
        h.buffs.damageDealtMod = Math.max(0.1, (h.buffs.damageDealtMod || 1.0) - h.buffs.chuiXinTempBonus);
        h.buffs.chuiXinTempBonus = 0;
        if (!h.tactics.some(t => t.id === 'tac_shen_she')) {
          h.buffs.continuousAttack = false;
        }
      }
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
      tactics: h.tactics.map((t, idx) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        quality: (idx === 0) ? (h.star >= 5 ? 'S' : (h.star === 4 ? 'A' : 'B')) : (t.quality || 'A'),
        level: t.level || 1
      })),
      tacticStats: Object.values(h.tacticStats || {})
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
      tactics: h.tactics.map((t, idx) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        quality: (idx === 0) ? (h.star >= 5 ? 'S' : (h.star === 4 ? 'A' : 'B')) : (t.quality || 'A'),
        level: t.level || 1
      })),
      tacticStats: Object.values(h.tacticStats || {})
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
/**
 * 战报统计：记录武将兵力恢复并精准归集至对应战法
 */
function recordHeroHeal(actor, heal, tacticId = null) {
  if (!actor || !heal || heal <= 0) return 0;
  actor.stats.healDone += heal;
  if (tacticId && actor.tacticStats && actor.tacticStats[tacticId]) {
    actor.tacticStats[tacticId].heals += heal;
  }
  return heal;
}

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
 * 通用目标伤害结算与防御减免 (全面覆盖兵刃/谋略/真伤分流、藤甲火攻引燃、会心/奇谋暴击与抵御规避)
 * @returns {{ damage: number, wasHit: boolean, shielded: boolean, isCrit: boolean, damageType: string }} 结算结果
 */
function applyDamageToTarget(round, actor, target, rawDmg, log, damageDesc = '', options = {}) {
  if (target.currentSoldiers <= 0) return { damage: 0, wasHit: false, shielded: false, isCrit: false, damageType: 'blade', valueOf() { return 0; }, toString() { return '0'; } };

  // 1. 虚弱判定 (攻击方处于虚弱，无法造成伤害，但依然算攻击动作)
  if (actor.buffs.weakness > 0) {
    return { damage: 0, wasHit: true, shielded: false, isCrit: false, damageType: 'blade', valueOf() { return 0; }, toString() { return '0'; } };
  }

  const hasTrueStrike = Boolean(actor.buffs.trueStrike);

  // 2. 规避判定 (如左慈金丹秘术，必中可直接无视规避)
  if (!hasTrueStrike && target.buffs.evasionRate && Math.random() < target.buffs.evasionRate) {
    log(round, `✨【${target.label}】身法鬼魅，凭借【金丹规避】完全避开了【${actor.label}】的攻击！`, 'buff', { actor, target });
    return { damage: 0, wasHit: false, shielded: false, isCrit: false, damageType: 'blade', valueOf() { return 0; }, toString() { return '0'; } };
  }

  // 3. 必中判定提示
  if (hasTrueStrike && (target.buffs.shieldLayers > 0 || target.buffs.evasionRate > 0)) {
    log(round, `🎯【${actor.label}】身具【必中】之势，利刃破空，无视规避与抵御坚壁！`, 'skill', { actor, target });
  }

  // 🌟 诸葛恪【傲睨冲天】前3回合受创时60%概率赋予抵御
  if (round <= 3 && target.buffs?.aoNiCharges > 0 && Math.random() < 0.60 && !hasTrueStrike) {
    target.buffs.aoNiCharges--;
    grantShield(round, target, 1, 1, log, '傲睨冲天');
  }

  // 4. 抵御判定 (无必中时，抵御化解全部伤害，但依然算作受击 On Damaged)
  if (!hasTrueStrike && target.buffs.shieldLayers > 0) {
    target.buffs.shieldLayers--;
    if (target.buffs.shieldLayers <= 0) {
      target.buffs.shieldDuration = 0;
    }
    const desc = damageDesc ? `【${damageDesc}】` : '攻势';
    log(round, `🛡️【${target.label}】周身浮现【抵御】坚壁，本次伤害化为 0，完全化解了来自【${actor.label}】的${desc}！(剩余抵御: ${target.buffs.shieldLayers}次)`, 'action', { actor, target });
    // 🌟 诸葛恪【傲睨冲天】抵御抵消伤害时，恢复该武将兵力88%！
    if (target.buffs?.aoNiActor && target.buffs.aoNiActor.currentSoldiers > 0) {
      const aoNiHero = target.buffs.aoNiActor;
      const heal = Math.round(aoNiHero.intel * 0.88 * Math.sqrt(aoNiHero.currentSoldiers / 100));
      target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
      recordHeroHeal(aoNiHero, heal, 'tac_ao_ni_chong_tian');
      log(round, `📜 傲睨冲天抵御回春！【${aoNiHero.label}】神机护阵，为【${target.label}】恢复 ${heal} 兵力！(余兵:${target.currentSoldiers})`, 'heal', { actor: aoNiHero, target });
    }
    return { damage: 0, wasHit: true, shielded: true, isCrit: false, damageType: 'blade', valueOf() { return 0; }, toString() { return '0'; } };
  }

  // 5. 伤害类型判定 (blade: 兵刃, tactical: 谋略, true: 真实伤害)
  let damageType = 'blade';
  let isFire = false;
  let alreadyCrit = false;

  if (typeof options === 'string') {
    damageType = options;
  } else if (options && typeof options === 'object') {
    if (options.damageType) damageType = options.damageType;
    if (options.isFire) isFire = true;
    if (options.alreadyCrit) alreadyCrit = true;
  }

  // 若未显式传入 damageType，根据 damageDesc 进行智能推断兜底
  if (damageType === 'blade' && damageDesc) {
    if (/火|熯天|风助|烈火/.test(damageDesc)) {
      damageType = 'tactical';
      isFire = true;
    } else if (/水|滔天|沉沙|覆雨|用武通神|士别三日|五雷轰顶|雷击|谋略|义胆谋略|铁索连环|杯蛇鬼车|料事如神|妖术|沙暴/.test(damageDesc)) {
      damageType = 'tactical';
    } else if (/真实|叛逃|十面埋伏/.test(damageDesc)) {
      damageType = 'true';
    }
  }
  if (!isFire && /火|熯天|风助|烈火/.test(damageDesc)) {
    isFire = true;
  }

  // 基础系数：攻击方士气与战场自然随机浮动系数 (0.95 ~ 1.05)
  const actorMoraleMod = actor.moraleMod ?? 1.0;
  const floatMod = 0.95 + Math.random() * 0.10;

  let effectiveDealtMod = 1.0;
  let effectiveReceivedMod = 1.0;
  let isCrit = alreadyCrit;
  let critType = '';
  let critMult = 1.0;
  let tengJiaBurnIgnited = false;
  let modTags = '';

  // 6. 核心乘区分流结算
  if (damageType === 'true') {
    // 真实伤害：不受攻守双方常规减伤乘区影响，保留士气
    effectiveDealtMod = actorMoraleMod;
    effectiveReceivedMod = 1.0;
    modTags += '【真实伤害】';
  } else if (damageType === 'tactical') {
    // 谋略伤害：
    // 攻方谋略增减伤 * 全局伤害增减伤 * 士气
    const baseTacticalDealtMod = (actor.buffs?.tacticalDealtMod ?? 1.0) * (actor.buffs?.damageDealtMod ?? 1.0);
    effectiveDealtMod = baseTacticalDealtMod * actorMoraleMod;

    // 防方谋略承受倍率 * 全局承受倍率
    let baseTacticalReceivedMod = (target.buffs?.tacticalReceivedMod ?? 1.0) * (target.buffs?.damageReceivedMod ?? 1.0);

    // 🌟 藤甲兵遇火攻克制结算 (暴增 250% 伤害引燃)
    if (isFire && (target.buffs?.hasTengJia || target.hasTengJia)) {
      baseTacticalReceivedMod *= 2.50;
      tengJiaBurnIgnited = true;
      modTags += '【🔥藤甲引燃·暴增250%】';
    }

    // 减伤上限保护 (非引燃状态下，最大减伤 90%，保留至少 10% 底线)
    effectiveReceivedMod = tengJiaBurnIgnited ? baseTacticalReceivedMod : Math.max(0.10, baseTacticalReceivedMod);

    // 奇谋暴击结算 (太平道法、五谋臣等)
    if (!alreadyCrit && actor.buffs?.tacticalCritRate > 0 && Math.random() < actor.buffs.tacticalCritRate) {
      isCrit = true;
      critType = 'tactical';
      critMult = actor.buffs?.tacticalCritDamage || 2.0;
      if (target.buffs?.critDmgReduction) {
        critMult = Math.max(1.1, critMult - target.buffs.critDmgReduction);
      }
      modTags += '【⚡奇谋暴击】';
    }

    // 标签构造
    if (Math.abs(baseTacticalDealtMod - 1.0) >= 0.01) {
      const dealtPct = Math.round((baseTacticalDealtMod - 1.0) * 100);
      modTags += dealtPct > 0 ? `【谋略增伤+${dealtPct}%】` : `【谋略减伤${dealtPct}%】`;
    }
    if (Math.abs(effectiveReceivedMod - 1.0) >= 0.01 && !tengJiaBurnIgnited) {
      const receivedPct = Math.round((1.0 - effectiveReceivedMod) * 100);
      modTags += receivedPct > 0 ? `【谋略减伤${receivedPct}%】` : `【谋略易伤+${Math.abs(receivedPct)}%】`;
    }
  } else {
    // 兵刃伤害 (blade)：
    // 攻方兵刃增减伤 * 全局伤害增减伤 * 士气 + 徐晃长驱直入
    const changQuBonus = (actor.buffs?.changQuStacks || 0) * 0.15;
    const baseBladeDealtMod = (actor.buffs?.bladeDealtMod ?? 1.0) * (actor.buffs?.damageDealtMod ?? 1.0) + changQuBonus;
    effectiveDealtMod = baseBladeDealtMod * actorMoraleMod;

    // 防方兵刃承受倍率 * 全局承受倍率
    const baseBladeReceivedMod = (target.buffs?.bladeReceivedMod ?? 1.0) * (target.buffs?.damageReceivedMod ?? 1.0);
    // 减伤上限保护 (最大减伤 90%，保留至少 10% 底线)
    effectiveReceivedMod = Math.max(0.10, baseBladeReceivedMod);

    // 会心暴击结算 (甘宁、黄忠、左右开弓、五虎等)
    if (!alreadyCrit && actor.buffs?.critRate > 0 && Math.random() < actor.buffs.critRate) {
      isCrit = true;
      critType = 'blade';
      critMult = actor.buffs?.critDamage || 1.5;
      if (target.buffs?.critDmgReduction) {
        critMult = Math.max(1.1, critMult - target.buffs.critDmgReduction);
      }
      modTags += '【💥会心暴击】';
    }

    // 标签构造
    if (changQuBonus > 0) {
      modTags += `【长驱直入+${Math.round(changQuBonus * 100)}%】`;
    }
    if (Math.abs(baseBladeDealtMod - 1.0) >= 0.01) {
      const dealtPct = Math.round((baseBladeDealtMod - 1.0) * 100);
      modTags += dealtPct > 0 ? `【兵刃增伤+${dealtPct}%】` : `【兵刃减伤${dealtPct}%】`;
    }
    if (Math.abs(effectiveReceivedMod - 1.0) >= 0.01) {
      const receivedPct = Math.round((1.0 - effectiveReceivedMod) * 100);
      modTags += receivedPct > 0 ? `【兵刃减伤${receivedPct}%】` : `【兵刃易伤+${Math.abs(receivedPct)}%】`;
    }
  }

  // 🌟 许褚【虎痴】锁定目标增伤 33%
  if (actor.buffs?.huChiTarget && actor.buffs.huChiTarget === target) {
    effectiveDealtMod *= 1.33;
    modTags += '【虎痴锁定+33%】';
  }

  // 🌟 以逸待劳护盾结算 (法正自带：受下2次伤害降低)
  if (target.buffs?.yiYiCharges > 0) {
    const yiYiRed = target.buffs.yiYiReduction || 0.40;
    target.buffs.yiYiCharges--;
    effectiveReceivedMod = Math.max(0.10, effectiveReceivedMod * (1.0 - yiYiRed));
    modTags += `【以逸待劳减伤-${Math.round(yiYiRed * 100)}%(剩${target.buffs.yiYiCharges}次)】`;
  }

  // 🌟 荀彧【机鉴先识·警戒】结算 (受到伤害降低50%，最多4次)
  if (target.buffs?.jingJianCharges > 0) {
    target.buffs.jingJianCharges--;
    effectiveReceivedMod = Math.max(0.10, effectiveReceivedMod * 0.50);
    modTags += `【警戒减伤-50%(剩${target.buffs.jingJianCharges}次)】`;
  }

  // 🌟 乱世红颜：受到男性武将伤害降低 10%
  if (target.buffs?.maleDmgReduction > 0 && !isFemaleGeneral(actor)) {
    effectiveReceivedMod = Math.max(0.10, effectiveReceivedMod * (1.0 - target.buffs.maleDmgReduction));
    modTags += `【乱世红颜减伤-${Math.round(target.buffs.maleDmgReduction * 100)}%】`;
  }

  // 士气不足惩罚标签
  if (actorMoraleMod < 0.98) {
    const moraleNerfPct = Math.round((1.0 - actorMoraleMod) * 100);
    modTags += `【士气削弱-${moraleNerfPct}%】`;
  }

  // 基础最终伤害结算 (带入暴击倍率)
  let finalDmg = Math.max(1, Math.round(rawDmg * effectiveDealtMod * effectiveReceivedMod * floatMod * critMult));

  // 勇者得前单次增伤消费还原
  if (actor.buffs?.yongZheBonus) {
    const yzBonus = actor.buffs.yongZheBonus;
    actor.buffs.damageDealtMod = Math.max(1.0, (actor.buffs.damageDealtMod || 1.0) / (1 + yzBonus));
    actor.buffs.yongZheBonus = null;
  }

  // 记录最近一次伤害结算的增减伤加成与目标信息，供战报 log 自动提取联动
  lastDamageContext = {
    actor,
    target,
    finalDmg,
    modTags,
    effectiveDealtMod,
    effectiveReceivedMod,
    damageType,
    isCrit,
    critType,
    tengJiaBurnIgnited
  };

  // 🌟 周泰【肉身铁壁】伤害分摊机制 (友军受创时周泰挺身替其分摊承受 40% 伤害)
  if (finalDmg > 0 && target.buffs?.zhouTaiProtector && target.buffs.zhouTaiProtector.currentSoldiers > 0 && target !== target.buffs.zhouTaiProtector) {
    const zhouTai = target.buffs.zhouTaiProtector;
    const shareRate = target.buffs.zhouTaiShareRate || 0.40;
    const sharedDmg = Math.min(zhouTai.currentSoldiers, Math.max(1, Math.round(finalDmg * shareRate)));
    finalDmg = Math.max(0, finalDmg - sharedDmg);
    zhouTai.currentSoldiers = Math.max(0, zhouTai.currentSoldiers - sharedDmg);
    zhouTai.stats.damageTaken += sharedDmg;
    log(round, `🛡️【${zhouTai.label}】肉身铁壁舍生护主！挺身替【${target.label}】分摊承受了 ${sharedDmg} 点伤害！(周泰余兵:${zhouTai.currentSoldiers})`, 'buff', { actor: zhouTai, target });
    if (zhouTai.currentSoldiers <= 0) {
      log(round, `💀【${zhouTai.label}】为掩护友军战至力竭阵亡！肉身铁壁护阵瓦解！`, 'death', { actor: zhouTai });
      target.buffs.zhouTaiProtector = null;
    }
  }

  // 貂蝉【闭月】与关兴【双雄同袍】伤害分担机制
  if (finalDmg > 0 && target.buffs.shareDamageTarget && target.buffs.shareDamageTarget.currentSoldiers > 0 && target.buffs.shareDamageRate > 0) {
    const proxy = target.buffs.shareDamageTarget;
    const shareRate = target.buffs.shareDamageRate;
    const sharedDmg = Math.min(proxy.currentSoldiers, Math.max(1, Math.round(finalDmg * shareRate)));
    finalDmg = Math.max(0, finalDmg - sharedDmg);
    proxy.currentSoldiers = Math.max(0, proxy.currentSoldiers - sharedDmg);
    proxy.stats.damageTaken += sharedDmg;
    if (target.buffs.shareDamageIsGuanXing) {
      log(round, `🤝【${proxy.label}】双雄同袍！挺身替【${target.label}】分担承受了 ${sharedDmg} 点伤害！(关兴余兵:${proxy.currentSoldiers})`, 'buff', { actor: proxy, target });
    } else {
      log(round, `🌹【${target.label}】闭月倾城！借力化解，将 ${sharedDmg} 点伤害转移至【${proxy.label}】承受！(余兵:${proxy.currentSoldiers})`, 'buff', { actor: target, target: proxy });
    }
  }

  // 🌟 陆抗【校胜帷幄】主将伤害分担机制 (陆抗替主将分担 30% 伤害)
  if (finalDmg > 0 && target.buffs?.luKangProtector && target.buffs.luKangProtector.currentSoldiers > 0 && target !== target.buffs.luKangProtector) {
    const luKang = target.buffs.luKangProtector;
    const sharedDmg = Math.min(luKang.currentSoldiers, Math.max(1, Math.round(finalDmg * 0.30)));
    finalDmg = Math.max(0, finalDmg - sharedDmg);
    luKang.currentSoldiers = Math.max(0, luKang.currentSoldiers - sharedDmg);
    luKang.stats.damageTaken += sharedDmg;
    log(round, `🦊【${luKang.label}】校胜帷幄舍身护帅！挺身为主将【${target.label}】分担承受了 ${sharedDmg} 点伤害！(陆抗余兵:${luKang.currentSoldiers})`, 'buff', { actor: luKang, target });
    if (luKang.currentSoldiers <= 0) {
      log(round, `💀【${luKang.label}】为主将护阵力竭阵亡！`, 'death', { actor: luKang });
      target.buffs.luKangProtector = null;
    }
  }

  // 🌟 小乔【天香】受创伤害转移 (40%几率将伤害的50%转移给敌军兵力最低的武将)
  if (finalDmg > 0 && target.buffs?.tianXiang && target.currentSoldiers > 0 && Math.random() < 0.40) {
    const attackerTeam = [actor, ...(actor.buffs?.opponentsRef || [])].filter(h => h && h.currentSoldiers > 0);
    if (attackerTeam.length > 0) {
      const lowestOpp = attackerTeam.slice().sort((a, b) => a.currentSoldiers - b.currentSoldiers)[0];
      const transferDmg = Math.round(finalDmg * 0.50);
      finalDmg = Math.max(0, finalDmg - transferDmg);
      lowestOpp.currentSoldiers = Math.max(0, lowestOpp.currentSoldiers - transferDmg);
      lowestOpp.stats.damageTaken += transferDmg;
      log(round, `🪭【${target.label}】天香移花接木！身姿轻盈转嫁 ${transferDmg} 点伤害至敌将【${lowestOpp.label}】！(余兵:${lowestOpp.currentSoldiers})`, 'buff', { actor: target, target: lowestOpp });
    }
  }

  target.currentSoldiers = Math.max(0, target.currentSoldiers - finalDmg);
  actor.stats.damageDealt += finalDmg;
  target.stats.damageTaken += finalDmg;

  // 🌟 张星彩【甚得人心】受创反弹与全体抵御
  if (finalDmg > 0 && damageType === 'blade' && target.buffs?.shenDeRenXin && target.currentSoldiers > 0) {
    const reflectDmg = Math.round(finalDmg * 0.30);
    if (reflectDmg > 0 && actor.currentSoldiers > 0) {
      actor.currentSoldiers = Math.max(0, actor.currentSoldiers - reflectDmg);
      actor.stats.damageTaken += reflectDmg;
      target.stats.damageDealt += reflectDmg; // 归集反弹伤害给张星彩
      log(round, `🛡️【${target.label}】甚得人心重甲反弹！反震【${actor.label}】造成 ${reflectDmg} 点兵刃伤害！(余兵:${actor.currentSoldiers})`, 'action', { actor: target, target: actor });
    }
    if (Math.random() < 0.35) {
      const teamMates = (target.buffs?.myTeam || [target]).filter(h => h.currentSoldiers > 0);
      teamMates.forEach(m => {
        grantShield(round, m, 1, 2, log, '甚得人心');
      });
    }
  }

  // 🌟 步练师【安抚军心】受创急救 (受到伤害有50%几率回复35%伤害量)
  if (finalDmg > 0 && target.currentSoldiers > 0 && target.buffs?.anFuEmergency > 0 && Math.random() < 0.50) {
    if (!target.buffs.cannotHeal) {
      const emergencyHeal = Math.max(1, Math.round(finalDmg * 0.35));
      target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + emergencyHeal);
      recordHeroHeal(target, emergencyHeal, 'tac_an_fu_jun_xin');
      log(round, `🕊️ 安抚军心紧急回春！【${target.label}】受创触发急救，恢复 ${emergencyHeal} 兵力！(余兵:${target.currentSoldiers})`, 'heal', { actor: target });
    }
  }

  // 🌟 甄姬【魅惑】受普攻反制
  if (finalDmg > 0 && (damageDesc === '普通攻击' || options?.isNormalAttack) && target.buffs?.meiHuo && target.currentSoldiers > 0 && actor.currentSoldiers > 0 && Math.random() < 0.45 && !actor.buffs.insight) {
    const statuses = ['confused', 'silenced', 'disarmed', 'weakness'];
    const chosen = statuses[Math.floor(Math.random() * statuses.length)];
    actor.buffs[chosen] = Math.max(actor.buffs[chosen] || 0, 1);
    const statusNames = { confused: '【混乱】', silenced: '【计穷】', disarmed: '【缴械】', weakness: '【虚弱】' };
    log(round, `🌸【${target.label}】魅惑颠倒众生！令攻击者【${actor.label}】陷入${statusNames[chosen]}1回合！`, 'debuff', { actor: target, target: actor });
  }

  // 🌟 荀彧【机鉴先识】警戒谋略反噬 (受创时40%几率反噬)
  if (finalDmg > 0 && target.buffs?.jingJianActor && target.buffs.jingJianActor.currentSoldiers > 0 && Math.random() < 0.40) {
    const xunYu = target.buffs.jingJianActor;
    const counterDmg = Math.round((xunYu.intel * 1.5 - actor.intel * 0.5) * Math.sqrt(xunYu.currentSoldiers / 100) * 1.05);
    const hitCounter = applyDamageToTarget(round, xunYu, actor, counterDmg, log, '机鉴反噬', { damageType: 'tactical', tacticId: 'tac_ji_jian_xian_shi' });
    if (hitCounter.damage > 0) {
      log(round, `📜 机鉴先识神谋反噬！【${xunYu.label}】引动王佐之谋，反噬【${actor.label}】造成 ${hitCounter.damage} 点谋略伤害！(余兵:${actor.currentSoldiers})`, 'action', { actor: xunYu, target: actor });
    }
  }

  // 🌟 徐晃【长驱直入】每次造成兵刃伤害叠加增伤 (每次+15%，最多5层)
  if (finalDmg > 0 && damageType === 'blade' && actor.currentSoldiers > 0 && actor.tactics.some(t => t.id === 'tac_chang_qu_zhi_ru')) {
    if ((actor.buffs.changQuStacks || 0) < 5) {
      actor.buffs.changQuStacks = (actor.buffs.changQuStacks || 0) + 1;
      log(round, `🪓【${actor.label}】长驱直入势如破竹！兵刃伤害提升 15%(当前层数:${actor.buffs.changQuStacks}/5层·累计增伤+${actor.buffs.changQuStacks * 15}%)！`, 'buff', { actor });
    }
  }

  // 🌟 文武双全 (造成兵刃提武力，造成谋略提智力，各最多5层各150点)
  if (finalDmg > 0 && actor.currentSoldiers > 0 && actor.tactics.some(t => t.id === 'tac_wen_wu_shuang_quan')) {
    if (damageType === 'blade' && (actor.buffs.wenWuForceStacks || 0) < 5) {
      actor.buffs.wenWuForceStacks = (actor.buffs.wenWuForceStacks || 0) + 1;
      actor.force += 30;
      log(round, `⚔️ 文武双全武略精研！【${actor.label}】造成兵刃伤害，武力暴涨 30 点(当前武力:${actor.force}，层数:${actor.buffs.wenWuForceStacks}/5)！`, 'buff', { actor });
    } else if (damageType === 'tactical' && (actor.buffs.wenWuIntelStacks || 0) < 5) {
      actor.buffs.wenWuIntelStacks = (actor.buffs.wenWuIntelStacks || 0) + 1;
      actor.intel += 30;
      log(round, `📜 文武双全韬略通玄！【${actor.label}】造成谋略伤害，智力暴涨 30 点(当前智力:${actor.intel}，层数:${actor.buffs.wenWuIntelStacks}/5)！`, 'buff', { actor });
    }
  }

  // 🌟 孟获【南蛮渠魁】受击几率递增 (+8%)
  if (finalDmg > 0 && target.currentSoldiers > 0 && target.tactics.some(t => t.id === 'tac_nan_man_qu_kui')) {
    target.buffs.nanManBonusRate = (target.buffs.nanManBonusRate || 0) + 8;
    log(round, `👑【${target.label}】南蛮战意激荡！受到重创不屈，【南蛮渠魁】发动几率累计提升 8%(当前蓄力+${target.buffs.nanManBonusRate}%)！`, 'buff', { actor: target });
  }

  // 🌟 严颜【不老长枪】受创反击 (受到伤害35%几率使敌军群体2人陷入计穷1回合，并使我军主将获得洞察2回合)
  if (finalDmg > 0 && target.currentSoldiers > 0 && target.tactics.some(t => t.id === 'tac_bu_lao_chang_qiang') && Math.random() < 0.35) {
    const attackerTeam = (actor.buffs?.myTeam || [actor]);
    const enemies = attackerTeam.filter(h => h && h.currentSoldiers > 0 && !h.buffs.insight);
    const target2 = getRandomElements(enemies, 2);
    target2.forEach(e => {
      e.buffs.silenced = 1;
      log(round, `🛡️ 不老长枪断头之勇！【${target.label}】受创横枪反制，敌将【${e.label}】陷入【计穷】1回合！`, 'debuff', { actor: target, target: e });
    });
    // 自身队伍主将获得洞察
    const defTeamLeader = (target.buffs?.myTeam || [target]).find(h => h.isLeader) || (target.isLeader ? target : null);
    if (defTeamLeader && defTeamLeader.currentSoldiers > 0) {
      defTeamLeader.buffs.insight = true;
      log(round, `✨ 不老长枪老将护阵！主将【${defTeamLeader.label}】获老将庇护，进入【洞察】状态免受一切控制！`, 'buff', { actor: target, target: defTeamLeader });
    }
  }

  // 🌟 大乔【国色天香】受创治愈 (受到伤害50%几率治愈一名友军并提供30%减伤护盾)
  if (finalDmg > 0 && target.currentSoldiers > 0 && target.tactics.some(t => t.id === 'tac_guo_se_tian_xiang') && Math.random() < 0.50) {
    const healVal = Math.round(target.intel * 1.08 * Math.sqrt(target.currentSoldiers / 100));
    target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + healVal);
    target.buffs.damageReceivedMod = Math.max(0.1, (target.buffs.damageReceivedMod || 1.0) - 0.30);
    recordHeroHeal(target, healVal, 'tac_guo_se_tian_xiang');
    log(round, `🌸 国色天香倾国回春！【${target.label}】受创激发天香，为自身恢复 ${healVal} 兵力并赋予下一次 30% 减伤！(余兵:${target.currentSoldiers})`, 'heal', { actor: target });
  }

  // 🌟 陷阵营受创急救 (前3回合受到伤害有35%几率获得急救恢复兵力)
  if (round <= 3 && finalDmg > 0 && target.buffs?.xianZhenEmergency && target.currentSoldiers > 0 && Math.random() < 0.35) {
    const heal = Math.round(target.command * 0.90 * Math.sqrt(target.currentSoldiers / 100));
    target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
    recordHeroHeal(target, heal, 'tac_xian_zhen_ying');
    log(round, `🛡️ 陷阵营军阵急救！【${target.label}】铠甲卸力止血，紧急恢复 ${heal} 兵力！(余兵:${target.currentSoldiers})`, 'heal', { actor: target });
  }

  // 🌟 草船借箭受创急救 (处于草船急救状态下，70%几率按该次伤害量的35%急救)
  if (finalDmg > 0 && target.buffs?.caoChuanEmergency > 0 && target.currentSoldiers > 0 && Math.random() < 0.70) {
    const heal = Math.round(finalDmg * 0.35);
    target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
    recordHeroHeal(target, heal, 'tac_cao_chuan_jie_jian');
    log(round, `🌿 草船借箭急救应验！【${target.label}】借箭化生，紧急自愈恢复 ${heal} 兵力(本次伤害35%)！(余兵:${target.currentSoldiers})`, 'heal', { actor: target });
  }

  // 倒戈吸血结算 (兵刃吸血：董卓酒池肉林等)
  if (actor.buffs?.vampireForce && damageType === 'blade' && finalDmg > 0 && actor.currentSoldiers > 0) {
    const vHeal = Math.min(actor.maxSoldiers - actor.currentSoldiers, Math.round(finalDmg * actor.buffs.vampireForce));
    if (vHeal > 0) {
      actor.currentSoldiers += vHeal;
      recordHeroHeal(actor, vHeal, 'vampire');
      log(round, `🩸【${actor.label}】倒戈嗜血！兵刃斩杀同时吸取气血，恢复 ${vHeal} 兵力！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
    }
  }

  // 攻心吸血结算 (谋略吸血：司马懿鹰视狼顾等)
  if (actor.buffs?.vampireTactical && damageType === 'tactical' && finalDmg > 0 && actor.currentSoldiers > 0) {
    const vHeal = Math.min(actor.maxSoldiers - actor.currentSoldiers, Math.round(finalDmg * actor.buffs.vampireTactical));
    if (vHeal > 0) {
      actor.currentSoldiers += vHeal;
      recordHeroHeal(actor, vHeal, 'vampire');
      log(round, `🩸【${actor.label}】攻心夺魄！谋略重创同时汲取灵气，恢复 ${vHeal} 兵力！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
    }
  }

  // 许褚【虎痴】斩杀破阵觉醒
  if (target.currentSoldiers <= 0 && actor.buffs?.huChiTarget === target && actor.tactics.some(t => t.id === 'tac_hu_chi')) {
    if (!actor.buffs.trueStrike) {
      actor.buffs.trueStrike = true;
      log(round, `🐯【${actor.label}】虎痴神威！成功击溃锁定目标【${target.label}】，觉醒【破阵】(无视敌军统率与智力)！`, 'buff', { actor, target });
    }
  }

  // 战法明细统计：精准归集杀敌伤害至具体战法或普通攻击
  let tId = (options && typeof options === 'object') ? options.tacticId : null;
  if (!tId) {
    if (damageDesc === '普通攻击' || damageDesc === '普攻' || damageDesc === '反击') {
      tId = 'normal_attack';
    } else if (damageDesc) {
      const found = actor.tactics.find(t => t.name === damageDesc || damageDesc.includes(t.name) || t.name.includes(damageDesc));
      if (found) tId = found.id;
    }
  }
  if (tId && actor.tacticStats && actor.tacticStats[tId]) {
    actor.tacticStats[tId].damage += finalDmg;
  } else if (actor.tacticStats && actor.tacticStats['normal_attack'] && (!damageDesc || damageDesc === '普通攻击')) {
    actor.tacticStats['normal_attack'].damage += finalDmg;
  }

  const result = {
    damage: finalDmg,
    wasHit: true,
    shielded: false,
    modTags,
    effectiveDealtMod,
    effectiveReceivedMod,
    damageType,
    isCrit,
    critType,
    tengJiaBurnIgnited,
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

  // 🌟 士别三日：前3回合闭门研读，无法进行普通攻击
  const shiBieTac = actor.tactics.find(t => t.id === 'tac_shi_bie_san_ri');
  if (shiBieTac && round <= 3) {
    log(round, `📖【${actor.label}】士别三日闭门潜心研读兵法，前3回合无法进行普通攻击！`, 'status', { actor });
    return;
  }

  // 目标选取：若处于【混乱】状态，有 50% 概率敌我不分将攻击转向友军存活单位！
  let target;
  const livingTeammates = team.filter(h => h.currentSoldiers > 0 && h !== actor);
  if (actor.buffs.confused > 0 && livingTeammates.length > 0 && Math.random() < 0.5) {
    target = livingTeammates[Math.floor(Math.random() * livingTeammates.length)];
    log(round, `🌀【${actor.label}】心神迷乱陷入【混乱】，敌我不分，反手攻向友军【${target.label}】！`, 'status', { actor, target });
  } else {
    // 🌟 许褚【虎痴】锁定单体判定
    const huChiTac = actor.tactics.find(t => t.id === 'tac_hu_chi');
    if (huChiTac) {
      if (!actor.buffs.huChiTarget || actor.buffs.huChiTarget.currentSoldiers <= 0) {
        const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
        if (freshLiving.length > 0) {
          actor.buffs.huChiTarget = freshLiving[Math.floor(Math.random() * freshLiving.length)];
          log(round, `🐯【${actor.label}】触发【虎痴】！虎视眈眈死死锁定敌军【${actor.buffs.huChiTarget.label}】，伤害提升 33%！`, 'buff', { actor, target: actor.buffs.huChiTarget });
        }
      }
      if (actor.buffs.huChiTarget && actor.buffs.huChiTarget.currentSoldiers > 0) {
        target = actor.buffs.huChiTarget;
      }
    }

    if (!target) {
      // 🌟 马云禄【鸱目虎吻】：第 5 回合起必定锁定敌军兵力最低单体
      const chiMuTac = actor.tactics.find(t => t.id === 'tac_chi_mu_hu_wen');
      if (chiMuTac && round >= 5) {
        const sorted = [...livingOpps].sort((a, b) => a.currentSoldiers - b.currentSoldiers);
        target = sorted[0];
        log(round, `🦅 鸱目虎吻锁定残血！【${actor.label}】神箭死死锁定残血敌将【${target.label}】(余兵:${target.currentSoldiers})！`, 'buff', { actor, target });
      } else {
        // 正常选取敌军目标：若有锁主将概率则打主将，否则随机打击
        target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
        const hasLockLeader = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi');
        if (hasLockLeader && Math.random() < 0.68) {
          const oppLeader = oppTeam.find(h => h.isLeader && h.currentSoldiers > 0);
          if (oppLeader) target = oppLeader;
        }
      }
    }
  }

  // 🌟 程昱/程普传承【守而必固】：主将受嘲讽强制普攻嘲讽者
  if (actor.buffs.tauntTarget && actor.buffs.tauntTarget.currentSoldiers > 0 && round <= (actor.buffs.tauntExpireRound || 4)) {
    target = actor.buffs.tauntTarget;
    log(round, `🛡️【${actor.label}】受到【守而必固】嘲讽牵制，身不由己强制攻击【${target.label}】！`, 'status', { actor, target });
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
    log(round, `🛡️【${rescuer.label}】挺身援护！飞身架盾替友军【${target.label}】援护拦截普攻！`, 'skill', { actor: rescuer, target });
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
    const hitGY = applyDamageToTarget(round, actor, target, rawGongYao, log, '弓腰姬', { damageType: 'blade' });
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

  // 普攻发动次数统计
  if (actor.tacticStats && actor.tacticStats['normal_attack']) {
    actor.tacticStats['normal_attack'].casts++;
  }

  // 伤害计算 (基础兵刃普攻)
  const armAdv = actor.isPlayer ? pArmAdv : eArmAdv;
  const baseDmg = Math.max(20, (actor.force * 1.5 - target.command * 0.75));
  const soldierRatio = Math.sqrt(actor.currentSoldiers / 100);
  let finalDmg = Math.round(baseDmg * soldierRatio * armAdv);

  // 🌟 马云禄【鸱目虎吻】：伤害随目标已损兵力百分比提高(最高提高100%)
  if (actor.tactics.some(t => t.id === 'tac_chi_mu_hu_wen') && target.maxSoldiers > 0) {
    const lostRatio = Math.min(1.0, Math.max(0, 1 - (target.currentSoldiers / target.maxSoldiers)));
    finalDmg = Math.round(finalDmg * (1 + lostRatio));
  }

  // 虚弱判断
  if (actor.buffs.weakness > 0) finalDmg = 0;

  // 抵御、规避与兵刃伤害结算 (由 applyDamageToTarget 统一结算兵刃乘区与会心暴击)
  const hitResult = applyDamageToTarget(round, actor, target, finalDmg, log, '普通攻击', { damageType: 'blade', tacticId: 'normal_attack' });
  const actualDmg = hitResult.damage;
  if (actualDmg > 0) {
    const critText = hitResult.isCrit ? '💥 触发【会心暴击】！' : '';
    log(round, `🗡️【${actor.label}】挥戈突刺，${critText}对【${target.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });

    // 马超 槊血复骑：普攻群体溅射
    if (actor.buffs.hasSplash) {
      const splashDmg = Math.round(actualDmg * 0.54);
      oppTeam.filter(h => h.currentSoldiers > 0 && h !== target).forEach(other => {
        const splashResult = applyDamageToTarget(round, actor, other, splashDmg, log, '槊血溅射', { damageType: 'blade', tacticId: 'tac_shuo_xue_fu_qi' });
        if (splashResult.damage > 0) {
          log(round, `🐎 槊血溅射！狂暴枪芒波及【${other.label}】造成 ${splashResult.damage} 点兵刃溅射伤害！(余兵:${other.currentSoldiers})`, 'action', { actor, target: other });
        }
      });
    }
  }

  // 受到伤害后的急救判定 (青囊相助：战斗前4回合，只要受创方队伍中有存活的华佗，全队皆有50%几率急救治愈)
  if (round <= 4 && actualDmg > 0 && target.currentSoldiers > 0) {
    const defenderTeam = actor.isPlayer ? oppTeam : team;
    const qingNangDoc = defenderTeam.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_qing_nang_xiang_zhu'));
    if (qingNangDoc && Math.random() < 0.5) {
      const heal = Math.round(qingNangDoc.intel * 1.2);
      target.currentSoldiers = Math.min(target.maxSoldiers, target.currentSoldiers + heal);
      recordHeroHeal(qingNangDoc, heal, 'tac_qing_nang_xiang_zhu');
      log(round, `🧪【${qingNangDoc.label}】圣手施针触发【青囊急救】，紧急治愈【${target.label}】恢复 ${heal} 兵力！(余兵:${target.currentSoldiers})`, 'heal', { actor: qingNangDoc, target });
    }
  }

  // 反击与受击判定 (夏侯惇刚烈不屈、绝地反击受创蓄力、梦中弑臣反击、典韦古之恶来反击)
  if (hitResult.wasHit && target.currentSoldiers > 0) {
    // 绝地反击：每次受到兵刃伤害提高武力(最多叠加10次)
    const jueDiTac = target.tactics.find(t => t.id === 'tac_jue_di_fan_ji');
    if (jueDiTac) {
      target.buffs.jueDiStacks = target.buffs.jueDiStacks || 0;
      if (target.buffs.jueDiStacks < 10) {
        target.buffs.jueDiStacks++;
        const stackBuff = jueDiTac.statBuff || 6;
        target.force += stackBuff;
        log(round, `🛡️【${target.label}】触发【绝地反击】！蓄势反扑，武力提升 ${stackBuff} 点！(当前武力:${target.force}，蓄力:${target.buffs.jueDiStacks}/10层)`, 'buff', { actor: target });
      }
    }

    // 梦中弑臣：前2回合受到普攻反击
    const mengZhong = target.tactics.find(t => t.id === 'tac_meng_zhong_shi_chen');
    if (mengZhong && round <= 2 && target.currentSoldiers > 0) {
      if (target.tacticStats && target.tacticStats[mengZhong.id]) target.tacticStats[mengZhong.id].casts++;
      const retRate = mengZhong.damageRate || 1.05;
      const retDmg = Math.round(target.force * retRate * Math.sqrt(target.currentSoldiers / 100));
      const retResult = applyDamageToTarget(round, target, actor, retDmg, log, '梦中反击', { damageType: 'blade', tacticId: mengZhong.id });
      if (retResult.damage > 0) {
        log(round, `🗡️【${target.label}】梦中弑臣！暴怒反戈一击，对【${actor.label}】造成 ${retResult.damage} 点兵刃反击伤害！(余兵:${actor.currentSoldiers})`, 'skill', { actor: target, target: actor, isSkillCast: true });
      }
    }

    // 🌟 典韦 古之恶来：受到普通攻击反击 130%
    const guZhiTac = target.tactics.find(t => t.id === 'tac_gu_zhi_e_lai');
    if (guZhiTac && target.currentSoldiers > 0) {
      if (target.tacticStats && target.tacticStats[guZhiTac.id]) target.tacticStats[guZhiTac.id].casts++;
      const retRate = guZhiTac.damageRate || 1.30;
      const retDmg = Math.round(target.force * 1.5 * Math.sqrt(target.currentSoldiers / 100) * retRate);
      const retResult = applyDamageToTarget(round, target, actor, retDmg, log, '古之恶来', { damageType: 'blade', tacticId: guZhiTac.id });
      if (retResult.damage > 0) {
        log(round, `🪓【${target.label}】古之恶来金戟怒扫！狂暴反戈一击轰向【${actor.label}】造成 ${retResult.damage} 点兵刃伤害！(余兵:${actor.currentSoldiers})`, 'skill', { actor: target, target: actor, isSkillCast: true });
      }
    }

    const retaliateTactic = target.tactics.find(t => t.id === 'tac_gang_lie_bu_qu');
    if (retaliateTactic && Math.random() * 100 < retaliateTactic.retaliateRate) {
      if (target.tacticStats && target.tacticStats[retaliateTactic.id]) target.tacticStats[retaliateTactic.id].casts++;
      const retDmg = Math.round(target.force * 1.1 * Math.sqrt(target.currentSoldiers / 100));
      const retResult = applyDamageToTarget(round, target, actor, retDmg, log, '刚烈反击', { damageType: 'blade', tacticId: retaliateTactic.id });
      if (retResult.damage > 0) {
        log(round, `⚡【${target.label}】刚烈狂怒！拔矢啖睛触发反击，轰击【${actor.label}】造成 ${retResult.damage} 点兵刃反击伤害！(余兵:${actor.currentSoldiers})`, 'skill', { actor: target, target: actor, isSkillCast: true });
      }
    }

    // 程普 勇烈持重：受到伤害时有35%几率净化自身所有负面并随机震慑敌军1回合
    const yongLie = target.tactics.find(t => t.id === 'tac_yong_lie_chi_zhong');
    if (yongLie && Math.random() < 0.35) {
      if (target.tacticStats && target.tacticStats[yongLie.id]) target.tacticStats[yongLie.id].casts++;
      target.buffs.silenced = 0;
      target.buffs.disarmed = 0;
      target.buffs.burn = 0;
      target.buffs.confused = 0;
      const freshEnemies = team.filter(h => h.currentSoldiers > 0 && !h.buffs.insight);
      if (freshEnemies.length > 0) {
        const stunTarget = freshEnemies[Math.floor(Math.random() * freshEnemies.length)];
        stunTarget.buffs.stunned = 1;
        log(round, `🛡️【${target.label}】触发【勇烈持重】！净化自身所有负面状态，威武震慑【${stunTarget.label}】使其瘫痪 1 回合！`, 'skill', { actor: target, target: stunTarget, isSkillCast: true });
      } else {
        log(round, `🛡️【${target.label}】触发【勇烈持重】！净化自身所有负面状态！`, 'skill', { actor: target, isSkillCast: true });
      }
    }
  }

  // 大戟士 (张郃枪兵进阶)：普通攻击命中后，全体友军有35%几率协同突刺单体
  if (hitResult.wasHit && team.some(h => h.tactics.some(t => t.id === 'tac_da_ji_shi')) && target.currentSoldiers > 0) {
    if (Math.random() < 0.35) {
      const dajiDmg = Math.round((actor.force * 1.3 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.22);
      const hitDJ = applyDamageToTarget(round, actor, target, dajiDmg, log, '大戟士', { damageType: 'blade', tacticId: 'tac_da_ji_shi' });
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
      recordHeroHeal(actor, heal, 'tac_huo_shen_ning_shang');
      log(round, `🔥 火神宁墒圣火庇佑！【${actor.label}】普攻毕，为【${mate.label}】回复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }

  // 🌟 白毦兵 (陈到自带·枪兵进阶)：普通攻击后有40%几率对目标追加一次谋略法伤轰击
  if (hitResult.wasHit && team.some(h => h.buffs.baiErBing) && target.currentSoldiers > 0) {
    if (Math.random() < 0.40) {
      const baiErDmg = Math.round((actor.intel * 1.5 - target.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.10);
      const hitBE = applyDamageToTarget(round, actor, target, baiErDmg, log, '白毦雷鸣', { damageType: 'tactical', tacticId: 'tac_bai_er_bing' });
      if (hitBE.damage > 0) {
        log(round, `🔱 白毦神枪追击！狂暴法伤雷霆贯穿【${target.label}】，追加造成 ${hitBE.damage} 点谋略伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }

  // 🌟 锦帆军 (甘宁专属·弓兵进阶)：普通攻击命中40%几率溃逃；若已溃逃则造成伤害并回血
  if (hitResult.wasHit && team.some(h => h.buffs.jinFanJun) && target.currentSoldiers > 0) {
    if (target.buffs.kuiTao && target.buffs.kuiTao > 0) {
      // 目标已溃逃：造成兵刃斩杀并恢复自身兵力
      const extraDmg = Math.round((actor.force * 1.4 - target.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.10);
      const hitJF = applyDamageToTarget(round, actor, target, extraDmg, log, '锦帆斩杀', { damageType: 'blade', tacticId: 'tac_jin_fan_jun' });
      const heal = Math.round(actor.force * 0.80 * Math.sqrt(actor.currentSoldiers / 100));
      actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
      recordHeroHeal(actor, heal, 'tac_jin_fan_jun');
      if (hitJF.damage > 0) {
        log(round, `🏹 锦帆军趁隙破敌！目标处于溃逃，【${actor.label}】造成 ${hitJF.damage} 点斩杀伤害并破血自愈 ${heal} 兵力！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    } else if (Math.random() < 0.40) {
      target.buffs.kuiTao = 2;
      target.buffs.kuiTaoDmg = Math.round(actor.force * 0.64);
      log(round, `🏹 锦帆军箭镞撕裂！【${target.label}】身中剧毒利刃陷入【溃逃】状态持续2回合！`, 'debuff', { actor, target });
    }
  }

  // 突击战法触发判定 (仅在普攻后判定，虎豹骑加持突击几率+10%)
  if (actor.currentSoldiers > 0) {
    actor.tactics.filter(t => t.type === 'assault').forEach(tac => {
      let bonusRate = actor.tactics.some(t => t.id === 'tac_xian_zhen_tu_xi') ? 15 : 0;
      if (actor.buffs.huBaoActive) {
        bonusRate += (actor.buffs.huBaoAssaultBonus || 10);
      }
      if (Math.random() * 100 < (tac.rate + bonusRate)) {
        actor.stats.tacticsCast++;
        if (actor.tacticStats && actor.tacticStats[tac.id]) {
          actor.tacticStats[tac.id].casts++;
        }
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
  log(round, `⚡【${actor.label}】普攻破阵，连携发动突击战法【${lvlTag}${tactic.name}】！`, 'skill', { actor, tactic, isSkillCast: true });

  if (tactic.id === 'tac_yi_qi_dang_qian') {
    const baseRate = tactic.damageRate || 1.08;
    const rate = actor.isLeader ? (baseRate * 1.33) : baseRate;
    oppTeam.filter(h => h.currentSoldiers > 0).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.4 - opp.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1));
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '一骑当千', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🌪️ 一骑当千横扫八荒！对【${opp.label}】造成 ${actualDmg} 点巨额兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  } else if (tactic.id === 'tac_shou_qi_dao_luo') {
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.84;
      const rawDmg = Math.round((actor.force * 1.8 - primaryTarget.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '手起刀落', { damageType: 'blade' });
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
      if (!primaryTarget.buffs.statRestorations) primaryTarget.buffs.statRestorations = [];
      primaryTarget.buffs.statRestorations.push({ roundExpire: round + 2, command: debuffVal, intel: debuffVal, name: '折冲御侮' });
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
    const bonus = tactic.damageBonus || 0.80;
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * (1 + bonus);
    actor.buffs.yongZheBonus = bonus; // 标记勇者增伤，消费后还原
    log(round, `⚡ 勇者得前！【${actor.label}】下次输出造成的伤害暴增 ${(bonus * 100).toFixed(0)}%！`, 'buff', { actor });
  } else if (tactic.id === 'tac_bao_li_wu_ren') {
    // 董卓正统传承：暴戾无仁
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.96;
      const rawDmg = Math.round((actor.force * 1.9 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '暴戾无仁', { damageType: 'blade' });
      if (actualDmg > 0) {
        primaryTarget.buffs.confused = 1;
        log(round, `🩸 暴戾无仁狂残劈击！对【${primaryTarget.label}】造成 ${actualDmg} 点毁灭兵刃伤害并使其陷入【混乱】！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_jiang_dong_xiao_ba_wang') {
    // 孙策自带：江东小霸王
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.92;
      const rawDmg = Math.round((actor.force * 1.7 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '江东小霸王', { damageType: 'blade' });
      const heal = Math.round(actor.force * 1.16 * Math.sqrt(actor.currentSoldiers / 100));
      actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tactic.id);
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
      if (!primaryTarget.buffs.statRestorations) primaryTarget.buffs.statRestorations = [];
      primaryTarget.buffs.statRestorations.push({ roundExpire: round + 2, command: debuffVal, intel: 0, name: '弯弓饮羽' });
      if (!primaryTarget.buffs.insight) {
        primaryTarget.buffs.silenced = 1;
      }
      log(round, `🏹 弯弓饮羽破防穿心！令【${primaryTarget.label}】统率暴降 ${debuffVal} 点(持续2回合)，并陷入【计穷】无法施展主动战法！`, 'debuff', { actor, target: primaryTarget });
    }
  } else if (tactic.id === 'tac_jiang_xing_qi_ji') {
    // 夏侯渊 将行其疾：普通攻击后发动180%兵刃攻击，若命中主将则施加计穷2回合
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.80;
      const rawDmg = Math.round((actor.force * 1.7 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '将行其疾', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🏹⚡ 将行其疾疾风瞬杀！【${actor.label}】神箭贯穿【${primaryTarget.label}】造成 ${actualDmg} 点致命兵刃伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
      if (primaryTarget.isLeader && !primaryTarget.buffs.insight) {
        primaryTarget.buffs.silenced = 2;
        log(round, `🎯 将行其疾精准爆头！敌方主将【${primaryTarget.label}】咽喉中箭，陷入【计穷】2回合无法释放任何主动战法！`, 'debuff', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_dang_feng_cui_jue') {
    // 🌟 当锋摧决 (三战第一神技·颜良传承：谋略攻击182% + 施加【伪报】1回合)
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.82;
      const rawDmg = Math.round((actor.intel * 1.7 - primaryTarget.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '当锋摧决', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `🗡️⚡ 当锋摧决灵光裂空！对【${primaryTarget.label}】造成 ${actualDmg} 点谋略伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
      if (!primaryTarget.buffs.insight) {
        // 沮授【监统震军】延长判定
        const extendRound = (myTeam.hasJuShou && Math.random() < 0.65) ? 2 : 1;
        primaryTarget.buffs.weiBao = extendRound;
        const extText = extendRound > 1 ? `(受【沮授·监统震军】延长至${extendRound}回合)` : '1回合';
        log(round, `🚫【伪报降临】！【${primaryTarget.label}】遭当锋封禁，所有指挥战法与被动战法全部失活瘫痪 ${extText}！`, 'debuff', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_bai_qi_jie_ying') {
    // 🌟 百骑劫营 (甘宁专属传承：兵刃攻击152%，自身为主将时50%几率斩首敌主将118%)
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.52;
      const rawDmg = Math.round((actor.force * 1.6 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '百骑劫营', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🐎 百骑劫营呼啸夜袭！对【${primaryTarget.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
      if (actor.isLeader && Math.random() < 0.50) {
        const enemyLeader = oppTeam.find(h => h.isLeader && h.currentSoldiers > 0);
        if (enemyLeader) {
          const snipeRaw = Math.round((actor.force * 1.5 - enemyLeader.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * 1.18 * armAdv);
          const snipeHit = applyDamageToTarget(round, actor, enemyLeader, snipeRaw, log, '百骑斩首', { damageType: 'blade' });
          if (snipeHit.damage > 0) {
            log(round, `🎯 百骑斩首定乾坤！【${actor.label}】飞骑直捣黄龙，暴击敌方主将【${enemyLeader.label}】追加造成 ${snipeHit.damage} 点兵刃斩首重创！(余兵:${enemyLeader.currentSoldiers})`, 'action', { actor, target: enemyLeader });
          }
        }
      }
    }
  } else if (tactic.id === 'tac_gui_shen_ting_wei') {
    // 🌟 鬼神霆威 (吕布专属传承：狂暴兵刃斩击204%，目标兵力低于50%时爆发至306%)
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const isExec = (primaryTarget.currentSoldiers / primaryTarget.maxSoldiers) < 0.50;
      const baseRate = tactic.damageRate || 2.04;
      const rate = isExec ? (baseRate * 1.50) : baseRate;
      const rawDmg = Math.round((actor.force * 1.8 - primaryTarget.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '鬼神霆威', { damageType: 'blade' });
      const execText = isExec ? '【🩸血线斩杀暴击·伤害率306%】' : '';
      if (actualDmg > 0) {
        log(round, `⚡👹 鬼神霆威魔神降世！${execText}对【${primaryTarget.label}】造成 ${actualDmg} 点狂暴兵刃重创！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
    }
  } else if (tactic.id === 'tac_ke_di_zhi_sheng') {
    // 🌟 克敌制胜 (程普传承：谋略攻击180%，若目标处于溃逃/水攻/中毒有70%几率虚弱1回合)
    if (primaryTarget && primaryTarget.currentSoldiers > 0) {
      const rate = tactic.damageRate || 1.80;
      const rawDmg = Math.round((actor.intel * 1.6 - primaryTarget.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv * (actor.isPlayer ? moraleMod : 1.0));
      const actualDmg = applyDamageToTarget(round, actor, primaryTarget, rawDmg, log, '克敌制胜', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `🏹 克敌制胜神箭破军！对【${primaryTarget.label}】造成 ${actualDmg} 点谋略伤害！(余兵:${primaryTarget.currentSoldiers})`, 'action', { actor, target: primaryTarget });
      }
      const hasDebuff = (primaryTarget.buffs.kuiTao > 0) || (primaryTarget.buffs.water > 0) || (primaryTarget.buffs.burn > 0);
      if (hasDebuff && !primaryTarget.buffs.insight && Math.random() < 0.70) {
        primaryTarget.buffs.weakness = 1;
        log(round, `🕊️ 克敌制胜乘虚而入！目标受异常侵蚀，陷入【虚弱】1回合无法造成任何伤害！`, 'debuff', { actor, target: primaryTarget });
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

  // 🌟 周瑜【神火计】联动辅助函数 (成功发动主动战法后，80%几率对敌全体造成68%谋略伤害并施加灼烧)
  const triggerShenHuoJi = () => {
    if (actor.tactics.some(t => t.id === 'tac_shen_huo_ji') && actor.currentSoldiers > 0) {
      if (Math.random() < 0.80) {
        log(round, `🔥【${actor.label}】神火计触发！借东风引燃赤壁烈火，漫天火海席卷敌阵！`, 'skill', { actor, isSkillCast: true });
        livingOpps.filter(opp => opp.currentSoldiers > 0).forEach(opp => {
          const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 0.68);
          const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '神火计', { damageType: 'tactical', isFire: true, tacticId: 'tac_shen_huo_ji' });
          opp.buffs.burn = 1;
          opp.buffs.burnDmg = Math.round(actor.intel * 0.50);
          opp.buffs.burnSourceActor = actor;
          if (actualDmg > 0) {
            log(round, `🔥 赤壁烈焰焚天！对【${opp.label}】造成 ${actualDmg} 点谋略灼烧伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
          }
        });
      }
    }
  };

  // 🌟 诸葛亮【神机妙算】反制辅助函数 (敌军试图发动主动战法时，35%几率打断失效并反噬150%伤害)
  const checkZhuGeCounter = (tac) => {
    const zhuGe = livingOpps.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_shen_ji_miao_suan') && h.buffs.silenced === 0 && h.buffs.stunned === 0);
    if (zhuGe && Math.random() * 100 < 35) {
      log(round, `⚡【${zhuGe.label}】神机妙算识破天机！羽扇微摇，令【${actor.label}】的战法【${tac.name}】化为乌有，并引发天雷反噬！`, 'skill', { actor: zhuGe, target: actor, isSkillCast: true });
      const counterDmg = Math.round((zhuGe.intel * 1.6 - actor.intel * 0.5) * Math.sqrt(zhuGe.currentSoldiers / 100) * 1.50);
      const actualCounter = applyDamageToTarget(round, zhuGe, actor, counterDmg, log, '神机妙算', { damageType: 'tactical', tacticId: 'tac_shen_ji_miao_suan' });
      if (actualCounter > 0) {
        log(round, `⚡ 神机天雷怒劈！对【${actor.label}】造成 ${actualCounter} 点强力谋略反噬伤害！(余兵:${actor.currentSoldiers})`, 'action', { actor: zhuGe, target: actor });
      }
      return true; // 打断成功
    }
    return false;
  };

  actor.tactics.filter(t => t.type === 'active').forEach(tac => {
    if (actor.currentSoldiers <= 0) return;
    const lvlTag = tac.level ? `Lv.${tac.level} ` : '';
    // 发动率加成 (白眉 +12%，白马义从 +10%，袁术符命自立 +25%，太平道法自带主动 +12%，三势阵主将自带主动 +16%)
    let rateBonus = 0;
    if (actor.tactics.some(t => t.id === 'tac_bai_mei')) rateBonus += 12;
    if (team.some(h => h.tactics.some(t => t.id === 'tac_bai_ma_yi_cong'))) rateBonus += 10;
    if (actor.tactics.some(t => t.id === 'tac_fu_ming_zi_li') && round <= 2) rateBonus += 25;
    if (actor.tactics.some(t => t.id === 'tac_tai_ping_dao_fa') && tac.id === actor.tactics[0]?.id) rateBonus += 12;
    if (actor.isLeader && actor.buffs.sanShiActiveRateBonus && tac.id === actor.tactics[0]?.id && round <= 5) {
      rateBonus += actor.buffs.sanShiActiveRateBonus;
    }
    if (actor.buffs.activeRateBonus > 0) {
      rateBonus += actor.buffs.activeRateBonus;
    }

    // 🌟 诸葛亮传承【舌战群儒】：敌军若有存活者携带，降低发动者10%发动率，并使我军全体下回合主动几率+5%
    const sheZhanEnemy = livingOpps.find(h => h.currentSoldiers > 0 && h.tactics.some(t => t.id === 'tac_she_zhan_qun_ru'));
    if (sheZhanEnemy) {
      rateBonus -= 10;
      livingOpps.forEach(opp => opp.buffs.sheZhanActiveRound = round);
    }
    if (actor.buffs.sheZhanActiveRound === round) {
      rateBonus += 5;
    }

    const finalRate = Math.min(100, Math.max(5, (tac.rate || 35) + rateBonus));

    // 🌟 士争先赴辅助触发函数 (发动自带主动战法前，50%几率对敌全体轰击120%)
    const triggerShiZheng = () => {
      if (tac.id === actor.tactics[0]?.id && actor.tactics.some(t => t.id === 'tac_shi_zheng_xian_fu')) {
        if (Math.random() < 0.50) {
          log(round, `⚔️ 士争先赴锋芒毕露！【${actor.label}】主动战法催动万军先锋，对敌全体发动兵刃轰击！`, 'skill', { actor, isSkillCast: true });
          livingOpps.forEach(opp => {
            const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * 1.20 * armAdv);
            const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '士争先赴', { damageType: 'blade', tacticId: 'tac_shi_zheng_xian_fu' });
            if (actualDmg > 0) {
              log(round, `💥 士争狂击！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
            }
          });
        }
      }
    };

    // 蓄力准备判定 (如威震华夏、所向披靡)
    if (tac.requiresPrep) {
      if (actor.buffs.isPreparingActive === tac.id) {
        actor.buffs.isPreparingActive = null;
        if (checkZhuGeCounter(tac)) return;
        actor.stats.tacticsCast++;
        if (actor.tacticStats && actor.tacticStats[tac.id]) {
          actor.tacticStats[tac.id].casts++;
        }
        triggerShiZheng();
        log(round, `🔥【${actor.label}】蓄力完成！撼世战法【${lvlTag}${tac.name}】磅礴释放！`, 'skill', { actor, tactic: tac, isSkillCast: true });
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
        triggerShenHuoJi();
        return;
      } else {
        if (Math.random() * 100 < finalRate) {
          // 魏延 奇兵间道：有 75% 几率直接跳过准备回合瞬间爆发！
          if (actor.buffs.skipPrepChance && Math.random() < actor.buffs.skipPrepChance) {
            if (checkZhuGeCounter(tac)) return;
            actor.stats.tacticsCast++;
            if (actor.tacticStats && actor.tacticStats[tac.id]) {
              actor.tacticStats[tac.id].casts++;
            }
            triggerShiZheng();
            log(round, `⚡ 奇兵间道神谋瞬发！【${actor.label}】跳过蓄力，绝技【${lvlTag}${tac.name}】刹那间呼啸释放！`, 'skill', { actor, tactic: tac, isSkillCast: true });
            castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
            triggerShenHuoJi();
            return;
          }
          if (checkZhuGeCounter(tac)) return;
          actor.buffs.isPreparingActive = tac.id;
          log(round, `⌛【${actor.label}】沉声立定，开始蓄势准备绝技【${lvlTag}${tac.name}】！(下回合释放)`, 'prep', { actor, tactic: tac });
          return;
        }
      }
    } else {
      if (Math.random() * 100 < finalRate) {
        if (checkZhuGeCounter(tac)) return;
        actor.stats.tacticsCast++;
        if (actor.tacticStats && actor.tacticStats[tac.id]) {
          actor.tacticStats[tac.id].casts++;
        }
        triggerShiZheng();
        log(round, `✨【${actor.label}】大喝一声，发动主动战法【${lvlTag}${tac.name}】！`, 'skill', { actor, tactic: tac, isSkillCast: true });
        castActiveEffect(round, actor, tac, team, livingOpps, log, moraleMod, armAdv);
        triggerShenHuoJi();
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '威震华夏', { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '所向披靡', { damageType: 'blade' });
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
      recordHeroHeal(actor, heal, tac.id);
      log(round, `🩹 刮骨疗毒圣手回春！清除【${wounded.label}】所有负面状态，大幅疗愈 ${heal} 兵力！(余兵:${wounded.currentSoldiers})`, 'heal', { actor, target: wounded });
    }
  }
  // 火烧连营
  else if (tac.id === 'tac_huo_shao_lian_ying') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      target.buffs.burn = 2;
      target.buffs.burnDmg = Math.round(actor.intel * 1.18);
      target.buffs.burnSourceActor = actor;
      log(round, `🌋 夷陵烽火连天！对【${target.label}】点燃火势，附带 2 回合谋略灼烧伤害！`, 'debuff', { actor, target });
    }
  }
  // 天下无双
  else if (tac.id === 'tac_tian_xia_wu_shuang') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      log(round, `🔥 方天画戟怒指！【${actor.label}】强行邀战【${target.label}】进行绝命单挑 3 连击！`, 'skill', { actor, target });
      const rate = tac.damageRate || 1.0;
      for (let s = 1; s <= 3; s++) {
        if (target.currentSoldiers <= 0 || actor.currentSoldiers <= 0) break;
        const rawD = Math.round((actor.force * 1.6 - target.command * 0.7) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv);
        const actualD = applyDamageToTarget(round, actor, target, rawD, log, `天下无双第${s}击`, { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '横扫千军', { damageType: 'blade' });
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
    const boost = tac.statBuff || 50;
    actor.force += boost;
    const splashBonus = tac.damageRate ? (1 + tac.damageRate * 0.5) : 1.35;
    actor.buffs.damageDealtMod = (actor.buffs.damageDealtMod || 1.0) * splashBonus;
    log(round, `🐅 嗔目横矛虎啸！【${actor.label}】武力暴涨 ${boost} 点，开启 2 回合群攻溅射重劈！`, 'buff', { actor });
  }
  // 风助火势 (周瑜官方传承)
  else if (tac.id === 'tac_feng_zhu_huo_shi') {
    const target = livingOpps[Math.floor(Math.random() * livingOpps.length)];
    if (target) {
      let dmgRate = tac.damageRate || 1.54;
      const isBurning = (target.buffs.burn > 0);
      if (isBurning) dmgRate += 1.98; // 灼烧引爆额外追加198%
      const rawDmg = Math.round((actor.intel * 1.6 - target.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * dmgRate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '风助火势', { damageType: 'tactical', isFire: true });
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '熯天炽地', { damageType: 'tactical', isFire: true });
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.72);
      opp.buffs.burnSourceActor = actor;
      if (actualDmg > 0) {
        log(round, `🌋 熯天炽地焦土千里！对【${opp.label}】造成 ${actualDmg} 点谋略伤害并点燃 2 回合大火！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `🌋 熯天炽地焦土千里！对【${opp.label}】点燃 2 回合大火！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 卧薪尝胆 (孙权官方传承)
  else if (tac.id === 'tac_wo_xin_chang_dan') {
    const targets = getRandomElements(livingOpps, 2);
    // 根据自身连击、先攻、洞察等Buff层数提高震慑几率
    let buffCount = 0;
    if (actor.buffs.continuousAttack) buffCount++;
    if (actor.buffs.firstStrike) buffCount++;
    if (actor.buffs.insight) buffCount++;
    const stunChance = 0.25 + buffCount * 0.15; // 最高 70% 震慑

    targets.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.3 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 0.96) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '卧薪尝胆', { damageType: 'blade' });
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
    const targets = getRandomElements(livingOpps, 2);
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '百步穿杨', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🏹 百步穿杨万钧开弓！对【${opp.label}】造成 ${actualDmg} 点极速暴击兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 以逸待劳 (法正自带)
  else if (tac.id === 'tac_yi_yi_dai_lao') {
    const livingMates = team.filter(h => h.currentSoldiers > 0);
    const targets = getRandomElements(livingMates, 2);
    const baseRed = tac.damageReduction || 0.40;
    const redVal = Math.min(0.75, baseRed * (1 + Math.max(0, actor.intel - 80) * 0.003));
    targets.forEach(mate => {
      const heal = Math.round(actor.intel * (tac.healRate || 1.58) * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      mate.buffs.yiYiCharges = 2; // 下2次受创有效
      mate.buffs.yiYiReduction = redVal;
      recordHeroHeal(actor, heal, tac.id);
      log(round, `📜 以逸待劳神机安澜！为【${mate.label}】回复 ${heal} 兵力，并赋予下 2 次受创减伤 ${(redVal * 100).toFixed(1)}% 护盾！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 铁索连环 (庞统自带)
  else if (tac.id === 'tac_tie_suo_lian_huan') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.56) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '铁索连环', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `⛓️ 铁索连环大计！锁困【${opp.label}】造成 ${actualDmg} 点谋略伤害并连带全场！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 十面埋伏 (程昱自带)
  else if (tac.id === 'tac_shi_mian_mai_fu') {
    livingOpps.forEach(opp => {
      const rawDmg = Math.round(actor.intel * 1.65 * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26));
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '十面埋伏', { damageType: 'true' });
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
      const hitResult = applyDamageToTarget(round, actor, target, rawDmg, log, `五雷轰顶第${strike}道`, { damageType: 'tactical' });
      const actualDmg = hitResult.damage;
      if (actualDmg > 0) {
        const critTag = hitResult.isCrit ? '💥【奇谋暴击】' : '';
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
    getRandomElements(livingOpps, 2).forEach(opp => {
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '万箭齐发', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🏹 万箭齐发漫天箭雨！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 沉沙决水 (法正/郭嘉官方传承)
  else if (tac.id === 'tac_chen_sha_jue_shui') {
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.45 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '沉沙决水', { damageType: 'tactical' });
      opp.buffs.tacticalReceivedMod += 0.25;
      if (actualDmg > 0) {
        log(round, `🌊 沉沙决水汪洋水攻！对【${opp.label}】造成 ${actualDmg} 点谋略水攻伤害，且使其受到谋略伤害提升 25%！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `🌊 沉沙决水汪洋水攻令【${opp.label}】受到谋略伤害提升 25%！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 破阵摧坚 (孙策/庞统官方传承)
  else if (tac.id === 'tac_po_zhen_cui_jian') {
    const debuffVal = tac.statDebuff || 80;
    getRandomElements(livingOpps, 2).forEach(opp => {
      opp.command = Math.max(10, opp.command - debuffVal);
      opp.intel = Math.max(10, opp.intel - debuffVal);
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.58) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '破阵摧坚', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `💥 破阵摧坚削弱统智！重砍【${opp.label}】造成 ${actualDmg} 点毁灭兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `💥 破阵摧坚重创【${opp.label}】削弱统率与智力 ${debuffVal} 点！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 杯蛇鬼车 (左慈官方传承)
  else if (tac.id === 'tac_bei_she_gui_che') {
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.5 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.53) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '杯蛇鬼车', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `🐍 杯蛇鬼车幽冥幻法！对【${opp.label}】造成 ${actualDmg} 点奇门谋略伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    const livingMates = team.filter(h => h.currentSoldiers > 0);
    getRandomElements(livingMates, 2).forEach(mate => {
      const healRate = tac.healRate || 1.02;
      const heal = Math.round(actor.intel * healRate * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tac.id);
      log(round, `✨ 杯蛇生息！治愈【${mate.label}】恢复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 黄天泰平 (张角官方传承)
  else if (tac.id === 'tac_huang_tian_tai_ping') {
    getRandomElements(livingOpps, 2).forEach(opp => {
      opp.buffs.silenced = 2;
      log(round, `🕊️ 黄天泰平咒印封禁！【${opp.label}】陷入计穷 2 回合，无法释放主动战法！`, 'debuff', { actor, target: opp });
    });
    actor.buffs.confused = 1;
    log(round, `💫【${actor.label}】施展黄天泰平消耗神识，自身陷入【混乱】1回合！`, 'status', { actor });
  }
  // 一力拒守 (典韦官方传承)
  else if (tac.id === 'tac_yi_li_ju_shou') {
    const healRate = tac.healRate || 2.68;
    const heal = Math.round(actor.force * healRate * Math.sqrt(actor.currentSoldiers / 100));
    actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
    const boost = tac.statBuff || 42;
    actor.command += boost;
    recordHeroHeal(actor, heal, tac.id);
    log(round, `🛡️ 一力拒守铜墙铁壁！【${actor.label}】自愈狂增 ${heal} 兵力，统率提升 ${boost} 点！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
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
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '落凤', { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '纵兵劫掠', { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '避实击虚', { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, `轻勇飞燕第${h}段`, { damageType: 'blade' });
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
      const healRate = tac.healRate || 1.16;
      const heal = Math.round(actor.intel * healRate * Math.sqrt(actor.currentSoldiers / 100));
      mate.currentSoldiers = Math.min(mate.maxSoldiers, mate.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tac.id);
      log(round, `🏰 坐守孤城安抚伤卒！治愈【${mate.label}】恢复 ${heal} 兵力！(余兵:${mate.currentSoldiers})`, 'heal', { actor, target: mate });
    });
  }
  // 料事如神 (群体2人谋略伤害 + 2回合减伤)
  else if (tac.id === 'tac_liao_shi_ru_shen') {
    const targets = getRandomElements(livingOpps, 2);
    const baseRed = tac.damageReduction || 0.16;
    targets.forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.4 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.06) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '料事如神', { damageType: 'tactical' });
      opp.buffs.damageDealtMod = Math.max(0.1, (opp.buffs.damageDealtMod || 1.0) - baseRed);
      if (!opp.buffs.liaoShiDebuffs) opp.buffs.liaoShiDebuffs = [];
      opp.buffs.liaoShiDebuffs.push({ expireRound: round + 2, val: baseRed });
      if (actualDmg > 0) {
        log(round, `📜 料事如神奇策制敌！对【${opp.label}】造成 ${actualDmg} 点谋略伤害，并使其造成的伤害降低 ${(baseRed * 100).toFixed(1)}%(持续2回合)！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      } else {
        log(round, `📜 料事如神奇策制敌令【${opp.label}】造成的伤害降低 ${(baseRed * 100).toFixed(1)}%(持续2回合)！`, 'debuff', { actor, target: opp });
      }
    });
  }
  // 机略纵横 (群体2人灼烧与中毒)
  else if (tac.id === 'tac_ji_lue_zong_heng') {
    getRandomElements(livingOpps, 2).forEach(opp => {
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.58);
      opp.buffs.burnSourceActor = actor;
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
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.45 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.02) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '暴敛四方', { damageType: 'blade' });
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
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.45 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.10) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '天降覆雨', { damageType: 'blade' });
      opp.buffs.burn = 1;
      opp.buffs.burnDmg = Math.round(actor.intel * 0.66);
      opp.buffs.burnSourceActor = actor;
      if (actualDmg > 0) {
        log(round, `🌧️🔥 天降覆雨疾风暴雨！对【${opp.label}】造成 ${actualDmg} 点兵刃伤害并引燃 1 回合烈火！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 挫志怒袭 (群体2人虚弱)
  else if (tac.id === 'tac_cuo_zhi_nu_xi') {
    getRandomElements(livingOpps, 2).forEach(opp => {
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
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '左右开弓', { damageType: 'blade' });
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
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '妖术沙暴', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `🌪️ 妖术黄天迷雾！漫天狂沙席卷【${opp.label}】造成 ${actualDmg} 点谋略沙暴伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 处兹不惑 (徐庶自带：群体2人灼烧、中毒、溃逃连续判定)
  else if (tac.id === 'tac_chu_zi_bu_huo') {
    getRandomElements(livingOpps, 2).forEach(opp => {
      opp.buffs.burn = 2;
      opp.buffs.burnDmg = Math.round(actor.intel * 1.15);
      opp.buffs.burnSourceActor = actor;
      log(round, `📜 处兹不惑机谋神算！【${opp.label}】陷入【灼烧与毒素侵蚀】，每回合受到持续谋略重创！`, 'debuff', { actor, target: opp });
    });
  }
  // 将门虎女 (关银屏自带：群体2人兵刃打击并施加虎嗔与震慑)
  else if (tac.id === 'tac_jiang_men_hu_nv') {
    const rate = tac.damageRate || 1.28;
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '将门虎女', { damageType: 'blade' });
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
    const rate = tac.damageRate || 1.35;
    getRandomElements(livingOpps, 2).forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * rate * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '临战先登', { damageType: 'blade' });
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
        const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '乱武极刑', { damageType: 'tactical' });
        if (actualDmg > 0) {
          log(round, `☠️ 乱武引爆极刑诛灭！对已混乱的【${target.label}】造成 ${actualDmg} 点毁灭谋略伤害！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
        }
      }
    }
  }
  // 🌟 草船借箭 (三战第一解控神技·周瑜传承：清除群体所有负面控制并施加急救)
  else if (tac.id === 'tac_cao_chuan_jie_jian') {
    const targets = getRandomElements(team.filter(h => h.currentSoldiers > 0), 3);
    targets.forEach(mate => {
      mate.buffs.silenced = 0;
      mate.buffs.disarmed = 0;
      mate.buffs.burn = 0;
      mate.buffs.water = 0;
      mate.buffs.confused = 0;
      mate.buffs.stunned = 0;
      mate.buffs.weakness = 0;
      mate.buffs.kuiTao = 0;
      mate.buffs.caoChuanEmergency = 2; // 2回合急救
    });
    const targetNames = targets.map(m => `【${m.label}】`).join('、');
    log(round, `⛵ 草船借箭满载而归！为我军群体${targetNames}净化清除所有负面状态与控制，并施加 2 回合受创【急救】(受击70%几率回复35%伤害量)！`, 'heal', { actor });
  }
  // 🌟 焰逐风飞 (陆抗传承：单体谋略226% + 震慑1回合 + 谋略易伤20%)
  else if (tac.id === 'tac_yan_zhu_feng_fei') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.intel * 1.8 - target.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.26) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '焰逐风飞', { damageType: 'tactical', isFire: true });
      if (actualDmg > 0) {
        log(round, `🔥🌪️ 焰逐风飞火借风势！对【${target.label}】造成 ${actualDmg} 点毁灭谋略打击！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
      if (!target.buffs.insight) {
        const ext = (team.hasJuShou && Math.random() < 0.65) ? 2 : 1;
        target.buffs.stunned = ext;
        target.buffs.tacticalReceivedMod += 0.20;
        log(round, `😵 焰火焚身心胆俱裂！令【${target.label}】陷入【瘫痪震慑】${ext}回合，且受到的谋略伤害提升 20%！`, 'debuff', { actor, target });
      }
    }
  }
  // 🌟 绝其汲道 (魏延传承：群体2~3人兵刃162% + 禁疗2回合)
  else if (tac.id === 'tac_jue_qi_ji_dao') {
    const targets = getRandomElements(livingOpps, 3);
    targets.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.6 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.62) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '绝其汲道', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🪓 绝其汲道断水截粮！重劈【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      const ext = (team.hasJuShou && Math.random() < 0.65) ? 3 : 2;
      opp.buffs.cannotHeal = ext;
      log(round, `🚫 粮水源道尽绝！【${opp.label}】陷入【禁疗】${ext}回合(无法恢复任何兵力)！`, 'debuff', { actor, target: opp });
    });
  }
  // 🌟 江东猛虎 (孙坚自带：群体2人兵刃126% + 嘲讽2回合)
  else if (tac.id === 'tac_jiang_dong_meng_hu') {
    const targets = getRandomElements(livingOpps, 2);
    targets.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.5 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.26) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '江东猛虎', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `🐯 江东猛虎狂啸破阵！【${actor.label}】古锭刀斩向【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
      opp.buffs.tauntTarget = actor;
      opp.buffs.tauntExpireRound = round + 2;
      log(round, `🛡️ 猛虎威势震慑！【${opp.label}】受【江东猛虎】强行嘲讽，未来 2 回合必须普通攻击【${actor.label}】！`, 'debuff', { actor, target: opp });
    });
  }
  // 🌟 苦肉计 (黄盖自带：自损10%兵力，单体混乱与灼烧2回合)
  else if (tac.id === 'tac_ku_rou_ji') {
    const selfLoss = Math.max(10, Math.round(actor.currentSoldiers * 0.10));
    actor.currentSoldiers = Math.max(1, actor.currentSoldiers - selfLoss);
    log(round, `🚢 苦肉计舍身诈降！【${actor.label}】自损鞭挞 ${selfLoss} 兵力以取信于敌！(自身余兵:${actor.currentSoldiers})`, 'skill', { actor });
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      if (!target.buffs.insight) {
        const ext = (team.hasJuShou && Math.random() < 0.65) ? 3 : 2;
        target.buffs.confused = ext;
        target.buffs.burn = ext;
        target.buffs.burnDmg = Math.round(actor.intel * 0.78);
        target.buffs.burnSourceActor = actor;
        log(round, `🔥🌀 火烧赤壁连环劫！令【${target.label}】陷入【混乱】与【持续灼烧】${ext}回合！`, 'debuff', { actor, target });
      }
    }
  }
  // 🌟 婴城自守 (群体2人治疗180% + 休整62%)
  else if (tac.id === 'tac_ying_cheng_zi_shou') {
    const wounded = [...team].filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)).slice(0, 2);
    wounded.forEach(m => {
      const heal = Math.round(actor.intel * (tac.healRate || 1.80) * Math.sqrt(actor.currentSoldiers / 100));
      m.currentSoldiers = Math.min(m.maxSoldiers, m.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tac.id);
      log(round, `🏰 婴城自守据城深沟！治愈【${m.label}】恢复 ${heal} 兵力，并施加 1 回合休整生息！(余兵:${m.currentSoldiers})`, 'heal', { actor, target: m });
    });
  }
  // 🌟 登锋陷阵 (文丑自带：单体兵刃208% + 削统65点 + 自身抵御1次)
  else if (tac.id === 'tac_deng_feng_xian_zhen') {
    grantShield(round, actor, 1, 2, log, '登锋陷阵');
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.8 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.08) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '登锋陷阵', { damageType: 'blade' });
      target.command = Math.max(10, target.command - 65);
      if (!target.buffs.statRestorations) target.buffs.statRestorations = [];
      target.buffs.statRestorations.push({ roundExpire: round + 2, command: 65, intel: 0, name: '登锋陷阵' });
      if (actualDmg > 0) {
        log(round, `🪓 登锋陷阵万军冲锋！文丑铁矛重刺【${target.label}】造成 ${actualDmg} 点狂暴兵刃重创，削弱其 65 点统率(持续2回合)！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }
  // 🌟 胡笳十八拍 (蔡文姬自带：群体2人治疗108% + 50%几率增伤26%、减伤26%持续2回合)
  else if (tac.id === 'tac_hu_jia_shi_ba_pai') {
    const wounded = [...team].filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)).slice(0, 2);
    const intelMod = 1 + Math.max(0, (actor.intel - 100) / 300);
    const bonusPct = (tac.teamDamageBonus || 0.26) * intelMod;
    const reduxPct = (tac.teamDamageReduction || 0.26) * intelMod;
    wounded.forEach(m => {
      const heal = Math.round(actor.intel * (tac.healRate || 1.08) * Math.sqrt(actor.currentSoldiers / 100));
      m.currentSoldiers = Math.min(m.maxSoldiers, m.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tac.id);
      log(round, `🎵 胡笳十八拍悲歌感天！为【${m.label}】治愈恢复 ${heal} 兵力！(余兵:${m.currentSoldiers})`, 'heal', { actor, target: m });

      if (Math.random() < 0.50) {
        m.buffs.damageDealtMod = (m.buffs.damageDealtMod || 1.0) + bonusPct;
        m.buffs.damageReceivedMod = Math.max(0.1, (m.buffs.damageReceivedMod || 1.0) - reduxPct);
        if (!m.buffs.timedDealtModBuffs) m.buffs.timedDealtModBuffs = [];
        m.buffs.timedDealtModBuffs.push({ expireRound: round + 2, val: bonusPct, name: '胡笳十八拍' });
        if (!m.buffs.timedReceivedModBuffs) m.buffs.timedReceivedModBuffs = [];
        m.buffs.timedReceivedModBuffs.push({ expireRound: round + 2, val: reduxPct, name: '胡笳十八拍' });
        log(round, `✨ 胡笳清音激扬！【${m.label}】获得增益：造成伤害提升 ${(bonusPct * 100).toFixed(1)}%，受伤害降低 ${(reduxPct * 100).toFixed(1)}%(受智力影响，持续2回合)！`, 'buff', { actor, target: m });
      }
    });
  }
  // 🌟 狮子奋迅 (吕玲绮自带：单体兵刃228% + 增伤15% + 自身主动几率+15%)
  else if (tac.id === 'tac_shi_zi_fen_xun') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.8 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.28) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '狮子奋迅', { damageType: 'blade' });
      target.buffs.bladeReceivedMod = (target.buffs.bladeReceivedMod || 1.0) + 0.15;
      if (!target.buffs.timedBladeReceivedBuffs) target.buffs.timedBladeReceivedBuffs = [];
      target.buffs.timedBladeReceivedBuffs.push({ expireRound: round + 2, val: 0.15, name: '狮子奋迅' });
      const rateBonus = tac.activeRateBonus || 15;
      actor.buffs.activeRateBonus = (actor.buffs.activeRateBonus || 0) + rateBonus;
      if (!actor.buffs.timedActiveRateBuffs) actor.buffs.timedActiveRateBuffs = [];
      actor.buffs.timedActiveRateBuffs.push({ expireRound: round + 2, val: rateBonus, name: '狮子奋迅' });
      if (actualDmg > 0) {
        log(round, `🦁 狮子奋迅豪气贯日！吕布之女画戟狂舞，对【${target.label}】造成 ${actualDmg} 点狂暴兵刃重创，使其受兵刃伤害提升15%！自身主动战法几率提升15%(持续2回合)！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
    }
  }
  // 🌟 洛神 (甄姬自带：自身治疗120% + 随机敌单体混乱1回合)
  else if (tac.id === 'tac_luo_shen') {
    const heal = Math.round(actor.intel * (tac.healRate || 1.20) * Math.sqrt(actor.currentSoldiers / 100));
    actor.currentSoldiers = Math.min(actor.maxSoldiers, actor.currentSoldiers + heal);
    recordHeroHeal(actor, heal, tac.id);
    actor.buffs.silenced = 0;
    actor.buffs.disarmed = 0;
    log(round, `💃 洛神翩若惊鸿！甄姬引洛水灵韵，为自身恢复 ${heal} 兵力并驱散负面！(余兵:${actor.currentSoldiers})`, 'heal', { actor });
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      if (!target.buffs.insight) {
        target.buffs.confused = 1;
        log(round, `🌀 洛神流风回雪！【${target.label}】心神荡漾陷入【混乱】1回合！`, 'debuff', { actor, target });
      }
    }
  }
  // 🌟 潜谋沉思 (张春华自带：敌群体2人削弱统率智力30% + 谋略伤害148%)
  else if (tac.id === 'tac_chen_si') {
    const targets = getRandomElements(livingOpps.filter(h => h.currentSoldiers > 0), 2);
    targets.forEach(opp => {
      const lostCmd = Math.round(opp.command * 0.30);
      const lostInt = Math.round(opp.intel * 0.30);
      opp.command = Math.max(10, opp.command - lostCmd);
      opp.intel = Math.max(10, opp.intel - lostInt);
      if (!opp.buffs.statRestorations) opp.buffs.statRestorations = [];
      opp.buffs.statRestorations.push({ roundExpire: round + 2, command: lostCmd, intel: lostInt, name: '潜谋沉思' });
      const rawDmg = Math.round((actor.intel * 1.6 - opp.intel * 0.5) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 1.48) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '潜谋沉思', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `🧠 潜谋沉思洞察机先！对【${opp.label}】造成 ${actualDmg} 点谋略伤害，并削弱其 30% 统率与智力(持续2回合)！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
  }
  // 🌟 安抚军心 (步练师自带：净化群体2人 + 治疗136% + 急救)
  else if (tac.id === 'tac_an_fu_jun_xin') {
    const wounded = [...team].filter(h => h.currentSoldiers > 0).sort((a, b) => (a.currentSoldiers / a.maxSoldiers) - (b.currentSoldiers / b.maxSoldiers)).slice(0, 2);
    wounded.forEach(m => {
      m.buffs.silenced = 0;
      m.buffs.disarmed = 0;
      m.buffs.burn = 0;
      m.buffs.confused = 0;
      m.buffs.weakness = 0;
      const heal = Math.round(actor.intel * (tac.healRate || 1.36) * Math.sqrt(actor.currentSoldiers / 100));
      m.currentSoldiers = Math.min(m.maxSoldiers, m.currentSoldiers + heal);
      recordHeroHeal(actor, heal, tac.id);
      m.buffs.anFuEmergency = 2;
      m.buffs.anFuDoctor = actor;
      log(round, `🕊️ 安抚军心慈惠温润！驱散【${m.label}】负面异常，疗愈 ${heal} 兵力并赋予2回合急救！(余兵:${m.currentSoldiers})`, 'heal', { actor, target: m });
    });
  }
  // 🌟 竭忠尽智 (田丰自带：单体削弱统率智力50点 + 60%混乱虚弱)
  else if (tac.id === 'tac_jie_zhong_jin_zhi') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      target.command = Math.max(10, target.command - 50);
      target.intel = Math.max(10, target.intel - 50);
      if (!target.buffs.statRestorations) target.buffs.statRestorations = [];
      target.buffs.statRestorations.push({ roundExpire: round + 2, command: 50, intel: 50, name: '竭忠尽智' });
      log(round, `📜 竭忠尽智慷慨死谏！削弱【${target.label}】统率与智力各 50 点(持续2回合)！`, 'debuff', { actor, target });
      if (Math.random() < 0.60 && !target.buffs.insight) {
        target.buffs.confused = 1;
        target.buffs.weakness = 1;
        log(round, `🌀💔 忠言逆耳震颤肺腑！令【${target.label}】陷入【混乱】与【虚弱】1回合无法造成伤害！`, 'debuff', { actor, target });
      }
    }
  }
  // 🌟 鸩毒 (李儒自带：降低单体30%统率 + 叛逃剧毒真伤160%)
  else if (tac.id === 'tac_zhen_du') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const redPct = 0.30 * (1 + Math.max(0, (actor.intel - 100) / 400));
      const lostCmd = Math.round(target.command * redPct);
      target.command = Math.max(10, target.command - lostCmd);
      if (!target.buffs.statRestorations) target.buffs.statRestorations = [];
      target.buffs.statRestorations.push({ roundExpire: round + 2, command: lostCmd, intel: 0, name: '鸩毒' });
      target.buffs.panTao = 2;
      target.buffs.panTaoDmg = Math.round(actor.intel * (tac.damageRate || 1.60) * Math.sqrt(actor.currentSoldiers / 100) / 2);
      target.buffs.panTaoSourceActor = actor;
      log(round, `🍶 鸩毒赐酒阴鸷蚀骨！【${actor.label}】毒杀【${target.label}】，削弱其 ${(redPct * 100).toFixed(1)}% 统率(${lostCmd}点)，并施加持续2回合致命【叛逃剧毒】！`, 'debuff', { actor, target });
    }
  }
  // 🌟 精练策数 (钟会自带：全体谋略轰击210% + 敌军2人缴械2回合)
  else if (tac.id === 'tac_jing_lian_ce_shu') {
    livingOpps.filter(opp => opp.currentSoldiers > 0).forEach(opp => {
      const rawDmg = Math.round((actor.intel * 1.7 - opp.intel * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.10) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '精练策数', { damageType: 'tactical' });
      if (actualDmg > 0) {
        log(round, `📚 精练策数奇谋绝胜！钟会挥卷点兵，对【${opp.label}】造成 ${actualDmg} 点暴烈谋略重创！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    const disarmTargets = getRandomElements(livingOpps.filter(h => h.currentSoldiers > 0), 2);
    disarmTargets.forEach(t => {
      if (!t.buffs.insight) {
        t.buffs.disarmed = 2;
        log(round, `🚫 精练策数策禁干戈！【${t.label}】被钟会神策缴械无法普攻持续2回合！`, 'debuff', { actor, target: t });
      }
    });
  }
  // 🌟 十二奇策 (荀攸自带：驱散敌增益 + 全体主动几率+6%)
  else if (tac.id === 'tac_shi_er_qi_ce') {
    livingOpps.filter(opp => opp.currentSoldiers > 0).forEach(opp => {
      opp.buffs.damageDealtMod = 1.0;
      opp.buffs.firstStrike = false;
      opp.buffs.continuousAttack = false;
    });
    log(round, `📜 十二奇策百出不穷！荀攸神谋驱散敌军全体所有增益状态！`, 'skill', { actor });
    const bonusRate = Math.round((tac.activeRateBonus || 6) * (1 + Math.max(0, (actor.intel - 100) / 300)));
    team.filter(h => h.currentSoldiers > 0).forEach(m => {
      m.buffs.activeRateBonus = (m.buffs.activeRateBonus || 0) + bonusRate;
      if (!m.buffs.timedActiveRateBuffs) m.buffs.timedActiveRateBuffs = [];
      m.buffs.timedActiveRateBuffs.push({ expireRound: round + 1, val: bonusRate, name: '十二奇策' });
      log(round, `✨ 十二奇策点拨全军！【${m.label}】主动战法发动几率提升 ${bonusRate}%(持续1回合)！`, 'buff', { actor, target: m });
    });
  }
  // 🌟 刀劈千军 (关兴自带：单体兵刃220% + 30%倒戈吸血2回合 + 分担张苞伤害)
  else if (tac.id === 'tac_dao_pi_qian_jun') {
    const freshLiving = livingOpps.filter(h => h.currentSoldiers > 0);
    if (freshLiving.length > 0) {
      const target = freshLiving[Math.floor(Math.random() * freshLiving.length)];
      const rawDmg = Math.round((actor.force * 1.8 - target.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.20) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, target, rawDmg, log, '刀劈千军', { damageType: 'blade' });
      actor.buffs.vampireForce = Math.max(actor.buffs.vampireForce || 0, 0.30);
      if (actualDmg > 0) {
        log(round, `🗡️ 刀劈千军青龙再现！关兴青龙偃月重斩【${target.label}】造成 ${actualDmg} 点狂暴兵刃重创，获得 30% 倒戈吸血！(余兵:${target.currentSoldiers})`, 'action', { actor, target });
      }
      const zhangBao = team.find(h => h.id === 'gen_zhang_bao_shu' && h.currentSoldiers > 0);
      if (zhangBao) {
        zhangBao.buffs.shareDamageTarget = actor;
        zhangBao.buffs.shareDamageRate = 0.30;
        zhangBao.buffs.shareDamageDuration = 2;
        zhangBao.buffs.shareDamageIsGuanXing = true;
        log(round, `🤝 双雄破阵义结金兰！关兴挺身替张苞分担 30% 伤害持续2回合！`, 'buff', { actor, target: zhangBao });
      }
    }
  }
  // 🌟 枪震八方 (张苞自带：群体2人兵刃200% + 关兴自身2次抵御)
  else if (tac.id === 'tac_qiang_zhen_ba_fang') {
    const targets = getRandomElements(livingOpps.filter(h => h.currentSoldiers > 0), 2);
    targets.forEach(opp => {
      const rawDmg = Math.round((actor.force * 1.7 - opp.command * 0.6) * Math.sqrt(actor.currentSoldiers / 100) * (tac.damageRate || 2.00) * armAdv);
      const actualDmg = applyDamageToTarget(round, actor, opp, rawDmg, log, '枪震八方', { damageType: 'blade' });
      if (actualDmg > 0) {
        log(round, `💥 枪震八方蛇矛裂地！张苞丈八蛇矛横扫【${opp.label}】造成 ${actualDmg} 点兵刃伤害！(余兵:${opp.currentSoldiers})`, 'action', { actor, target: opp });
      }
    });
    grantShield(round, actor, 2, 2, log, '枪震八方');
    const guanXing = team.find(h => h.id === 'gen_guan_xing' && h.currentSoldiers > 0);
    if (guanXing) {
      grantShield(round, guanXing, 2, 2, log, '枪震八方');
    }
  }
  // 🌟 威谋靡亢 (顶级控场：群体2人虚弱2回合，已虚弱则真伤叛逃158%)
  else if (tac.id === 'tac_wei_mou_mi_kang') {
    const targets = getRandomElements(livingOpps.filter(h => h.currentSoldiers > 0), 2);
    targets.forEach(opp => {
      if (opp.buffs.weakness > 0) {
        opp.buffs.panTao = 2;
        const highestStat = Math.max(actor.force, actor.intel);
        opp.buffs.panTaoDmg = Math.round(highestStat * (tac.damageRate || 1.58) * Math.sqrt(actor.currentSoldiers / 100) / 2);
        opp.buffs.panTaoSourceActor = actor;
        log(round, `⚡🩸 威谋靡亢破防反噬！【${opp.label}】已受虚弱，直接转化为无视防御的【叛逃】真伤持续2回合！`, 'debuff', { actor, target: opp });
      } else if (!opp.buffs.insight) {
        opp.buffs.weakness = 2;
        log(round, `🕊️ 威谋靡亢神谋诛心！【${opp.label}】胆气崩溃陷入【虚弱】持续2回合无法造成任何伤害！`, 'debuff', { actor, target: opp });
      }
    });
  }
}
