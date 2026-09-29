import type { LifeDecision } from '../types/game';

export const DECISIONS_POOL: Record<string, LifeDecision> = {
  // 12 岁抉择
  decision_age_12: {
    id: 'decision_age_12',
    title: '少年韶华：课外发展的岔路口',
    description: '12岁面临初中分流，学校和家庭都在关注你的精力分配，你打算将业余重心放在哪里？',
    category: 'education',
    options: [
      {
        id: 'opt_olympiad',
        text: '进奥数与信息学集训队苦练',
        description: '需要足够的才智，将牺牲部分童年娱乐时间。',
        minReq: { intelligence: 20 },
        reqDesc: '智商 ≥ 20',
        execute: () => ({
          logText: '你进入了省重点初中的奥数集训队，夜以继日地攻克难题，思维逻辑突飞猛进！',
          statChanges: { intelligence: 12, happiness: -5, wealth: -2 },
          tagsGained: ['理科学霸'],
        }),
      },
      {
        id: 'opt_sports',
        text: '投身体育特长与竞技训练',
        description: '风雨无阻地奔跑在田径场上，锤炼体魄。',
        minReq: { strength: 20 },
        reqDesc: '体质 ≥ 20',
        execute: () => ({
          logText: '你参加了校田径与运动俱乐部，阳光晒黑了皮肤，身体像小牛犊一样结实敏捷！',
          statChanges: { strength: 14, charm: 6, happiness: 8 },
          tagsGained: ['运动新星'],
        }),
      },
      {
        id: 'opt_childhood',
        text: '享受无拘无束的快乐童年',
        description: '打游戏、抓泥鳅、看动漫，开心第一。',
        execute: () => ({
          logText: '你度过了无忧无虑的青葱岁月，结识了一群真挚的发小，身心格外健康明媚。',
          statChanges: { happiness: 18, strength: 5, intelligence: 2 },
          tagsGained: ['阳光少年'],
        }),
      },
    ],
  },

  // 18 岁高考/升学抉择
  decision_age_18: {
    id: 'decision_age_18',
    title: '成人礼：十八岁的人生第一考',
    description: '高考放榜的时刻来临，摆在面前的是决定未来起点的重要志愿方向：',
    category: 'education',
    options: [
      {
        id: 'opt_computer_science',
        text: '报考顶尖工科院校攻读计算机与AI',
        description: '踩在数字科技与人工智能的前沿浪潮上。',
        minReq: { intelligence: 35 },
        reqDesc: '智力 ≥ 35',
        execute: (state) => {
          const isTop = (state.attrs.intelligence + (state.attrs.luck / 2)) >= 55;
          return {
            logText: isTop
              ? '你以全省名列前茅的高分被顶级名校计算机系录取！代码成为你改造世界的利器。'
              : '你顺利进入重点高校软件工程专业，开启硬核编码日常。',
            statChanges: { intelligence: 16, wealth: 8 },
            tagsGained: [isTop ? '高考状元' : '工科学神'],
          };
        },
      },
      {
        id: 'opt_finance',
        text: '报考顶尖财经商学院，进军金融与商界',
        description: '学习资本运作与商业帝国逻辑。',
        minReq: { wealth: 25 },
        reqDesc: '家境 ≥ 25 或智力较高',
        execute: () => ({
          logText: '你进入著名商学院研读宏观经济与金融工程，在各类模拟投资与商赛中屡获佳绩。',
          statChanges: { wealth: 15, intelligence: 10, charm: 6 },
          tagsGained: ['金融新贵'],
        }),
      },
      {
        id: 'opt_arts',
        text: '投身艺术影视与设计殿堂',
        description: '追随内心的审美与灵感，用画笔或镜头惊艳世界。',
        minReq: { charm: 30 },
        reqDesc: '魅力/颜值 ≥ 30',
        execute: () => ({
          logText: '你凭借出众的气质与艺术灵气被艺术学府录取，作品迅速在年轻人圈子中走红。',
          statChanges: { charm: 18, happiness: 12 },
          tagsGained: ['新锐艺术家'],
        }),
      },
      {
        id: 'opt_stable',
        text: '选择传统师范或政法警校，追求安稳人生',
        description: '岁月静好，平稳可靠。',
        execute: () => ({
          logText: '你选择了一条稳定踏实的道路，在宁静的书香中积蓄底蕴，家人感到十分安心。',
          statChanges: { happiness: 12, strength: 8, wealth: 5 },
          tagsGained: ['踏实稳重'],
        }),
      },
    ],
  },

  // 22 岁毕业抉择
  decision_age_22: {
    id: 'decision_age_22',
    title: '初入江湖：毕业十字路口',
    description: '走出象牙塔，象牙塔外的风雨扑面而来，你的第一份职业归宿是？',
    category: 'career',
    options: [
      {
        id: 'opt_tech_giant',
        text: '斩获大厂核心研发/战略 Offer，迎接 996 挑战',
        description: '高薪酬、高强度、快节奏。',
        minReq: { intelligence: 35 },
        reqDesc: '智力 ≥ 35',
        execute: () => ({
          logText: '你入职头部科技大厂，虽然通宵复盘很累，但年薪与期权让你在同龄人中一骑绝尘！',
          statChanges: { wealth: 28, intelligence: 8, strength: -12, happiness: -6 },
          tagsGained: ['大厂核心骨干'],
        }),
      },
      {
        id: 'opt_civil_servant',
        text: '百里挑一成功考取选调生 / 体制内公职',
        description: '工作稳定有保障，社会地位尊崇。',
        execute: () => ({
          logText: '你以优异的笔面试成绩考取公职，作息规律，为民服务，社会声望与幸福感拉满！',
          statChanges: { happiness: 18, strength: 8, wealth: 10, charm: 6 },
          tagsGained: ['公职先锋'],
        }),
      },
      {
        id: 'opt_start_business',
        text: '不甘平庸！拉拢伙伴直接下海自主创业',
        description: '高风险高回报，可能是独角兽，也可能血本无归。',
        execute: (state) => {
          const score = state.attrs.intelligence + state.attrs.wealth + state.attrs.luck;
          if (score >= 95) {
            return {
              logText: '你的创业项目精准切中行业风口，迅速获得千万级天使轮融资，轰动业界！',
              statChanges: { wealth: 50, intelligence: 15, happiness: 15, charm: 12 },
              tagsGained: ['商海弄潮儿'],
            };
          } else {
            return {
              logText: '初次创业历经资金链危机与商海险恶，虽然暂时交了学费，但你淬炼出了坚毅的内心。',
              statChanges: { wealth: -15, intelligence: 15, strength: -5, happiness: -8 },
              tagsGained: ['打不死的小强'],
            };
          }
        },
      },
      {
        id: 'opt_academia',
        text: '继续深造，攻读博士研究生从事学术研究',
        description: '探索未知的知识边界，攀登科学高峰。',
        minReq: { intelligence: 40 },
        reqDesc: '智力 ≥ 40',
        execute: () => ({
          logText: '你进入国家级实验室深造，发表多篇高水平顶会论文，成为导师眼中的科研新星。',
          statChanges: { intelligence: 22, charm: 5, wealth: 2, happiness: 6 },
          tagsGained: ['青年学者'],
        }),
      },
    ],
  },

  // 27 岁感情婚姻抉择
  decision_age_27: {
    id: 'decision_age_27',
    title: '缘定今生：步入婚姻的门槛',
    description: '27岁正是谈婚论嫁的黄金时节，面对亲友的期盼与当下的生活，你决定：',
    category: 'love',
    options: [
      {
        id: 'opt_marry_soulmate',
        text: '与相伴知心的恋人走进婚姻殿堂',
        description: '携手筑起爱的小窝，平淡也是真。',
        execute: () => ({
          logText: '婚礼现场温馨感人，你们交换婚戒许下一生诺言，幸福感充盈在每个柴米油盐的日子里。',
          statChanges: { happiness: 25, wealth: -10, strength: 5 },
          tagsGained: ['美满姻缘'],
        }),
      },
      {
        id: 'opt_single_career',
        text: '暂缓婚事，全副身心冲刺事业与财富自由',
        description: '智者不入爱河，建设美丽中国。',
        execute: () => ({
          logText: '你顶住了催婚压力，独自一人在商海与职场自由穿梭，资产与专业声誉持续飙升！',
          statChanges: { wealth: 22, intelligence: 8, happiness: 8 },
          tagsGained: ['搞钱狂人'],
        }),
      },
      {
        id: 'opt_wealthy_marriage',
        text: '与名门望族豪门联姻',
        description: '借势腾飞，需要足够的个人魅力或家境背书。',
        minReq: { charm: 40 },
        reqDesc: '魅力/颜值 ≥ 40',
        execute: () => ({
          logText: '世纪婚礼轰动全城，两大名门结合让你的商业资源与人脉瞬间跃升到顶级圈层！',
          statChanges: { wealth: 45, charm: 12, happiness: 5 },
          tagsGained: ['豪门贵客'],
        }),
      },
    ],
  },

  // 35 岁壮年中流砥柱
  decision_age_35: {
    id: 'decision_age_35',
    title: '中年试炼：风浪中的抉择',
    description: '35岁是人生的中流砥柱，身体发出疲劳信号，职场与财富的机遇同样波诡云谲。',
    category: 'career',
    options: [
      {
        id: 'opt_lead_growth',
        text: '全力冲击成为行业领军合伙人/高管',
        description: '承担更大责任，带领百人团队。',
        execute: () => ({
          logText: '你成功跻身企业决策层核心，出入高端峰会，威望卓著，只是鬓角添了几缕白发。',
          statChanges: { wealth: 35, intelligence: 10, strength: -10, happiness: 8 },
          tagsGained: ['商界领袖'],
        }),
      },
      {
        id: 'opt_slow_life',
        text: '降低物欲，平衡生活，多陪伴家人与孩子',
        description: '回归生活本质，享受健康阳光。',
        execute: () => ({
          logText: '你推掉了无意义的无效社交，坚持每日晨跑烹饪，陪伴孩子成长，内心宁静而丰盈。',
          statChanges: { happiness: 25, strength: 15, wealth: 5 },
          tagsGained: ['人生赢家'],
        }),
      },
      {
        id: 'opt_all_in_invest',
        text: '拿出核心积蓄，重仓投资前沿硬科技与新兴资产',
        description: '高风险投机博弈，胜负在此一举。',
        execute: (state) => {
          if (state.attrs.luck >= 45 || state.attrs.intelligence >= 60) {
            return {
              logText: '你的商业预判极其精准！重仓的核心项目迎来爆发式暴涨，个人身价翻了数倍！',
              statChanges: { wealth: 60, happiness: 20 },
              tagsGained: ['投资神话'],
            };
          } else {
            return {
              logText: '市场突遭黑天鹅事件，投资遭遇重大回撤，所幸留有后手，尚保住了家庭底盘。',
              statChanges: { wealth: -20, happiness: -12 },
              tagsGained: ['历经波折'],
            };
          }
        },
      },
    ],
  },

  // 50 岁隐藏修真奇遇 (若有灵根且体质良好)
  decision_immortal_50: {
    id: 'decision_immortal_50',
    title: '异象天降：天地灵气复苏',
    description: '雷雨之夜，你体内潜藏数十载的灵根突然金光大炽，虚空中隐约传来仙鹤长鸣！',
    category: 'destiny',
    options: [
      {
        id: 'opt_cultivate',
        text: '顺应天意，参悟无上仙法，引气入体！',
        description: '凡人终有一死，而仙道长生久视！',
        minReq: { strength: 40 },
        reqDesc: '体质 ≥ 40',
        execute: () => ({
          logText: '你洗去一身凡尘铅华，丹田凝聚出纯阳金丹，白发转黑，重获百年生机与神通！',
          statChanges: { strength: 50, happiness: 30, charm: 25 },
          tagsGained: ['金丹大道', '脱胎换骨'],
        }),
      },
      {
        id: 'opt_mundane',
        text: '将灵气化入平凡生活，强身健体延年益寿',
        description: '珍惜红尘烟火，不求虚妄飞升。',
        execute: () => ({
          logText: '你以平和心对待造化，灵气暗中滋养着你与家人的体魄，无病无灾，益寿延年。',
          statChanges: { strength: 30, happiness: 20, wealth: 15 },
          tagsGained: ['福寿双全'],
        }),
      },
    ],
  },
};
