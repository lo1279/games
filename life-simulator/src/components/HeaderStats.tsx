import React from 'react';
import { Sparkles, Brain, HeartPulse, Coins, Smile, Clover, Flame } from 'lucide-react';
import type { Attributes } from '../types/game';


interface HeaderStatsProps {
  age: number;
  name: string;
  gender: '男' | '女';
  attrs: Attributes;
  tags: string[];
  cash?: number;
  partnerName?: string;
  onOpenBusiness?: () => void;
  onOpenFamily?: () => void;
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  age,
  name,
  gender,
  attrs,
  tags,
  cash = 0,
  partnerName,
  onOpenBusiness,
  onOpenFamily,
}) => {
  const statConfig = [
    {
      key: 'charm',
      label: '颜值',
      value: attrs.charm,
      icon: <Sparkles className="w-4 h-4 text-pink-400" />,
      color: 'from-pink-500/20 to-rose-500/10 border-pink-500/30 text-pink-300',
    },
    {
      key: 'intelligence',
      label: '智商',
      value: attrs.intelligence,
      icon: <Brain className="w-4 h-4 text-cyan-400" />,
      color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300',
    },
    {
      key: 'strength',
      label: '体质',
      value: attrs.strength,
      icon: <HeartPulse className="w-4 h-4 text-emerald-400" />,
      color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-300',
    },
    {
      key: 'wealth',
      label: '财富',
      value: attrs.wealth,
      icon: <Coins className="w-4 h-4 text-amber-400" />,
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300',
    },
    {
      key: 'happiness',
      label: '快乐',
      value: attrs.happiness,
      icon: <Smile className="w-4 h-4 text-purple-400" />,
      color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-300',
    },
    {
      key: 'luck',
      label: '气运',
      value: attrs.luck,
      icon: <Clover className="w-4 h-4 text-lime-400" />,
      color: 'from-lime-500/20 to-emerald-500/10 border-lime-500/30 text-lime-300',
    },
  ];

  return (
    <header className="shrink-0 z-20 backdrop-blur-md bg-slate-900/95 border-b border-slate-800 shadow-md px-3 sm:px-4 py-2 sm:py-2.5">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* 基本信息行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 font-bold text-white text-xs shadow-md shadow-indigo-500/20 shrink-0">
              {gender === '男' ? '♂' : '♀'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-sm sm:text-base tracking-tight truncate max-w-[120px] sm:max-w-none">
                {name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold shrink-0">
                {age} 岁
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 灵根展示 (若激活修仙线) */}
            {attrs.spiritualRoot && attrs.spiritualRoot > 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold animate-pulse shrink-0">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>灵根 {attrs.spiritualRoot}</span>
              </div>
            ) : null}

            {/* 成年后激活良缘家族入口 */}
            {age >= 18 && onOpenFamily && (
              <button
                onClick={onOpenFamily}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-pink-600/30 to-rose-600/30 hover:from-pink-600/40 hover:to-rose-600/40 border border-pink-500/40 text-pink-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <span>❤️</span>
                <span>{partnerName ? partnerName : '良缘'}</span>
              </button>
            )}

            {/* 成年后激活资产入口 */}
            {age >= 18 && onOpenBusiness && (
              <button
                onClick={onOpenBusiness}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>{cash.toFixed(1)}万</span>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-500/20 px-1 rounded">理财/创业</span>
              </button>
            )}
          </div>
        </div>

        {/* 6 大核心属性微卡片 (手机端 3 列 x 2 行，桌面端 6 列横排) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
          {statConfig.map((item) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl bg-gradient-to-br border ${item.color} shadow-xs min-w-0`}
            >
              <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 shrink">
                <span className="shrink-0 scale-90 sm:scale-100">{item.icon}</span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">{item.label}</span>
              </div>
              <span className="text-xs sm:text-sm font-extrabold ml-0.5 sm:ml-1 shrink-0 tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>

        {/* 获得的人生成就称号/标签 */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <span className="text-slate-500 shrink-0 font-medium text-[11px]">称号：</span>
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="shrink-0 px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60 font-medium text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
