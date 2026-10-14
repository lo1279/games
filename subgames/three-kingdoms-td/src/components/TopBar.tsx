import React, { useState, useEffect } from 'react';
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
  Maximize,
  Minimize,
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
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 全屏状态监听
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  return (
    <header className="h-11 sm:h-14 bg-stone-900/95 border-b border-amber-900/40 px-2 sm:px-4 flex items-center justify-between shadow-md backdrop-blur-sm z-30 shrink-0 select-none">
      {/* 战役标题与切换 */}
      <div className="flex items-center space-x-1 sm:space-x-2.5 shrink-0">
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-amber-950 border border-amber-600/50 flex items-center justify-center text-amber-400 font-bold shrink-0">
          <Swords size={13} className="sm:w-4 sm:h-4" />
        </div>
        <div className="max-w-[70px] xs:max-w-[120px] sm:max-w-none truncate">
          <span className="text-[11px] sm:text-sm font-bold text-amber-200 tracking-wide block truncate">
            {currentStage.name}
          </span>
        </div>

        {/* 关卡下拉（支持移动端点击展开与桌面端 hover） */}
        <div className="relative ml-0.5">
          <button
            onClick={() => setStageMenuOpen((prev) => !prev)}
            className="flex items-center gap-0.5 text-[10px] sm:text-xs px-1.5 py-0.5 sm:py-1 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-300 rounded border border-stone-700 transition"
          >
            <MapPin size={10} className="text-amber-400" />
            <span className="hidden sm:inline">战役</span>
          </button>
          {stageMenuOpen && (
            <>
              {/* 点击外部遮罩关闭 */}
              <div
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => setStageMenuOpen(false)}
              />
              <div className="absolute left-0 mt-1 bg-stone-900 border border-amber-900/70 rounded-lg shadow-2xl py-1 w-44 z-50 animate-in fade-in zoom-in-95">
                {STAGES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      onChangeStage(st);
                      setStageMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between ${
                      st.id === currentStage.id
                        ? 'bg-amber-950/80 text-amber-300 font-bold'
                        : 'text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <span>{st.name}</span>
                    {st.id === currentStage.id && <span className="text-[10px] text-amber-400">当前</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 战斗核心数值：军饷、军心、波次（小屏优化） */}
      <div className="flex items-center space-x-1 sm:space-x-3">
        {/* 军饷 */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 px-1.5 sm:px-2.5 py-0.5 bg-amber-950/40 rounded-full border border-amber-500/30">
          <Coins size={12} className="text-amber-400 animate-pulse sm:w-3.5 sm:h-3.5" />
          <span className="hidden md:inline text-[10px] sm:text-xs text-stone-400">军饷:</span>
          <span className="text-[11px] sm:text-sm font-extrabold text-amber-300 font-mono">{gold}</span>
        </div>

        {/* 军心 (生命值) */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 px-1.5 sm:px-2.5 py-0.5 bg-red-950/40 rounded-full border border-red-500/30">
          <Heart size={12} className="text-red-400 fill-red-500/60 sm:w-3.5 sm:h-3.5" />
          <span className="hidden md:inline text-[10px] sm:text-xs text-stone-400">军心:</span>
          <span className="text-[11px] sm:text-sm font-extrabold text-red-300 font-mono">{lives}</span>
        </div>

        {/* 波次 */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 px-1.5 sm:px-2.5 py-0.5 bg-stone-800/60 rounded-full border border-stone-600/40">
          <span className="hidden md:inline text-[10px] sm:text-xs text-stone-400">波次:</span>
          <span className="text-[11px] sm:text-sm font-bold text-amber-100 font-mono">
            {currentWave}/{totalWaves}
          </span>
        </div>
      </div>

      {/* 控制操作台：全屏、倍速、暂停、重新开始、音效 */}
      <div className="flex items-center space-x-0.5 sm:space-x-1.5 shrink-0">
        {/* 移动端全屏切换 */}
        <button
          onClick={handleToggleFullscreen}
          title={isFullscreen ? '退出全屏' : '全屏体验'}
          className="p-1 sm:p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press hidden xs:flex items-center justify-center"
        >
          {isFullscreen ? <Minimize size={13} className="text-amber-400" /> : <Maximize size={13} />}
        </button>

        <button
          onClick={onToggleSpeed}
          title="切换游戏倍速"
          className={`flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs rounded border transition btn-press font-mono font-bold ${
            gameSpeed > 1
              ? 'bg-amber-600 text-stone-950 border-amber-400 shadow-sm shadow-amber-600/30'
              : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
          }`}
        >
          <span>{gameSpeed}x</span>
        </button>

        <button
          onClick={onTogglePause}
          title={isPaused ? '继续战斗' : '暂停战局'}
          className="p-1 sm:p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          {isPaused ? <Play size={13} className="text-emerald-400" /> : <Pause size={13} />}
        </button>

        <button
          onClick={onRestart}
          title="重置本关战役"
          className="p-1 sm:p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          <RotateCcw size={13} />
        </button>

        <button
          onClick={onToggleSound}
          title={soundEnabled ? '静音' : '开启音效'}
          className="p-1 sm:p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition btn-press"
        >
          {soundEnabled ? <Volume2 size={13} className="text-amber-400" /> : <VolumeX size={13} />}
        </button>
      </div>
    </header>
  );
};
