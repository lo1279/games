import type { GameState } from '../types/game';

export interface LifeSummaryReport {
  score: number;
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';
  rankTitle: string;
  epitaph: string;
  highlights: string[];
  dimensions: {
    label: string;
    value: number; // 0 - 100
  }[];
  karmaEarned: number; // 本生结算功德币
}

export function evaluateLife(state: GameState): LifeSummaryReport {
  const { age, attrs, tags } = state;


  // 综合得分计算公式
  let score = 0;
  score += age * 5; // 寿元分
  score += Math.min(100, attrs.charm) * 2;
  score += Math.min(100, attrs.intelligence) * 2.5;
  score += Math.min(100, attrs.strength) * 2;
  score += Math.min(100, attrs.wealth) * 3;
  score += Math.min(100, attrs.happiness) * 2.5;
  score += Math.min(100, attrs.luck) * 1.5;
  score += tags.length * 15;

  if (tags.includes('羽化登仙')) score += 300;
  if (tags.includes('高考状元')) score += 80;
  if (tags.includes('商海弄潮儿') || tags.includes('投资神话')) score += 100;
  if (tags.includes('豪门贵客')) score += 60;

  score = Math.round(score);

  // 评级与称号
  let rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' = 'C';
  let rankTitle = '芸芸众生';
  let epitaph = '一抔黄土，红尘如梦。';

  if (tags.includes('羽化登仙') || score >= 900) {
    rank = 'SSS';
    rankTitle = '传奇飞仙 / 旷世伟人';
    epitaph = '朝游北海暮苍梧，袖里青蛇胆气粗。三界跳出红尘外，万古长青照玉壶！';
  } else if (score >= 750) {
    rank = 'SS';
    rankTitle = '天之骄子 / 行业巨擘';
    epitaph = '生当为人杰，叱咤风云几十载。功名利禄尽收眼底，不负天地走一遭！';
  } else if (score >= 600) {
    rank = 'S';
    rankTitle = '人生赢家 / 德高望重';
    epitaph = '功成身退，福寿绵长。家庭和睦儿孙绕膝，堪称人间顶格圆满！';
  } else if (score >= 450) {
    rank = 'A';
    rankTitle = '优裕安康 / 岁月静好';
    epitaph = '春有百花秋有月，夏有凉风冬有雪。莫道人间平凡好，平安喜乐最难求。';
  } else if (score >= 300) {
    rank = 'B';
    rankTitle = '安居乐业 / 踏实劳碌';
    epitaph = '踏实勤勉行人间，柴米油盐品酸甜。虽无滔天富贵势，无愧于心亦泰然。';
  } else {
    rank = 'C';
    rankTitle = '浮生草木 / 坎坷蹉跎';
    epitaph = '天地逆旅，百代过客。人生虽短憾事多，来世再求大鹏跃！';
  }

  // 高光亮点生成
  const highlights: string[] = [];
  if (age >= 100) highlights.push(`跨越世纪：享年 ${age} 岁，见证百年沧桑巨变`);
  else if (age >= 80) highlights.push(`福寿延绵：享年 ${age} 岁，得享天伦古稀高寿`);
  else if (age < 20) highlights.push(`如流星陨落：年仅 ${age} 岁，韶华早逝令人唏嘘`);

  if (attrs.wealth >= 80) highlights.push('富甲一方：坐拥惊人资产，财富冠绝同辈');
  if (attrs.intelligence >= 80) highlights.push('天纵奇才：才智超群绝伦，在领域内卓尔不群');
  if (attrs.charm >= 80) highlights.push('倾国倾城：魅力无可匹敌，收获无数倾慕与掌声');
  if (attrs.happiness >= 85) highlights.push('心态无敌：一生乐观豁达，从未被烦忧击垮');
  if (tags.includes('高考状元')) highlights.push('魁首夺魁：曾荣膺全省高考状元，名震四方');
  if (tags.includes('商海弄潮儿')) highlights.push('商界巨浪：亲手打造独角兽商业传奇');
  if (tags.includes('羽化登仙')) highlights.push('仙道终成：打破肉体桎梏，渡劫羽化登仙！');

  if (highlights.length === 0) {
    highlights.push('品行端正：在平凡的生活中恪守真我');
    highlights.push('踏实笃行：经历了人生的起落与温情');
  }

  // 六维属性归一化（0~100）
  const dimensions = [
    { label: '颜值魅力', value: Math.min(100, Math.max(10, Math.round(attrs.charm))) },
    { label: '智商才略', value: Math.min(100, Math.max(10, Math.round(attrs.intelligence))) },
    { label: '体质健康', value: Math.min(100, Math.max(10, Math.round(attrs.strength))) },
    { label: '家境财富', value: Math.min(100, Math.max(10, Math.round(attrs.wealth))) },
    { label: '快乐心态', value: Math.min(100, Math.max(10, Math.round(attrs.happiness))) },
    { label: '天命气运', value: Math.min(100, Math.max(10, Math.round(attrs.luck))) },
  ];

  // 计算功德点数结算
  let karmaEarned = Math.floor(age * 2) + Math.floor(attrs.wealth * 0.8);
  const totalCash = state.assets?.cash || 0;
  karmaEarned += Math.min(300, Math.floor(totalCash / 10));
  if (rank === 'SSS') karmaEarned += 800;
  else if (rank === 'SS') karmaEarned += 400;
  else if (rank === 'S') karmaEarned += 200;
  else if (rank === 'A') karmaEarned += 100;
  else if (rank === 'B') karmaEarned += 50;
  else karmaEarned += 20;

  if (tags.includes('羽化登仙')) karmaEarned += 500;
  if (tags.includes('福布斯富豪') || tags.includes('商业帝国敲钟')) karmaEarned += 300;
  karmaEarned = Math.max(10, Math.round(karmaEarned));

  return {
    score,
    rank,
    rankTitle,
    epitaph,
    highlights,
    dimensions,
    karmaEarned,
  };
}
