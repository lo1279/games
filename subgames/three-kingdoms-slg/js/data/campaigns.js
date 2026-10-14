/**
 * 三国志·战略版 - 历史经典战役与演武通天试炼关卡数据
 */

export const CAMPAIGNS_DATA = [
  {
    id: 'camp_huangjin',
    chapter: 1,
    title: '第一章 · 黄巾初起 幽州平乱',
    subtitle: '张宝卞喜聚众起事，先锋开荒营首战平乱！',
    icon: '🌾',
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(6, 78, 59, 0.5) 100%)',
    enemyArm: 'spear', // 枪兵
    desc: '黄巾初起，贼寇侵掠州郡。地公将军张宝聚众作乱，关平率先锋开荒营奉命平定叛乱，此役为诸公起兵立功之首战！',
    tacticalHint: '💡 战术锦囊：黄巾军主力为【枪兵】，我军可切换【弓兵】或以郭淮坚盾抵御，关平佩戴手起刀落可轻易破敌！',
    enemyHeroes: [
      {
        id: 'gen_zhang_bao',
        name: '张宝',
        camp: 'qun',
        star: 4,
        avatar: '🌩️',
        level: 10,
        force: 68,
        intel: 82,
        command: 75,
        speed: 55,
        currentSoldiers: 2500,
        maxSoldiers: 2500,
        aptitude: { cavalry: 'B', shield: 'A', bow: 'A', spear: 'A', siege: 'B' },
        builtInTacticId: 'tac_yao_shu',
        equippedTactic1: 'tac_zi_yu',
        equippedTactic2: 'tac_yu_di_ping_zhang'
      },
      {
        id: 'gen_bian_xi',
        name: '卞喜',
        camp: 'qun',
        star: 3,
        avatar: '🔨',
        level: 8,
        force: 73,
        intel: 44,
        command: 66,
        speed: 51,
        currentSoldiers: 2000,
        maxSoldiers: 2000,
        aptitude: { cavalry: 'B', shield: 'B', bow: 'C', spear: 'B', siege: 'B' },
        builtInTacticId: 'tac_fen_fa',
        equippedTactic1: 'tac_shou_qi_dao_luo',
        equippedTactic2: 'tac_zuo_you_kai_gong'
      },
      {
        id: 'gen_pan_feng',
        name: '潘凤',
        camp: 'qun',
        star: 4,
        avatar: '🪓',
        level: 9,
        force: 87,
        intel: 32,
        command: 76,
        speed: 58,
        currentSoldiers: 2200,
        maxSoldiers: 2200,
        aptitude: { cavalry: 'S', shield: 'A', bow: 'B', spear: 'A', siege: 'B' },
        builtInTacticId: 'tac_bai_mei',
        equippedTactic1: 'tac_luo_feng',
        equippedTactic2: 'tac_bi_shi_ji_xu'
      }
    ]
  },
  {
    id: 'camp_hulao',
    chapter: 2,
    title: '第二章 · 虎牢关之战 决战吕布',
    subtitle: '天下第一飞将，方天画戟一骑当千！',
    icon: '🏯',
    bgGradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(30, 27, 75, 0.4) 100%)',
    enemyArm: 'cavalry', // 骑兵
    desc: '讨董联军进逼虎牢天险，飞将吕布率西凉铁骑出战。吕布拥有顶格武力与天下无双主动战法，必须注意利用兵种克制或高减伤战法应对！',
    tacticalHint: '💡 战术锦囊：吕布所部为【骑兵】，建议我军部署【枪兵】形成克制减伤！佩戴【盛气凌敌】可令突击战法失效。',
    enemyHeroes: [
      {
        id: 'gen_lv_bu',
        name: '吕布',
        camp: 'qun',
        star: 5,
        avatar: '戟',
        level: 30,
        force: 100,
        intel: 30,
        command: 95,
        speed: 95,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'B', bow: 'S', spear: 'A', siege: 'C' },
        builtInTacticId: 'tac_tian_xia_wu_shuang',
        equippedTactic1: 'tac_yi_qi_dang_qian',
        equippedTactic2: 'tac_bao_li_wu_ren'
      },
      {
        id: 'gen_zhang_liao',
        name: '张辽',
        camp: 'wei',
        star: 5,
        avatar: '⚔️',
        level: 28,
        force: 92,
        intel: 78,
        command: 90,
        speed: 90,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'B', bow: 'B', spear: 'S', siege: 'C' },
        builtInTacticId: 'tac_xian_zhen_tu_xi',
        equippedTactic1: 'tac_shou_qi_dao_luo',
        equippedTactic2: 'tac_yong_zhe_de_qian'
      },
      {
        id: 'gen_diao_chan',
        name: '貂蝉',
        camp: 'qun',
        star: 5,
        avatar: '💃',
        level: 25,
        force: 30,
        intel: 85,
        command: 80,
        speed: 85,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'B', shield: 'B', bow: 'B', spear: 'B', siege: 'C' },
        builtInTacticId: 'tac_bi_yue',
        equippedTactic1: 'tac_yu_di_ping_zhang',
        equippedTactic2: 'tac_qing_guo_qing_cheng'
      }
    ]
  },
  {
    id: 'camp_guandu',
    chapter: 3,
    title: '第三章 · 官渡之战 烽火连营',
    subtitle: '袁绍统领河北十万大军，以少胜多决战中原！',
    icon: '🚩',
    bgGradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.3) 0%, rgba(67, 20, 7, 0.4) 100%)',
    enemyArm: 'spear', // 枪兵
    desc: '河北雄主袁绍率河北精锐枪兵屯兵官渡，河北名将张郃与袁术联袂出战，输出极具压迫感。',
    tacticalHint: '💡 战术锦囊：袁绍全军为【枪兵】，使用【弓兵】队伍可在开局获取 15% 伤害增益并大幅削减敌军输出！',
    enemyHeroes: [
      {
        id: 'gen_yuan_shao',
        name: '袁绍',
        camp: 'qun',
        star: 5,
        avatar: '👑',
        level: 35,
        force: 85,
        intel: 82,
        command: 90,
        speed: 65,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'A', shield: 'A', bow: 'S', spear: 'S', siege: 'A' },
        builtInTacticId: 'tac_luan_shi_jian_xiong',
        equippedTactic1: 'tac_suo_xiang_pi_mi',
        equippedTactic2: 'tac_yu_di_ping_zhang'
      },
      {
        id: 'gen_zhang_he',
        name: '张郃',
        camp: 'wei',
        star: 5,
        avatar: '🔱',
        level: 35,
        force: 89,
        intel: 69,
        command: 90,
        speed: 68,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'A', shield: 'B', bow: 'A', spear: 'S', siege: 'B' },
        builtInTacticId: 'tac_da_ji_da_li',
        equippedTactic1: 'tac_shou_qi_dao_luo',
        equippedTactic2: 'tac_zi_yu'
      },
      {
        id: 'gen_yuan_shu',
        name: '袁术',
        camp: 'qun',
        star: 5,
        avatar: '👑',
        level: 32,
        force: 75,
        intel: 74,
        command: 84,
        speed: 73,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'B', shield: 'A', bow: 'S', spear: 'A', siege: 'B' },
        builtInTacticId: 'tac_wang_ling_feng_fa',
        equippedTactic1: 'tac_fen_fa',
        equippedTactic2: 'tac_liao_shi_ru_shen'
      }
    ]
  },
  {
    id: 'camp_chibi',
    chapter: 4,
    title: '第四章 · 赤壁之战 饮马长江',
    subtitle: '曹操八十万大军南下，独眼夏侯中流砥柱！',
    icon: '⛵',
    bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.3) 0%, rgba(15, 23, 42, 0.5) 100%)',
    enemyArm: 'shield', // 盾兵
    desc: '曹魏主力铁甲坚盾列阵江畔，曹操自带全体高伤统领光环，更有夏侯惇受创疯狂反弹伤害！',
    tacticalHint: '💡 战术锦囊：敌军为【盾兵】，建议派遣【骑兵】冲阵撕裂敌军防线；携带控制或虚弱战法压制夏侯惇反击。',
    enemyHeroes: [
      {
        id: 'gen_cao_cao',
        name: '曹操',
        camp: 'wei',
        star: 5,
        avatar: '🦅',
        level: 40,
        force: 78,
        intel: 94,
        command: 100,
        speed: 70,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'S', bow: 'B', spear: 'B', siege: 'A' },
        builtInTacticId: 'tac_luan_shi_jian_xiong',
        equippedTactic1: 'tac_ba_men_jin_suo',
        equippedTactic2: 'tac_yu_di_ping_zhang'
      },
      {
        id: 'gen_xia_hou_dun',
        name: '夏侯惇',
        camp: 'wei',
        star: 5,
        avatar: '🛡️',
        level: 40,
        force: 94,
        intel: 68,
        command: 94,
        speed: 68,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'S', bow: 'B', spear: 'B', siege: 'C' },
        builtInTacticId: 'tac_gang_lie_bu_qu',
        equippedTactic1: 'tac_zi_yu',
        equippedTactic2: 'tac_jue_di_fan_ji'
      },
      {
        id: 'gen_si_ma_yi',
        name: '司马懿',
        camp: 'wei',
        star: 5,
        avatar: '🐺',
        level: 38,
        force: 65,
        intel: 100,
        command: 98,
        speed: 55,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'A', shield: 'S', bow: 'A', spear: 'S', siege: 'S' },
        builtInTacticId: 'tac_ying_shi_lang_gu',
        equippedTactic1: 'tac_yong_wu_tong_shen',
        equippedTactic2: 'tac_ji_lue_zong_heng'
      }
    ]
  },
  {
    id: 'camp_yiling',
    chapter: 5,
    title: '第五章 · 夷陵之战 火烧连营',
    subtitle: '陆伯言白面书生巧布奇谋，烈焰燃尽八百里！',
    icon: '🔥',
    bgGradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.3) 0%, rgba(69, 10, 10, 0.5) 100%)',
    enemyArm: 'bow', // 弓兵
    desc: '江东大都督周瑜、陆逊联袂出战，都督火攻体系全开，灼烧蔓延接连引爆震慑，伤害极度爆炸！',
    tacticalHint: '💡 战术锦囊：都督队为【弓兵】，必须使用【盾兵】顶住漫天箭雨！强力推荐携带【刮骨疗毒】及时净化全队灼烧！',
    enemyHeroes: [
      {
        id: 'gen_lu_xun',
        name: '陆逊',
        camp: 'wu',
        star: 5,
        avatar: '🌋',
        level: 45,
        force: 72,
        intel: 98,
        command: 95,
        speed: 75,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'B', shield: 'B', bow: 'S', spear: 'S', siege: 'A' },
        builtInTacticId: 'tac_huo_shao_lian_ying',
        equippedTactic1: 'tac_han_tian_chi_di',
        equippedTactic2: 'tac_feng_zhu_huo_shi'
      },
      {
        id: 'gen_zhou_yu',
        name: '周瑜',
        camp: 'wu',
        star: 5,
        avatar: '🔥',
        level: 45,
        force: 74,
        intel: 98,
        command: 96,
        speed: 76,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'B', shield: 'B', bow: 'S', spear: 'A', siege: 'A' },
        builtInTacticId: 'tac_shen_huo_ji',
        equippedTactic1: 'tac_ba_men_jin_suo',
        equippedTactic2: 'tac_she_zhan_qun_ru'
      },
      {
        id: 'gen_tai_shi_ci',
        name: '太史慈',
        camp: 'wu',
        star: 5,
        avatar: '🏹',
        level: 45,
        force: 96,
        intel: 72,
        command: 92,
        speed: 78,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'C', bow: 'S', spear: 'B', siege: 'C' },
        builtInTacticId: 'tac_shen_she',
        equippedTactic1: 'tac_shou_qi_dao_luo',
        equippedTactic2: 'tac_zhe_chong_yu_wu'
      }
    ]
  },
  {
    id: 'camp_luoyang',
    chapter: 6,
    title: '终章 · 洛阳问鼎 天下一统',
    subtitle: '汉末终局对决，诛灭魔王董卓，定鼎中原！',
    icon: '👑',
    bgGradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.4) 0%, rgba(20, 15, 5, 0.6) 100%)',
    enemyArm: 'shield', // 盾兵
    desc: '汉室倾颓，天下大乱，终极关卡！暴虐魔王董卓、飞将吕布与医圣华佗联手镇守九五至尊宝座，攻坚防守双极致！',
    tacticalHint: '💡 战术锦囊：敌方兼备华佗急救治疗与吕布高爆发，建议派出我军顶配蜀汉五虎或国家队，快速斩首主将！',
    enemyHeroes: [
      {
        id: 'gen_dong_zhuo',
        name: '董卓',
        camp: 'qun',
        star: 5,
        avatar: '🥩',
        level: 50,
        force: 89,
        intel: 76,
        command: 94,
        speed: 68,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'S', bow: 'B', spear: 'A', siege: 'C' },
        builtInTacticId: 'tac_jiu_chi_rou_lin',
        equippedTactic1: 'tac_ba_men_jin_suo',
        equippedTactic2: 'tac_yu_di_ping_zhang'
      },
      {
        id: 'gen_lv_bu',
        name: '吕布',
        camp: 'qun',
        star: 5,
        avatar: '戟',
        level: 50,
        force: 105,
        intel: 35,
        command: 100,
        speed: 98,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'S', shield: 'S', bow: 'S', spear: 'S', siege: 'S' },
        builtInTacticId: 'tac_tian_xia_wu_shuang',
        equippedTactic1: 'tac_yi_qi_dang_qian',
        equippedTactic2: 'tac_bao_li_wu_ren'
      },
      {
        id: 'gen_hua_tuo',
        name: '华佗',
        camp: 'qun',
        star: 5,
        avatar: '🧪',
        level: 50,
        force: 35,
        intel: 95,
        command: 90,
        speed: 82,
        currentSoldiers: 10000,
        maxSoldiers: 10000,
        aptitude: { cavalry: 'A', shield: 'S', bow: 'S', spear: 'A', siege: 'C' },
        builtInTacticId: 'tac_qing_nang_xiang_zhu',
        equippedTactic1: 'tac_gua_gu_liao_du',
        equippedTactic2: 'tac_zi_yu'
      }
    ]
  }
];

export const TRIALS_DATA = [
  {
    floor: 1,
    title: '演武第 1 层 · 黄巾余部',
    arm: 'spear',
    leadName: '张角法师队',
    difficulty: '入门',
    hint: '敌军全员枪兵，派出弓兵可轻松碾压。',
    heroes: [
      { id: 'gen_zhang_bao', name: '张宝', star: 4, camp: 'qun', avatar: '🌩️', level: 50, force: 68, intel: 82, command: 75, speed: 55, builtInTacticId: 'tac_yao_shu', equippedTactic1: 'tac_zi_yu', equippedTactic2: 'tac_yu_di_ping_zhang' },
      { id: 'gen_guan_ping', name: '关平', star: 4, camp: 'shu', avatar: '🗡️', level: 50, force: 82, intel: 65, command: 80, speed: 60, builtInTacticId: 'tac_fen_fa', equippedTactic1: 'tac_shou_qi_dao_luo', equippedTactic2: 'tac_zuo_you_kai_gong' },
      { id: 'gen_bian_xi', name: '卞喜', star: 3, camp: 'qun', avatar: '🔨', level: 50, force: 73, intel: 44, command: 66, speed: 51, builtInTacticId: 'tac_an_cang_xian_ji', equippedTactic1: 'tac_qiang_gong', equippedTactic2: 'tac_luo_feng' }
    ]
  },
  {
    floor: 2,
    title: '演武第 2 层 · 铜墙铁壁',
    arm: 'shield',
    leadName: '郭淮护卫盾',
    difficulty: '简单',
    hint: '敌军为坚盾阵型，带御敌屏障减伤，换骑兵出阵克制。',
    heroes: [
      { name: '郭淮', star: 4, camp: 'wei', avatar: '🧱', level: 50, force: 75, intel: 75, command: 85, speed: 45, builtInTacticId: 'tac_yu_di_ping_zhang', equippedTactic1: 'tac_zi_yu', equippedTactic2: 'tac_bai_lian_cheng_gang' },
      { name: '韩当', star: 4, camp: 'wu', avatar: '🎯', level: 50, force: 80, intel: 55, command: 75, speed: 60, builtInTacticId: 'tac_zuo_you_kai_gong', equippedTactic1: 'tac_shou_qi_dao_luo', equippedTactic2: 'tac_qiang_gong' },
      { name: '典韦', star: 5, camp: 'wei', avatar: '🛡️', level: 50, force: 95, intel: 35, command: 90, speed: 60, builtInTacticId: 'tac_yi_li_ju_shou', equippedTactic1: 'tac_qing_yong_fei_yan', equippedTactic2: 'tac_jue_di_fan_ji' }
    ]
  },
  {
    floor: 3,
    title: '演武第 3 层 · 桃园前哨',
    arm: 'spear',
    leadName: '翼德暴烈枪',
    difficulty: '进阶',
    hint: '张飞第2、4回合全体暴击，注意前排统率防御。',
    heroes: [
      { name: '张飞', star: 5, camp: 'shu', avatar: '🐅', level: 50, force: 98, intel: 35, command: 94, speed: 85, builtInTacticId: 'tac_yan_ren_pao_xiao', equippedTactic1: 'tac_suo_xiang_pi_mi', equippedTactic2: 'tac_chen_mu_heng_mao' },
      { name: '关平', star: 4, camp: 'shu', avatar: '🗡️', level: 50, force: 82, intel: 65, command: 80, speed: 60, builtInTacticId: 'tac_fen_fa', equippedTactic1: 'tac_shou_qi_dao_luo', equippedTactic2: 'tac_zuo_you_kai_gong' },
      { name: '廖化', star: 4, camp: 'shu', avatar: '🛡️', level: 50, force: 76, intel: 65, command: 82, speed: 52, builtInTacticId: 'tac_zi_yu', equippedTactic1: 'tac_yu_di_ping_zhang', equippedTactic2: 'tac_bai_lian_cheng_gang' }
    ]
  },
  {
    floor: 4,
    title: '演武第 4 层 · 连环绝色',
    arm: 'bow',
    leadName: '闭月连环弓',
    difficulty: '困难',
    hint: '貂蝉分担伤害并附带混乱，优先安排高爆发物理伤害将其斩杀。',
    heroes: [
      { name: '貂蝉', star: 5, camp: 'qun', avatar: '💃', level: 50, force: 30, intel: 85, command: 85, speed: 88, builtInTacticId: 'tac_bi_yue', equippedTactic1: 'tac_ba_men_jin_suo', equippedTactic2: 'tac_qing_guo_qing_cheng' },
      { name: '太史慈', star: 5, camp: 'wu', avatar: '🏹', level: 50, force: 92, intel: 70, command: 90, speed: 70, builtInTacticId: 'tac_shen_she', equippedTactic1: 'tac_shou_qi_dao_luo', equippedTactic2: 'tac_zhe_chong_yu_wu' },
      { name: '吕布', star: 5, camp: 'qun', avatar: '戟', level: 50, force: 105, intel: 30, command: 95, speed: 95, builtInTacticId: 'tac_tian_xia_wu_shuang', equippedTactic1: 'tac_yi_qi_dang_qian', equippedTactic2: 'tac_bao_li_wu_ren' }
    ]
  },
  {
    floor: 5,
    title: '演武第 5 层 · 蜀汉桃园顶配盾',
    arm: 'shield',
    leadName: '刘备桃园队',
    difficulty: '极难',
    hint: '经典三战天花板阵容！刘备高额急救回血 + 关羽威震华夏群控 + 张飞破防。必须使用骑兵且佩戴强控战法！',
    heroes: [
      { name: '刘备', star: 5, camp: 'shu', avatar: '👑', level: 50, force: 80, intel: 85, command: 90, speed: 60, builtInTacticId: 'tac_ren_de_zai_shi', equippedTactic1: 'tac_ba_men_jin_suo', equippedTactic2: 'tac_gua_gu_liao_du' },
      { name: '关羽', star: 5, camp: 'shu', avatar: '🐉', level: 50, force: 98, intel: 80, command: 98, speed: 78, builtInTacticId: 'tac_wei_zhen_hua_xia', equippedTactic1: 'tac_suo_xiang_pi_mi', equippedTactic2: 'tac_heng_sao_qian_jun' },
      { name: '张飞', star: 5, camp: 'shu', avatar: '🐅', level: 50, force: 99, intel: 35, command: 95, speed: 86, builtInTacticId: 'tac_yan_ren_pao_xiao', equippedTactic1: 'tac_sheng_qi_ling_di', equippedTactic2: 'tac_chen_mu_heng_mao' }
    ]
  },
  {
    floor: 6,
    title: '演武第 6 层 · 曹魏雄狮铁骑',
    arm: 'cavalry',
    leadName: '曹魏奸雄骑',
    difficulty: '王者',
    hint: '曹操全队增伤 + 夏侯惇狂暴反伤 + 张辽锁头主将！必须注意主将血量，推荐使用枪兵反制。',
    heroes: [
      { name: '曹操', star: 5, camp: 'wei', avatar: '🦅', level: 50, force: 75, intel: 92, command: 100, speed: 72, builtInTacticId: 'tac_luan_shi_jian_xiong', equippedTactic1: 'tac_yu_di_ping_zhang', equippedTactic2: 'tac_ba_men_jin_suo' },
      { name: '张辽', star: 5, camp: 'wei', avatar: '⚔️', level: 50, force: 94, intel: 78, command: 95, speed: 92, builtInTacticId: 'tac_xian_zhen_tu_xi', equippedTactic1: 'tac_yi_qi_dang_qian', equippedTactic2: 'tac_yong_zhe_de_qian' },
      { name: '夏侯惇', star: 5, camp: 'wei', avatar: '🛡️', level: 50, force: 92, intel: 68, command: 92, speed: 68, builtInTacticId: 'tac_gang_lie_bu_qu', equippedTactic1: 'tac_zi_yu', equippedTactic2: 'tac_jue_di_fan_ji' }
    ]
  },
  {
    floor: 7,
    title: '演武第 7 层 · 智冠诸葛天下神机',
    arm: 'spear',
    leadName: '武侯神机队',
    difficulty: '登峰造极',
    hint: '诸葛亮神机妙算打断所有主动战法并造成高额谋略反击！建议少带主动战法，多带指挥与被动突击体系！',
    heroes: [
      { name: '诸葛亮', star: 5, camp: 'shu', avatar: '🪶', level: 50, force: 40, intel: 105, command: 100, speed: 75, builtInTacticId: 'tac_shen_ji_miao_suan', equippedTactic1: 'tac_ba_men_jin_suo', equippedTactic2: 'tac_she_zhan_qun_ru' },
      { name: '赵云', star: 5, camp: 'shu', avatar: '⚡', level: 50, force: 100, intel: 80, command: 100, speed: 85, builtInTacticId: 'tac_yi_shen_shi_dan', equippedTactic1: 'tac_suo_xiang_pi_mi', equippedTactic2: 'tac_heng_sao_qian_jun' },
      { name: '关羽', star: 5, camp: 'shu', avatar: '🐉', level: 50, force: 100, intel: 82, command: 98, speed: 80, builtInTacticId: 'tac_wei_zhen_hua_xia', equippedTactic1: 'tac_gua_gu_liao_du', equippedTactic2: 'tac_po_zhen_cui_jian' }
    ]
  }
];
