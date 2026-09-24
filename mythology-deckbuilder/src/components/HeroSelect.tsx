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
        return <ShieldAlert className="w-5 h-5 text-amber-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-cyan-400" />;
      default:
        return <Shield className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 flex flex-col items-center justify-between p-6">
      {/* 头部标题与诸神万神殿氛围 */}
      <div className="text-center my-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3 tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5" /> 万界裂隙 · 诸神苏醒
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-md">
          万神纪元：诸神对决
        </h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
          世界之树与不周山出现时空交错。选择你统御的神话主神，踏入裂隙，用神术与神器迎战深渊魔潮！
        </p>
      </div>

      {/* 英雄卡牌三选一切换 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full my-auto">
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
                relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-300 flex flex-col justify-between
                bg-gradient-to-b from-slate-900/90 to-slate-950/95
                ${isSelected 
                  ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] scale-105 z-10' 
                  : 'border-slate-800 hover:border-slate-600 opacity-75 hover:opacity-100'}
              `}
            >
              {isSelected && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-black px-3 py-0.5 rounded-full shadow-lg">
                  当前选择
                </div>
              )}

              {/* 英雄立绘图标与阵营 */}
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-5xl shadow-inner mb-4 transform hover:scale-110 transition-transform">
                  {hero.avatar}
                </div>
                <h3 className="text-2xl font-bold text-slate-100">{hero.name}</h3>
                <div className="text-xs text-amber-400 font-medium tracking-wide mt-1">
                  {hero.title}
                </div>
              </div>

              {/* 基础属性 */}
              <div className="flex items-center justify-center gap-6 my-4 py-2 border-y border-slate-800/80">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                  <Heart className="w-4 h-4" /> 生命: {hero.maxHp}
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                  <Zap className="w-4 h-4" /> 神力: {hero.maxEnergy}
                </div>
              </div>

              {/* 神格专属被动 */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                  {getTraitIcon(hero.trait.icon)}
                  神格：{hero.trait.name}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {hero.trait.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部：当前选择的神明详情与开始征途 */}
      <div className="max-w-4xl w-full bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 my-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            神明典故 · {currentHero.name}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed italic">
            "{currentHero.lore}"
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400">初始套牌包含:</span>
            {Array.from(new Set(currentHero.starterDeckIds)).map(cardId => {
              const card = CARD_MAP.get(cardId);
              return card ? (
                <span key={cardId} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
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
          className="whitespace-nowrap px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-lg tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <Compass className="w-5 h-5" /> 踏入神话远征
        </button>
      </div>
    </div>
  );
};
