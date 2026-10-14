export interface EventChoice {
  text: string;
  description: string;
  effect: 'heal' | 'maxHp' | 'gold' | 'card' | 'relic' | 'damage';
  value?: number;
}

export interface MythEvent {
  id: string;
  title: string;
  mythology: string;
  story: string;
  choices: EventChoice[];
}

export const MYTH_EVENTS: MythEvent[] = [
  {
    id: 'event_yaochi',
    title: '华夏 · 昆仑瑶池仙酿',
    mythology: '华夏神话',
    story: '云雾缭绕之中，你偶然步入西王母的瑶池仙境。琼浆玉液在白玉池中翻涌，散发着诱人仙香。',
    choices: [
      {
        text: '痛饮瑶池仙酿',
        description: '恢复 25 点生命值',
        effect: 'heal',
        value: 25,
      },
      {
        text: '掬一捧池水洗练神魂',
        description: '最大生命值上限永久提升 10 点，并回复 10 点生命',
        effect: 'maxHp',
        value: 10,
      },
    ],
  },
  {
    id: 'event_delphi',
    title: '希腊 · 特尔斐神庙的阿波罗神谕',
    mythology: '希腊神话',
    story: '在帕纳塞斯山麓的古老神庙前，皮提亚女祭司被金色的阿波罗日光所笼罩，低语着命运的谶言。',
    choices: [
      {
        text: '献祭财富换取神谕馈赠',
        description: '获得 60 点神晶金币',
        effect: 'gold',
        value: 60,
      },
      {
        text: '沐浴太阳神阿波罗的光辉',
        description: '受到 6 点灼烫试炼，但获得 20 点生命上限强化',
        effect: 'maxHp',
        value: 15,
      },
    ],
  },
  {
    id: 'event_mimir',
    title: '北欧 · 密米尔之智慧泉',
    mythology: '北欧神话',
    story: '在世界之树第二根树根之下，巨神密米尔守护着汲取天地至理的智慧泉水。连神王奥丁曾在此以一眼换取一饮。',
    choices: [
      {
        text: '虔诚饮下一泓智泉',
        description: '恢复 15 点生命值，获得 50 点神晶金币',
        effect: 'gold',
        value: 50,
      },
      {
        text: '参悟泉水中的卢恩符文',
        description: '恢复全部生命值！',
        effect: 'heal',
        value: 999,
      },
    ],
  },
];
