import React, { useState } from 'react';
import type { Hero } from './types/hero';
import type { Enemy } from './types/enemy';
import type { Card } from './types/card';
import type { Relic, MapNode } from './types/relic';
import type { Potion } from './types/potion';
import { HEROES } from './data/heroes';
import { ALL_CARDS, CARD_MAP, upgradeCard } from './data/cards';
import { ALL_RELICS } from './data/relics';
import { ALL_POTIONS, getRandomPotion } from './data/potions';
import { createEnemyInstance, ENEMY_TEMPLATES } from './data/enemies';
import { MYTH_EVENTS } from './data/events';
import type { MythEvent, EventChoice } from './data/events';
import { HeroSelect } from './components/HeroSelect';
import { BattleArena } from './components/BattleArena';
import { MapView } from './components/MapView';
import { RewardModal } from './components/RewardModal';
import { RestModal } from './components/RestModal';
import { ShopModal } from './components/ShopModal';
import { EventModal } from './components/EventModal';
import { DeckViewerModal } from './components/DeckViewerModal';
import { CardUpgradeModal } from './components/CardUpgradeModal';
import { sounds } from './audio/soundSynth';
import confetti from 'canvas-confetti';
import { Trophy, Skull, RotateCcw } from 'lucide-react';

type GameState = 'HERO_SELECT' | 'MAP' | 'BATTLE' | 'REWARD' | 'REST' | 'SHOP' | 'EVENT' | 'VICTORY' | 'DEFEAT';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('HERO_SELECT');

  // 玩家状态
  const [hero, setHero] = useState<Hero>(HEROES[0]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [relics, setRelics] = useState<Relic[]>([]);
  const [potions, setPotions] = useState<(Potion | null)[]>([null, null]);
  
  // 战役推进状态 (1 ~ 3 幕)
  const [currentAct, setCurrentAct] = useState<1 | 2 | 3>(1);
  const [hadesRevived, setHadesRevived] = useState<boolean>(false);

  // 战斗状态
  const [enemy, setEnemy] = useState<Enemy>(createEnemyInstance('yaksha'));
  const [hand, setHand] = useState<Card[]>([]);
  const [drawPile, setDrawPile] = useState<Card[]>([]);
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);

  // 地图状态
  const [currentFloor, setCurrentFloor] = useState<number>(0);
  const [floors, setFloors] = useState<MapNode[][]>([]);
  
  // 模态弹窗状态
  const [rewardGold, setRewardGold] = useState<number>(25);
  const [rewardCardChoices, setRewardCardChoices] = useState<Card[]>([]);
  const [currentEvent, setCurrentEvent] = useState<MythEvent>(MYTH_EVENTS[0]);
  const [showDeckViewer, setShowDeckViewer] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeSource, setUpgradeSource] = useState<'rest' | 'shop'>('rest');

  // 初始化或切换 Act 时生成爬塔地图网络
  const generateMapForAct = (act: 1 | 2 | 3): MapNode[][] => {
    if (act === 1) {
      return [
        [
          { id: 'a1_f0_1', type: 'battle', name: '巡海夜叉巡逻队', floor: 0, columnIndex: 0, visited: false, available: true, connections: ['a1_f1_1', 'a1_f1_2'] },
          { id: 'a1_f0_2', type: 'battle', name: '狂暴半人马先锋', floor: 0, columnIndex: 1, visited: false, available: true, connections: ['a1_f1_2', 'a1_f1_3'] },
        ],
        [
          { id: 'a1_f1_1', type: 'event', name: '太古神碑奇遇', floor: 1, columnIndex: 0, visited: false, available: false, connections: ['a1_f2_1'] },
          { id: 'a1_f1_2', type: 'battle', name: '霜巨人哨兵', floor: 1, columnIndex: 1, visited: false, available: false, connections: ['a1_f2_1', 'a1_f2_2'] },
          { id: 'a1_f1_3', type: 'shop', name: '第一幕 · 凡尘裂隙黑市', floor: 1, columnIndex: 2, visited: false, available: false, connections: ['a1_f2_2'] },
        ],
        [
          { id: 'a1_f2_1', type: 'elite', name: '九头蛇 · 海德拉', floor: 2, columnIndex: 0, visited: false, available: false, connections: ['a1_f3_1'] },
          { id: 'a1_f2_2', type: 'elite', name: '魔狼芬里尔之嗣', floor: 2, columnIndex: 1, visited: false, available: false, connections: ['a1_f3_1'] },
        ],
        [
          { id: 'a1_f3_1', type: 'rest', name: '诸神圣火营地', floor: 3, columnIndex: 0, visited: false, available: false, connections: ['a1_f4_boss'] },
        ],
        [
          { id: 'a1_f4_boss', type: 'boss', name: '第一幕守关 · 蚩尤战魂', floor: 4, columnIndex: 0, visited: false, available: false, connections: [] },
        ],
      ];
    } else if (act === 2) {
      return [
        [
          { id: 'a2_f0_1', type: 'battle', name: '迷宫牛头怪', floor: 0, columnIndex: 0, visited: false, available: true, connections: ['a2_f1_1', 'a2_f1_2'] },
          { id: 'a2_f0_2', type: 'battle', name: '熔岩巨魔守卫', floor: 0, columnIndex: 1, visited: false, available: true, connections: ['a2_f1_2', 'a2_f1_3'] },
        ],
        [
          { id: 'a2_f1_1', type: 'shop', name: '泰坦神圣黑市', floor: 1, columnIndex: 0, visited: false, available: false, connections: ['a2_f2_1'] },
          { id: 'a2_f1_2', type: 'event', name: '潘多拉古匣奇遇', floor: 1, columnIndex: 1, visited: false, available: false, connections: ['a2_f2_1', 'a2_f2_2'] },
          { id: 'a2_f1_3', type: 'battle', name: '狂暴火灵精英', floor: 1, columnIndex: 2, visited: false, available: false, connections: ['a2_f2_2'] },
        ],
        [
          { id: 'a2_f2_1', type: 'elite', name: '芬里尔狂暴巨狼', floor: 2, columnIndex: 0, visited: false, available: false, connections: ['a2_f3_1'] },
          { id: 'a2_f2_2', type: 'event', name: '奥林匹斯回音', floor: 2, columnIndex: 1, visited: false, available: false, connections: ['a2_f3_1'] },
        ],
        [
          { id: 'a2_f3_1', type: 'rest', name: '泰坦圣殿静息所', floor: 3, columnIndex: 0, visited: false, available: false, connections: ['a2_f4_boss'] },
        ],
        [
          { id: 'a2_f4_boss', type: 'boss', name: '第二幕守关 · 克洛诺斯', floor: 4, columnIndex: 0, visited: false, available: false, connections: [] },
        ],
      ];
    } else {
      return [
        [
          { id: 'a3_f0_1', type: 'battle', name: '深渊腐化巨兽', floor: 0, columnIndex: 0, visited: false, available: true, connections: ['a3_f1_1', 'a3_f1_2'] },
          { id: 'a3_f0_2', type: 'elite', name: '堕落女武神', floor: 0, columnIndex: 1, visited: false, available: true, connections: ['a3_f1_2'] },
        ],
        [
          { id: 'a3_f1_1', type: 'shop', name: '世界树底黑市', floor: 1, columnIndex: 0, visited: false, available: false, connections: ['a3_f2_1'] },
          { id: 'a3_f1_2', type: 'event', name: '诸神黄昏残响', floor: 1, columnIndex: 1, visited: false, available: false, connections: ['a3_f2_1'] },
        ],
        [
          { id: 'a3_f2_1', type: 'rest', name: '世界树根末日圣火', floor: 2, columnIndex: 0, visited: false, available: false, connections: ['a3_f3_boss'] },
        ],
        [
          { id: 'a3_f3_boss', type: 'boss', name: '终极 BOSS · 灭世黑龙尼德霍格', floor: 3, columnIndex: 0, visited: false, available: false, connections: [] },
        ],
      ];
    }
  };

  // 洗牌洗混算法
  const shuffle = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // 1. 选择英雄开始游戏
  const handleSelectHero = (chosenHero: Hero) => {
    setHero(chosenHero);
    const initialDeck = chosenHero.starterDeckIds
      .map(id => CARD_MAP.get(id))
      .filter((c): c is Card => !!c);
    setDeck(initialDeck);
    
    // 初始神器与药水
    if (chosenHero.id === 'wukong') {
      setRelics([ALL_RELICS[0]]); // 定海神针残片
      setPotions([ALL_POTIONS[0], null]); // 九转金丹
    } else if (chosenHero.id === 'yang_jian') {
      setRelics([ALL_RELICS[0]]); // 定海神针残片
      setPotions([ALL_POTIONS[3], null]); // 金刚护体神液
    } else if (chosenHero.id === 'thor') {
      setRelics([ALL_RELICS[1]]); // 宙斯雷晶
      setPotions([ALL_POTIONS[4], null]); // 雷暴天露
    } else if (chosenHero.id === 'hades') {
      setRelics([ALL_RELICS[3]]); // 冥王硬币
      setPotions([ALL_POTIONS[5], null]); // 三昧真火灵油
    } else {
      setRelics([ALL_RELICS[2]]); // 金苹果
      setPotions([ALL_POTIONS[1], null]); // 奥林匹斯仙露
    }

    setCurrentAct(1);
    setHadesRevived(false);
    const newMap = generateMapForAct(1);
    setFloors(newMap);
    setCurrentFloor(0);
    setGameState('MAP');
  };

  // 2. 开启战斗
  const startCombat = (enemyTemplateId: string) => {
    const newEnemy = createEnemyInstance(enemyTemplateId);
    
    // 神器战斗前触发
    if (relics.some(r => r.id === 'relic_zeus_spark')) {
      newEnemy.status.shock += 2;
    }

    setEnemy(newEnemy);
    setHero(prev => ({ ...prev, shield: 0, energy: prev.maxEnergy }));

    // 洗牌与抽初始手牌
    const shuffled = shuffle(deck);
    const initialHand = shuffled.slice(0, 5);
    const restPile = shuffled.slice(5);

    // 抽牌音效
    initialHand.forEach((_, idx) => {
      setTimeout(() => sounds.playCardDraw(), idx * 70);
    });

    setHand(initialHand);
    setDrawPile(restPile);
    setDiscardPile([]);
    setIsPlayerTurn(true);
    setCombatLogs([`你遭遇了【${newEnemy.name}】！拔出神兵，准备迎战！`]);
    setGameState('BATTLE');
  };

  // 3. 抽牌逻辑
  const drawCards = (count: number, currentHand: Card[], currentDraw: Card[], currentDiscard: Card[]) => {
    let nextHand = [...currentHand];
    let nextDraw = [...currentDraw];
    let nextDiscard = [...currentDiscard];

    for (let i = 0; i < count; i++) {
      if (nextDraw.length === 0) {
        if (nextDiscard.length === 0) break;
        nextDraw = shuffle(nextDiscard);
        nextDiscard = [];
        sounds.playShield();
      }
      const card = nextDraw.shift();
      if (card) {
        nextHand.push(card);
        sounds.playCardDraw();
      }
    }

    return { nextHand, nextDraw, nextDiscard };
  };

  // 战术法宝药水使用
  const handleUsePotion = (potionIdx: number) => {
    const potion = potions[potionIdx];
    if (!potion || !isPlayerTurn) return;

    sounds.playBuff();
    const eff = potion.effect;
    const logs: string[] = [`🧪 饮下【${potion.name}】！`];

    let newHeroHp = hero.hp;
    let newHeroEnergy = hero.energy;
    let newHeroShield = hero.shield;
    let newEnemyHp = enemy.hp;
    const newEnemyStatus = { ...enemy.status };

    if (eff.heal) {
      newHeroHp = Math.min(hero.maxHp, newHeroHp + eff.heal);
      logs.push(`💖 恢复了 ${eff.heal} 点生命值！`);
    }
    if (eff.energy) {
      newHeroEnergy += eff.energy;
      logs.push(`⚡ 恢复了 ${eff.energy} 点神力！`);
    }
    if (eff.shield) {
      newHeroShield += eff.shield;
      logs.push(`🛡️ 获得了 ${eff.shield} 点坚不可摧护盾！`);
    }
    if (eff.strength) {
      // 永久力量加成
      hero.trait.description += ` [神酿提升力量+${eff.strength}]`;
      logs.push(`⚔️ 威能暴涨，获得 ${eff.strength} 点力量！`);
    }
    if (eff.damage) {
      newEnemyHp = Math.max(0, newEnemyHp - eff.damage);
      logs.push(`💥 降下天威，对敌人造成 ${eff.damage} 点真实法宝伤害！`);
    }
    if (eff.vulnerable) {
      newEnemyStatus.vulnerable += eff.vulnerable;
      logs.push(`💔 附加 ${eff.vulnerable} 层破甲！`);
    }
    if (eff.burn) {
      newEnemyStatus.burn += eff.burn;
      logs.push(`🔥 附加 ${eff.burn} 层灼烧！`);
    }

    // 抽牌效果
    if (eff.draw) {
      const drawn = drawCards(eff.draw, hand, drawPile, discardPile);
      setHand(drawn.nextHand);
      setDrawPile(drawn.nextDraw);
      setDiscardPile(drawn.nextDiscard);
    }

    // 消耗该药水
    setPotions(prev => {
      const updated = [...prev];
      updated[potionIdx] = null;
      return updated;
    });

    setHero(prev => ({
      ...prev,
      hp: newHeroHp,
      energy: newHeroEnergy,
      shield: newHeroShield,
    }));

    setEnemy(prev => ({
      ...prev,
      hp: newEnemyHp,
      status: newEnemyStatus,
    }));

    setCombatLogs(prev => [...prev.slice(-6), ...logs]);

    if (newEnemyHp <= 0) {
      handleCombatVictory({ ...enemy, hp: 0 });
    }
  };

  // 4. 玩家打出卡牌
  const handlePlayCard = (card: Card) => {
    if (!isPlayerTurn || hero.energy < card.cost) return;

    // 扣除神力
    let newHeroEnergy = hero.energy - card.cost;
    let newHeroHp = hero.hp;
    let newHeroShield = hero.shield;
    let newEnemyHp = enemy.hp;
    let newEnemyShield = enemy.shield;
    const newEnemyStatus = { ...enemy.status };
    const logs: string[] = [];

    // 执行卡牌效果
    const eff = card.effect;

    // 伤害计算 (支持连击 repeat 次数循环)
    if (eff.damage) {
      const repeatCount = eff.repeat || 1;
      let totalDmgDealt = 0;

      for (let r = 0; r < repeatCount; r++) {
        let dmg = eff.damage;
        // 破甲易伤 +50%
        if (newEnemyStatus.vulnerable > 0) {
          dmg = Math.floor(dmg * 1.5);
        }
        // 孙悟空被动或连击
        if (hero.id === 'wukong') {
          dmg += 1;
        }
        // 杨戬天眼被动：敌方有破甲时额外增伤 50%
        if (hero.id === 'yang_jian' && newEnemyStatus.vulnerable > 0) {
          dmg = Math.floor(dmg * 1.5);
          if (r === 0) logs.push(`👁️ 杨戬【天眼破障】洞悉死穴，暴击提升 50% 伤害！`);
        }
        // 托尔感电暴击
        if (hero.id === 'thor' && newEnemyStatus.shock > 0) {
          dmg = Math.floor(dmg * 1.5);
          if (r === 0) logs.push(`⚡ 托尔神力触发【雷霆暴击】！`);
        }

        // 扣除护盾后扣生命
        if (newEnemyShield >= dmg) {
          newEnemyShield -= dmg;
          sounds.playShield();
        } else {
          const remainingDmg = dmg - newEnemyShield;
          newEnemyShield = 0;
          newEnemyHp = Math.max(0, newEnemyHp - remainingDmg);
          sounds.playAttack();
        }

        // 感电追加雷击
        if (newEnemyStatus.shock > 0) {
          const shockDmg = newEnemyStatus.shock * 4;
          newEnemyHp = Math.max(0, newEnemyHp - shockDmg);
          sounds.playLightning();
          logs.push(`⚡ 感电引发连锁雷暴，追加 ${shockDmg} 点雷电真实伤害！`);
        }

        totalDmgDealt += dmg;
        if (newEnemyHp <= 0) break;
      }

      if (repeatCount > 1) {
        logs.push(`${hero.name} 施放【${card.name}】，连续打击 ${repeatCount} 次，共计造成 ${totalDmgDealt} 点伤害！`);
      } else {
        logs.push(`${hero.name} 施放【${card.name}】，造成 ${totalDmgDealt} 点伤害！`);
      }
    }

    // 护盾效果
    if (eff.shield) {
      newHeroShield += eff.shield;
      sounds.playShield();
      logs.push(`${hero.name} 凝聚神力，获得 ${eff.shield} 点护盾！`);
    }

    // 治疗效果
    if (eff.heal) {
      newHeroHp = Math.min(hero.maxHp, newHeroHp + eff.heal);
      logs.push(`${hero.name} 沐浴神辉，恢复了 ${eff.heal} 点生命值！`);
    }

    // 神力回复
    if (eff.energy) {
      newHeroEnergy += eff.energy;
    }

    // 反噬自损
    if (eff.recoil) {
      newHeroHp = Math.max(1, newHeroHp - eff.recoil);
      logs.push(`⚠️ 神术反噬，自身受到 ${eff.recoil} 点反噬伤害！`);
    }

    // 异常状态施加
    if (eff.vulnerable) newEnemyStatus.vulnerable += eff.vulnerable;
    if (eff.weak) newEnemyStatus.weak += eff.weak;
    if (eff.shock) newEnemyStatus.shock += eff.shock;
    if (eff.burn) newEnemyStatus.burn += eff.burn;

    // 更新手牌与弃牌堆
    const updatedHand = hand.filter(c => c !== card);
    const updatedDiscard = [...discardPile, card];

    // 如果包含抽牌效果
    let finalHand = updatedHand;
    let finalDraw = drawPile;
    let finalDiscard = updatedDiscard;

    if (eff.draw) {
      const drawn = drawCards(eff.draw, updatedHand, drawPile, updatedDiscard);
      finalHand = drawn.nextHand;
      finalDraw = drawn.nextDraw;
      finalDiscard = drawn.nextDiscard;
    }

    setHero(prev => ({
      ...prev,
      energy: newHeroEnergy,
      hp: newHeroHp,
      shield: newHeroShield,
    }));

    setEnemy(prev => ({
      ...prev,
      hp: newEnemyHp,
      shield: newEnemyShield,
      status: newEnemyStatus,
    }));

    setHand(finalHand);
    setDrawPile(finalDraw);
    setDiscardPile(finalDiscard);
    setCombatLogs(prev => [...prev.slice(-6), ...logs]);

    // 检查敌人是否死亡
    if (newEnemyHp <= 0) {
      handleCombatVictory({ ...enemy, hp: 0 });
    }
  };

  // 5. 战斗胜利处理
  const handleCombatVictory = (defeatedEnemy: Enemy) => {
    sounds.playVictory();
    
    // 金苹果回血神器
    if (relics.some(r => r.id === 'relic_golden_apple')) {
      setHero(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 10) }));
    }

    // 战斗胜利有概率掉落神丹法宝
    if (Math.random() < 0.45) {
      setPotions(prev => {
        const emptyIdx = prev.findIndex(p => p === null);
        if (emptyIdx !== -1) {
          const droppedPotion = getRandomPotion();
          const nextPotions = [...prev];
          nextPotions[emptyIdx] = droppedPotion;
          return nextPotions;
        }
        return prev;
      });
    }

    // 判断是否击败 Boss
    if (defeatedEnemy.isBoss) {
      if (currentAct === 1) {
        // 第一幕 Boss 蚩尤战魂倒下，晋升第二幕
        sounds.playVictory();
        setCurrentAct(2);
        const act2Map = generateMapForAct(2);
        setFloors(act2Map);
        setCurrentFloor(0);
        setHero(prev => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + 25), // 跨幕回血
          gold: prev.gold + 80,
        }));
        setCombatLogs(['你斩杀了【兵主 · 蚩尤战魂】！第一幕裂隙平息，你踏入了泰坦圣所！']);
        setGameState('MAP');
        return;
      } else if (currentAct === 2) {
        // 第二幕 Boss 克洛诺斯倒下，晋升第三幕
        sounds.playVictory();
        setCurrentAct(3);
        const act3Map = generateMapForAct(3);
        setFloors(act3Map);
        setCurrentFloor(0);
        setHero(prev => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + 30),
          gold: prev.gold + 100,
        }));
        setCombatLogs(['时空泰坦【克洛诺斯】轰然倒下！诸神黄昏降临世界之树深渊！']);
        setGameState('MAP');
        return;
      } else {
        // 第三幕 终极 Boss 尼德霍格斩杀，完全通关
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        setGameState('VICTORY');
        return;
      }
    }

    // 战胜普通与精英怪物奖励
    const availablePool = ALL_CARDS.filter(c => c.rarity !== 'starter');
    const shuffledPool = shuffle(availablePool);
    const choices = shuffledPool.slice(0, 3);

    const goldEarned = defeatedEnemy.isElite ? 50 : 25;
    setRewardGold(goldEarned);
    setRewardCardChoices(choices);
    setHero(prev => ({ ...prev, gold: prev.gold + goldEarned }));
    setGameState('REWARD');
  };

  // 6. 结束玩家回合，轮到敌方行动
  const handleEndTurn = () => {
    if (!isPlayerTurn) return;
    setIsPlayerTurn(false);

    const initialLogs: string[] = [];
    let currentEnemyHp = enemy.hp;
    let currentEnemyStatus = { ...enemy.status };

    // 雅典娜被动：未破之盾反弹 50% 真实伤害
    if (hero.id === 'athena' && hero.shield > 0) {
      const reflectDmg = Math.floor(hero.shield * 0.5);
      if (reflectDmg > 0) {
        sounds.playShield();
        initialLogs.push(`🦉 雅典娜【神盾反震】触发，对敌人反弹 ${reflectDmg} 点真实伤害！`);
        currentEnemyHp = Math.max(0, currentEnemyHp - reflectDmg);
      }
    }

    // 杨戬被动：回合结束哮天犬额外扑咬 5 点真实伤害
    if (hero.id === 'yang_jian') {
      sounds.playAttack();
      initialLogs.push(`🐕 哮天犬凌空扑咬，追加造成 5 点破甲伤害！`);
      currentEnemyHp = Math.max(0, currentEnemyHp - 5);
    }

    // 即时更新反伤后的血量与日志
    setEnemy(prev => ({ ...prev, hp: currentEnemyHp }));
    if (initialLogs.length > 0) {
      setCombatLogs(prev => [...prev.slice(-6), ...initialLogs]);
    }

    // 若反弹直接斩杀敌人，立刻进入胜利阶段并终止怪兽行动
    if (currentEnemyHp <= 0) {
      setTimeout(() => handleCombatVictory({ ...enemy, hp: 0 }), 500);
      return;
    }

    // 敌人行动延迟模拟沉浸感
    setTimeout(() => {
      const enemyLogs: string[] = [];
      let enemyHpAfterBurn = currentEnemyHp;

      // 灼烧状态在回合初真实掉血
      if (currentEnemyStatus.burn > 0) {
        const burnDmg = currentEnemyStatus.burn * 3;
        enemyHpAfterBurn = Math.max(0, enemyHpAfterBurn - burnDmg);
        sounds.playAttack();
        enemyLogs.push(`🔥 业火焚身，敌人受到 ${burnDmg} 点真实灼烧伤害！`);
      }

      if (enemyHpAfterBurn <= 0) {
        setEnemy(prev => ({ ...prev, hp: 0 }));
        handleCombatVictory({ ...enemy, hp: 0 });
        return;
      }

      // 执行敌人意图
      let newHeroHp = hero.hp;
      let newHeroShield = hero.shield;
      // 敌方护盾在新行动轮开始时重置
      let newEnemyShield = 0;

      const { intent } = enemy;

      if (intent.type === 'attack' && intent.value) {
        // 力量增加攻击力，虚弱减少 25% 伤害
        let baseDmg = intent.value + (currentEnemyStatus.strength || 0);
        if (currentEnemyStatus.weak > 0) {
          baseDmg = Math.max(1, Math.floor(baseDmg * 0.75));
          enemyLogs.push(`📉 敌人受【虚弱】限制，攻击威力削弱 25%！`);
        }

        let totalDmg = baseDmg;
        if (intent.multiHit) totalDmg *= intent.multiHit;
        
        // 孙悟空金刚不坏被动减伤
        if (hero.id === 'wukong') {
          totalDmg = Math.max(1, totalDmg - 4);
          enemyLogs.push(`🐒 齐天大圣【金刚不坏】护体，减免 4 点伤害！`);
        }

        if (newHeroShield >= totalDmg) {
          newHeroShield -= totalDmg;
          sounds.playShield();
        } else {
          const dmg = totalDmg - newHeroShield;
          newHeroShield = 0;
          newHeroHp = Math.max(0, newHeroHp - dmg);
          sounds.playAttack();
        }
        enemyLogs.push(`⚔️ ${enemy.name} 发动攻击，造成 ${totalDmg} 点打击！`);
      } else if (intent.type === 'defend' && intent.value) {
        newEnemyShield = intent.value;
        sounds.playShield();
        enemyLogs.push(`🛡️ ${enemy.name} 展开神圣御守，获得 ${intent.value} 点护盾！`);
      } else if (intent.type === 'buff') {
        currentEnemyStatus.strength += 3;
        enemyLogs.push(`✨ ${enemy.name} 威能暴涨，力量提升 3 点！`);
      } else if (intent.type === 'debuff') {
        enemyLogs.push(`💀 ${enemy.name} 降下凶煞诅咒！`);
      }

      // 哈迪斯【冥河不灭】复活被动判定
      if (newHeroHp <= 0 && hero.id === 'hades' && !hadesRevived) {
        setHadesRevived(true);
        sounds.playVictory();
        newHeroHp = Math.floor(hero.maxHp * 0.35);
        currentEnemyStatus.burn += 4;
        enemyLogs.push(`💀 哈迪斯触发【冥河不灭】！自幽冥黄泉归来，恢复 ${newHeroHp} 点生命，并引燃全场冥火！`);
      }

      // 检查玩家是否阵亡
      if (newHeroHp <= 0) {
        sounds.playDefeat();
        setGameState('DEFEAT');
        return;
      }

      // 回合状态衰减 (破甲、虚弱、灼烧层数扣除 1)
      const nextEnemyStatus = {
        ...currentEnemyStatus,
        vulnerable: Math.max(0, currentEnemyStatus.vulnerable - 1),
        weak: Math.max(0, currentEnemyStatus.weak - 1),
        burn: Math.max(0, currentEnemyStatus.burn - 1),
      };

      // 准备敌人下回合意图
      const template = ENEMY_TEMPLATES.find(t => enemy.id.startsWith(t.id)) || ENEMY_TEMPLATES[0];
      const nextIntent = template.getIntents(enemy.turnCount + 1);

      // 回合开始神器触发：定海神针残片
      let bonusShield = 0;
      if (relics.some(r => r.id === 'relic_jingu_shard')) {
        bonusShield += 4;
      }

      // 玩家手牌全部弃置，抽满 5 张新牌
      const allDiscards = [...discardPile, ...hand];
      const drawn = drawCards(5, [], drawPile, allDiscards);

      setHero(prev => ({
        ...prev,
        hp: newHeroHp,
        shield: bonusShield,
        energy: prev.maxEnergy,
      }));

      setEnemy(prev => ({
        ...prev,
        hp: enemyHpAfterBurn,
        shield: newEnemyShield,
        status: nextEnemyStatus,
        intent: nextIntent,
        turnCount: prev.turnCount + 1,
      }));

      setHand(drawn.nextHand);
      setDrawPile(drawn.nextDraw);
      setDiscardPile(drawn.nextDiscard);
      setIsPlayerTurn(true);
      setCombatLogs(prev => [...prev.slice(-6), ...enemyLogs, '你的回合开始了！神力已充盈！']);
    }, 900);
  };

  // 7. 地图节点选择
  const handleSelectMapNode = (node: MapNode) => {
    node.visited = true;

    if (node.type === 'battle') {
      const actEnemies = ENEMY_TEMPLATES.filter(e => e.act === currentAct && !e.isElite && !e.isBoss);
      const chosen = actEnemies.length > 0 ? actEnemies[Math.floor(Math.random() * actEnemies.length)].id : 'yaksha';
      startCombat(chosen);
    } else if (node.type === 'elite') {
      const actElites = ENEMY_TEMPLATES.filter(e => e.act === currentAct && e.isElite);
      const chosen = actElites.length > 0 ? actElites[Math.floor(Math.random() * actElites.length)].id : 'hydra';
      startCombat(chosen);
    } else if (node.type === 'boss') {
      if (currentAct === 1) startCombat('boss_chiyou');
      else if (currentAct === 2) startCombat('boss_cronus');
      else startCombat('boss_nidhogg');
    } else if (node.type === 'rest') {
      setGameState('REST');
    } else if (node.type === 'shop') {
      setGameState('SHOP');
    } else if (node.type === 'event') {
      const randomEvent = MYTH_EVENTS[Math.floor(Math.random() * MYTH_EVENTS.length)];
      setCurrentEvent(randomEvent);
      setGameState('EVENT');
    }
  };

  // 8. 奖励与选择卡牌后进入下一层
  const handleProceedAfterReward = (newCard?: Card) => {
    if (newCard) {
      setDeck(prev => [...prev, newCard]);
    }
    advanceFloor();
  };

  const advanceFloor = () => {
    setCurrentFloor(prev => {
      const nextFloor = prev + 1;
      if (floors[nextFloor]) {
        floors[nextFloor].forEach(n => { n.available = true; });
      }
      return nextFloor;
    });
    setGameState('MAP');
  };

  // 卡牌强化回调
  const handleUpgradeCardConfirm = (cardIdx: number) => {
    setDeck(prev => {
      const updated = [...prev];
      updated[cardIdx] = upgradeCard(updated[cardIdx]);
      return updated;
    });
    setShowUpgradeModal(false);

    if (upgradeSource === 'rest') {
      advanceFloor();
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 font-sans">
      
      {/* 状态 1: 英雄选择 */}
      {gameState === 'HERO_SELECT' && (
        <HeroSelect onSelectHero={handleSelectHero} />
      )}

      {/* 状态 2: 爬塔地图 */}
      {gameState === 'MAP' && (
        <MapView
          floors={floors}
          currentFloor={currentFloor}
          currentAct={currentAct}
          onSelectNode={handleSelectMapNode}
          playerDeckCount={deck.length}
          playerHp={hero.hp}
          playerMaxHp={hero.maxHp}
          playerGold={hero.gold}
          heroAvatar={hero.avatar}
          heroName={hero.name}
          onOpenDeckView={() => setShowDeckViewer(true)}
        />
      )}

      {/* 状态 3: 核心战斗竞技场 */}
      {gameState === 'BATTLE' && (
        <BattleArena
          hero={hero}
          enemy={enemy}
          hand={hand}
          drawPile={drawPile}
          discardPile={discardPile}
          relics={relics}
          potions={potions}
          onUsePotion={handleUsePotion}
          onPlayCard={handlePlayCard}
          onEndTurn={handleEndTurn}
          combatLogs={combatLogs}
          isPlayerTurn={isPlayerTurn}
        />
      )}

      {/* 战利品弹窗 */}
      {gameState === 'REWARD' && (
        <RewardModal
          goldReward={rewardGold}
          cardChoices={rewardCardChoices}
          onSelectCard={(card) => handleProceedAfterReward(card)}
          onSkipCards={() => handleProceedAfterReward()}
        />
      )}

      {/* 休憩营地弹窗 */}
      {gameState === 'REST' && (
        <RestModal
          currentHp={hero.hp}
          maxHp={hero.maxHp}
          onHeal={() => {
            const heal = Math.floor(hero.maxHp * 0.35);
            setHero(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + heal) }));
            advanceFloor();
          }}
          onFortify={() => {
            setHero(prev => ({ ...prev, maxHp: prev.maxHp + 10, hp: prev.hp + 10 }));
            advanceFloor();
          }}
          onUpgradeCard={() => {
            setUpgradeSource('rest');
            setShowUpgradeModal(true);
          }}
        />
      )}

      {/* 神秘奇遇弹窗 */}
      {gameState === 'EVENT' && (
        <EventModal
          event={currentEvent}
          onChoose={(choice: EventChoice) => {
            if (choice.effect === 'heal' && choice.value) {
              setHero(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + choice.value!) }));
            } else if (choice.effect === 'maxHp' && choice.value) {
              setHero(prev => ({ ...prev, maxHp: prev.maxHp + choice.value!, hp: prev.hp + choice.value! }));
            } else if (choice.effect === 'gold' && choice.value) {
              setHero(prev => ({ ...prev, gold: prev.gold + choice.value! }));
            }
            advanceFloor();
          }}
        />
      )}

      {/* 诸神黑市商店弹窗 */}
      {gameState === 'SHOP' && (
        <ShopModal
          cardsForSale={ALL_CARDS.filter(c => c.rarity === 'rare' || c.rarity === 'epic').slice(0, 4)}
          relicsForSale={ALL_RELICS.filter(r => !relics.some(re => re.id === r.id)).slice(0, 2)}
          potionsForSale={ALL_POTIONS.slice(0, 3)}
          potionsCount={potions.filter(Boolean).length}
          playerGold={hero.gold}
          playerDeck={deck}
          onBuyCard={(card, cost) => {
            setHero(prev => ({ ...prev, gold: prev.gold - cost }));
            setDeck(prev => [...prev, card]);
          }}
          onBuyRelic={(relic, cost) => {
            setHero(prev => ({ ...prev, gold: prev.gold - cost }));
            setRelics(prev => [...prev, relic]);
          }}
          onBuyPotion={(potion, cost) => {
            setHero(prev => ({ ...prev, gold: prev.gold - cost }));
            setPotions(prev => {
              const emptyIdx = prev.findIndex(p => p === null);
              if (emptyIdx !== -1) {
                const updated = [...prev];
                updated[emptyIdx] = potion;
                return updated;
              }
              return prev;
            });
          }}
          onRemoveCard={(idx, cost) => {
            setHero(prev => ({ ...prev, gold: prev.gold - cost }));
            setDeck(prev => prev.filter((_, i) => i !== idx));
          }}
          onUpgradeCard={() => {
            const UPGRADE_COST = 60;
            if (hero.gold >= UPGRADE_COST) {
              setHero(prev => ({ ...prev, gold: prev.gold - UPGRADE_COST }));
              setUpgradeSource('shop');
              setShowUpgradeModal(true);
            }
          }}
          onClose={() => advanceFloor()}
        />
      )}

      {/* 通关大捷全屏 */}
      {gameState === 'VICTORY' && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="w-24 h-24 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-6 animate-bounce">
            <Trophy className="w-12 h-12" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
            万神平定 · 远征胜利！
          </h1>
          <p className="text-slate-300 max-w-lg mt-4 text-base leading-relaxed">
            你统御的神明斩杀了蚩尤战魂、时空泰坦克洛诺斯与灭世黑龙【尼德霍格】，三界裂隙彻底愈合。万界诸神皆传颂着你的不朽威名！
          </p>
          <button
            onClick={() => {
              sounds.playClick();
              setGameState('HERO_SELECT');
            }}
            className="mt-8 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-lg shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-transform hover:scale-105 cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" /> 开启新的神话轮回
          </button>
        </div>
      )}

      {/* 阵亡遗憾全屏 */}
      {gameState === 'DEFEAT' && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="w-24 h-24 rounded-full bg-red-950 border-2 border-red-500/60 flex items-center justify-center text-red-500 mb-6">
            <Skull className="w-12 h-12" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-red-500">神力枯竭 · 诸神陨落</h1>
          <p className="text-slate-400 max-w-md mt-4 text-sm">
            深渊裂隙的狂暴魔潮吞噬了你的神格。但神话不灭，万界犹存，淬炼套牌再战裂隙！
          </p>
          <button
            onClick={() => {
              sounds.playClick();
              setGameState('HERO_SELECT');
            }}
            className="mt-8 px-8 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-base border border-slate-600 transition-transform hover:scale-105 cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" /> 重新唤醒神明
          </button>
        </div>
      )}

      {/* 套牌查看器 */}
      {showDeckViewer && (
        <DeckViewerModal
          deck={deck}
          onClose={() => setShowDeckViewer(false)}
        />
      )}

      {/* 卡牌淬火强化弹窗 */}
      {showUpgradeModal && (
        <CardUpgradeModal
          deck={deck}
          onUpgrade={handleUpgradeCardConfirm}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
};

export default App;
