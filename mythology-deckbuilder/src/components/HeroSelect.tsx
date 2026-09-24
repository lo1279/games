import React, { useState } from 'react';
import { HEROES } from '../data/heroes';
import type { Hero } from '../types/hero';
import { CARD_MAP } from '../data/cards';
import { ShieldAlert, Zap, Shield, Sparkles, Heart, Compass } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface HeroSelectProps {
  onSelectHero: (hero: Hero) => void;
}

export const HeroSelect: React.FC<HeroSelectProps> = ({ onSelectHero }) => {
  const [selectedId, setSelectedId] = useState<string>(HEROES[0].id);

  const currentHero = HEROES.find(h => h.id === selectedId) || HEROES[0];

  const getTraitIcon = (icon: string) => {
    switch (icon) {
      case 'ShieldAlert':
        return <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />;
      default:
        return <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 flex flex-col justify-between p-3 sm:p-6 safe-area-container select-none">
      
      {/* 头部标题与诸神氛围 */}
      <div className="text-center my-2 sm:my-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-semibold mb-2 tracking-wider uppercase">
          <Sparkles className="w-3 h-3" /> 万界裂隙 · 诸神对决
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow">
          万神纪元：诸神对决
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto mt-1 px-2">
          选择你统御的神话主神，踏入裂隙，构建属于你的神术卡组！
        </p>
      </div>

      {/* 英雄卡牌：移动端横向滑动或自适应网格 */}
      <div className="w-full max-w-5xl mx-auto my-auto overflow-x-auto no-scrollbar py-2">
        <div className="flex md:grid md:grid-cols-3 gap-3 sm:gap-6 justify-start md:justify-center px-1">
          {HEROES.map((hero) => {
            const isSelected = hero.id === selectedId;
            return (
              <div
                key={hero.id}
                onClick={() => {
                  setSelectedId(hero.id);
                  sounds.playClick();
                }}
                className={`
                  relative rounded-2xl border-2 p-3 sm:p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between flex-shrink-0
                  w-[260px] sm:w-[280px] md:w-auto bg-gradient-to-b from-slate-900/90 to-slate-950/95
                  ${isSelected 
                    ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.02] z-10' 
                    : 'border-slate-800 opacity-75 hover:opacity-100'}
                `}
              >
                {isSelected && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-2.5 py-0.2 rounded-full shadow">
                    已选定
                  </div>
                )}

                {/* 英雄立绘图标与阵营 */}
                <div className="text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-2">
                    {hero.avatar}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-100">{hero.name}</h3>
                  <div className="text-[10px] sm:text-xs text-amber-400 font-medium tracking-wide mt-0.5">
                    {hero.title}
                  </div>
                </div>

                {/* 基础属性 */}
                <div className="flex items-center justify-center gap-4 my-2.5 py-1.5 border-y border-slate-800/80">
                  <div className="flex items-center gap-1 text-rose-400 font-bold text-xs">
                    <Heart className="w-3.5 h-3.5" /> 生命: {hero.maxHp}
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                    <Zap className="w-3.5 h-3.5" /> 神力: {hero.maxEnergy}
                  </div>
                </div>

                {/* 神格专属被动 */}
                <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                    {getTraitIcon(hero.trait.icon)}
                    神格：{hero.trait.name}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 leading-relaxed">
                    {hero.trait.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部：当前选择的神明详情与开始征途 */}
      <div className="max-w-4xl w-full mx-auto bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-3 sm:p-5 my-2 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 shadow-2xl">
        <div className="flex-1 w-full text-left">
          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">
            神明典故 · {currentHero.name}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed italic line-clamp-2 sm:line-clamp-none">
            "{currentHero.lore}"
          </p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400">初始套牌:</span>
            {Array.from(new Set(currentHero.starterDeckIds)).map(cardId => {
              const card = CARD_MAP.get(cardId);
              return card ? (
                <span key={cardId} className="text-[9px] bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700 text-slate-300">
                  {card.name}
                </span>
              ) : null;
            })}
          </div>
        </div>

        <button
          onClick={() => {
            sounds.playVictory();
            onSelectHero(currentHero);
          }}
          className="w-full sm:w-auto whitespace-nowrap px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm sm:text-base tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Compass className="w-4 h-4 sm:w-5 sm:h-5" /> 踏入神话远征
        </button>
      </div>
    </div>
  );
};
