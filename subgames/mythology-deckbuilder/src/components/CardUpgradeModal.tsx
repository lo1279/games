import React, { useState } from 'react';
import type { Card } from '../types/card';
import { CardComponent } from './CardComponent';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { upgradeCard } from '../data/cards';
import { sounds } from '../audio/soundSynth';

interface CardUpgradeModalProps {
  deck: Card[];
  onUpgrade: (cardIndex: number) => void;
  onClose: () => void;
}

export const CardUpgradeModal: React.FC<CardUpgradeModalProps> = ({
  deck,
  onUpgrade,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedCard = selectedIndex !== null ? deck[selectedIndex] : null;
  const previewUpgradedCard = selectedCard ? upgradeCard(selectedCard) : null;

  const handleConfirmUpgrade = () => {
    if (selectedIndex !== null) {
      sounds.playBuff();
      onUpgrade(selectedIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in safe-area-container select-none">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/60 rounded-2xl p-3 sm:p-5 shadow-2xl flex flex-col max-h-[92dvh]">
        {/* 关闭按钮 */}
        <button
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 active:scale-95 cursor-pointer z-20"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* 头部标题 */}
        <div className="text-center mb-2 sm:mb-3 pr-6">
          <div className="inline-flex items-center gap-1.5 text-amber-400 font-black text-base sm:text-lg">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>神术熔炉 · 淬火强化</span>
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          </div>
          <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5">
            选择牌组中的一张卡牌注入天地灵力，大幅跃升其攻防与神通！
          </p>
        </div>

        {/* 卡牌强化对比预览区 (当选中卡牌时显示) */}
        {selectedCard && previewUpgradedCard && (
          <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3 mb-3 flex flex-col items-center">
            <div className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-2">
              <span>【强化预览】</span>
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-6">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 mb-1">当前境界</span>
                <CardComponent card={selectedCard} compact={true} isPlayable={false} />
              </div>
              <ArrowRight className="w-6 h-6 text-amber-400 animate-pulse shrink-0" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-300 font-bold mb-1">神化之境</span>
                <CardComponent card={previewUpgradedCard} compact={true} isPlayable={false} />
              </div>
            </div>

            <button
              onClick={handleConfirmUpgrade}
              className="mt-3 px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-[0_0_15px_rgba(245,158,11,0.6)] active:scale-95 transition-all"
            >
              确认淬炼【{selectedCard.name}】
            </button>
          </div>
        )}

        {/* 牌库可选卡牌列表 */}
        <div className="text-xs font-semibold text-slate-300 mb-2 flex justify-between items-center px-1">
          <span>选择需要强化的卡牌 (点击预览)：</span>
          <span className="text-slate-400">牌组总数: {deck.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 p-1">
          {deck.map((card, idx) => {
            const isUpgraded = !!card.upgraded;
            const isSelected = selectedIndex === idx;

            return (
              <div
                key={`${card.id}_${idx}`}
                className={`relative flex flex-col items-center ${isUpgraded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (!isUpgraded) {
                    sounds.playClick();
                    setSelectedIndex(idx);
                  }
                }}
              >
                <CardComponent
                  card={card}
                  compact={true}
                  selected={isSelected}
                  isPlayable={!isUpgraded}
                />
                {isUpgraded && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500/50">
                      已达极境
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
