import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { GameState } from '../types/game';
import { evaluateLife } from '../engine/lifeEvaluation';
import { Trophy, Award, RotateCcw, Sparkles } from 'lucide-react';


interface GameOverModalProps {
  state: GameState;
  onRestart: () => void;
  onOpenKarma?: () => void;
  onInheritChild?: (child: any) => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  state,
  onRestart,
  onOpenKarma,
  onInheritChild,
}) => {
  const summary = evaluateLife(state);

  useEffect(() => {
    // 烟花彩带庆祝
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, []);

  const getRankBadgeStyle = (rank: string) => {
    switch (rank) {
      case 'SSS':
        return 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/40 border border-amber-300';
      case 'SS':
        return 'bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 text-white shadow-lg shadow-purple-500/30 border border-purple-300';
      case 'S':
        return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-300';
      case 'A':
        return 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white border border-blue-400';
      case 'B':
        return 'bg-slate-700 text-slate-200 border border-slate-600';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90dvh] flex flex-col bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl space-y-3 sm:space-y-4 overflow-hidden animate-drawer-up sm:animate-scale-up">
        {/* 移动端顶部把手条 */}
        <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto sm:hidden -mt-1 mb-0.5 shrink-0" />

        {/* 顶部荣誉与评级卡片 */}
        <div className="text-center space-y-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>人生传记总览</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-black tracking-wider shrink-0 ${getRankBadgeStyle(
                summary.rank
              )}`}
            >
              {summary.rank}
            </div>
            <div className="text-left">
              <h2 className="text-base sm:text-xl font-extrabold text-white leading-tight">{summary.rankTitle}</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                终年 <span className="text-slate-200 font-bold">{state.age}</span> 岁 · 综合评分{' '}
                <span className="text-amber-400 font-bold">{summary.score}</span> 分
              </p>
            </div>
          </div>
        </div>

        {/* 可滚动的主体内容 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* 终局原因 */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs text-center leading-relaxed break-words">
            {state.deathReason}
          </div>

          {/* 墓志铭金句 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 text-center space-y-0.5">
            <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-400">【 墓志铭 】</span>
            <p className="text-xs sm:text-sm font-medium text-slate-200 italic leading-relaxed">
              “{summary.epitaph}”
            </p>
          </div>

          {/* 六维属性进度条 */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300">六维维度雷达</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0.5">
              {summary.dimensions.map((dim) => (
                <div key={dim.label} className="space-y-0.5">
                  <div className="flex justify-between text-[10px] sm:text-[11px]">
                    <span className="text-slate-400">{dim.label}</span>
                    <span className="font-bold text-slate-200">{dim.value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                      style={{ width: `${Math.min(100, dim.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 人生高光时刻 */}
          <div className="space-y-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>高光足迹</span>
            </span>
            <ul className="space-y-1">
              {summary.highlights.map((hl, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-300 bg-slate-800/40 p-2 sm:p-2.5 rounded-lg border border-slate-800 flex items-start gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span>{hl}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 本生功德收益卡片 (方案4：局外养成接入) */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-800/80 to-slate-800 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-200">本世功德收益</span>
                <p className="text-[10px] text-slate-400">寿元、财富与传奇成就折算</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-black text-amber-400">
                +{summary.karmaEarned}
              </span>
              <span className="text-[11px] text-amber-400/80 ml-1">功德币</span>
            </div>
          </div>

          {/* 获得成就展示 */}
          {state.unlockedAchievementIds.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-400" />
                <span>本局解锁成就 ({state.unlockedAchievementIds.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {state.achievements
                  .filter((a) => state.unlockedAchievementIds.includes(a.id))
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium"
                    >
                      <span>{a.icon}</span>
                      <span>{a.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* 家族世代传承通道 (方案2) */}
        {state.family?.children && state.family.children.length > 0 && onInheritChild && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900 border border-pink-500/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-pink-300 flex items-center gap-1">
                <span>👑</span>
                <span>家族世代传承（第 {state.family.generation} 代 ➔ 第 {state.family.generation + 1} 代）</span>
              </span>
              <span className="text-[11px] text-pink-400/80">继承 30% 资产与核心天赋</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {state.family.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onInheritChild(child)}
                  className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-left border border-pink-500/30 active:scale-95 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-white">{child.name}</span>
                    <span className="text-[10px] text-pink-300 ml-1">({child.gender} · 资质{child.potential})</span>
                  </div>
                  <span className="text-[11px] text-pink-400 font-bold">继承家业 ➔</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 底部按钮组合 (前往神殿 + 重开) */}
        <div className="pt-1 shrink-0 pb-[max(0.2rem,env(safe-area-inset-bottom))] flex gap-2">
          {onOpenKarma && (
            <button
              onClick={onOpenKarma}
              className="flex-1 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>轮回神殿</span>
            </button>
          )}

          <button
            onClick={onRestart}
            className={`${
              onOpenKarma ? 'flex-1' : 'w-full'
            } py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>再入轮回</span>
          </button>
        </div>
      </div>
    </div>
  );
};
