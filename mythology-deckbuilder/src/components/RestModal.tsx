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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_0_40px_rgba(245,158,11,0.25)]">
        
        {/* 圣火标识 */}
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <Flame className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-amber-300">诸神圣火 · 静息之所</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-md">
          在烈焰与神光环绕的庇护所中，深渊的暴戾之气暂时退散。你可以选择恢复精力，或者在神火中淬炼神格。
        </p>

        <div className="text-xs font-bold text-rose-400 my-3">
          当前生命: {currentHp} / {maxHp}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
          {/* 选项 1: 打坐冥想 */}
          <button
            onClick={() => {
              sounds.playShield();
              onHeal();
            }}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-700 hover:border-emerald-500/70 hover:bg-emerald-950/20 transition-all flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6" />
            </div>
            <div className="font-extrabold text-sm text-slate-100">神识归一 · 冥想</div>
            <div className="text-xs text-emerald-400 font-semibold">
              恢复 {healAmount} 点生命值
            </div>
          </button>

          {/* 选项 2: 淬炼神力 */}
          <button
            onClick={() => {
              sounds.playVictory();
              onFortify();
            }}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-700 hover:border-amber-500/70 hover:bg-amber-950/20 transition-all flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="font-extrabold text-sm text-slate-100">神躯淬炼 · 强化</div>
            <div className="text-xs text-amber-400 font-semibold">
              最大生命值上限 +10 点
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
