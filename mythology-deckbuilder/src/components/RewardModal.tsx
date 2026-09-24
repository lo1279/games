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
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.3)]">
        
        {/* 胜利标志 */}
        <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl text-amber-400 mb-3 animate-bounce">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black text-amber-300 tracking-wide">
          诸神裁决 · 战役大捷！
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          妖邪已被击退，三界裂隙中散落出跨神话的秘法与神晶。
        </p>

        {/* 金币奖励展示 */}
        <div className="my-4 px-6 py-2 bg-slate-950/80 rounded-xl border border-amber-500/40 flex items-center gap-2 text-amber-400 font-extrabold text-sm">
          <Coins className="w-4 h-4" />
          <span>获得神晶金币: +{goldReward}</span>
        </div>

        {/* 卡牌三选一构筑 */}
        <div className="w-full my-4">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4">
            选择一张神术加入你的神明套牌（三选一）
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {cardChoices.map((card) => (
              <div key={card.id} className="transform hover:scale-105 transition-transform">
                <CardComponent
                  card={card}
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
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => {
              sounds.playClick();
              onSkipCards();
            }}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
            <span>放弃添牌，直接启程</span>
          </button>
        </div>
      </div>
    </div>
  );
};
