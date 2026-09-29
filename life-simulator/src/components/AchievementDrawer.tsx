import React from 'react';
import type { Achievement } from '../types/game';
import { X, Trophy, Lock, CheckCircle2 } from 'lucide-react';

interface AchievementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: Achievement[];
  unlockedIds: string[];
}

export const AchievementDrawer: React.FC<AchievementDrawerProps> = ({
  isOpen,
  onClose,
  achievements,
  unlockedIds,
}) => {
  if (!isOpen) return null;

  const unlockedSet = new Set(unlockedIds);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col space-y-4 shadow-2xl animate-slide-left overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">人生成就图鉴</h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">
              解锁进度: <span className="text-amber-400 font-bold">{unlockedIds.length}</span> / {achievements.length}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 成就列表 */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {achievements.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);

            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                    isUnlocked ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isUnlocked ? ach.icon : <Lock className="w-4 h-4 text-slate-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-sm font-bold truncate ${
                        isUnlocked ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {ach.title}
                    </span>
                    {isUnlocked && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ach.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
