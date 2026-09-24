import React from 'react';
import {
  Coins,
  Heart,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Swords,
  MapPin,
} from 'lucide-react';
import { StageConfig } from '../types/game';
import { STAGES } from '../config/stages';

interface TopBarProps {
  currentStage: StageConfig;
  gold: number;
  lives: number;
  currentWave: number;
  totalWaves: number;
  isPaused: boolean;
  gameSpeed: number;
  soundEnabled: boolean;
  onTogglePause: () => void;
  onToggleSpeed: () => void;
  onToggleSound: () => void;
  onRestart: () => void;
  onChangeStage: (stage: StageConfig) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentStage,
  gold,
  lives,
  currentWave,
  totalWaves,
  isPaused,
  gameSpeed,
  soundEnabled,
  onTogglePause,
  onToggleSpeed,
  onToggleSound,
  onRestart,
  onChangeStage,
}) => {
  return (
    <header className="h-14 bg-stone-900/90 border-b border-amber-900/40 px-4 flex items-center justify-between shadow-md backdrop-blur-sm z-20">
      {/* 战役标题与切换 */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded bg-amber-950 border border-amber-600/50 flex items-center justify-center text-amber-400 font-bold">
          <Swords size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-amber-200 tracking-wide flex items-center gap-1.5">
            <span>{currentStage.name}</span>
            <span className="text-xs text-amber-500/80 font-normal">({currentStage.subtitle})</span>
          </div>
        </div>

        {/* 关卡下拉 */}
        <div className="relative group ml-2">
          <button className="flex items-center gap-1 text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition">
            <MapPin size={12} />
            <span>切换战役</span>
          </button>
          <div className="absolute left-0 mt-1 hidden group-hover:block bg-stone-900 border border-amber-900/60 rounded shadow-xl py-1 w-44 z-50">
            {STAGES.map((st) => (
              <button
                key={st.id}
                onClick={() => onChangeStage(st)}
                className={`w-full text-left px-3 py-1.5 text-xs transition ${
                  st.id === currentStage.id
                    ? 'bg-amber-950/80 text-amber-300 font-bold'
                    : 'text-stone-300 hover:bg-stone-800'
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 战斗核心数值：军饷、军心、波次 */}
      <div className="flex items-center space-x-6">
        {/* 军饷 */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-950/40 rounded-full border border-amber-500/30">
          <Coins size={16} className="text-amber-400 animate-pulse" />
          <span className="text-xs text-stone-400">军饷:</span>
          <span className="text-sm font-extrabold text-amber-300 tracking-wider">{gold}</span>
        </div>

        {/* 军心 (生命值) */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-red-950/40 rounded-full border border-red-500/30">
          <Heart size={16} className="text-red-400 fill-red-500/60" />
          <span className="text-xs text-stone-400">军心:</span>
          <span className="text-sm font-extrabold text-red-300">{lives}</span>
        </div>

        {/* 波次 */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-stone-800/60 rounded-full border border-stone-600/40">
          <span className="text-xs text-stone-400">迎击波次:</span>
          <span className="text-sm font-bold text-amber-100">
            第 {currentWave} / {totalWaves} 波
          </span>
        </div>
      </div>

      {/* 控制操作台：暂停、倍速、重新开始、音效 */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleSpeed}
          title="切换游戏倍速"
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition btn-press ${
            gameSpeed > 1
              ? 'bg-amber-600 text-stone-950 font-bold border-amber-400'
              : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
          }`}
        >
          <FastForward size={14} />
          <span>{gameSpeed}x</span>
        </button>

        <button
          onClick={onTogglePause}
          title={isPaused ? '继续战斗' : '暂停战局'}
          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          {isPaused ? <Play size={15} className="text-emerald-400" /> : <Pause size={15} />}
        </button>

        <button
          onClick={onRestart}
          title="重置本关战役"
          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          <RotateCcw size={15} />
        </button>

        <button
          onClick={onToggleSound}
          title={soundEnabled ? '静音' : '开启音效'}
          className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          {soundEnabled ? <Volume2 size={15} className="text-amber-400" /> : <VolumeX size={15} />}
        </button>
      </div>
    </header>
  );
};
