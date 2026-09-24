import React, { useEffect } from 'react';
import type { Card } from '../types/card';
import { CardComponent } from './CardComponent';
import confetti from 'canvas-confetti';
import { Trophy, Coins, SkipForward } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface RewardModalProps {
  goldReward: number;
  cardChoices: Card[];
  onSelectCard: (card: Card) => void;
  onSkipCards: () => void;
}

export const RewardModal: React.FC<RewardModalProps> = ({
  goldReward,
  cardChoices,
  onSelectCard,
  onSkipCards,
}) => {
  useEffect(() => {
    sounds.playVictory();
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.5 },
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 safe-area-container select-none">
      <div className="max-w-2xl w-full bg-slate-900 border-2 border-amber-500/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center text-center shadow-[0_0_40px_rgba(245,158,11,0.3)] max-h-[95dvh] overflow-y-auto no-scrollbar">
        
        {/* 胜利标志 */}
        <div className="p-2 sm:p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl sm:rounded-2xl text-amber-400 mb-2 animate-bounce">
          <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-wide">
          诸神裁决 · 战役大捷！
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 max-w-sm">
          三界裂隙中散落出跨神话神术拓片，请挑选一张加入套牌：
        </p>

        {/* 金币奖励展示 */}
        <div className="my-2.5 px-4 py-1.5 bg-slate-950/80 rounded-xl border border-amber-500/40 flex items-center gap-1.5 text-amber-400 font-extrabold text-xs sm:text-sm">
          <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>获得神晶: +{goldReward}</span>
        </div>

        {/* 卡牌三选一构筑 */}
        <div className="w-full my-2">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            {cardChoices.map((card) => (
              <div key={card.id} className="active:scale-95 transition-transform">
                <CardComponent
                  card={card}
                  compact={true}
                  onClick={() => {
                    sounds.playVictory();
                    onSelectCard(card);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 放弃拿牌按钮 */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => {
              sounds.playClick();
              onSkipCards();
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer active:scale-95"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>跳过添牌，直接启程</span>
          </button>
        </div>
      </div>
    </div>
  );
};
