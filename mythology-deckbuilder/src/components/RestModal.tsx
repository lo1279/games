import React from 'react';
import { Flame, Heart, Sparkles } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface RestModalProps {
  onHeal: () => void;
  onFortify: () => void;
  currentHp: number;
  maxHp: number;
}

export const RestModal: React.FC<RestModalProps> = ({
  onHeal,
  onFortify,
  currentHp,
  maxHp,
}) => {
  const healAmount = Math.floor(maxHp * 0.35);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 safe-area-container select-none">
      <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/70 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center text-center shadow-2xl max-h-[92dvh] overflow-y-auto no-scrollbar">
        
        {/* 圣火标识 */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 mb-2 sm:mb-3 animate-pulse">
          <Flame className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>

        <h2 className="text-lg sm:text-2xl font-black text-amber-300">诸神圣火 · 静息之所</h2>
        <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-xs">
          在神圣庇护所中，你可以选择休整疗愈，或在神火中淬炼神躯。
        </p>

        <div className="text-xs font-bold text-rose-400 my-2">
          当前生命: {currentHp} / {maxHp}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 w-full mt-2">
          {/* 选项 1: 打坐冥想 */}
          <button
            onClick={() => {
              sounds.playShield();
              onHeal();
            }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950 border border-slate-700 hover:border-emerald-500/70 hover:bg-emerald-950/20 transition-all flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-100">神识归一 · 冥想</div>
            <div className="text-[11px] sm:text-xs text-emerald-400 font-semibold">
              恢复 {healAmount} 点生命
            </div>
          </button>

          {/* 选项 2: 淬炼神力 */}
          <button
            onClick={() => {
              sounds.playVictory();
              onFortify();
            }}
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950 border border-slate-700 hover:border-amber-500/70 hover:bg-amber-950/20 transition-all flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-100">神躯淬炼 · 强化</div>
            <div className="text-[11px] sm:text-xs text-amber-400 font-semibold">
              最大生命值上限 +10
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
