import React from 'react';
import type { Talent, TalentGrade } from '../types/game';
import { RefreshCw, Check, Sparkles } from 'lucide-react';

interface TalentSelectorProps {
  talents: Talent[];
  selectedTalents: Talent[];
  maxSlots?: number;
  onToggleTalent: (talent: Talent) => void;
  onReroll: () => void;
  onConfirm: () => void;
}

export const TalentSelector: React.FC<TalentSelectorProps> = ({
  talents,
  selectedTalents,
  maxSlots = 3,
  onToggleTalent,
  onReroll,
  onConfirm,
}) => {
  const isSelected = (t: Talent) => selectedTalents.some((item) => item.id === t.id);

  const getGradeStyle = (grade: TalentGrade) => {
    switch (grade) {
      case 4:
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          border: 'border-amber-500/60 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900',
          glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
          title: 'text-amber-300',
          gradeText: '传说',
        };
      case 3:
        return {
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
          border: 'border-purple-500/50 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900',
          glow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]',
          title: 'text-purple-300',
          gradeText: '史诗',
        };
      case 2:
        return {
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          border: 'border-blue-500/40 bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900',
          glow: '',
          title: 'text-blue-300',
          gradeText: '优秀',
        };
      default:
        return {
          badge: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          border: 'border-slate-800 bg-slate-900/90',
          glow: '',
          title: 'text-slate-200',
          gradeText: '普通',
        };
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto overflow-hidden">
      {/* 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 overscroll-contain">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>轮回之门已开启</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">天赋抽选</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            命运赐予你 10 项初生机缘，请勾选 <span className="text-indigo-400 font-semibold">{maxSlots} 项</span> 转生：
          </p>
        </div>

        {/* 天赋卡片网格 (手机单列，平板/桌面双列) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 pb-2">
          {talents.map((talent) => {
            const selected = isSelected(talent);
            const style = getGradeStyle(talent.grade);

            return (
              <button
                type="button"
                key={talent.id}
                onClick={() => onToggleTalent(talent)}
                className={`relative p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer select-none text-left w-full active:scale-[0.99] ${style.border} ${style.glow} ${
                  selected
                    ? 'ring-2 ring-indigo-500 shadow-md shadow-indigo-500/25 bg-slate-900'
                    : 'hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md border ${style.badge}`}>
                      {style.gradeText}
                    </span>
                    <span className={`font-bold text-sm sm:text-base ${style.title}`}>{talent.name}</span>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      selected ? 'bg-indigo-600 border-indigo-400 text-white' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-2.5">{talent.description}</p>

                {talent.statBonus && (
                  <div className="flex flex-wrap gap-1 text-[10px] sm:text-[11px]">
                    {Object.entries(talent.statBonus).map(([k, v]) => {
                      const labelMap: Record<string, string> = {
                        charm: '颜值',
                        intelligence: '智力',
                        strength: '体质',
                        wealth: '家境',
                        happiness: '快乐',
                        luck: '气运',
                        spiritualRoot: '灵根',
                      };
                      const isPositive = Number(v) > 0;
                      return (
                        <span
                          key={k}
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {labelMap[k] || k} {isPositive ? `+${v}` : v}
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部吸底操作栏 (支持全面屏安全区) */}
      <div className="shrink-0 backdrop-blur-md bg-slate-900/95 border-t border-slate-800 px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shadow-xl">
        <button
          onClick={onReroll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs sm:text-sm font-medium transition-all border border-slate-700 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>重新摇号</span>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-slate-400 shrink-0">
            已选
            <span
              className={`font-bold ml-1 ${
                selectedTalents.length === maxSlots ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {selectedTalents.length}/{maxSlots}
            </span>
          </span>

          <button
            disabled={selectedTalents.length !== maxSlots}
            onClick={onConfirm}
            className={`px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 ${
              selectedTalents.length === maxSlots
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/25 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            去加点 ➔
          </button>
        </div>
      </div>
    </div>
  );
};
