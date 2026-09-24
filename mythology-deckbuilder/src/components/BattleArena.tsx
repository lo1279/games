import React, { useState } from 'react';
import type { Hero } from '../types/hero';
import type { Enemy } from '../types/enemy';
import type { Card } from '../types/card';
import type { Relic } from '../types/relic';
import { CardComponent } from './CardComponent';
import { 
  Shield, Zap, Swords, Flame, Skull, 
  RotateCcw, Sparkles, AlertCircle, Eye,
  Play, X
} from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface BattleArenaProps {
  hero: Hero;
  enemy: Enemy;
  hand: Card[];
  drawPile: Card[];
  discardPile: Card[];
  relics: Relic[];
  onPlayCard: (card: Card) => void;
  onEndTurn: () => void;
  combatLogs: string[];
  isPlayerTurn: boolean;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  hero,
  enemy,
  hand,
  drawPile,
  discardPile,
  relics,
  onPlayCard,
  onEndTurn,
  combatLogs,
  isPlayerTurn,
}) => {
  const [viewingPile, setViewingPile] = useState<'draw' | 'discard' | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);

  const selectedCard = selectedCardIdx !== null && hand[selectedCardIdx] ? hand[selectedCardIdx] : null;

  // 意图渲染
  const renderEnemyIntent = () => {
    const { intent } = enemy;
    switch (intent.type) {
      case 'attack':
        return (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-red-950/90 border border-red-500/80 rounded-full text-red-400 font-bold text-[11px] sm:text-xs animate-bounce shadow">
            <Swords className="w-3.5 h-3.5 text-red-400" />
            <span>准备攻击: {intent.value} 点伤害</span>
            {intent.multiHit && <span> x{intent.multiHit}</span>}
          </div>
        );
      case 'defend':
        return (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-950/90 border border-blue-500/80 rounded-full text-blue-400 font-bold text-[11px] sm:text-xs shadow">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>准备御守: +{intent.value} 护盾</span>
          </div>
        );
      case 'buff':
        return (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-950/90 border border-amber-500/80 rounded-full text-amber-400 font-bold text-[11px] sm:text-xs shadow">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>神威凝聚: 强化自身</span>
          </div>
        );
      case 'debuff':
        return (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-950/90 border border-purple-500/80 rounded-full text-purple-400 font-bold text-[11px] sm:text-xs shadow">
            <Skull className="w-3.5 h-3.5 text-purple-400" />
            <span>降下诅咒: 削弱玩家</span>
          </div>
        );
      case 'charge':
        return (
          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-orange-950/90 border border-orange-500 rounded-full text-orange-300 font-extrabold text-[11px] sm:text-xs animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.6)]">
            <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>⚠️ 灭世蓄力中！</span>
          </div>
        );
    }
  };

  const handleCardClick = (idx: number, card: Card) => {
    if (!isPlayerTurn) return;
    if (selectedCardIdx === idx) {
      // 再次点击同一张牌且费用充足，直接打出
      if (hero.energy >= card.cost) {
        onPlayCard(card);
        setSelectedCardIdx(null);
      } else {
        setSelectedCardIdx(null);
      }
    } else {
      setSelectedCardIdx(idx);
    }
  };

  const handleConfirmPlay = () => {
    if (selectedCard && isPlayerTurn && hero.energy >= selectedCard.cost) {
      onPlayCard(selectedCard);
      setSelectedCardIdx(null);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen min-h-[100dvh] bg-radial from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col justify-between overflow-hidden select-none safe-area-container">
      
      {/* 顶部状态栏：避让微信胶囊、展示神器与金币 */}
      <div className="flex items-center justify-between z-20 bg-slate-950/80 backdrop-blur-md px-3 sm:px-4 py-1.5 rounded-xl border border-slate-800 shadow-md">
        {/* 神器栏 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[50%]">
          <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase whitespace-nowrap">神器:</span>
          {relics.length === 0 && <span className="text-[10px] text-slate-600">无</span>}
          {relics.map((relic) => (
            <div
              key={relic.id}
              title={`${relic.name}: ${relic.description}`}
              className="p-1 bg-slate-900 border border-amber-500/40 rounded text-amber-400 flex-shrink-0"
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          ))}
        </div>

        {/* 金币 */}
        <div className="flex items-center gap-1 text-amber-400 font-extrabold text-xs sm:text-sm">
          <span>💰</span>
          <span>{hero.gold}</span>
        </div>
      </div>

      {/* 战况文字即时播报胶囊 */}
      <div className="px-3 py-1 my-1 bg-slate-900/60 rounded-full border border-slate-800/80 text-[10px] sm:text-xs text-slate-400 text-center truncate max-w-md mx-auto w-full">
        {combatLogs[combatLogs.length - 1] || '战斗进行中，诸神屏息凝视...'}
      </div>

      {/* 核心对决区：上下结构 (顶部敌人 - 中部对决栏 - 下方我方神明) */}
      <div className="flex-1 flex flex-col justify-around py-1 max-w-2xl w-full mx-auto">
        
        {/* 1. 敌人区域 (Upper Half) */}
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          {/* 行动意图气泡 */}
          <div className="min-h-[26px] flex items-center justify-center">
            {renderEnemyIntent()}
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 w-full px-4">
            {/* 敌人立绘 */}
            <div className="relative flex-shrink-0">
              <div className={`
                w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center text-4xl sm:text-5xl shadow-xl backdrop-blur-md
                ${enemy.isBoss 
                  ? 'bg-gradient-to-tr from-purple-900/60 to-red-950/70 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse-subtle' 
                  : 'bg-gradient-to-tr from-slate-800 to-slate-900 border-slate-700 shadow-md'}
              `}>
                {enemy.avatar}
              </div>
              {/* 敌人护盾角标 */}
              {enemy.shield > 0 && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-full border border-blue-300 shadow flex items-center gap-0.5">
                  <Shield className="w-3 h-3" /> {enemy.shield}
                </div>
              )}
            </div>

            {/* 敌人血条与状态 */}
            <div className="flex-1 max-w-[200px] sm:max-w-xs flex flex-col justify-center gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-rose-300 truncate">{enemy.name}</span>
                {enemy.isBoss && (
                  <span className="text-[9px] bg-red-600/40 text-red-300 border border-red-500 px-1 py-0.2 rounded font-bold">
                    BOSS
                  </span>
                )}
              </div>

              {/* 生命值条 */}
              <div className="w-full bg-slate-900 rounded-full h-3.5 p-0.5 border border-slate-700 relative overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100))}%` }}
                />
                <span className="absolute inset-0 text-[9px] font-black flex items-center justify-center text-white drop-shadow">
                  {enemy.hp} / {enemy.maxHp} HP
                </span>
              </div>

              {/* 敌人负面状态徽章 */}
              <div className="flex items-center gap-1 flex-wrap min-h-[20px]">
                {enemy.status.shock > 0 && (
                  <span className="text-[9px] bg-cyan-950/80 border border-cyan-500 text-cyan-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 font-bold">
                    <Zap className="w-2.5 h-2.5" /> {enemy.status.shock}
                  </span>
                )}
                {enemy.status.burn > 0 && (
                  <span className="text-[9px] bg-orange-950/80 border border-orange-500 text-orange-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 font-bold">
                    <Flame className="w-2.5 h-2.5" /> {enemy.status.burn}
                  </span>
                )}
                {enemy.status.vulnerable > 0 && (
                  <span className="text-[9px] bg-red-950/80 border border-red-500 text-red-300 px-1.5 py-0.2 rounded-full font-bold">
                    💔破甲x{enemy.status.vulnerable}
                  </span>
                )}
                {enemy.status.weak > 0 && (
                  <span className="text-[9px] bg-yellow-950/80 border border-yellow-500 text-yellow-300 px-1.5 py-0.2 rounded-full font-bold">
                    📉虚弱x{enemy.status.weak}
                  </span>
                )}
                {enemy.status.strength > 0 && (
                  <span className="text-[9px] bg-amber-950/80 border border-amber-500 text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                    ⚔️力量+{enemy.status.strength}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. 中下部：我方神明属性状态栏 */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl mx-2 shadow-inner">
          {/* 玩家头像与生命 */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-tr from-amber-600/30 to-amber-400/10 border border-amber-500/60 flex items-center justify-center text-3xl shadow">
                {hero.avatar}
              </div>
              {hero.shield > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border border-blue-300 shadow flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" /> {hero.shield}
                </div>
              )}
            </div>

            <div>
              <div className="font-extrabold text-xs sm:text-sm text-amber-300">{hero.name}</div>
              {/* 血条 */}
              <div className="w-28 sm:w-36 bg-slate-900 rounded-full h-3 p-0.5 border border-slate-700 relative overflow-hidden mt-0.5">
                <div
                  className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100))}%` }}
                />
                <span className="absolute inset-0 text-[8px] font-black flex items-center justify-center text-white drop-shadow">
                  {hero.hp}/{hero.maxHp}
                </span>
              </div>
            </div>
          </div>

          {/* 神力能量宝石水晶 */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-amber-500/50 shadow">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="font-black text-sm sm:text-base text-amber-400">
              {hero.energy} <span className="text-[10px] text-slate-400 font-normal">/{hero.maxEnergy}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部：手牌区与手机端触屏出牌交互栏 */}
      <div className="relative w-full max-w-2xl mx-auto flex flex-col z-30">
        
        {/* 手机端选中预览与快捷出牌确认栏 */}
        {selectedCard && (
          <div className="mx-2 mb-1 p-2 bg-slate-900/95 border-2 border-amber-400/90 rounded-xl shadow-2xl flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs text-amber-300 truncate">{selectedCard.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-black">
                  耗能 {selectedCard.cost}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 truncate mt-0.5">
                {selectedCard.description}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                disabled={!isPlayerTurn || hero.energy < selectedCard.cost}
                onClick={handleConfirmPlay}
                className={`
                  px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow cursor-pointer
                  ${isPlayerTurn && hero.energy >= selectedCard.cost
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 hover:brightness-110 active:scale-95'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}
                `}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{hero.energy >= selectedCard.cost ? '打出' : '神力不足'}</span>
              </button>

              <button
                onClick={() => setSelectedCardIdx(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 手牌排列滑动区 (横向滑动 + 触屏紧凑模式) */}
        <div className="w-full flex items-end justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar px-2 py-1 min-h-[165px]">
          {hand.map((card, idx) => {
            const canAfford = hero.energy >= card.cost;
            const isSelected = selectedCardIdx === idx;
            return (
              <div key={`${card.id}_${idx}`} className="flex-shrink-0">
                <CardComponent
                  card={card}
                  compact={true}
                  selected={isSelected}
                  isPlayable={isPlayerTurn && canAfford}
                  onClick={() => handleCardClick(idx, card)}
                />
              </div>
            );
          })}
        </div>

        {/* 底部控制台：抽牌堆、结束回合、弃牌堆 */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-950/90 backdrop-blur-md rounded-t-2xl border-t border-slate-800">
          
          {/* 抽牌堆 */}
          <button
            onClick={() => {
              sounds.playClick();
              setViewingPile(viewingPile === 'draw' ? null : 'draw');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>抽牌 ({drawPile.length})</span>
          </button>

          {/* 结束回合核心按钮 */}
          <button
            disabled={!isPlayerTurn}
            onClick={() => {
              if (isPlayerTurn) {
                sounds.playAttack();
                setSelectedCardIdx(null);
                onEndTurn();
              }
            }}
            className={`
              px-6 py-2 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-md cursor-pointer
              ${isPlayerTurn 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95' 
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}
            `}
          >
            {isPlayerTurn ? '结束回合' : '敌方行动...'}
          </button>

          {/* 弃牌堆 */}
          <button
            onClick={() => {
              sounds.playClick();
              setViewingPile(viewingPile === 'discard' ? null : 'discard');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>弃牌 ({discardPile.length})</span>
          </button>
        </div>
      </div>

      {/* 牌堆全屏查看抽屉 */}
      {viewingPile && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-3 safe-area-container">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-base font-bold text-amber-300">
                {viewingPile === 'draw' ? `抽牌堆 (${drawPile.length} 张)` : `弃牌堆 (${discardPile.length} 张)`}
              </h3>
              <button
                onClick={() => setViewingPile(null)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-1">
              {(viewingPile === 'draw' ? drawPile : discardPile).map((card, i) => (
                <div key={i} className="flex justify-center">
                  <CardComponent card={card} compact={true} disabled />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
