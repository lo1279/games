import React from 'react';
import type { Card } from '../types/card';
import { Sword, Shield, Zap, Sparkles, Flame, Heart, Skull, Waves, Eye } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface CardProps {
  card: Card;
  disabled?: boolean;
  onClick?: () => void;
  isPlayable?: boolean;
}

export const CardComponent: React.FC<CardProps> = ({
  card,
  disabled = false,
  onClick,
  isPlayable = true,
}) => {
  // 阵营主题色
  const getMythologyTheme = () => {
    switch (card.mythology) {
      case 'huaxia':
        return {
          border: 'border-amber-500/80 hover:border-amber-400',
          bg: 'from-amber-950/90 via-slate-900 to-black',
          glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]',
          badge: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
          tag: '华夏 · 神术',
        };
      case 'greek':
        return {
          border: 'border-blue-500/80 hover:border-blue-400',
          bg: 'from-blue-950/90 via-slate-900 to-black',
          glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]',
          badge: 'bg-blue-600/30 text-blue-300 border-blue-500/50',
          tag: '希腊 · 奥林匹斯',
        };
      case 'norse':
        return {
          border: 'border-cyan-500/80 hover:border-cyan-400',
          bg: 'from-cyan-950/90 via-slate-900 to-black',
          glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]',
          badge: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50',
          tag: '北欧 · 阿斯加德',
        };
      default:
        return {
          border: 'border-purple-500/80 hover:border-purple-400',
          bg: 'from-purple-950/90 via-slate-900 to-black',
          glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]',
          badge: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
          tag: '远古 · 秘卷',
        };
    }
  };

  const theme = getMythologyTheme();

  // 卡牌主图
  const renderCardIcon = () => {
    const props = { className: 'w-10 h-10 drop-shadow-md text-amber-200' };
    switch (card.icon) {
      case 'Sword':
      case 'Swords':
        return <Sword {...props} />;
      case 'Shield':
        return <Shield {...props} />;
      case 'Zap':
      case 'CloudLightning':
        return <Zap {...props} className="w-10 h-10 text-cyan-300 drop-shadow-md" />;
      case 'Flame':
        return <Flame {...props} className="w-10 h-10 text-orange-400 drop-shadow-md" />;
      case 'Heart':
        return <Heart {...props} className="w-10 h-10 text-rose-400 drop-shadow-md" />;
      case 'Waves':
        return <Waves {...props} className="w-10 h-10 text-blue-300 drop-shadow-md" />;
      case 'Eye':
        return <Eye {...props} className="w-10 h-10 text-indigo-300 drop-shadow-md" />;
      case 'Skull':
        return <Skull {...props} className="w-10 h-10 text-red-500 drop-shadow-md" />;
      default:
        return <Sparkles {...props} />;
    }
  };

  return (
    <div
      onClick={() => {
        if (!disabled && isPlayable && onClick) {
          sounds.playCardPlay();
          onClick();
        }
      }}
      onMouseEnter={() => {
        if (!disabled && isPlayable) {
          sounds.playClick();
        }
      }}
      className={`
        relative w-44 h-64 rounded-xl border-2 p-3 flex flex-col justify-between
        bg-gradient-to-b ${theme.bg} ${theme.border} ${theme.glow}
        card-hover-fx cursor-pointer select-none transition-all duration-200
        ${disabled || !isPlayable ? 'opacity-40 grayscale cursor-not-allowed hover:transform-none' : 'shadow-lg'}
      `}
    >
      {/* 顶部：神力消耗能量宝石 + 卡牌名称 */}
      <div className="flex items-center justify-between gap-1 z-10">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-200 flex items-center justify-center font-black text-slate-950 text-sm shadow-md">
          {card.cost}
        </div>
        <div className="font-bold text-sm tracking-wide text-amber-100 truncate text-right flex-1">
          {card.name}
        </div>
      </div>

      {/* 中部：神话徽标与动态展示 */}
      <div className="flex-1 flex flex-col items-center justify-center my-1 relative">
        <div className="absolute inset-0 bg-radial from-amber-500/10 to-transparent blur-sm rounded-full pointer-events-none" />
        <div className="p-3 bg-slate-900/60 rounded-full border border-slate-700/60 shadow-inner">
          {renderCardIcon()}
        </div>
        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border mt-2 ${theme.badge}`}>
          {theme.tag}
        </span>
      </div>

      {/* 效果描述与属性 */}
      <div className="z-10 bg-slate-950/70 rounded-lg p-2 border border-slate-800/80 mb-1">
        <div className="text-xs text-slate-200 leading-snug font-medium text-center">
          {card.description}
        </div>
      </div>

      {/* 底部：神话背景风味物语 */}
      {card.flavorText && (
        <div className="text-[9px] text-slate-400 italic line-clamp-1 text-center border-t border-slate-800 pt-1">
          "{card.flavorText}"
        </div>
      )}
    </div>
  );
};
