import type { LifeEvent } from '../types/game';
import { DECISIONS_POOL } from './decisions';

export const EVENTS_POOL: LifeEvent[] = [
  // ================= 0 ~ 3 岁：婴儿时期 =================
  {
    id: 'e_born_wealthy',
    minAge: 0,
    maxAge: 0,
    weight: 20,
    condition: (s) => s.attrs.wealth >= 30,
    execute: () => ({
      content: '你出生在私立贵族妇产医院的特护病房，父母和家族长辈为你准备了丰厚的信托基金。',
      type: 'milestone',
      statChanges: { happiness: 10, wealth: 5 },
    }),
  },
  {
    id: 'e_born_normal',
    minAge: 0,
    maxAge: 0,
    weight: 50,
    condition: (s) => s.attrs.wealth < 30,
    execute: () => ({
      content: '伴随着一声清脆嘹亮的啼哭，你降生在一个普通的城市家庭，父母喜极而泣。',
      type: 'milestone',
      statChanges: { happiness: 5 },
    }),
  },
  {
    id: 'e_age_1_catch',
    minAge: 1,
    maxAge: 1,
    weight: 30,
    execute: () => {
      const items = ['算盘 (商业)', '毛笔 (文学)', '电脑鼠标 (极客)', '听诊器 (名医)'];

      const choice = items[Math.floor(Math.random() * items.length)];
      return {
        content: `一周岁周岁抓周礼上，你毫不犹豫地一把抓住了【${choice}】，引来全场亲朋好友欢声雷动！`,
        type: 'positive',
        statChanges: { intelligence: 3, happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_2_words',
    minAge: 2,
    maxAge: 2,
    weight: 30,
    execute: (s) => {
      if (s.attrs.intelligence >= 20) {
        return {
          content: '两岁时，你已经能背诵几十首唐诗并能与大人流畅对话，邻居们惊呼遇到了神童！',
          type: 'positive',
          statChanges: { intelligence: 5, charm: 3 },
          tagsGained: ['早慧'],
        };
      }
      return {
        content: '你学会了迈着小短腿飞快地奔跑，嘴里咿咿呀呀喊着“爸爸妈妈”，全家笑声不断。',
        type: 'normal',
        statChanges: { strength: 3, happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_3_fever',
    minAge: 3,
    maxAge: 3,
    weight: 25,
    execute: (s) => {
      if (s.attrs.strength <= 10 && s.attrs.wealth < 10) {
        // 体质极弱又无钱医治
        return {
          content: '一场突如其来的急症高烧来势汹汹，由于就医延误，你的身体遭受了严重打击。',
          type: 'danger',
          statChanges: { strength: -10, happiness: -10 },
        };
      }
      return {
        content: '你得了一次幼儿急疹，父母彻夜守护在床边给你敷毛巾喂水，几天后你彻底退烧康复。',
        type: 'normal',
        statChanges: { strength: 4, happiness: 3 },
      };
    },
  },

  // ================= 4 ~ 6 岁：幼童时期 =================
  {
    id: 'e_age_4_kindergarten',
    minAge: 4,
    maxAge: 4,
    weight: 30,
    execute: (s) => {
      if (s.attrs.charm >= 20) {
        return {
          content: '上幼儿园的第一天，因为长相可爱讨喜，老师和同桌小朋友都抢着分你饼干和水果。',
          type: 'positive',
          statChanges: { charm: 3, happiness: 8 },
        };
      }
      return {
        content: '你背着小书包踏入幼儿园大门，结识了许多小伙伴，每天搭积木玩得不亦乐乎。',
        type: 'normal',
        statChanges: { happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_5_interest',
    minAge: 5,
    maxAge: 5,
    weight: 30,
    execute: (s) => {
      if (s.attrs.wealth >= 35) {
        return {
          content: '父母为你报名了马术、钢琴和双语外教启蒙班，你的眼界与仪态得到了极好的塑造。',
          type: 'positive',
          statChanges: { charm: 5, intelligence: 5, wealth: -2 },
        };
      }
      return {
        content: '你在家附近的公园泥坑里逮泥鳅捉蟋蟀，在大自然中尽情释放探索欲，体魄愈发强健。',
        type: 'normal',
        statChanges: { strength: 6, happiness: 8 },
      };
    },
  },
  {
    id: 'e_age_6_drawing',
    minAge: 6,
    maxAge: 6,
    weight: 30,
    execute: () => ({
      content: '你在少儿书画比赛中凭借天马行空的想象力创作了一幅画作，获得了优秀雏鹰奖奖状。',
      type: 'positive',
      statChanges: { intelligence: 4, charm: 2 },
    }),
  },

  // ================= 7 ~ 12 岁：小学时期 =================
  {
    id: 'e_age_7_primary',
    minAge: 7,
    maxAge: 7,
    weight: 40,
    execute: () => ({
      content: '你戴上鲜艳的红领巾，正式成为一名光荣的小学生，朗朗读书声在校园回荡。',
      type: 'milestone',
      statChanges: { intelligence: 4, happiness: 4 },
    }),
  },
  {
    id: 'e_age_8_game',
    minAge: 8,
    maxAge: 8,
    weight: 30,
    execute: (s) => {
      if (s.attrs.intelligence >= 25) {
        return {
          content: '你第一次接触到家用电脑，自学敲出了人生第一个小游戏脚本，引发同学们的惊叹！',
          type: 'positive',
          statChanges: { intelligence: 6, happiness: 5 },
        };
      }
      return {
        content: '放学后你和同伴在操场上拍洋画、踢足球，直到夕阳西下才依依不舍地回家吃晚饭。',
        type: 'normal',
        statChanges: { strength: 5, happiness: 6 },
      };
    },
  },
  {
    id: 'e_age_9_library',
    minAge: 9,
    maxAge: 9,
    weight: 30,
    execute: () => ({
      content: '你办了第一张市图书馆借阅卡，在浩瀚的书海中阅读凡尔纳与科学画报，沉醉不已。',
      type: 'positive',
      statChanges: { intelligence: 5, happiness: 4 },
    }),
  },
  {
    id: 'e_age_10_pet',
    minAge: 10,
    maxAge: 10,
    weight: 25,
    execute: () => ({
      content: '家里领养了一只通人性的田园小金毛犬，你每天放学第一件事就是带它在小巷撒欢。',
      type: 'positive',
      statChanges: { happiness: 10, strength: 3 },
    }),
  },
  {
    id: 'e_age_11_class_leader',
    minAge: 11,
    maxAge: 11,
    weight: 30,
    execute: (s) => {
      if (s.attrs.charm >= 20 || s.attrs.intelligence >= 25) {
        return {
          content: '经过全班无记名投票，你高票当选班长，带领班级在校合唱比赛中勇夺一等奖！',
          type: 'positive',
          statChanges: { charm: 5, intelligence: 4, happiness: 6 },
        };
      }
      return {
        content: '你被选为科学实验课代表，认真负责地协助老师整理显微镜和植物标本。',
        type: 'normal',
        statChanges: { intelligence: 3, happiness: 3 },
      };
    },
  },
  {
    id: 'e_age_12_transition',
    minAge: 12,
    maxAge: 12,
    weight: 100, // 必触发重大抉择
    execute: () => ({
      content: '十二岁，小学圆满毕业，青春期悄然而至。面临初中路线的抉择！',
      type: 'milestone',
      triggerDecision: DECISIONS_POOL.decision_age_12,
    }),
  },

  // ================= 13 ~ 17 岁：初高中青春期 =================
  {
    id: 'e_age_13_growth',
    minAge: 13,
    maxAge: 13,
    weight: 30,
    execute: () => ({
      content: '初一这一年你个头猛蹿了十公分，声音也开始变得低沉有磁性，迎来了成长的蜕变。',
      type: 'normal',
      statChanges: { strength: 6, charm: 3 },
    }),
  },
  {
    id: 'e_age_14_crush',
    minAge: 14,
    maxAge: 14,
    weight: 30,
    execute: (s) => {
      if (s.attrs.charm >= 30) {
        return {
          content: '课桌里常能翻出隔壁班同学偷偷塞的小卡片和巧克力，懵懂的心跳让青春格外斑斓。',
          type: 'positive',
          statChanges: { charm: 4, happiness: 8 },
        };
      }
      return {
        content: '你暗自倾慕坐在窗边的课代表，每一次对视都让你心跳加速，成为努力学习的动力。',
        type: 'normal',
        statChanges: { intelligence: 3, happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_15_high_school_exam',
    minAge: 15,
    maxAge: 15,
    weight: 40,
    execute: (s) => {
      if (s.attrs.intelligence >= 30) {
        return {
          content: '中考成绩揭晓！你以全区名列前茅的佳绩直升省重点高中实验班，全家为你举杯庆祝！',
          type: 'positive',
          statChanges: { intelligence: 6, happiness: 10, wealth: 3 },
        };
      }
      return {
        content: '你顺利考入区重点中学，结识了一群同样怀揣梦想的高中同窗。',
        type: 'normal',
        statChanges: { intelligence: 3, happiness: 4 },
      };
    },
  },
  {
    id: 'e_age_16_study_hard',
    minAge: 16,
    maxAge: 16,
    weight: 30,
    execute: () => ({
      content: '高中课业繁重，你埋首在五三与厚厚的真题卷中，草稿纸写满了整整三大箱。',
      type: 'normal',
      statChanges: { intelligence: 7, strength: -2 },
    }),
  },
  {
    id: 'e_age_17_midnight_oil',
    minAge: 17,
    maxAge: 17,
    weight: 35,
    execute: () => ({
      content: '高三模拟考如火如荼，百日誓师大会上你与同桌共同立下誓言，誓要考上心仪学府！',
      type: 'normal',
      statChanges: { intelligence: 6, happiness: -3 },
    }),
  },
  {
    id: 'e_age_18_gaokao',
    minAge: 18,
    maxAge: 18,
    weight: 100, // 必触发重大抉择
    execute: () => ({
      content: '十八岁成人礼！高考答卷最后一笔落下，铃声响起，你的人生将驶向崭新的航道！',
      type: 'milestone',
      triggerDecision: DECISIONS_POOL.decision_age_18,
    }),
  },

  // ================= 19 ~ 22 岁：大学与青年时期 =================
  {
    id: 'e_age_19_campus',
    minAge: 19,
    maxAge: 19,
    weight: 35,
    execute: (s) => {
      if (s.attrs.charm >= 30) {
        return {
          content: '大学迎新晚会上你的才艺表演惊艳全场，表白墙上关于你的寻人贴直接被顶上了热门第一！',
          type: 'positive',
          statChanges: { charm: 6, happiness: 10 },
        };
      }
      return {
        content: '你加入了感兴趣的大学社团，在草坪音乐节和辩论赛上结交了一批志同道合的好友。',
        type: 'normal',
        statChanges: { intelligence: 4, happiness: 6 },
      };
    },
  },
  {
    id: 'e_age_20_part_time',
    minAge: 20,
    maxAge: 20,
    weight: 30,
    execute: (s) => {
      if (s.attrs.intelligence >= 35) {
        return {
          content: '你在课余时间承接企业级技术开发外包，赚到了人生第一笔六位数积蓄，经济完全独立！',
          type: 'positive',
          statChanges: { wealth: 18, intelligence: 6, happiness: 8 },
        };
      }
      return {
        content: '你通过兼职家教和奖学金攒下了人生第一笔小存款，请父母吃了一顿大餐。',
        type: 'positive',
        statChanges: { wealth: 6, happiness: 6 },
      };
    },
  },
  {
    id: 'e_age_21_internship',
    minAge: 21,
    maxAge: 21,
    weight: 35,
    execute: () => ({
      content: '你在知名企业的暑期实习中表现亮眼，主导解决了关键技术瓶颈，提前锁定转正资格。',
      type: 'positive',
      statChanges: { intelligence: 6, wealth: 8 },
    }),
  },
  {
    id: 'e_age_22_graduation',
    minAge: 22,
    maxAge: 22,
    weight: 100, // 必触发重大抉择
    execute: () => ({
      content: '二十二岁，学士帽高高抛向蓝天。毕业季的骊歌唱响，你正式踏入社会的大熔炉！',
      type: 'milestone',
      triggerDecision: DECISIONS_POOL.decision_age_22,
    }),
  },

  // ================= 23 ~ 30 岁：初入职场与黄金奋斗期 =================
  {
    id: 'e_age_23_work_start',
    minAge: 23,
    maxAge: 23,
    weight: 30,
    execute: () => ({
      content: '初入职场，你保持着饱满的求知欲，快速熟悉业务链路，在部门会议上的发言受到领导称赞。',
      type: 'normal',
      statChanges: { intelligence: 4, wealth: 6 },
    }),
  },
  {
    id: 'e_age_24_travel',
    minAge: 24,
    maxAge: 24,
    weight: 25,
    execute: () => ({
      content: '趁着年假，你约上好友去川藏线自驾游，壮丽的雪山与星空涤荡了内心的疲倦。',
      type: 'positive',
      statChanges: { happiness: 12, strength: 5 },
    }),
  },
  {
    id: 'e_age_25_promotion',
    minAge: 25,
    maxAge: 25,
    weight: 30,
    execute: (s) => {
      if (s.attrs.intelligence >= 40 || s.attrs.luck >= 40) {
        return {
          content: '凭借突出的业务能力与人品，你被破格提拔为主管，薪资翻倍，开始带属于自己的小团队！',
          type: 'positive',
          statChanges: { wealth: 18, intelligence: 5, charm: 4 },
        };
      }
      return {
        content: '你按部就班地完成了年度绩效目标，获得了不错的年终奖金。',
        type: 'normal',
        statChanges: { wealth: 8 },
      };
    },
  },
  {
    id: 'e_age_26_invest_small',
    minAge: 26,
    maxAge: 26,
    weight: 25,
    execute: (s) => {
      if (s.attrs.luck >= 30) {
        return {
          content: '你配置的稳健指数基金和理财跑赢了大盘，年化收益可观，小金库日益充盈。',
          type: 'positive',
          statChanges: { wealth: 12 },
        };
      }
      return {
        content: '股市小幅震荡，你秉持长期主义耐心定投，稳住了资产阵脚。',
        type: 'normal',
        statChanges: { wealth: 3 },
      };
    },
  },
  {
    id: 'e_age_27_marriage_call',
    minAge: 27,
    maxAge: 27,
    weight: 100, // 必触发重大抉择
    execute: () => ({
      content: '二十七岁，身边的发小与大学同学陆续步入婚姻殿堂，你的终身大事也到了关键时刻！',
      type: 'milestone',
      triggerDecision: DECISIONS_POOL.decision_age_27,
    }),
  },
  {
    id: 'e_age_28_buy_car',
    minAge: 28,
    maxAge: 28,
    weight: 25,
    execute: (s) => {
      if (s.attrs.wealth >= 30) {
        return {
          content: '你全款提了一辆心仪已久的轿跑车，夜晚带着喜悦在城市环线上兜风，惬意自在。',
          type: 'positive',
          statChanges: { wealth: -6, happiness: 10, charm: 4 },
        };
      }
      return {
        content: '你租下了离公司更近的阳光公寓，告别了漫长拥挤的通勤地铁，生活品质显著改善。',
        type: 'normal',
        statChanges: { happiness: 6, strength: 3 },
      };
    },
  },
  {
    id: 'e_age_29_health_check',
    minAge: 29,
    maxAge: 29,
    weight: 30,
    execute: (s) => {
      if (s.attrs.strength <= 25) {
        return {
          content: '体检报告上亮起了几项红灯（颈椎病、轻度脂肪肝），你下定决心办了健身年卡开始自律。',
          type: 'warning',
          statChanges: { strength: 4, happiness: -3 },
        };
      }
      return {
        content: '年度体检指标全绿，各项机能如猛虎般充沛，医生夸赞你的作息与活力相当健康。',
        type: 'positive',
        statChanges: { strength: 6, happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_30_prime',
    minAge: 30,
    maxAge: 30,
    weight: 35,
    execute: () => ({
      content: '三十而立！站在而立之年的门槛上回望，你褪去了青涩与鲁莽，胸中自有丘壑。',
      type: 'milestone',
      statChanges: { intelligence: 5, strength: 2, happiness: 5 },
    }),
  },

  // ================= 31 ~ 45 岁：中流砥柱与事业腾飞 =================
  {
    id: 'e_age_32_child',
    minAge: 32,
    maxAge: 32,
    weight: 30,
    execute: () => ({
      content: '伴随清脆的啼哭声，你的宝贝孩子顺利降生！初为人父母的感动与责任让你瞬间成熟。',
      type: 'positive',
      statChanges: { happiness: 15, wealth: -5 },
      tagsGained: ['慈爱父母'],
    }),
  },
  {
    id: 'e_age_35_crisis',
    minAge: 35,
    maxAge: 35,
    weight: 100, // 必触发重大抉择
    execute: () => ({
      content: '三十五岁，人生的黄金中场。家庭的重任与事业的浪头扑面而来，面临重大抉择！',
      type: 'milestone',
      triggerDecision: DECISIONS_POOL.decision_age_35,
    }),
  },
  {
    id: 'e_age_38_honor',
    minAge: 38,
    maxAge: 38,
    weight: 30,
    execute: (s) => {
      if (s.attrs.wealth >= 60 || s.attrs.intelligence >= 60) {
        return {
          content: '你荣获行业领军杰出贡献人物奖，接受权威媒体深度专访，声名远播！',
          type: 'positive',
          statChanges: { wealth: 15, charm: 8, happiness: 8 },
        };
      }
      return {
        content: '你带领团队啃下了一块硬骨头大项目，获得了公司的丰厚表彰。',
        type: 'normal',
        statChanges: { wealth: 8, happiness: 5 },
      };
    },
  },
  {
    id: 'e_age_42_parent_care',
    minAge: 42,
    maxAge: 42,
    weight: 25,
    execute: () => ({
      content: '父母渐渐上了年纪，你带他们去三亚度过了温暖的整个冬天，长辈的笑颜让你感到无比安心。',
      type: 'positive',
      statChanges: { happiness: 12, wealth: -6 },
    }),
  },
  {
    id: 'e_age_45_marathon',
    minAge: 45,
    maxAge: 45,
    weight: 25,
    execute: (s) => {
      if (s.attrs.strength >= 40) {
        return {
          content: '你参加了城市半程马拉松，以优异成绩完赛，矫健的步伐让身边的年轻人都自叹不如。',
          type: 'positive',
          statChanges: { strength: 8, happiness: 8 },
        };
      }
      return {
        content: '你坚持日常慢跑和瑜伽，身材依然保持得匀称挺拔，不见中年发福的油腻。',
        type: 'normal',
        statChanges: { strength: 4, charm: 3 },
      };
    },
  },

  // ================= 46 ~ 60 岁：成熟稳健与修真奇遇 =================
  {
    id: 'e_age_50_destiny_trigger',
    minAge: 50,
    maxAge: 50,
    weight: 100,
    execute: (s) => {
      // 若有灵根或修仙天赋，触发隐藏修真奇遇
      if ((s.attrs.spiritualRoot && s.attrs.spiritualRoot >= 50) || s.tags.includes('immortal_seed') || s.tags.includes('修真传承')) {
        return {
          content: '五十岁天命之年！体内深埋半个世纪的仙道灵根感应天机，绽放无量瑞彩！',
          type: 'special',
          triggerDecision: DECISIONS_POOL.decision_immortal_50,
        };
      }
      return {
        content: '五十知天命。你阅尽人间百态，对待世事愈发通达从容，泰山崩于前而色不变。',
        type: 'milestone',
        statChanges: { intelligence: 6, happiness: 8 },
      };
    },
  },
  {
    id: 'e_age_55_kids_graduate',
    minAge: 55,
    maxAge: 55,
    weight: 30,
    execute: () => ({
      content: '孩子顺利从名牌大学学成毕业并找到了心仪的工作，你心中沉甸甸的石头终于落了地。',
      type: 'positive',
      statChanges: { happiness: 18 },
    }),
  },
  {
    id: 'e_age_58_book',
    minAge: 58,
    maxAge: 58,
    weight: 25,
    execute: (s) => {
      if (s.attrs.intelligence >= 50) {
        return {
          content: '你将毕生的行业经验与思考凝结成书出版，迅速登上畅销榜，成为诸多年轻后辈的启蒙圣经。',
          type: 'positive',
          statChanges: { wealth: 15, charm: 6, happiness: 10 },
        };
      }
      return {
        content: '你开始练习书法与太极，行云流水之间涵养心性，神清气爽。',
        type: 'normal',
        statChanges: { strength: 6, happiness: 6 },
      };
    },
  },
  {
    id: 'e_age_60_retire',
    minAge: 60,
    maxAge: 60,
    weight: 50,
    execute: () => ({
      content: '六十岁花甲之年，荣光退休！同事们为你举办了隆重的欢送仪式，鲜花与掌声如潮水般涌来。',
      type: 'milestone',
      statChanges: { happiness: 15, strength: 5 },
      tagsGained: ['安享晚年'],
    }),
  },

  // ================= 61 ~ 80 岁：晚年岁月与天伦之乐 =================
  {
    id: 'e_age_65_grandchild',
    minAge: 65,
    maxAge: 65,
    weight: 30,
    execute: () => ({
      content: '小孙子/小孙女牙牙学语地喊出“爷爷/奶奶”，你乐得合不拢嘴，整天推着婴儿车在公园遛弯。',
      type: 'positive',
      statChanges: { happiness: 20 },
    }),
  },
  {
    id: 'e_age_68_garden',
    minAge: 68,
    maxAge: 68,
    weight: 25,
    execute: () => ({
      content: '你在自家小院里侍弄花草和蔬菜，春有百花秋有月，小日子过得诗情画意。',
      type: 'normal',
      statChanges: { strength: 5, happiness: 10 },
    }),
  },
  {
    id: 'e_age_70_golden',
    minAge: 70,
    maxAge: 70,
    weight: 40,
    execute: () => ({
      content: '古稀之年，家族为你设宴祝寿，四世同堂，后辈们围拢叩拜敬茶，福泽绵长。',
      type: 'milestone',
      statChanges: { happiness: 20 },
    }),
  },
  {
    id: 'e_age_75_health_check',
    minAge: 75,
    maxAge: 75,
    weight: 35,
    execute: (s) => {
      if (s.attrs.strength <= 30) {
        return {
          content: '岁月不饶人，腿脚有些不太灵便，但儿女极为孝顺，为你请了贴心看护悉心照料。',
          type: 'warning',
          statChanges: { strength: -5, happiness: 5 },
        };
      }
      return {
        content: '七十五岁的你依然步履生风，爬山锻炼从不喘粗气，令小区的老伙伴们艳羡不已。',
        type: 'positive',
        statChanges: { strength: 5, happiness: 10 },
      };
    },
  },

  // ================= 80 ~ 100+ 岁：长寿传奇与百岁终局 =================
  {
    id: 'e_age_80_octo',
    minAge: 80,
    maxAge: 80,
    weight: 40,
    execute: () => ({
      content: '八十岁杖朝之年！你的精神头依然矍铄，记忆力清晰，常给后辈讲述当年的沧桑传奇。',
      type: 'milestone',
      statChanges: { happiness: 15 },
    }),
  },
  {
    id: 'e_age_88_mizhu',
    minAge: 88,
    maxAge: 88,
    weight: 40,
    execute: () => ({
      content: '八十八岁“米寿”大吉！地方媒体登门拜访录制长寿秘诀，你笑着回答：“少生气，多看开”。',
      type: 'milestone',
      statChanges: { happiness: 15 },
    }),
  },
  {
    id: 'e_age_95_white_hair',
    minAge: 95,
    maxAge: 95,
    weight: 40,
    execute: () => ({
      content: '九十五岁高龄，白发如银，目光却澄澈如稚童。世间的一切功名利禄在你眼中皆化作云淡风轻。',
      type: 'milestone',
      statChanges: { happiness: 20 },
    }),
  },
  {
    id: 'e_age_100_century',
    minAge: 100,
    maxAge: 100,
    weight: 100,
    execute: () => ({
      content: '期颐之年！跨越整整一个世纪的长寿寿星！省市领导亲赴家中慰问，颁发百岁世纪寿星纪念金牌！',
      type: 'milestone',
      statChanges: { happiness: 30 },
      tagsGained: ['世纪传奇', '百岁人瑞'],
    }),
  },
  {
    id: 'e_age_108_tea',
    minAge: 108,
    maxAge: 108,
    weight: 50,
    execute: (s) => {
      // 如果有修真标签
      if (s.tags.includes('金丹大道') || (s.attrs.spiritualRoot && s.attrs.spiritualRoot >= 70)) {
        return {
          content: '百零八岁茶寿之际，九霄雷云滚滚汇聚，金光破开天幕！你终于圆满渡过雷劫，白日飞升！',
          type: 'special',
          tagsGained: ['羽化登仙'],
          isDead: true,
          deathReason: '渡劫大圆满，羽化登仙超脱凡俗！',
        };
      }
      return {
        content: '一百零八岁茶寿，你五世同堂，成为举国闻名的长寿奇迹。',
        type: 'milestone',
        statChanges: { happiness: 20 },
      };
    },
  },

  // ================= 阶段性随机事件库（覆盖全年龄中后段空白） =================
  // 23 ~ 35 岁：青年奋斗期常见生活与职场事件
  {
    id: 'e_range_young_cert',
    minAge: 23,
    maxAge: 34,
    weight: 15,
    condition: (s) => s.attrs.intelligence >= 30,
    execute: () => ({
      content: '你利用数月下班时间刻苦备考，顺利斩获含金量极高的行业顶级专业资质证书，职场竞争力倍增！',
      type: 'positive',
      statChanges: { intelligence: 6, wealth: 8 },
    }),
  },
  {
    id: 'e_range_young_camping',
    minAge: 23,
    maxAge: 34,
    weight: 15,
    execute: () => ({
      content: '周末你约上三五好友到郊野湖畔露营烤肉，围坐在篝火旁弹吉他畅谈理想，身心彻底放松。',
      type: 'normal',
      statChanges: { happiness: 8, strength: 3 },
    }),
  },
  {
    id: 'e_range_young_overtime',
    minAge: 24,
    maxAge: 34,
    weight: 12,
    execute: () => ({
      content: '近期重大项目攻坚上线，你连续两周加班复盘，虽疲惫不堪，但最终顺利交付收获丰厚奖金。',
      type: 'normal',
      statChanges: { wealth: 10, strength: -4, happiness: -2 },
    }),
  },
  {
    id: 'e_range_young_stock',
    minAge: 26,
    maxAge: 35,
    weight: 12,
    execute: (s) => {
      if (s.attrs.luck >= 50 || s.attrs.intelligence >= 45) {
        return {
          content: '凭借严谨的市场调研与敏锐眼光，你投资的高新科技板块逆势大涨，小金库利润丰厚！',
          type: 'positive',
          statChanges: { wealth: 15, happiness: 8 },
        };
      }
      return {
        content: '市场小幅震荡回调，你理性调整资产配置比例，平稳化解了短期波动风险。',
        type: 'normal',
        statChanges: { wealth: 2, happiness: 2 },
      };
    },
  },

  // 36 ~ 50 岁：壮年成熟期家庭与事业事件
  {
    id: 'e_range_mid_mentorship',
    minAge: 36,
    maxAge: 49,
    weight: 15,
    condition: (s) => s.attrs.intelligence >= 40,
    execute: () => ({
      content: '你主动悉心带教部门新入职的青年名校毕业生，被评为公司年度金牌导师，收获极佳人缘口碑。',
      type: 'positive',
      statChanges: { charm: 6, happiness: 8, intelligence: 3 },
    }),
  },
  {
    id: 'e_range_mid_family_trip',
    minAge: 36,
    maxAge: 49,
    weight: 15,
    execute: () => ({
      content: '暑期你安排了全家跨省深度自驾游，带着父母与妻儿在山水之间品尝地道风味，家庭其乐融融。',
      type: 'positive',
      statChanges: { happiness: 14, wealth: -4 },
    }),
  },
  {
    id: 'e_range_mid_reunion',
    minAge: 37,
    maxAge: 48,
    weight: 12,
    execute: () => ({
      content: '毕业二十周年同窗聚会上，老同学们欢聚一堂忆苦思甜。历经风雨沧桑，昔日同窗之谊历久弥香。',
      type: 'normal',
      statChanges: { happiness: 10, charm: 3 },
    }),
  },
  {
    id: 'e_range_mid_fitness',
    minAge: 38,
    maxAge: 49,
    weight: 15,
    execute: (s) => {
      if (s.attrs.strength >= 35) {
        return {
          content: '你坚持日常晨跑与器械力量训练，体脂率保持在青年水平，各项机能充沛，远离中年危机。',
          type: 'positive',
          statChanges: { strength: 8, charm: 4, happiness: 6 },
        };
      }
      return {
        content: '你戒掉了熬夜和宵夜习惯，开始泡温水枸杞并坚持规律快走，气色有了肉眼可见的改善。',
        type: 'normal',
        statChanges: { strength: 5, happiness: 4 },
      };
    },
  },

  // 51 ~ 65 岁：稳步荣休与资深长者事件
  {
    id: 'e_range_senior_consultant',
    minAge: 51,
    maxAge: 64,
    weight: 15,
    condition: (s) => s.attrs.wealth >= 50 || s.attrs.intelligence >= 50,
    execute: () => ({
      content: '凭借几十年积淀的深厚行业经验，你受邀担任行业高级战略顾问，为新兴独角兽企业把脉方向。',
      type: 'positive',
      statChanges: { wealth: 18, charm: 8, happiness: 10 },
    }),
  },
  {
    id: 'e_range_senior_tea_room',
    minAge: 52,
    maxAge: 64,
    weight: 15,
    execute: () => ({
      content: '你在家中布置了一间雅致的茶室，闲暇时烹泉沏茶，研读古籍先贤智慧，内心安详从容。',
      type: 'normal',
      statChanges: { happiness: 12, intelligence: 4, strength: 3 },
    }),
  },
  {
    id: 'e_range_senior_travel',
    minAge: 56,
    maxAge: 64,
    weight: 15,
    execute: () => ({
      content: '退休后没有了工作羁绊，你与老伴一同乘邮轮畅游蔚蓝大海，打卡祖国名山大川，生活浪漫多姿。',
      type: 'positive',
      statChanges: { happiness: 16, strength: 4, wealth: -3 },
    }),
  },

  // 66 ~ 85 岁：银发古稀岁月与天伦之乐
  {
    id: 'e_range_old_calligraphy',
    minAge: 66,
    maxAge: 85,
    weight: 15,
    execute: () => ({
      content: '你的太极与书法造诣日益精进，作品在老年文化艺术节上荣获金奖，被文化馆珍藏装裱。',
      type: 'positive',
      statChanges: { charm: 5, happiness: 12, strength: 4 },
    }),
  },
  {
    id: 'e_range_old_healthy_check',
    minAge: 67,
    maxAge: 85,
    weight: 15,
    execute: (s) => {
      if (s.attrs.strength >= 30) {
        return {
          content: '年度老干部全身体检显示心肺功能与血管弹性俱佳，主检医生竖起大拇指夸赞你的长寿体魄。',
          type: 'positive',
          statChanges: { strength: 6, happiness: 10 },
        };
      }
      return {
        content: '孝顺的儿女给你备齐了全套智能监测手环与理疗仪，家中常有后辈嘘寒问暖，晚年格外暖心。',
        type: 'normal',
        statChanges: { happiness: 10 },
      };
    },
  },
  {
    id: 'e_range_old_community',
    minAge: 71,
    maxAge: 85,
    weight: 15,
    execute: () => ({
      content: '你在社区花园里向邻里后辈传授养花与生活养生诀窍，街坊四邻无不敬重你这位德高望重的长辈。',
      type: 'normal',
      statChanges: { happiness: 12, charm: 4 },
    }),
  },

  // 86 ~ 105 岁：耄耋与期颐世纪传奇事件
  {
    id: 'e_range_centenarian_joy',
    minAge: 86,
    maxAge: 105,
    weight: 18,
    execute: () => ({
      content: '小玄孙迈着小短腿跑来甜甜地祝你“福如东海寿比南山”，欢声笑语充满庭院，天伦之福莫过于此。',
      type: 'positive',
      statChanges: { happiness: 20, strength: 3 },
    }),
  },
  {
    id: 'e_range_centenarian_interview',
    minAge: 89,
    maxAge: 105,
    weight: 15,
    execute: () => ({
      content: '省文史档案馆与地方长寿协会上门专访，将你的生平事迹整理为百年风云口述史，流传后世。',
      type: 'milestone',
      statChanges: { happiness: 18, charm: 8 },
    }),
  },
  {
    id: 'e_range_centenarian_peace',
    minAge: 90,
    maxAge: 105,
    weight: 20,
    execute: () => ({
      content: '你坐在藤椅上静看庭前花开花落，回溯一生跌宕起伏与辉煌平静，内心宁静超脱，物我两忘。',
      type: 'milestone',
      statChanges: { happiness: 22, strength: 4 },
    }),
  },
];
