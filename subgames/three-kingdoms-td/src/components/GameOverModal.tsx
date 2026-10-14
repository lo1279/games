import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Skull, RotateCcw, ArrowRight } from 'lucide-react';
import { StageConfig } from '../types/game';
import { STAGES } from '../config/stages';

interface GameOverModalProps {
  victory: boolean;
  currentStage: StageConfig;
  onRestart: () => void;
  onNextStage: (nextStage: StageConfig) => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  victory,
  currentStage,
  onRestart,
  onNextStage,
}) => {
  useEffect(() => {
    if (victory) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#dc2626', '#16a34a', '#3b82f6'],
      });
    }
  }, [victory]);

  const currentIndex = STAGES.findIndex((s) => s.id === currentStage.id);
  const nextStage = currentIndex !== -1 && currentIndex + 1 < STAGES.length ? STAGES[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-stone-900 border-2 border-amber-600/70 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl shadow-amber-900/40">
        {/* 顶部图标 */}
        <div className="flex justify-center mb-4">
          {victory ? (
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400">
              <Trophy size={36} />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400">
              <Skull size={36} />
            </div>
          )}
        </div>

        {/* 标题 */}
        <h2 className="text-2xl font-black tracking-wider mb-1 text-amber-200">
          {victory
            ? !nextStage
              ? '天下归心·一统三国！'
              : '战役大捷·凯歌高奏！'
            : '全线溃败·主帅失守！'}
        </h2>
        <div className="text-xs text-amber-500/90 mb-4">{currentStage.name}</div>

        {/* 说明 */}
        <p className="text-sm text-stone-300 leading-relaxed mb-6 px-4">
          {victory
            ? !nextStage
              ? '恭喜主公！曲阳平乱、虎牢破敌、下邳生擒战神吕布，三大战役尽数大捷！四海升平，名垂青史！'
              : '主公用兵如神，各路名将恪尽职守，敌军已全数伏诛或溃散逃亡，天下安宁又近一步！'
            : '敌军突入中军主帅营帐，军心瓦解。请主公重整旗鼓，调整名将布阵，再战雄关！'}
        </p>

        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold border border-stone-600 transition btn-press"
          >
            <RotateCcw size={15} />
            <span>重整再战</span>
          </button>

          {victory && nextStage && (
            <button
              onClick={() => onNextStage(nextStage)}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 rounded-xl text-xs font-extrabold shadow-lg shadow-amber-600/30 transition btn-press"
            >
              <span>进军下一战役</span>
              <ArrowRight size={15} />
            </button>
          )}

          {victory && !nextStage && (
            <button
              onClick={() => onNextStage(STAGES[0])}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 rounded-xl text-xs font-extrabold shadow-lg shadow-amber-600/30 transition btn-press"
            >
              <span>重温全战役</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
