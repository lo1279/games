import React from 'react';
import { PlacedTower } from '../types/game';
import { HEROES } from '../config/heroes';
import { ArrowUpCircle, Trash2, X, Swords, Target, Crosshair, Award } from 'lucide-react';

interface TowerPanelProps {
  tower: PlacedTower;
  gold: number;
  onUpgrade: (tower: PlacedTower) => void;
  onSell: (tower: PlacedTower) => void;
  onClose: () => void;
}

export const TowerPanel: React.FC<TowerPanelProps> = ({
  tower,
  gold,
  onUpgrade,
  onSell,
  onClose,
}) => {
  const hero = HEROES.find((h) => h.id === tower.heroId);
  if (!hero) return null;

  const upgradeCost = Math.floor(hero.cost * (0.8 * tower.level));
  const isMaxLevel = tower.level >= 5;
  const canUpgrade = !isMaxLevel && gold >= upgradeCost;

  const totalInvested = hero.cost + Math.floor(hero.cost * 0.8 * (tower.level - 1));
  const sellRefund = Math.floor(totalInvested * 0.7);

  return (
    <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-6 bg-stone-900/95 border border-amber-600/60 rounded-xl p-3 sm:p-4 shadow-2xl backdrop-blur-md w-72 sm:w-84 max-w-[calc(100%-16px)] z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* 头部信息 */}
      <div className="flex items-center justify-between pb-2.5 border-b border-amber-900/40">
        <div className="flex items-center gap-2.5">
          <div
            className="w-12 h-12 rounded-lg border border-amber-500/40 overflow-hidden flex items-center justify-center font-bold text-white text-lg shadow-md shrink-0 relative bg-stone-900"
            style={{ backgroundColor: hero.color }}
          >
            <span className="select-none">{hero.avatarChar}</span>
            {hero.avatarUrl && (
              <img
                src={hero.avatarUrl}
                alt={hero.name}
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-amber-200 flex items-center gap-1.5">
              <span>{hero.name}</span>
              <span className="text-xs text-amber-400 font-normal">
                {'★'.repeat(tower.level)}
              </span>
            </div>
            <div className="text-[11px] text-stone-400">{hero.title}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-stone-200 rounded hover:bg-stone-800 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* 生命值状态栏 */}
      <div className="mt-2.5 mb-1 bg-stone-950/80 p-2 rounded border border-stone-800">
        <div className="flex justify-between items-center text-[11px] mb-1">
          <span className="text-stone-400 font-medium">生命值:</span>
          {tower.isDown ? (
            <span className="text-rose-400 font-bold animate-pulse">
              负伤休整中 ({Math.ceil(tower.recoveryTimer)}s)
            </span>
          ) : (
            <span className="text-emerald-400 font-bold">
              {tower.hp} / {tower.maxHp}
            </span>
          )}
        </div>
        <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden border border-stone-700">
          <div
            className={`h-full transition-all duration-300 ${
              tower.isDown
                ? 'bg-rose-600'
                : (tower.hp / tower.maxHp) > 0.4
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, (tower.hp / tower.maxHp) * 100))}%` }}
          />
        </div>
      </div>

      {/* 属性与战绩数据 */}
      <div className="grid grid-cols-2 gap-2 my-2.5 text-xs">
        <div className="flex items-center gap-1.5 bg-stone-950/60 p-2 rounded border border-stone-800">
          <Swords size={14} className="text-amber-400" />
          <span className="text-stone-400">攻击力:</span>
          <span className="font-bold text-amber-100">{tower.damage}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-950/60 p-2 rounded border border-stone-800">
          <Crosshair size={14} className="text-amber-400" />
          <span className="text-stone-400">射程:</span>
          <span className="font-bold text-amber-100">{tower.range}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-950/60 p-2 rounded border border-stone-800">
          <Target size={14} className="text-emerald-400" />
          <span className="text-stone-400">杀敌数:</span>
          <span className="font-bold text-emerald-300">{tower.kills}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-stone-950/60 p-2 rounded border border-stone-800">
          <Award size={14} className="text-blue-400" />
          <span className="text-stone-400">总输出:</span>
          <span className="font-bold text-blue-300">{tower.totalDamageDealt}</span>
        </div>
      </div>

      {/* 战法说明与技能冷却进度 */}
      <div className="text-[11px] bg-amber-950/30 p-2 rounded border border-amber-900/30 text-amber-200/90 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-amber-400">战法【{hero.skillName}】</span>
          <span className="text-[10px] text-amber-300/80 px-1.5 py-0.5 rounded bg-stone-900/80 border border-amber-900/50">
            冷却: {hero.skillCooldown}s
          </span>
        </div>
        <div className="text-stone-300 text-[10.5px] leading-relaxed">
          {hero.skillDesc}
        </div>
      </div>

      {/* 操作按钮组：晋升与撤阵 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpgrade(tower)}
          disabled={!canUpgrade}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition btn-press ${
            isMaxLevel
              ? 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed'
              : canUpgrade
              ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-md shadow-amber-600/30'
              : 'bg-stone-800 text-stone-400 border border-stone-700 cursor-not-allowed'
          }`}
        >
          <ArrowUpCircle size={15} />
          <span>{isMaxLevel ? '已至最高星级' : `晋升 (${upgradeCost} 军饷)`}</span>
        </button>

        <button
          onClick={() => onSell(tower)}
          className="py-1.5 px-3 bg-red-950/60 hover:bg-red-900/80 text-red-300 rounded-lg text-xs font-semibold border border-red-800/60 transition flex items-center gap-1 btn-press"
          title="撤除防线并返还军饷"
        >
          <Trash2 size={14} />
          <span>撤阵 (+{sellRefund})</span>
        </button>
      </div>
    </div>
  );
};
