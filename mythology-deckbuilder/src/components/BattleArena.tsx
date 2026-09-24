import React, { useState } from 'react';
import type { Hero } from '../types/hero';
import type { Enemy } from '../types/enemy';
import type { Card } from '../types/card';
import type { Relic } from '../types/relic';
import { CardComponent } from './CardComponent';
import { 
  Shield, Zap, Swords, Flame, Skull, 
  RotateCcw, Sparkles, AlertCircle, Eye
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

  // 意图渲染
  const renderEnemyIntent = () => {
    const { intent } = enemy;
    switch (intent.type) {
      case 'attack':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/80 border border-red-500/80 rounded-full text-red-400 font-bold text-xs animate-bounce shadow-lg">
            <Swords className="w-4 h-4 text-red-400" />
            <span>准备攻击: {intent.value} 点伤害</span>
            {intent.multiHit && <span> x{intent.multiHit}</span>}
          </div>
        );
      case 'defend':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-950/80 border border-blue-500/80 rounded-full text-blue-400 font-bold text-xs shadow-lg">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>准备御守: +{intent.value} 护盾</span>
          </div>
        );
      case 'buff':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-amber-500/80 rounded-full text-amber-400 font-bold text-xs shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>神威凝聚: 强化自身</span>
          </div>
        );
      case 'debuff':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-950/80 border border-purple-500/80 rounded-full text-purple-400 font-bold text-xs shadow-lg">
            <Skull className="w-4 h-4 text-purple-400" />
            <span>诅咒施加: 削弱玩家</span>
          </div>
        );
      case 'charge':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-950/90 border border-orange-500 rounded-full text-orange-300 font-extrabold text-xs animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.6)]">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <span>⚠️ 灭世大招蓄力中！</span>
          </div>
        );
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-radial from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col justify-between p-4 overflow-hidden select-none">
      
      {/* 顶部状态栏：神器栏 + 敌方 Boss 标识 */}
      <div className="flex items-center justify-between z-20 bg-slate-950/60 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-slate-800 shadow-md">
        {/* 持有神器 Relics */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">携带神器:</span>
          {relics.length === 0 && <span className="text-xs text-slate-600">暂无</span>}
          {relics.map((relic) => (
            <div
              key={relic.id}
              title={`${relic.name}: ${relic.description}`}
              className="p-1.5 bg-slate-800/90 border border-amber-500/40 rounded-lg text-amber-400 hover:scale-110 transition-transform cursor-help"
            >
              <Sparkles className="w-4 h-4" />
            </div>
          ))}
        </div>

        {/* 战斗播报简要 */}
        <div className="text-xs text-slate-400 italic max-w-md truncate">
          {combatLogs[combatLogs.length - 1] || '战斗打响，诸神凝视着这片战场...'}
        </div>

        {/* 金币 */}
        <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
          <span>💰</span>
          <span>{hero.gold}</span>
        </div>
      </div>

      {/* 战场中央主舞台：英雄 VS 敌人 */}
      <div className="flex-1 flex items-center justify-around max-w-6xl w-full mx-auto relative my-2">
        
        {/* 左侧：玩家英雄状态 */}
        <div className="flex flex-col items-center gap-3">
          {/* 英雄立绘与神环 */}
          <div className="relative group">
            <div className="w-36 h-36 rounded-3xl bg-gradient-to-tr from-amber-600/30 to-amber-400/10 border-2 border-amber-500/60 flex items-center justify-center text-6xl shadow-[0_0_30px_rgba(245,158,11,0.25)] backdrop-blur-md">
              {hero.avatar}
            </div>
            {/* 护盾标识 */}
            {hero.shield > 0 && (
              <div className="absolute -top-3 -right-3 bg-blue-600 text-white font-extrabold text-sm px-3 py-1 rounded-full border-2 border-blue-300 shadow-lg flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> {hero.shield}
              </div>
            )}
          </div>

          {/* 英雄名号与阵营 */}
          <div className="text-center">
            <h2 className="text-xl font-black text-amber-300 tracking-wide">{hero.name}</h2>
            <p className="text-xs text-slate-400">{hero.title}</p>
          </div>

          {/* 生命值条 */}
          <div className="w-48 bg-slate-800/90 rounded-full h-4 p-0.5 border border-slate-700 relative overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100))}%` }}
            />
            <span className="absolute inset-0 text-[10px] font-black flex items-center justify-center text-white drop-shadow">
              {hero.hp} / {hero.maxHp} HP
            </span>
          </div>

          {/* 神力法力球指示器 */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-2xl border border-amber-500/50 shadow-md">
            <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="font-extrabold text-lg text-amber-400">
              {hero.energy} <span className="text-xs text-slate-400 font-normal">/ {hero.maxEnergy} 神力</span>
            </div>
          </div>
        </div>

        {/* 战斗中央：神火/虚空对决符文 */}
        <div className="hidden md:flex flex-col items-center justify-center opacity-40">
          <div className="text-4xl text-amber-500 font-black italic tracking-widest">VS</div>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent my-2" />
        </div>

        {/* 右侧：敌方魔怪/Boss */}
        <div className="flex flex-col items-center gap-3">
          {/* 行动意图气泡 */}
          <div className="h-8 flex items-center justify-center">
            {renderEnemyIntent()}
          </div>

          {/* 敌人立绘 */}
          <div className="relative group">
            <div className={`
              w-36 h-36 rounded-3xl border-2 flex items-center justify-center text-6xl shadow-2xl backdrop-blur-md
              ${enemy.isBoss 
                ? 'bg-gradient-to-tr from-purple-900/60 to-red-950/70 border-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.35)] animate-pulse-subtle' 
                : 'bg-gradient-to-tr from-slate-800 to-slate-900 border-slate-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]'}
            `}>
              {enemy.avatar}
            </div>
            {/* 敌人护盾 */}
            {enemy.shield > 0 && (
              <div className="absolute -top-3 -right-3 bg-blue-600 text-white font-extrabold text-sm px-3 py-1 rounded-full border-2 border-blue-300 shadow-lg flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> {enemy.shield}
              </div>
            )}
          </div>

          {/* 敌人名号 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-black text-rose-300 tracking-wide">{enemy.name}</h2>
              {enemy.isBoss && (
                <span className="text-[10px] bg-red-600/40 text-red-300 border border-red-500 px-1.5 py-0.5 rounded font-bold uppercase">
                  BOSS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{enemy.title}</p>
          </div>

          {/* 敌人生命值 */}
          <div className="w-48 bg-slate-800/90 rounded-full h-4 p-0.5 border border-slate-700 relative overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100))}%` }}
            />
            <span className="absolute inset-0 text-[10px] font-black flex items-center justify-center text-white drop-shadow">
              {enemy.hp} / {enemy.maxHp} HP
            </span>
          </div>

          {/* 敌人负面状态徽章 (感电/灼烧/破甲/虚弱) */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center min-h-[24px]">
            {enemy.status.shock > 0 && (
              <span className="text-[10px] bg-cyan-950/80 border border-cyan-500 text-cyan-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                <Zap className="w-3 h-3" /> 感电 x{enemy.status.shock}
              </span>
            )}
            {enemy.status.burn > 0 && (
              <span className="text-[10px] bg-orange-950/80 border border-orange-500 text-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                <Flame className="w-3 h-3" /> 灼烧 x{enemy.status.burn}
              </span>
            )}
            {enemy.status.vulnerable > 0 && (
              <span className="text-[10px] bg-red-950/80 border border-red-500 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                💔 破甲 x{enemy.status.vulnerable}
              </span>
            )}
            {enemy.status.weak > 0 && (
              <span className="text-[10px] bg-yellow-950/80 border border-yellow-500 text-yellow-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                📉 虚弱 x{enemy.status.weak}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 底部：手牌区、抽弃牌堆、结束回合 */}
      <div className="relative w-full max-w-6xl mx-auto flex flex-col items-center z-30">
        
        {/* 手牌排列区域 */}
        <div className="w-full flex items-end justify-center gap-3 overflow-x-auto py-4 px-2 min-h-[290px]">
          {hand.map((card, idx) => {
            const canAfford = hero.energy >= card.cost;
            return (
              <div key={`${card.id}_${idx}`} className="transform transition-transform">
                <CardComponent
                  card={card}
                  isPlayable={isPlayerTurn && canAfford}
                  onClick={() => {
                    if (isPlayerTurn && canAfford) {
                      onPlayCard(card);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* 底部控制台：抽牌堆、弃牌堆、结束回合按钮 */}
        <div className="w-full flex items-center justify-between px-6 py-2 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-slate-800">
          
          {/* 抽牌堆 */}
          <button
            onClick={() => {
              sounds.playClick();
              setViewingPile(viewingPile === 'draw' ? null : 'draw');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>抽牌堆 ({drawPile.length})</span>
          </button>

          {/* 结束回合核心按钮 */}
          <button
            disabled={!isPlayerTurn}
            onClick={() => {
              if (isPlayerTurn) {
                sounds.playAttack();
                onEndTurn();
              }
            }}
            className={`
              px-8 py-3 rounded-xl font-black text-sm tracking-wider uppercase transition-all shadow-lg cursor-pointer
              ${isPlayerTurn 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95' 
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}
            `}
          >
            {isPlayerTurn ? '结束回合' : '敌方行动中...'}
          </button>

          {/* 弃牌堆 */}
          <button
            onClick={() => {
              sounds.playClick();
              setViewingPile(viewingPile === 'discard' ? null : 'discard');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>弃牌堆 ({discardPile.length})</span>
          </button>
        </div>
      </div>

      {/* 牌堆查看弹出抽屉 */}
      {viewingPile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6">
          <div className="max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-xl font-bold text-amber-300">
                {viewingPile === 'draw' ? `抽牌堆 (${drawPile.length} 张)` : `弃牌堆 (${discardPile.length} 张)`}
              </h3>
              <button
                onClick={() => setViewingPile(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
              {(viewingPile === 'draw' ? drawPile : discardPile).map((card, i) => (
                <div key={i} className="scale-90 origin-top">
                  <CardComponent card={card} disabled />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
