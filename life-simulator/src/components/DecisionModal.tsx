import React from 'react';
import type { LifeDecision, GameState, AttributeKey } from '../types/game';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';


interface DecisionModalProps {
  decision: LifeDecision;
  state: GameState;
  onSelectOption: (optionId: string) => void;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  decision,
  state,
  onSelectOption,
}) => {
  const checkRequirement = (minReq?: Partial<Record<AttributeKey, number>>) => {
    if (!minReq) return { met: true, missing: '' };
    for (const [key, val] of Object.entries(minReq)) {
      const current = state.attrs[key as AttributeKey] || 0;
      if (current < (val || 0)) {
        return { met: false, missing: `需 ${key} ≥ ${val} (当前 ${current})` };
      }
    }
    return { met: true, missing: '' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col bg-slate-900 border border-indigo-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-indigo-500/20 space-y-3.5 sm:space-y-4 animate-scale-up overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>重大抉择 · {state.age} 岁</span>
            </span>
            <span className="text-[11px] text-slate-400">请谨慎权衡</span>
          </div>

          <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight leading-snug">{decision.title}</h2>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-2.5 sm:p-3.5 rounded-xl border border-slate-800 break-words">
            {decision.description}
          </p>
        </div>

        {/* 选项列表 (可滚动，防止超长) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {decision.options.map((option) => {
            const reqStatus = checkRequirement(option.minReq);
            const isDisabled = !reqStatus.met;

            return (
              <button
                key={option.id}
                disabled={isDisabled}
                onClick={() => onSelectOption(option.id)}
                className={`w-full p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-2.5 group active:scale-[0.99] ${
                  isDisabled
                    ? 'bg-slate-950/60 border-slate-800/80 opacity-50 cursor-not-allowed'
                    : 'bg-slate-800/70 hover:bg-indigo-950/40 border-slate-700 hover:border-indigo-500/60 hover:shadow-md cursor-pointer'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        isDisabled ? 'text-slate-400' : 'text-slate-100 group-hover:text-indigo-300'
                      }`}
                    >
                      {option.text}
                    </span>
                  </div>

                  {option.description && (
                    <p className="text-xs text-slate-400">{option.description}</p>
                  )}

                  {isDisabled && (
                    <div className="flex items-center gap-1 text-[11px] text-rose-400 font-medium pt-1">
                      <Lock className="w-3 h-3" />
                      <span>{option.reqDesc || reqStatus.missing}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {isDisabled ? (
                    <Lock className="w-4 h-4 text-slate-600" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-indigo-600 flex items-center justify-center text-slate-300 group-hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
