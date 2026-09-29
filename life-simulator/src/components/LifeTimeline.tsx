import React, { useEffect, useRef } from 'react';
import type { LifeLog, AttributeKey } from '../types/game';
import { Play, Pause, FastForward, RotateCcw, AlertCircle, Award, Compass, Zap } from 'lucide-react';

interface LifeTimelineProps {
  logs: LifeLog[];
  isDead: boolean;
  autoPlay: boolean;
  playSpeedMs: number;
  age?: number;
  onNextYear: () => void;
  onToggleAutoPlay: () => void;
  onChangeSpeed: () => void;
  onRestart: () => void;
  onOpenBusiness?: () => void;
}

const STAT_LABELS: Record<AttributeKey, string> = {
  charm: '颜值',
  intelligence: '智力',
  strength: '体质',
  wealth: '财富',
  happiness: '快乐',
  luck: '气运',
  spiritualRoot: '灵根',
};

export const LifeTimeline: React.FC<LifeTimelineProps> = ({
  logs,
  isDead,
  autoPlay,
  playSpeedMs,
  age = 0,
  onNextYear,
  onToggleAutoPlay,
  onChangeSpeed,
  onRestart,
  onOpenBusiness,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: autoPlay && playSpeedMs <= 500 ? 'auto' : 'smooth',
    });
  }, [logs.length, autoPlay, playSpeedMs]);

  const getLogStyle = (type: LifeLog['type']) => {
    switch (type) {
      case 'milestone':
        return {
          card: 'bg-indigo-950/40 border-indigo-500/40 shadow-indigo-500/10',
          badge: 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30',
          icon: <Compass className="w-4 h-4 text-indigo-300" />,
        };
      case 'positive':
        return {
          card: 'bg-slate-900/90 border-slate-800 hover:border-slate-700',
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
          icon: <Award className="w-4 h-4 text-emerald-400" />,
        };
      case 'warning':
        return {
          card: 'bg-amber-950/30 border-amber-500/30',
          badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
          icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
        };
      case 'danger':
        return {
          card: 'bg-rose-950/40 border-rose-500/50 shadow-rose-500/20',
          badge: 'bg-rose-500 text-white font-bold',
          icon: <AlertCircle className="w-4 h-4 text-rose-300" />,
        };
      case 'special':
        return {
          card: 'bg-purple-950/40 border-purple-500/50 shadow-purple-500/20',
          badge: 'bg-purple-600 text-white',
          icon: <Zap className="w-4 h-4 text-purple-300" />,
        };
      default:
        return {
          card: 'bg-slate-900/80 border-slate-800/80',
          badge: 'bg-slate-800 text-slate-400 border border-slate-700',
          icon: null,
        };
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto overflow-hidden">
      {/* 滚动时间轴主区域 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2.5 sm:space-y-3.5 overscroll-contain">
        {logs.map((log) => {
          const style = getLogStyle(log.type);

          return (
            <div
              key={log.id}
              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 shadow-xs flex items-start gap-2.5 sm:gap-3.5 ${style.card}`}
            >
              {/* 年龄标签 */}
              <div
                className={`shrink-0 flex items-center justify-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold ${style.badge}`}
              >
                {log.age} 岁
              </div>

              {/* 文本内容与变更属性 */}
              <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal break-words">{log.content}</p>
                  {style.icon && <div className="shrink-0 mt-0.5">{style.icon}</div>}
                </div>

                {/* 属性增减与称号变动徽章 */}
                {(log.statChanges || (log.tagsGained && log.tagsGained.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-0.5">
                    {log.statChanges &&
                      Object.entries(log.statChanges).map(([k, delta]) => {
                        const val = Number(delta);
                        if (!val) return null;
                        const isPlus = val > 0;
                        return (
                          <span
                            key={k}
                            className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded font-medium ${
                              isPlus
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {STAT_LABELS[k as AttributeKey] || k} {isPlus ? `+${val}` : val}
                          </span>
                        );
                      })}

                    {log.tagsGained &&
                      log.tagsGained.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                        >
                          获得称号「{t}」
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 底部悬浮控制台 (支持手机全面屏安全区) */}
      <div className="shrink-0 backdrop-blur-md bg-slate-900/95 border-t border-slate-800 px-3 sm:px-4 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shadow-xl">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onRestart}
            title="重新开局"
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onChangeSpeed}
            className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{playSpeedMs === 1000 ? '1x' : playSpeedMs === 500 ? '2x' : '3x'}</span>
          </button>

          {/* 成年后的商海操作入口 */}
          {age >= 18 && onOpenBusiness && !isDead && (
            <button
              onClick={onOpenBusiness}
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>商海</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end max-w-[240px] sm:max-w-none">
          <button
            onClick={onToggleAutoPlay}
            disabled={isDead}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
              autoPlay
                ? 'bg-amber-600/30 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{autoPlay ? '暂停' : '自动'}</span>
          </button>

          <button
            onClick={onNextYear}
            disabled={isDead || autoPlay}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 text-center"
          >
            下一年 ➔
          </button>
        </div>
      </div>
    </div>
  );
};
