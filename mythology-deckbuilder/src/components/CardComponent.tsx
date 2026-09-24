import React from 'react';
import type { Card } from '../types/card';
import { Sword, Shield, Zap, Sparkles, Flame, Heart, Skull, Waves, Eye } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface CardProps {
  card: Card;
  disabled?: boolean;
  onClick?: () => void;
  isPlayable?: boolean;
  compact?: boolean;
  selected?: boolean;
}

export const CardComponent: React.FC<CardProps> = ({
  card,
  disabled = false,
  onClick,
  isPlayable = true,
  compact = false,
  selected = false,
}) => {
  // 阵营主题色
  const getMythologyTheme = () => {
    switch (card.mythology) {
      case 'huaxia':
        return {
          border: 'border-amber-500/80 hover:border-amber-400',
          selectedBorder: 'border-amber-400 ring-2 ring-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.6)]',
          bg: 'from-amber-950/90 via-slate-900 to-black',
          badge: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
          tag: '华夏',
        };
      case 'greek':
        return {
          border: 'border-blue-500/80 hover:border-blue-400',
          selectedBorder: 'border-blue-400 ring-2 ring-blue-400/90 shadow-[0_0_20px_rgba(59,130,246,0.6)]',
          bg: 'from-blue-950/90 via-slate-900 to-black',
          badge: 'bg-blue-600/30 text-blue-300 border-blue-500/50',
          tag: '希腊',
        };
      case 'norse':
        return {
          border: 'border-cyan-500/80 hover:border-cyan-400',
          selectedBorder: 'border-cyan-400 ring-2 ring-cyan-400/90 shadow-[0_0_20px_rgba(6,182,212,0.6)]',
          bg: 'from-cyan-950/90 via-slate-900 to-black',
          badge: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50',
          tag: '北欧',
        };
      default:
        return {
          border: 'border-purple-500/80 hover:border-purple-400',
          selectedBorder: 'border-purple-400 ring-2 ring-purple-400/90 shadow-[0_0_20px_rgba(168,85,247,0.6)]',
          bg: 'from-purple-950/90 via-slate-900 to-black',
          badge: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
          tag: '远古',
        };
    }
  };

  const theme = getMythologyTheme();

  // 卡牌主图
  const renderCardIcon = () => {
    const iconSize = compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10';
    const props = { className: `${iconSize} drop-shadow text-amber-200` };
    switch (card.icon) {
      case 'Sword':
      case 'Swords':
        return <Sword {...props} />;
      case 'Shield':
        return <Shield {...props} />;
      case 'Zap':
      case 'CloudLightning':
        return <Zap {...props} className={`${iconSize} text-cyan-300 drop-shadow`} />;
      case 'Flame':
        return <Flame {...props} className={`${iconSize} text-orange-400 drop-shadow`} />;
      case 'Heart':
        return <Heart {...props} className={`${iconSize} text-rose-400 drop-shadow`} />;
      case 'Waves':
        return <Waves {...props} className={`${iconSize} text-blue-300 drop-shadow`} />;
      case 'Eye':
        return <Eye {...props} className={`${iconSize} text-indigo-300 drop-shadow`} />;
      case 'Skull':
        return <Skull {...props} className={`${iconSize} text-red-500 drop-shadow`} />;
      default:
        return <Sparkles {...props} />;
    }
  };

  return (
    <div
      onClick={() => {
        if (!disabled && onClick) {
          sounds.playClick();
          onClick();
        }
      }}
      className={`
        relative rounded-xl border-2 flex flex-col justify-between select-none transition-all duration-200 cursor-pointer
        bg-gradient-to-b ${theme.bg}
        ${compact 
          ? 'w-[106px] h-[156px] sm:w-36 sm:h-52 p-2' 
          : 'w-36 h-54 sm:w-44 sm:h-64 p-3'}
        ${selected ? `${theme.selectedBorder} -translate-y-2 scale-105 z-30` : theme.border}
        ${!selected && 'card-hover-fx'}
        ${disabled || !isPlayable ? 'opacity-40 grayscale cursor-not-allowed hover:transform-none' : 'shadow-md'}
      `}
    >
      {/* 顶部：神力消耗能量宝石 + 卡牌名称 */}
      <div className="flex items-center justify-between gap-1 z-10">
        <div className={`
          rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-200 
          flex items-center justify-center font-black text-slate-950 shadow-sm
          ${compact ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm'}
        `}>
          {card.cost}
        </div>
        <div className={`font-bold tracking-wide text-amber-100 truncate text-right flex-1 ${compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
          {card.name}
        </div>
      </div>

      {/* 中部：神话徽标与动态展示 */}
      <div className="flex-1 flex flex-col items-center justify-center my-0.5 relative">
        <div className="absolute inset-0 bg-radial from-amber-500/10 to-transparent blur-sm rounded-full pointer-events-none" />
        <div className={`rounded-full bg-slate-900/60 border border-slate-700/60 shadow-inner ${compact ? 'p-1.5' : 'p-2.5 sm:p-3'}`}>
          {renderCardIcon()}
        </div>
        <span className={`text-[8px] sm:text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded-full border mt-1 ${theme.badge}`}>
          {theme.tag}
        </span>
      </div>

      {/* 效果描述与属性 */}
      <div className={`z-10 bg-slate-950/75 rounded-lg border border-slate-800/80 mb-0.5 ${compact ? 'p-1' : 'p-1.5 sm:p-2'}`}>
        <div className={`text-slate-200 font-medium text-center line-clamp-3 leading-tight ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[11px] sm:text-xs'}`}>
          {card.description}
        </div>
      </div>

      {/* 底部：桌面端或大尺寸下展示背景物语 */}
      {!compact && card.flavorText && (
        <div className="text-[8px] sm:text-[9px] text-slate-400 italic line-clamp-1 text-center border-t border-slate-800 pt-0.5 hidden sm:block">
          "{card.flavorText}"
        </div>
      )}
    </div>
  );
};
