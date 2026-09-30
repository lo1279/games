/**
 * 三国志·战略版 - 战法数据库 (Tactics)
 * 严格按照 指挥(Command)、被动(Passive)、主动(Active)、突击(Assault) 四大机制设计
 */

export const TACTICS_DATA = [
  // ================= 专属自带战法 =================
  {
    id: 'tac_ren_de_zai_shi',
    name: '仁德载世',
    type: 'command',
    rate: 100,
    target: 'friendly_2',
    quality: 'S',
    damageType: 'heal',
    desc: '每回合恢复我军群体(2人)兵力(治疗率128%，受智力影响)，并有25%概率使敌军单体陷入虚弱(无法造成伤害)持续1回合。',
    healRate: 1.28,
    debuff: { type: 'weakness', rate: 25, duration: 1 }
  },
  {
    id: 'tac_wei_zhen_hua_xia',
    name: '威震华夏',
    type: 'active',
    rate: 35,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.46,
    desc: '准备1回合，对敌军全体发动猛攻(伤害率146%)，并有50%概率使其陷入缴械(无法普攻)或计穷(无法发动主动战法)持续1回合。',
    requiresPrep: true,
    debuff: { type: 'control', rate: 50, duration: 1 }
  },
  {
    id: 'tac_yan_ren_pao_xiao',
    name: '燕人咆哮',
    type: 'passive',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.04,
    desc: '第2、4回合对敌军全体发动兵刃攻击(伤害率104%)；若目标处于缴械状态，则额外降低其统率50%持续2回合。',
    triggerRounds: [2, 4]
  },
  {
    id: 'tac_shen_ji_miao_suan',
    name: '神机妙算',
    type: 'command',
    rate: 100,
    target: 'enemy_active',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.50,
    desc: '敌军试图发动主动战法时，有35%概率令其战法失效，并对其造成强力谋略伤害(伤害率150%，受智力影响)！',
    counterActiveRate: 35
  },
  {
    id: 'tac_yi_shen_shi_dan',
    name: '一身是胆',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中使自己获得洞察状态(免疫所有控制效果)，并提高自身武力、智力、统率、速度各40点。',
    statBoost: 40,
    insight: true
  },
  {
    id: 'tac_luan_shi_jian_xiong',
    name: '乱世奸雄',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中使我军群体造成的伤害提升16%(受智力影响)；自身受到的伤害降低18%，副将造成伤害时为曹操恢复其伤害量10%的兵力。',
    teamDamageBonus: 0.16,
    selfDamageReduction: 0.18
  },
  {
    id: 'tac_gang_lie_bu_qu',
    name: '刚烈不屈',
    type: 'passive',
    rate: 100,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    damageRate: 0.84,
    desc: '战斗中提升自身统率38点；受到兵刃或谋略伤害时，有40%概率对敌军群体(2人)发动反击(伤害率84%)。',
    retaliateRate: 40,
    statBoostCmd: 38
  },
  {
    id: 'tac_ying_shi_lang_gu',
    name: '鹰视狼顾',
    type: 'command',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.54,
    desc: '前4回合自身获得攻心并叠加奇谋概率；第5回合起每回合对敌军全体造成强力谋略伤害(伤害率154%)。',
    lateGameStartRound: 5
  },
  {
    id: 'tac_xian_zhen_tu_xi',
    name: '陷阵突袭',
    type: 'passive',
    rate: 100,
    target: 'enemy_leader',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中普通攻击有68%概率锁定敌军主将！同时使自身突击战法发动概率提高15%，斩首核心神技。',
    lockLeaderRate: 68,
    assaultRateBonus: 15
  },
  {
    id: 'tac_shen_huo_ji',
    name: '神火计',
    type: 'passive',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 0.68,
    desc: '自身每次成功发动主动战法时，有80%概率对敌军全体造成谋略伤害(伤害率68%)，并施加灼烧状态。',
    triggerOnActive: true,
    burnRate: 80
  },
  {
    id: 'tac_huo_shao_lian_ying',
    name: '火烧连营',
    type: 'active',
    rate: 50,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.18,
    desc: '对敌军单体施加灼烧状态(伤害率98%持续2回合)；若目标已灼烧，则引发烈焰爆轰蔓延至敌军其他目标并震慑1回合！',
    burnDamage: 0.98
  },
  {
    id: 'tac_shen_she',
    name: '神射',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中使自己获得稳定连击状态(每回合进行2次普通攻击)，但降低自身统率5点。突击体系绝对核心！',
    doubleAttack: true
  },
  {
    id: 'tac_zuo_duan_dong_nan',
    name: '坐断东南',
    type: 'command',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '自身及友军普通攻击时，自身有75%概率随机获得连击、洞察、先攻、必中、破阵状态之一，持续2回合。',
    emperorBuff: true
  },
  {
    id: 'tac_tian_xia_wu_shuang',
    name: '天下无双',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'physical',
    desc: '对敌军单体发起决斗！双方轮流进行3次普通攻击(不受缴械影响)，吕布决斗期间先攻并减伤7%。决斗可触发突击！',
    duelStrikes: 3
  },
  {
    id: 'tac_bi_yue',
    name: '闭月',
    type: 'active',
    rate: 75,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'buff',
    desc: '选择敌军单体为自身分担25%所受伤害(受智力影响)，并根据目标兵刃/谋略属性令其陷入混乱或计穷1回合。',
    shareDamageRate: 0.25
  },
  {
    id: 'tac_qing_nang_xiang_zhu',
    name: '青囊相助',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'heal',
    desc: '战斗前4回合使我军群体统率提高40点，且受到伤害时有50%概率获得急救恢复兵力(治疗率88%)。',
    statBoostCmd: 40,
    firstRounds: 4,
    emergencyHealRate: 0.88
  },
  {
    id: 'tac_shuo_xue_fu_qi',
    name: '槊血复骑',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '提升自身34点武力；普通攻击命中后，对敌军全体造成群攻溅射兵刃伤害(伤害率54%)！',
    statBoostForce: 34,
    splashRate: 0.54
  },
  {
    id: 'tac_bai_bu_chuan_yang',
    name: '百步穿杨',
    type: 'active',
    rate: 35,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    requiresPrep: true,
    damageRate: 1.80,
    desc: '准备1回合，提升自身25%会心几率持续2回合，并对敌军全体发动致命箭雨猛攻(伤害率180%)！',
    critRateBonus: 0.25
  },
  {
    id: 'tac_yi_yi_dai_lao',
    name: '以逸待劳',
    type: 'active',
    rate: 35,
    target: 'friendly_2',
    quality: 'S',
    damageType: 'heal',
    healRate: 1.58,
    desc: '治疗我军群体(2人)兵力(治疗率158%，受智力影响)，并使目标受到下2次伤害降低40%！'
  },
  {
    id: 'tac_tie_suo_lian_huan',
    name: '铁索连环',
    type: 'active',
    rate: 35,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 1.56,
    desc: '准备1回合，对敌军全体施加【铁索连环】状态：任一目标受到伤害时，连带传递15%伤害给其余所有敌军！'
  },
  {
    id: 'tac_shi_sheng_shi_bai',
    name: '十胜十败',
    type: 'command',
    rate: 100,
    target: 'leader',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗前2回合，使我军主将获得【洞察】状态(免疫所有控制)，且受到的所有伤害大幅降低50%！'
  },
  {
    id: 'tac_shi_mian_mai_fu',
    name: '十面埋伏',
    type: 'active',
    rate: 35,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.26,
    desc: '对有负面状态的敌军造成无视防御的【叛逃真伤】(伤害率126%)，并令其陷入【禁疗】(无法恢复兵力)持续2回合！'
  },
  {
    id: 'tac_gu_zhi_e_lai',
    name: '古之恶来',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '我军主将即将受到普通攻击时，自身替其承担该次攻击伤害，并对攻击者发动强力猛击反击(伤害率130%)！'
  },
  {
    id: 'tac_hu_chi',
    name: '虎痴',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中每回合锁定敌军单体，自身对该目标造成的伤害提升33%；若成功击溃该目标，自身获得【破阵】(无视统率与智力)！'
  },
  {
    id: 'tac_jin_fan_bai_shou',
    name: '锦帆百狩',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗中自身会心几率提升50%，且自身造成的会心伤害提高120%！江表第一暴力核弹！',
    critRateBonus: 0.50,
    critDamageBonus: 1.20
  },
  {
    id: 'tac_bai_yi_du_jiang',
    name: '白衣渡江',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗首回合使我军全体获得1次【抵御】免疫伤害；自身造成兵刃伤害时40%几率缴械敌方，造成谋略伤害时40%几率计穷敌方！'
  },
  {
    id: 'tac_jiang_dong_xiao_ba_wang',
    name: '江东小霸王',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '普通攻击后有35%几率对目标再次发动兵刃猛攻(伤害率192%)，并恢复自身兵力(治疗率116%)！'
  },
  {
    id: 'tac_ji_pin_hao_shi',
    name: '济贫好施',
    type: 'command',
    rate: 100,
    target: 'friendly_lowest',
    quality: 'S',
    damageType: 'buff',
    desc: '第2回合将自身40%属性移交给我军兵力最低的友军；并在后续回合为其提供巨额减伤(42%)与持续回血！'
  },
  {
    id: 'tac_wu_lei_hong_ding',
    name: '五雷轰顶',
    type: 'active',
    rate: 45,
    target: 'enemy_random',
    quality: 'S',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 1.36,
    desc: '准备1回合，引动九天玄雷对敌军随机单体连续劈击5次(每次伤害率136%)，且每次劈击有30%概率附加【震慑】！'
  },
  {
    id: 'tac_lei_shi_li_ming',
    name: '累世立名',
    type: 'active',
    rate: 50,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'mixed',
    requiresPrep: true,
    damageRate: 1.26,
    desc: '准备1回合，对敌军2人造成兵刃与灼烧谋略双重打击，并使我军全体统率提升80点持续2回合！'
  },
  {
    id: 'tac_jin_dan_mi_shu',
    name: '金丹秘术',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗前2回合使我军全体获得60%【规避】几率(完全避开伤害)；第3~5回合持续使全体获得休整恢复兵力！'
  },
  {
    id: 'tac_jiu_chi_rou_lin',
    name: '酒池肉林',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '自身获得50%倒戈吸血；第5回合起每回合对敌我全体造成毁灭性兵刃轰击(伤害率120%)！'
  },

  // ================= 通用可装配传承战法 =================
  {
    id: 'tac_wan_jian_qi_fa',
    name: '万箭齐发',
    type: 'active',
    rate: 40,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    requiresPrep: true,
    damageRate: 1.40,
    desc: '【黄忠专属传承】准备1回合，对敌军全体发动万箭齐射(伤害率140%)，并有50%几率造成持续溃逃(伤害率84%)持续1回合！'
  },
  {
    id: 'tac_chen_sha_jue_shui',
    name: '沉沙决水',
    type: 'active',
    rate: 40,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 1.26,
    desc: '【法正/郭嘉专属传承】准备1回合，对敌军2人施加水攻(伤害率126%)，并使其受到的谋略伤害提升25%持续2回合！'
  },
  {
    id: 'tac_po_zhen_cui_jian',
    name: '破阵摧坚',
    type: 'active',
    rate: 35,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    requiresPrep: true,
    damageRate: 1.58,
    desc: '【孙策专属传承】准备1回合，使敌军群体(2人)统率和智力削减80点，随后对其发动强力兵刃轰击(伤害率158%)！'
  },
  {
    id: 'tac_shi_bie_san_ri',
    name: '士别三日',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'tactical',
    desc: '【吕蒙专属传承】前3回合无法进行普攻但获得30%规避几率；第4回合自身智力提高68点，并对敌军全体发动毁灭性谋略轰炸(伤害率180%)！'
  },
  {
    id: 'tac_bei_she_gui_che',
    name: '杯蛇鬼车',
    type: 'active',
    rate: 50,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 1.53,
    healRate: 1.02,
    desc: '【左慈专属传承】准备1回合，对敌军2人造成谋略伤害(153%)，并为我军群体(2人)恢复海量兵力(治疗率102%)！'
  },
  {
    id: 'tac_huang_tian_tai_ping',
    name: '黄天泰平',
    type: 'active',
    rate: 35,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'debuff',
    requiresPrep: true,
    desc: '【张角专属传承】准备1回合，使敌军群体2人陷入【计穷】(无法释放主动战法)持续2回合；自身陷入混乱1回合。'
  },
  {
    id: 'tac_bao_li_wu_ren',
    name: '暴戾无仁',
    type: 'assault',
    rate: 35,
    target: 'attack_target',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.96,
    desc: '【董卓专属传承】普通攻击后，对目标造成一次狂暴兵刃斩击(伤害率196%)，并使其陷入【混乱】持续1回合！'
  },
  {
    id: 'tac_yi_li_ju_shou',
    name: '一力拒守',
    type: 'active',
    rate: 55,
    target: 'self',
    quality: 'S',
    damageType: 'heal',
    healRate: 2.68,
    desc: '【典韦专属传承】为自身恢复巨量兵力(治疗率268%)，并提高自身统率42点持续1回合！'
  },
  {
    id: 'tac_shou_er_bi_gu',
    name: '守而必固',
    type: 'command',
    rate: 100,
    target: 'enemy_leader',
    quality: 'S',
    damageType: 'debuff',
    desc: '【程昱专属传承】战斗开始前4回合，嘲讽敌军主将迫使其普通攻击自身，并提高自身统率40点！'
  },
  {
    id: 'tac_he_jun_ju_zhong',
    name: '合军聚众',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'heal',
    healRate: 1.24,
    desc: '【袁绍专属传承】战斗中每回合稳定使自身获得休整，恢复自身兵力(治疗率124%)！'
  },
  {
    id: 'tac_bai_lian_cheng_gang',
    name: '百炼成钢',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'A',
    damageType: 'buff',
    desc: '【甘宁专属传承】战斗中使自身武力、智力、统率、速度全部提升36点！'
  },

  // ================= 通用可装配传承战法 =================
  {
    id: 'tac_ba_men_jin_suo',
    name: '八门金锁阵',
    type: 'command',
    rate: 100,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗前3回合使敌军群体(2人)造成的伤害降低30%(受智力影响)，并使我军主将获得先攻状态(优先出手)。',
    firstRounds: 3,
    damageReduction: 0.30,
    leaderFirstStrike: true
  },
  {
    id: 'tac_sheng_qi_ling_di',
    name: '盛气凌敌',
    type: 'command',
    rate: 100,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'buff',
    desc: '战斗前2回合使敌军群体(2人)有90%几率陷入缴械状态(无法进行普通攻击)，极度克制突击流派！',
    firstRounds: 2,
    disarmRate: 90
  },
  {
    id: 'tac_suo_xiang_pi_mi',
    name: '所向披靡',
    type: 'active',
    rate: 30,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 2.06,
    requiresPrep: true,
    desc: '准备1回合，对敌军全体发动毁天灭地的兵刃打击(伤害率206%)！顶级物理爆发大核战法。'
  },
  {
    id: 'tac_gua_gu_liao_du',
    name: '刮骨疗毒',
    type: 'active',
    rate: 40,
    target: 'friendly_lowest',
    quality: 'S',
    damageType: 'heal',
    healRate: 2.56,
    cleanse: true,
    desc: '为我军损失兵力最多的单体清除所有负面状态与控制，并为其恢复巨额兵力(治疗率256%，受智力影响)！'
  },
  {
    id: 'tac_yi_qi_dang_qian',
    name: '一骑当千',
    type: 'assault',
    rate: 30,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.08,
    desc: '普通攻击后对敌军全体发动一次强力兵刃攻击(伤害率108%)；若为主将担任时伤害率提升至144%！'
  },
  {
    id: 'tac_bai_ma_yi_cong',
    name: '白马义从',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    armReq: 'bow',
    desc: '【仅弓兵可用】将弓兵进阶为白马义从。前2回合全体行军速度提升50%，全体获得先攻，并使主动战法发动率提高10%！',
    firstRounds: 2,
    activeRateBonus: 10,
    allFirstStrike: true
  },
  {
    id: 'tac_yu_di_ping_zhang',
    name: '御敌屏障',
    type: 'command',
    rate: 100,
    target: 'friendly_2',
    quality: 'A',
    damageType: 'buff',
    desc: '战斗前4回合使我军群体(2人)受到的伤害降低25%。平民开荒减伤神技！',
    firstRounds: 4,
    teamDamageReduction: 0.25
  },
  {
    id: 'tac_zi_yu',
    name: '自愈',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'A',
    damageType: 'heal',
    healRate: 1.00,
    desc: '战斗中使自己每回合稳定恢复一次兵力(治疗率100%)。开荒单刷续航核心战法。'
  },
  {
    id: 'tac_shou_qi_dao_luo',
    name: '手起刀落',
    type: 'assault',
    rate: 35,
    target: 'attack_target',
    quality: 'A',
    damageType: 'physical',
    damageRate: 1.84,
    desc: '普通攻击后对目标再次发动一次猛烈兵刃打击(伤害率184%)。'
  },
  {
    id: 'tac_fen_fa',
    name: '奋发',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'A',
    damageType: 'buff',
    desc: '使自身武力与速度各提升25点，强化先手输出与伤害。',
    statBoostForce: 25,
    statBoostSpeed: 25
  },
  {
    id: 'tac_zuo_you_kai_gong',
    name: '左右开弓',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'A',
    damageType: 'physical',
    damageRate: 1.80,
    armReq: 'bow',
    desc: '【仅弓兵可用】提升自身13%会心(暴击率)，并对敌军单体造成兵刃攻击(伤害率180%)；若目标为骑兵则造成溃逃。',
    critRateBonus: 13
  },
  {
    id: 'tac_yao_shu',
    name: '妖术',
    type: 'active',
    rate: 40,
    target: 'enemy_all',
    quality: 'A',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 0.72,
    desc: '准备1回合，使敌军全体陷入沙暴状态持续2回合(每回合造成谋略伤害72%)，并使自身获得1次抵御(免疫1次伤害)。',
    sandstorm: true
  },

  // ================= 官方正统名将传承战法 (100%严苛还原) =================
  {
    id: 'tac_heng_sao_qian_jun',
    name: '横扫千军',
    type: 'active',
    rate: 40,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.60,
    desc: '【关羽/赵云专属传承】对敌军全体造成强力兵刃打击(伤害率160%)；若目标处于缴械或计穷状态，有30%概率使其陷入震慑(无法行动)1回合！'
  },
  {
    id: 'tac_chen_mu_heng_mao',
    name: '嗔目横矛',
    type: 'active',
    rate: 40,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【张飞专属传承】使自身武力提升50点，并使普通攻击获得群攻溅射效果(对敌军其余目标造成70%兵刃溅射伤害)，持续2回合！'
  },
  {
    id: 'tac_she_zhan_qun_ru',
    name: '舌战群儒',
    type: 'passive',
    rate: 100,
    target: 'enemy_active',
    quality: 'S',
    damageType: 'debuff',
    desc: '【诸葛亮专属传承】敌军试图发动主动战法时，降低其发动几率10%，并提升我军全体主动战法发动几率5%，持续1回合。'
  },
  {
    id: 'tac_meng_zhong_shi_chen',
    name: '梦中弑臣',
    type: 'command',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【曹操专属传承】战斗前2回合自身获得反击几率(受到普攻反击105%伤害)，并提高自身统率40点。'
  },
  {
    id: 'tac_jue_di_fan_ji',
    name: '绝地反击',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '【夏侯惇专属传承】战斗中自身每次受到兵刃伤害提高武力6点(最多叠加10次)；第5回合根据层数对敌军全体发动致命反击爆发(最高280%伤害)！'
  },
  {
    id: 'tac_yong_wu_tong_shen',
    name: '用武通神',
    type: 'command',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    desc: '【司马懿专属传承】战斗第2、4、6、8回合，依次对敌军群体施加稳定递增的谋略爆发(第2回合75%、第4回合105%、第6回合135%、第8回合165%)！'
  },
  {
    id: 'tac_yong_zhe_de_qian',
    name: '勇者得前',
    type: 'assault',
    rate: 35,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【张辽专属传承】普通攻击后使自身获得1次抵御(免疫伤害)，并使自身下一次主动战法造成的伤害大幅提升80%！'
  },
  {
    id: 'tac_feng_zhu_huo_shi',
    name: '风助火势',
    type: 'active',
    rate: 45,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.54,
    desc: '【周瑜专属传承】对敌军单体造成谋略伤害(154%)；若目标处于灼烧状态，则额外引爆第二次天火爆轰(追加198%谋略伤害)！'
  },
  {
    id: 'tac_han_tian_chi_di',
    name: '熯天炽地',
    type: 'active',
    rate: 35,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 1.02,
    desc: '【陆逊专属传承】准备1回合，对敌军全体发动滔天烈火谋略打击(伤害率102%)，并附带持续2回合全体灼烧溃灭！'
  },
  {
    id: 'tac_zhe_chong_yu_wu',
    name: '折冲御侮',
    type: 'assault',
    baseRate: 25,
    rate: 45,
    statDebuff: 100,
    shieldCount: 2,
    shieldDuration: 2,
    target: 'attack_target',
    quality: 'S',
    damageType: 'debuff',
    desc: '【太史慈专属传承】普通攻击后，使随机敌军单体统率与智力各削减100点(受等级影响)持续2回合；若携带者不是主将，使我军主将获得2次抵御(免疫伤害)，持续2回合！'
  },
  {
    id: 'tac_wo_xin_chang_dan',
    name: '卧薪尝胆',
    type: 'active',
    rate: 45,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    damageRate: 0.96,
    desc: '【孙权专属传承】对敌军2人造成兵刃伤害(96%)；自身拥有的连击/洞察/先攻等状态越多，震慑敌方的几率越高(最高75%震慑)！'
  },
  {
    id: 'tac_qing_guo_qing_cheng',
    name: '倾国倾城',
    type: 'active',
    rate: 40,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'debuff',
    requiresPrep: true,
    desc: '【貂蝉专属传承】准备1回合，使敌军群体2人陷入混乱(敌我不分相互攻击)持续2回合；自身为女性时必定混乱2人！'
  }
];

// ================= 战法研习升级系统 (Lv.1 ~ Lv.10) =================
export const MAX_TACTIC_LEVEL = 10;

// 升级消耗铜币阶梯 (Lv.1 -> Lv.2 ... Lv.9 -> Lv.10)
export const TACTIC_UPGRADE_COSTS = {
  1: 500,
  2: 1000,
  3: 1800,
  4: 3000,
  5: 5000,
  6: 8000,
  7: 12000,
  8: 18000,
  9: 26000
};

/**
 * 计算战法在指定等级下的实际战斗属性与威力
 * @param {Object} tactic 原始战法对象
 * @param {number} level 战法等级 (1 ~ 10)
 * @returns {Object} 包含升级后属性的战法对象
 */
export function getTacticEffectiveProps(tactic, level = 1) {
  const lvl = Math.max(1, Math.min(MAX_TACTIC_LEVEL, parseInt(level) || 1));
  const scale = 0.55 + 0.45 * ((lvl - 1) / 9); // Lv.1 为 55% 基础数值，Lv.10 达到 100% 满额

  const effective = { ...tactic, level: lvl };

  // 发动率成长：若指定 baseRate 与 rate (作为满级率)，按区间平滑成长；否则默认每级提升 +1%
  if (tactic.baseRate && tactic.rate && tactic.rate < 100) {
    const rateStep = (tactic.rate - tactic.baseRate) / 9;
    effective.rate = Math.round(tactic.baseRate + rateStep * (lvl - 1));
  } else if (tactic.rate && tactic.rate < 100) {
    effective.rate = Math.min(75, Math.round(tactic.rate - 9 + (lvl * 1)));
  }

  // 伤害率与治疗率成长
  if (tactic.damageRate) {
    effective.damageRate = parseFloat((tactic.damageRate * scale).toFixed(2));
  }
  if (tactic.healRate) {
    effective.healRate = parseFloat((tactic.healRate * scale).toFixed(2));
  }
  if (tactic.damageReduction) {
    effective.damageReduction = parseFloat((tactic.damageReduction * scale).toFixed(2));
  }
  if (tactic.teamDamageReduction) {
    effective.teamDamageReduction = parseFloat((tactic.teamDamageReduction * scale).toFixed(2));
  }
  if (tactic.disarmRate && tactic.disarmRate < 100) {
    effective.disarmRate = Math.min(100, Math.round(tactic.disarmRate * scale));
  }

  return effective;
}

// ================= 武将传承战法谱系 (Hero Inheritance - 100%正版严苛对齐) =================
export const TACTIC_INHERIT_SOURCES = {
  tac_heng_sao_qian_jun: { names: ['关羽', '赵云'], tacticName: '横扫千军' },
  tac_chen_mu_heng_mao: { names: ['张飞'], tacticName: '嗔目横矛' },
  tac_she_zhan_qun_ru: { names: ['诸葛亮'], tacticName: '舌战群儒' },
  tac_meng_zhong_shi_chen: { names: ['曹操'], tacticName: '梦中弑臣' },
  tac_jue_di_fan_ji: { names: ['夏侯惇'], tacticName: '绝地反击' },
  tac_yong_wu_tong_shen: { names: ['司马懿'], tacticName: '用武通神' },
  tac_yong_zhe_de_qian: { names: ['张辽'], tacticName: '勇者得前' },
  tac_feng_zhu_huo_shi: { names: ['周瑜'], tacticName: '风助火势' },
  tac_han_tian_chi_di: { names: ['陆逊'], tacticName: '熯天炽地' },
  tac_zhe_chong_yu_wu: { names: ['太史慈'], tacticName: '折冲御侮' },
  tac_wo_xin_chang_dan: { names: ['孙权'], tacticName: '卧薪尝胆' },
  tac_qing_guo_qing_cheng: { names: ['貂蝉'], tacticName: '倾国倾城' },
  tac_ba_men_jin_suo: { names: ['刘备', '曹仁'], tacticName: '八门金锁阵' },
  tac_yi_qi_dang_qian: { names: ['吕布'], tacticName: '一骑当千' },
  tac_gua_gu_liao_du: { names: ['华佗'], tacticName: '刮骨疗毒' },
  tac_wan_jian_qi_fa: { names: ['黄忠'], tacticName: '万箭齐发' },
  tac_chen_sha_jue_shui: { names: ['法正', '郭嘉'], tacticName: '沉沙决水' },
  tac_po_zhen_cui_jian: { names: ['孙策', '庞统'], tacticName: '破阵摧坚' },
  tac_shi_bie_san_ri: { names: ['吕蒙'], tacticName: '士别三日' },
  tac_bei_she_gui_che: { names: ['左慈'], tacticName: '杯蛇鬼车' },
  tac_huang_tian_tai_ping: { names: ['张角'], tacticName: '黄天泰平' },
  tac_bao_li_wu_ren: { names: ['董卓'], tacticName: '暴戾无仁' },
  tac_yi_li_ju_shou: { names: ['典韦'], tacticName: '一力拒守' },
  tac_shou_er_bi_gu: { names: ['程昱'], tacticName: '守而必固' },
  tac_he_jun_ju_zhong: { names: ['袁绍'], tacticName: '合军聚众' },
  tac_bai_lian_cheng_gang: { names: ['甘宁', '鲁肃'], tacticName: '百炼成钢' },
  tac_yu_di_ping_zhang: { names: ['郭淮', '孙静', '刘禅'], tacticName: '御敌屏障' },
  tac_zuo_you_kai_gong: { names: ['韩当'], tacticName: '左右开弓' },
  tac_yao_shu: { names: ['张宝'], tacticName: '妖术' },
  tac_suo_xiang_pi_mi: { names: ['许褚', '马超'], tacticName: '所向披靡' },
  tac_sheng_qi_ling_di: { names: ['颜良', '曹丕'], tacticName: '盛气凌敌' },
  tac_bai_ma_yi_cong: { names: ['公孙瓒'], tacticName: '白马义从' },
  tac_zi_yu: { names: ['潘凤', '廖化', '董袭'], tacticName: '自愈' },
  tac_shou_qi_dao_luo: { names: ['曹休', '文丑'], tacticName: '手起刀落' },
  tac_fen_fa: { names: ['关平', '朱儁'], tacticName: '奋发' }
};

// 武将名字快速索引对应传承战法 (100% 严苛对齐官方)
export const HERO_INHERIT_MAP = {
  // 蜀国
  '关羽': 'tac_heng_sao_qian_jun',
  '赵云': 'tac_heng_sao_qian_jun',
  '张飞': 'tac_chen_mu_heng_mao',
  '诸葛亮': 'tac_she_zhan_qun_ru',
  '刘备': 'tac_ba_men_jin_suo',
  '马超': 'tac_suo_xiang_pi_mi',
  '黄忠': 'tac_wan_jian_qi_fa',
  '法正': 'tac_chen_sha_jue_shui',
  '庞统': 'tac_po_zhen_cui_jian',
  '关平': 'tac_fen_fa',
  '刘禅': 'tac_yu_di_ping_zhang',
  '廖化': 'tac_zi_yu',

  // 魏国
  '曹操': 'tac_meng_zhong_shi_chen',
  '夏侯惇': 'tac_jue_di_fan_ji',
  '司马懿': 'tac_yong_wu_tong_shen',
  '张辽': 'tac_yong_zhe_de_qian',
  '郭嘉': 'tac_chen_sha_jue_shui',
  '程昱': 'tac_shou_er_bi_gu',
  '典韦': 'tac_yi_li_ju_shou',
  '许褚': 'tac_suo_xiang_pi_mi',
  '郭淮': 'tac_yu_di_ping_zhang',
  '曹休': 'tac_shou_qi_dao_luo',

  // 吴国
  '周瑜': 'tac_feng_zhu_huo_shi',
  '陆逊': 'tac_han_tian_chi_di',
  '太史慈': 'tac_zhe_chong_yu_wu',
  '孙权': 'tac_wo_xin_chang_dan',
  '甘宁': 'tac_bai_lian_cheng_gang',
  '吕蒙': 'tac_shi_bie_san_ri',
  '孙策': 'tac_po_zhen_cui_jian',
  '鲁肃': 'tac_bai_lian_cheng_gang',
  '韩当': 'tac_zuo_you_kai_gong',
  '孙静': 'tac_yu_di_ping_zhang',

  // 群雄
  '吕布': 'tac_yi_qi_dang_qian',
  '貂蝉': 'tac_qing_guo_qing_cheng',
  '华佗': 'tac_gua_gu_liao_du',
  '张角': 'tac_huang_tian_tai_ping',
  '袁绍': 'tac_he_jun_ju_zhong',
  '左慈': 'tac_bei_she_gui_che',
  '董卓': 'tac_bao_li_wu_ren',
  '张宝': 'tac_yao_shu',
  '潘凤': 'tac_zi_yu',
  '朱儁': 'tac_fen_fa'
};

export function getHeroInheritTacticId(hero) {
  if (!hero) return null;
  return hero.inheritedTacticId || HERO_INHERIT_MAP[hero.name] || 'tac_fen_fa';
}
