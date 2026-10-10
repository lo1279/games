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
    damageReduction: 0.40,
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
    damageReduction: 0.50,
    firstRounds: 2,
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
    damageReduction: 0.42,
    healRate: 1.0,
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
    id: 'tac_xing_yun_bu_yu',
    name: '兴云布雨',
    type: 'command',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 0.72,
    desc: '【于吉专属自带】战斗第2回合起，使敌军全体陷入【水攻】状态，每回合受到持续谋略伤害(伤害率72%)，并使其受到的谋略伤害提升15%，持续全场！'
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

  // ================= 新增五星橙将专属战法 =================
  {
    id: 'tac_qi_bing_jian_dao',
    name: '奇兵间道',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【魏延自带】自身发动需要准备的战法时，有75%概率跳过1回合准备直接释放！爆发战术天花板。',
    skipPrepChance: 0.75
  },
  {
    id: 'tac_yi_dan_xiong_xin',
    name: '义胆雄心',
    type: 'passive',
    rate: 100,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'mixed',
    desc: '【姜维自带】战斗中奇数回合对敌军单体造成兵刃伤害(184%)并降低其64点统率；偶数回合造成谋略伤害(184%)并降低其64点智力！'
  },
  {
    id: 'tac_chu_zi_bu_huo',
    name: '处兹不惑',
    type: 'active',
    rate: 35,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.15,
    desc: '【徐庶自带】对敌军群体(2人)分别判定：有70%概率陷入灼烧、中毒、溃逃状态持续2回合(每回合各造成115%伤害)！'
  },
  {
    id: 'tac_jiang_men_hu_nv',
    name: '将门虎女',
    type: 'active',
    rate: 60,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.28,
    desc: '【关银屏自带】对敌军群体2人造成兵刃伤害(128%)并施加【虎嗔】状态；目标受到3次伤害即刻引爆并陷入【震慑】1回合！'
  },
  {
    id: 'tac_lin_zhan_xian_deng',
    name: '临战先登',
    type: 'active',
    rate: 100,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.35,
    desc: '【乐进自带】100%发动！对敌军群体2人造成狂暴兵刃斩击(伤害率135%)，随后自身进入虚弱状态1回合(无法造成普攻伤害)。'
  },
  {
    id: 'tac_da_ji_shi',
    name: '大戟士',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'physical',
    armReq: 'spear',
    desc: '【张郃专属·枪兵进阶】我军全体进行普通攻击时，有35%几率对敌军单体追加一次猛烈兵刃突刺(伤害率122%)！'
  },
  {
    id: 'tac_gu_ruo_jin_tang',
    name: '固若金汤',
    type: 'active',
    rate: 45,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【曹仁自带】嘲讽敌军全体迫使其普通攻击自身，同时自身统率暴涨150点并获得【洞察】(免疫所有控制)，持续2回合！'
  },
  {
    id: 'tac_jiang_xing_qi_ji',
    name: '将行其疾',
    type: 'assault',
    rate: 60,
    target: 'attack_target',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.80,
    desc: '【夏侯渊自带】普通攻击后，对目标造成一次极速兵刃袭击(伤害率180%)；若命中敌方主将，则额外使其陷入【计穷】2回合！'
  },
  {
    id: 'tac_rou_shen_tie_bi',
    name: '肉身铁壁',
    type: 'passive',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    shareDamageRate: 0.40,
    teamDamageBonus: 0.30,
    desc: '【周泰自带】替我军全体承担40%所受伤害；只要周泰兵力高于30%，使全队造成的伤害提升30%！'
  },
  {
    id: 'tac_gong_yao_ji',
    name: '弓腰姬',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '【孙尚香自带】普通攻击前，对敌军单体发动兵刃重击(122%)；自身每拥有一层增益状态，兵刃伤害额外提高20%并提升武力！'
  },
  {
    id: 'tac_guo_shi_zhi_feng',
    name: '国士之风',
    type: 'command',
    rate: 100,
    target: 'friendly_2',
    quality: 'S',
    damageType: 'buff',
    desc: '【凌统自带】战斗前3回合使自身及随机友军获得【先攻】与【必中】(完全无视敌方规避)，且造成的伤害提升28%！'
  },
  {
    id: 'tac_yong_lie_chi_zhong',
    name: '勇烈持重',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【程普自带】受到伤害时，有35%几率立即净化自身所有负面状态，并使敌军随机单体陷入【震慑】(无法行动)1回合！'
  },
  {
    id: 'tac_shen_ji_mo_ce',
    name: '神机莫测',
    type: 'active',
    rate: 65,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.75,
    desc: '【贾诩自带】使敌军单体陷入【混乱】2回合；对已混乱的目标额外造成175%极刑谋略重创，全场乱武！'
  },
  {
    id: 'tac_fu_ming_zi_li',
    name: '符命自立',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【袁术自带】前2回合自身主动战法与突击战法发动几率提高25%，会心与奇谋几率提高25%！爆发毁天灭地。'
  },
  {
    id: 'tac_huo_shen_ning_shang',
    name: '火神宁墒',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'heal',
    healRate: 1.58,
    desc: '【祝融夫人自带】战斗中自身免疫灼烧；第3~5回合每回合普通攻击后，为我军全体恢复巨量兵力(治疗率158%)！'
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
    statDebuff: 80,
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
    damageRate: 1.80,
    statBuff: 68,
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
    id: 'tac_tai_ping_dao_fa',
    name: '太平道法',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【张角/于吉传承】获得28%奇谋几率(谋略伤害造成200%暴击)；并使自身自带主动战法发动率提高12%！'
  },
  {
    id: 'tac_teng_jia_bing',
    name: '藤甲兵',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    damageReduction: 0.40,
    desc: '【兀突骨/群雄传承·盾兵专属】我军全体受到兵刃伤害降低40%(受统率影响)；但处于灼烧状态时，每回合受到大量火攻伤害！'
  },
  {
    id: 'tac_feng_shi_zhen',
    name: '锋矢阵',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    damageBonus: 0.30,
    damageReduction: 0.15,
    desc: '【典韦传承·阵法】战斗中，使我军主将造成伤害提升30%，受到伤害提升20%；副将造成伤害降低15%，受到伤害降低25%！'
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
    statBuff: 42,
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
    statBuff: 40,
    desc: '【程昱/程普传承】战斗开始前4回合，嘲讽敌军主将迫使其普通攻击自身，并提高自身统率40点！'
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
    statBuff: 36,
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
  {
    id: 'tac_luo_feng',
    name: '落凤',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'A',
    damageType: 'physical',
    damageRate: 2.50,
    desc: '对随机敌军单体造成猛烈兵刃打击(伤害率250%)，并使其陷入计穷状态(无法发动主动战法)持续1回合！A级输出强控天花板。',
    debuff: { type: 'silence', duration: 1 }
  },
  {
    id: 'tac_zong_bing_jie_lue',
    name: '纵兵劫掠',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'A',
    damageType: 'physical',
    damageRate: 1.72,
    desc: '对敌军单体造成兵刃攻击(伤害率172%)，并使其陷入震慑状态(无法行动)持续1回合！控制流神技。',
    debuff: { type: 'stun', duration: 1 }
  },
  {
    id: 'tac_bi_shi_ji_xu',
    name: '避实击虚',
    type: 'active',
    rate: 40,
    target: 'enemy_weakest_command',
    quality: 'A',
    damageType: 'physical',
    damageRate: 1.85,
    desc: '对统率最低的敌军单体发动精准兵刃打击(伤害率185%)！点杀破防神技。'
  },
  {
    id: 'tac_qing_yong_fei_yan',
    name: '轻勇飞燕',
    type: 'active',
    rate: 40,
    target: 'random_hits',
    quality: 'A',
    damageType: 'physical',
    damageRate: 0.84,
    randomHits: [2, 4],
    desc: '对敌军随机单体发动2~4次迅猛兵刃打击(每次伤害率84%)，多段爆发输出极高！'
  },
  {
    id: 'tac_qiang_gong',
    name: '强攻',
    type: 'active',
    rate: 45,
    target: 'self',
    quality: 'A',
    damageType: 'buff',
    desc: '使自身进入连击状态(每回合进行2次普通攻击)，持续1回合！突击武将核心发动机。'
  },
  {
    id: 'tac_wan_gong_yin_yu',
    name: '弯弓饮羽',
    type: 'assault',
    rate: 40,
    target: 'attack_target',
    quality: 'A',
    damageType: 'debuff',
    statDebuff: 150,
    desc: '普通攻击后，使目标统率降低150点持续2回合，并使其陷入计穷状态(无法发动主动战法)持续1回合！'
  },
  {
    id: 'tac_zuo_shou_gu_cheng',
    name: '坐守孤城',
    type: 'active',
    rate: 45,
    target: 'friendly_2',
    quality: 'A',
    damageType: 'heal',
    healRate: 1.16,
    desc: '恢复我军群体(2人)兵力(治疗率116%，受智力影响)。A级泛用最强群体治疗战法！'
  },
  {
    id: 'tac_liao_shi_ru_shen',
    name: '料事如神',
    type: 'active',
    rate: 35,
    target: 'enemy_2',
    quality: 'A',
    damageType: 'tactical',
    damageRate: 1.06,
    damageReduction: 0.16,
    desc: '对敌军群体(2人)造成谋略伤害(伤害率106%，受智力影响)，并使其造成的伤害降低16%持续2回合。'
  },
  {
    id: 'tac_ji_lue_zong_heng',
    name: '机略纵横',
    type: 'active',
    rate: 45,
    target: 'enemy_2',
    quality: 'A',
    damageType: 'tactical',
    requiresPrep: true,
    damageRate: 0.58,
    desc: '准备1回合，使敌军群体(2人)陷入灼烧与中毒状态持续2回合(每回合造成灼烧与中毒伤害各58%，受智力影响)。'
  },
  {
    id: 'tac_qian_li_chi_yuan',
    name: '千里驰援',
    type: 'active',
    rate: 40,
    target: 'self',
    quality: 'A',
    damageType: 'buff',
    desc: '提高自身40点统率，并为友军全体承担所有普通攻击(援护状态)，持续1回合！'
  },
  {
    id: 'tac_bai_mei',
    name: '白眉',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'A',
    damageType: 'buff',
    desc: '战斗中使自身所有主动战法的发动几率提高12%！主动战法爆发流核心被动。',
    activeRateBonus: 12
  },
  {
    id: 'tac_bao_lian_si_fang',
    name: '暴敛四方',
    type: 'active',
    rate: 45,
    target: 'enemy_2',
    quality: 'A',
    damageType: 'physical',
    damageRate: 1.02,
    desc: '对敌军群体(2人)造成兵刃攻击(伤害率102%)；若目标处于震慑状态，则额外使其陷入禁疗持续2回合。'
  },
  {
    id: 'tac_zhen_ya_huang_jin',
    name: '镇压黄巾',
    type: 'command',
    rate: 100,
    target: 'enemy_all',
    quality: 'A',
    damageType: 'tactical',
    damageRate: 0.88,
    triggerRounds: [2, 3],
    desc: '【朱儁专属】战斗第2、3回合使敌军全体陷入溃逃状态(每回合造成88%无视防御谋略真伤)，且自身免疫叛逃！'
  },
  {
    id: 'tac_tian_jiang_fu_yu',
    name: '天降覆雨',
    type: 'active',
    rate: 40,
    target: 'enemy_2',
    quality: 'A',
    damageType: 'physical',
    requiresPrep: true,
    damageRate: 1.10,
    desc: '【蒋钦专属】准备1回合，对敌军群体(2人)造成兵刃打击(110%)，并附带灼烧状态持续1回合(造成66%谋略伤害)。'
  },
  {
    id: 'tac_cuo_zhi_nu_xi',
    name: '挫志怒袭',
    type: 'active',
    rate: 35,
    target: 'enemy_2',
    quality: 'A',
    damageType: 'debuff',
    requiresPrep: true,
    desc: '【曹彰专属】准备1回合，使敌军群体(2人)陷入虚弱状态(无法造成任何伤害)持续1回合；若目标已处于虚弱则造成猛烈兵刃反噬！'
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
    statBuff: 50,
    damageRate: 0.70,
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
    statDebuff: 10,
    activeRateBonus: 5,
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
    statBuff: 40,
    damageRate: 1.05,
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
    damageRate: 2.80,
    statBuff: 6,
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
    damageRate: 1.65,
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
    damageBonus: 0.80,
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
  },

  // ================= 2026 年度巅峰扩充：官方核心流派战法 =================
  // --- 突击战法大核 ---
  {
    id: 'tac_dang_feng_cui_jue',
    name: '当锋摧决',
    type: 'assault',
    rate: 35,
    target: 'attack_target',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.82,
    desc: '【三战第一神技·颜良传承】普通攻击后，对目标造成一次谋略攻击(伤害率182%)，并对其施加【伪报】状态(禁用目标所有指挥战法与被动战法)持续1回合！'
  },
  {
    id: 'tac_bai_qi_jie_ying',
    name: '百骑劫营',
    type: 'assault',
    rate: 40,
    target: 'attack_target',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.52,
    desc: '【甘宁专属传承】普通攻击后，对目标造成一次猛烈兵刃攻击(伤害率152%)；自身为主将时，有50%几率对敌军主将追加一次斩首兵刃打击(伤害率118%)！'
  },
  {
    id: 'tac_gui_shen_ting_wei',
    name: '鬼神霆威',
    type: 'assault',
    rate: 35,
    target: 'attack_target',
    quality: 'S',
    damageType: 'physical',
    damageRate: 2.04,
    desc: '【吕布专属传承】普通攻击后，对目标造成一次狂暴兵刃斩击(伤害率204%)；若目标兵力低于50%，额外提高伤害率(最高可达306%)，绝命斩杀！'
  },
  {
    id: 'tac_ke_di_zhi_sheng',
    name: '克敌制胜',
    type: 'assault',
    rate: 40,
    target: 'attack_target',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 1.80,
    desc: '【程普传承】普通攻击后，对目标造成一次谋略攻击(伤害率180%)；若目标处于溃逃、水攻或中毒状态，有70%几率使其陷入【虚弱】1回合！'
  },

  // --- 特殊兵种进阶 ---
  {
    id: 'tac_hu_bao_qi',
    name: '虎豹骑',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    armReq: 'cavalry',
    damageType: 'buff',
    statBuff: 40,
    assaultRateBonus: 10,
    desc: '【曹纯专属传承·骑兵进阶】将骑兵进阶为虎豹骑。战斗前3回合，使我军全体突击战法发动几率提高10%，且武力提高40点！突击骑核心发动机。'
  },
  {
    id: 'tac_xi_liang_tie_qi',
    name: '西凉铁骑',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    armReq: 'cavalry',
    damageType: 'buff',
    critRateBonus: 0.25,
    desc: '【马腾专属传承·骑兵进阶】将骑兵进阶为西凉铁骑。战斗前3回合，使我军全体获得25%【会心暴击率】(兵刃伤害造成150%~200%暴击)！核弹爆发必备。'
  },
  {
    id: 'tac_jin_fan_jun',
    name: '锦帆军',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    armReq: 'bow',
    damageType: 'mixed',
    desc: '【甘宁专属进阶·弓兵进阶】将弓兵进阶为锦帆贼。全军普通攻击命中时有40%几率对目标施加溃逃伤害(伤害率64%持续2回合)；若目标已溃逃，则造成兵刃斩杀并恢复自身兵力！'
  },
  {
    id: 'tac_xian_zhen_ying',
    name: '陷阵营',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    armReq: 'shield',
    damageType: 'heal',
    statBuff: 30,
    desc: '【高顺专属自带·盾兵进阶】将盾兵进阶为陷阵营。使我军全体统率与武力提高30点；战斗前3回合受到伤害时有35%几率获得急救恢复兵力(治疗率60%)！'
  },
  {
    id: 'tac_bai_er_bing',
    name: '白毦兵',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    armReq: 'spear',
    damageType: 'tactical',
    desc: '【陈到专属自带·枪兵进阶】将枪兵进阶为白毦兵。我军全体普通攻击后，有40%几率对目标追加一次猛烈谋略攻击(伤害率110%，受智力影响)！蜀智法枪核心。'
  },

  // --- 灵魂阵法大核 ---
  {
    id: 'tac_san_shi_zhen',
    name: '三势阵',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '【跨阵营组队灵魂·阵法】我军三名武将阵营各不相同时生效：战斗前5回合，使我军主将自带主动战法发动几率提高16%；每回合行动前，使损失兵力较多的副将受到的伤害降低30%，另一副将造成的伤害提高25%！'
  },

  // --- 新增名将专属自带战法 ---
  {
    id: 'tac_gong_shen',
    name: '工神',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    damageBonus: 0.30,
    desc: '【黄月英自带】战斗前3回合，使我军全体获得【先攻】状态(优先出手)，且造成的所有伤害提升30%；第4回合起造成的伤害降低15%，持续全场。快攻核弹核心！'
  },
  {
    id: 'tac_bu_lao_chang_qiang',
    name: '不老长枪',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【严颜自带】战斗中受到伤害时，有35%几率使敌军群体(2人)陷入【计穷】1回合，并使我军主将获得【洞察】(免受所有控制)持续2回合！'
  },
  {
    id: 'tac_chi_mu_hu_wen',
    name: '鸱目虎吻',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    desc: '【马云禄自带】自身普通攻击造成的伤害随目标已损失兵力百分比提高(最高提高100%)；第5回合起普通攻击必定锁定敌军兵力最低的单体，残血收割之王！'
  },
  {
    id: 'tac_jin_cheng_tang_chi',
    name: '金城汤池',
    type: 'passive',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'mixed',
    desc: '【郝昭自带】战斗中无法进行普通攻击；第1、3、5、7回合恢复我军群体(2人)兵力(治疗率98%)；第2、4、6、8回合对敌军全体施加无视防御的烈火灼烧真实谋略伤害(伤害率102%)！'
  },
  {
    id: 'tac_zhen_e_fang_ju',
    name: '镇扼防拒',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '【满宠自带】每回合有50%几率使我军副将替全体友军承担所有普通攻击(援护状态)；且该副将受到伤害时有50%几率驱散攻击者全部增益状态并为我军恢复兵力！'
  },
  {
    id: 'tac_chang_qu_zhi_ru',
    name: '长驱直入',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    desc: '【徐晃自带】自身每次造成兵刃伤害后，使自身造成的兵刃伤害提升15%，最高叠加5层(累计提升75%兵刃伤害)！越战越强的物理重炮。'
  },
  {
    id: 'tac_ji_jian_xian_shi',
    name: '机鉴先识',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '【荀彧自带】王佐之才！战斗前4回合使我军全体获得【警戒】状态(受到的伤害降低50%)，每人最多生效4次；且受击时有40%几率对攻击者造成强力谋略反噬伤害！'
  },
  {
    id: 'tac_jiang_dong_meng_hu',
    name: '江东猛虎',
    type: 'active',
    rate: 50,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.26,
    desc: '【孙坚自带】对敌军群体(2人)造成强力兵刃打击(伤害率126%)，并强行嘲讽目标使其普通攻击自身，持续2回合！'
  },
  {
    id: 'tac_xiao_sheng_wei_wo',
    name: '校胜帷幄',
    type: 'passive',
    rate: 100,
    target: 'friendly_leader',
    quality: 'S',
    damageType: 'buff',
    desc: '【陆抗自带】战斗中使我军主将奇谋几率提高20%，奇谋暴击伤害提高35%；且陆抗自身替主将分担30%所受到的伤害！都督核心挂件。'
  },
  {
    id: 'tac_ku_rou_ji',
    name: '苦肉计',
    type: 'active',
    rate: 55,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'debuff',
    desc: '【黄盖自带】消耗自身10%当前兵力，使敌军单体陷入【混乱】与【烈火灼烧】状态(每回合造成78%谋略伤害)，持续2回合！'
  },
  {
    id: 'tac_guo_se_tian_xiang',
    name: '国色天香',
    type: 'passive',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'heal',
    healRate: 1.08,
    desc: '【大乔自带】受到伤害时，有50%几率随机治愈一名友军(治疗率108%，受智力影响)，并使该友军受到的下一次伤害降低30%！'
  },
  {
    id: 'tac_jian_tong_zhen_jun',
    name: '监统震军',
    type: 'command',
    rate: 100,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'buff',
    desc: '【沮授自带】我军友军对敌军施加负面状态(震慑/缴械/计穷/虚弱/混乱/灼烧/水攻/中毒等)时，有65%几率使其持续时间额外延长1回合！群弓控场核心。'
  },
  {
    id: 'tac_deng_feng_xian_zhen',
    name: '登锋陷阵',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'physical',
    damageRate: 2.08,
    statDebuff: 65,
    desc: '【文丑自带】对敌军单体造成猛烈兵刃重击(伤害率208%)，使其统率大幅削减65点持续2回合，并使自身获得1次【抵御】！'
  },
  {
    id: 'tac_nan_man_qu_kui',
    name: '南蛮渠魁',
    type: 'command',
    rate: 100,
    target: 'enemy_all',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.06,
    desc: '【孟获自带】每回合行动时有28%基础几率对敌军全体发动兵刃猛攻(伤害率106%)；自身每次受到兵刃或谋略伤害，发动几率提高8%，触发后重置！'
  },

  // --- 顶级泛用传承战法 ---
  {
    id: 'tac_cao_chuan_jie_jian',
    name: '草船借箭',
    type: 'active',
    rate: 65,
    target: 'friendly_all',
    quality: 'S',
    damageType: 'heal',
    cleanse: true,
    desc: '【三战第一解控神技·周瑜传承】为我军群体(2~3人)清除所有负面状态与控制，并施加【急救】状态(持续2回合，受到伤害时有70%几率按该次伤害量的35%恢复兵力)！'
  },
  {
    id: 'tac_fu_ji_jun_min',
    name: '抚辑军民',
    type: 'command',
    rate: 100,
    target: 'friendly_2',
    quality: 'S',
    damageType: 'buff',
    damageReduction: 0.40,
    healRate: 1.26,
    desc: '【刘备/鲁肃专属传承】战斗前3回合，使我军群体(2人)受到的所有兵刃与谋略伤害降低40%(受统率加成)；第4回合为该目标恢复巨量兵力(治疗率126%)！'
  },
  {
    id: 'tac_wen_wu_shuang_quan',
    name: '文武双全',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'buff',
    statBuff: 30,
    desc: '【钟会/邓艾传承】战斗中每次造成兵刃伤害提高自身武力30点(最多叠加5层)，每次造成谋略伤害提高自身智力30点(最多叠加5层)！最高可叠150点双属性。'
  },
  {
    id: 'tac_shi_zheng_xian_fu',
    name: '士争先赴',
    type: 'passive',
    rate: 100,
    target: 'self',
    quality: 'S',
    damageType: 'physical',
    damageRate: 1.20,
    activeDamageBonus: 0.20,
    desc: '【乐进/张辽传承】提高自身自带主动战法造成的伤害20%；且每次发动自带主动战法前，有50%几率对敌军全体造成一次狂暴兵刃轰击(伤害率120%)！'
  },
  {
    id: 'tac_yan_zhu_feng_fei',
    name: '焰逐风飞',
    type: 'active',
    rate: 35,
    target: 'enemy_single',
    quality: 'S',
    damageType: 'tactical',
    damageRate: 2.26,
    tacticalDebuff: 0.20,
    desc: '【陆抗传承】对敌军单体造成毁灭性谋略打击(伤害率226%)，使其陷入【震慑】(无法行动)1回合，并使其受到的谋略伤害提升20%持续2回合！'
  },
  {
    id: 'tac_jue_qi_ji_dao',
    name: '绝其汲道',
    type: 'active',
    rate: 45,
    target: 'enemy_2',
    quality: 'S',
    damageType: 'physical',
    requiresPrep: true,
    damageRate: 1.62,
    cannotHeal: true,
    desc: '【魏延传承】准备1回合，对敌军群体(2~3人)发动猛烈兵刃劈击(伤害率162%)，并使其陷入【禁疗】状态(无法恢复兵力)持续2回合！'
  },
  {
    id: 'tac_ying_cheng_zi_shou',
    name: '婴城自守',
    type: 'active',
    rate: 50,
    target: 'friendly_2',
    quality: 'S',
    damageType: 'heal',
    healRate: 1.80,
    desc: '【审配/曹仁传承】恢复我军群体(2人)兵力(治疗率180%，受智力加成)，并为其施加持续1回合的休整状态(每回合恢复兵力62%)！'
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

  const effective = { ...tactic, level: lvl, scale };

  // 发动率成长：若指定 baseRate 与 rate (作为满级率)，按区间平滑成长；否则默认每级提升 +1%
  if (tactic.baseRate && tactic.rate && tactic.rate < 100) {
    const rateStep = (tactic.rate - tactic.baseRate) / 9;
    effective.rate = Math.round(tactic.baseRate + rateStep * (lvl - 1));
  } else if (tactic.rate && tactic.rate < 100) {
    effective.rate = Math.min(75, Math.round(tactic.rate - 9 + (lvl * 1)));
  }

  // 伤害率与治疗率成长（含自带战法专属溅射、急救、灼烧率）
  if (tactic.damageRate) {
    effective.damageRate = parseFloat((tactic.damageRate * scale).toFixed(2));
  }
  if (tactic.healRate) {
    effective.healRate = parseFloat((tactic.healRate * scale).toFixed(2));
  }
  if (tactic.emergencyHealRate) {
    effective.emergencyHealRate = parseFloat((tactic.emergencyHealRate * scale).toFixed(2));
  }
  if (tactic.splashRate) {
    effective.splashRate = parseFloat((tactic.splashRate * scale).toFixed(2));
  }
  if (tactic.burnDamage) {
    effective.burnDamage = parseFloat((tactic.burnDamage * scale).toFixed(2));
  }
  if (tactic.damageReduction) {
    effective.damageReduction = parseFloat((tactic.damageReduction * scale).toFixed(2));
  }
  if (tactic.teamDamageReduction) {
    effective.teamDamageReduction = parseFloat((tactic.teamDamageReduction * scale).toFixed(2));
  }
  if (tactic.selfDamageReduction) {
    effective.selfDamageReduction = parseFloat((tactic.selfDamageReduction * scale).toFixed(2));
  }
  if (tactic.teamDamageBonus) {
    effective.teamDamageBonus = parseFloat((tactic.teamDamageBonus * scale).toFixed(2));
  }
  if (tactic.shareDamageRate) {
    effective.shareDamageRate = parseFloat((tactic.shareDamageRate * scale).toFixed(2));
  }
  if (tactic.critRateBonus) {
    effective.critRateBonus = parseFloat((tactic.critRateBonus * scale).toFixed(2));
  }
  if (tactic.disarmRate && tactic.disarmRate < 100) {
    effective.disarmRate = Math.min(100, Math.round(tactic.disarmRate * scale));
  }
  if (tactic.counterActiveRate) {
    effective.counterActiveRate = Math.round(tactic.counterActiveRate * scale);
  }
  if (tactic.retaliateRate) {
    effective.retaliateRate = Math.round(tactic.retaliateRate * scale);
  }
  if (tactic.lockLeaderRate) {
    effective.lockLeaderRate = Math.round(tactic.lockLeaderRate * scale);
  }
  if (tactic.assaultRateBonus) {
    effective.assaultRateBonus = Math.round(tactic.assaultRateBonus * scale);
  }

  // 全维属性与战斗增减益成长 (四舍五入或保留两位小数)
  if (tactic.statBuff) {
    // 若基础数值较小(如绝地反击武力每层6点)，按保留1位小数计算，避免四舍五入过早失真
    effective.statBuff = tactic.statBuff <= 10 
      ? parseFloat((tactic.statBuff * scale).toFixed(1)) 
      : Math.round(tactic.statBuff * scale);
  }
  if (tactic.statDebuff) {
    effective.statDebuff = Math.round(tactic.statDebuff * scale);
  }
  if (tactic.damageBonus) {
    effective.damageBonus = parseFloat((tactic.damageBonus * scale).toFixed(2));
  }
  if (tactic.activeRateBonus) {
    effective.activeRateBonus = Math.round(tactic.activeRateBonus * scale);
  }
  if (tactic.statBoost) {
    effective.statBoost = Math.round(tactic.statBoost * scale);
  }
  if (tactic.statBoostForce) {
    effective.statBoostForce = Math.round(tactic.statBoostForce * scale);
  }
  if (tactic.statBoostCmd) {
    effective.statBoostCmd = Math.round(tactic.statBoostCmd * scale);
  }
  if (tactic.statBoostSpeed) {
    effective.statBoostSpeed = Math.round(tactic.statBoostSpeed * scale);
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
  tac_tai_ping_dao_fa: { names: ['张角', '于吉'], tacticName: '太平道法' },
  tac_teng_jia_bing: { names: ['兀突骨'], tacticName: '藤甲兵' },
  tac_feng_shi_zhen: { names: ['典韦'], tacticName: '锋矢阵' },
  tac_huang_tian_tai_ping: { names: ['张角'], tacticName: '黄天泰平' },
  tac_bao_li_wu_ren: { names: ['董卓'], tacticName: '暴戾无仁' },
  tac_yi_li_ju_shou: { names: ['典韦'], tacticName: '一力拒守' },
  tac_shou_er_bi_gu: { names: ['程昱', '程普'], tacticName: '守而必固' },
  tac_he_jun_ju_zhong: { names: ['袁绍'], tacticName: '合军聚众' },
  tac_bai_lian_cheng_gang: { names: ['甘宁', '鲁肃'], tacticName: '百炼成钢' },
  tac_yu_di_ping_zhang: { names: ['郭淮', '孙静', '刘禅'], tacticName: '御敌屏障' },
  tac_zuo_you_kai_gong: { names: ['韩当'], tacticName: '左右开弓' },
  tac_yao_shu: { names: ['张宝'], tacticName: '妖术' },
  tac_suo_xiang_pi_mi: { names: ['许褚', '马超'], tacticName: '所向披靡' },
  tac_sheng_qi_ling_di: { names: ['颜良', '曹丕'], tacticName: '盛气凌敌' },
  tac_bai_ma_yi_cong: { names: ['公孙瓒'], tacticName: '白马义从' },
  tac_zi_yu: { names: ['廖化', '董袭'], tacticName: '自愈' },
  tac_shou_qi_dao_luo: { names: ['文聘', '曹休'], tacticName: '手起刀落' },
  tac_fen_fa: { names: ['关平'], tacticName: '奋发' },
  tac_luo_feng: { names: ['张任'], tacticName: '落凤' },
  tac_zong_bing_jie_lue: { names: ['周仓'], tacticName: '纵兵劫掠' },
  tac_bi_shi_ji_xu: { names: ['徐盛', '臧霸'], tacticName: '避实击虚' },
  tac_qing_yong_fei_yan: { names: ['文丑'], tacticName: '轻勇飞燕' },
  tac_qiang_gong: { names: ['简雍', '纪灵'], tacticName: '强攻' },
  tac_wan_gong_yin_yu: { names: ['沙摩柯'], tacticName: '弯弓饮羽' },
  tac_zuo_shou_gu_cheng: { names: ['审配'], tacticName: '坐守孤城' },
  tac_liao_shi_ru_shen: { names: ['刘晔'], tacticName: '料事如神' },
  tac_ji_lue_zong_heng: { names: ['黄权'], tacticName: '机略纵横' },
  tac_qian_li_chi_yuan: { names: ['朱桓'], tacticName: '千里驰援' },
  tac_bai_mei: { names: ['潘凤', '白眉'], tacticName: '白眉' },
  tac_bao_lian_si_fang: { names: ['郭汜'], tacticName: '暴敛四方' },
  tac_tian_jiang_fu_yu: { names: ['蒋钦'], tacticName: '天降覆雨' },
  tac_cuo_zhi_nu_xi: { names: ['曹彰'], tacticName: '挫志怒袭' }
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
  '周仓': 'tac_zong_bing_jie_lue',
  '沙摩柯': 'tac_wan_gong_yin_yu',
  '魏延': 'tac_po_zhen_cui_jian',
  '姜维': 'tac_ba_men_jin_suo',
  '徐庶': 'tac_chen_sha_jue_shui',
  '关银屏': 'tac_heng_sao_qian_jun',
  '黄月英': 'tac_gong_shen',
  '严颜': 'tac_bu_lao_chang_qiang',
  '陈到': 'tac_bai_er_bing',
  '马云禄': 'tac_chi_mu_hu_wen',

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
  '曹彰': 'tac_cuo_zhi_nu_xi',
  '文聘': 'tac_shou_qi_dao_luo',
  '臧霸': 'tac_bi_shi_ji_xu',
  '乐进': 'tac_feng_fa',
  '张郃': 'tac_da_ji_shi',
  '曹仁': 'tac_ba_men_jin_suo',
  '夏侯渊': 'tac_wan_jian_qi_fa',
  '郝昭': 'tac_jin_cheng_tang_chi',
  '满宠': 'tac_zhen_e_fang_ju',
  '徐晃': 'tac_chang_qu_zhi_ru',
  '荀彧': 'tac_ji_jian_xian_shi',

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
  '蒋钦': 'tac_tian_jiang_fu_yu',
  '徐盛': 'tac_bi_shi_ji_xu',
  '朱桓': 'tac_qian_li_chi_yuan',
  '周泰': 'tac_rou_shen_tie_bi',
  '孙尚香': 'tac_jie_meng',
  '凌统': 'tac_yong_zhe_de_qian',
  '程普': 'tac_shou_er_bi_gu',
  '孙坚': 'tac_jiang_dong_meng_hu',
  '陆抗': 'tac_yan_zhu_feng_fei',
  '黄盖': 'tac_ku_rou_ji',
  '大乔': 'tac_guo_se_tian_xiang',

  // 群雄
  '吕布': 'tac_yi_qi_dang_qian',
  '貂蝉': 'tac_qing_guo_qing_cheng',
  '华佗': 'tac_gua_gu_liao_du',
  '张角': 'tac_tai_ping_dao_fa',
  '于吉': 'tac_tai_ping_dao_fa',
  '袁绍': 'tac_he_jun_ju_zhong',
  '左慈': 'tac_bei_she_gui_che',
  '董卓': 'tac_bao_li_wu_ren',
  '典韦': 'tac_feng_shi_zhen',
  '张宝': 'tac_yao_shu',
  '潘凤': 'tac_bai_mei',
  '朱儁': 'tac_luo_feng',
  '张任': 'tac_luo_feng',
  '贾诩': 'tac_wei_zhen_hua_xia',
  '袁术': 'tac_po_zhen_cui_jian',
  '祝融夫人': 'tac_bing_lin_cheng_xia',
  '公孙瓒': 'tac_bai_ma_yi_cong',
  '沮授': 'tac_jian_tong_zhen_jun',
  '高顺': 'tac_xian_zhen_ying',
  '文丑': 'tac_deng_feng_xian_zhen',
  '孟获': 'tac_nan_man_qu_kui'
};

export function getHeroInheritTacticId(hero) {
  if (!hero) return null;
  return hero.inheritedTacticId || HERO_INHERIT_MAP[hero.name] || 'tac_fen_fa';
}
