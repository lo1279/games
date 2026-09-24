import React, { useState } from 'react';
import type { Card } from '../types/card';
import type { Relic } from '../types/relic';
import { CardComponent } from './CardComponent';
import { ShoppingBag, Coins, Trash2, X, Sparkles } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface ShopModalProps {
  cardsForSale: Card[];
  relicsForSale: Relic[];
  playerGold: number;
  playerDeck: Card[];
  onBuyCard: (card: Card, cost: number) => void;
  onBuyRelic: (relic: Relic, cost: number) => void;
  onRemoveCard: (cardIndex: number, cost: number) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  cardsForSale,
  relicsForSale,
  playerGold,
  playerDeck,
  onBuyCard,
  onBuyRelic,
  onRemoveCard,
  onClose,
}) => {
  const [isPurging, setIsPurging] = useState(false);
  const [purchasedCardIds, setPurchasedCardIds] = useState<string[]>([]);
  const [purchasedRelicIds, setPurchasedRelicIds] = useState<string[]>([]);
  const PURGE_COST = 50;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 safe-area-container select-none">
      <div className="max-w-2xl w-full bg-slate-900 border-2 border-yellow-500/80 rounded-2xl sm:rounded-3xl p-3 sm:p-6 flex flex-col max-h-[92dvh] shadow-2xl">
        
        {/* 顶部标题与金币 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/40">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-yellow-300">诸神黑市 · 万界商会</h2>
              <p className="text-[10px] sm:text-xs text-slate-400">汇聚华夏、奥林匹斯与阿斯加德宝物</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 rounded-lg border border-yellow-500/40 text-yellow-400 font-extrabold text-xs">
              <Coins className="w-3.5 h-3.5" />
              <span>{playerGold}</span>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 商店主体内容 */}
        <div className="flex-1 overflow-y-auto py-3 space-y-5 pr-1 no-scrollbar">
          
          {/* 在售神术卡牌 */}
          <div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 神术拓片
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 justify-items-center">
              {cardsForSale.map((card) => {
                const cost = 45;
                const isSoldOut = purchasedCardIds.includes(card.id);
                const canAfford = playerGold >= cost && !isSoldOut;
                return (
                  <div key={card.id} className="flex flex-col items-center gap-1.5 w-full max-w-[120px]">
                    <CardComponent
                      card={card}
                      compact={true}
                      disabled={isSoldOut || !canAfford}
                      onClick={() => {
                        if (canAfford) {
                          sounds.playVictory();
                          setPurchasedCardIds(prev => [...prev, card.id]);
                          onBuyCard(card, cost);
                        }
                      }}
                    />
                    <button
                      disabled={isSoldOut || !canAfford}
                      onClick={() => {
                        if (canAfford) {
                          sounds.playVictory();
                          setPurchasedCardIds(prev => [...prev, card.id]);
                          onBuyCard(card, cost);
                        }
                      }}
                      className={`
                        w-full text-[10px] sm:text-xs font-bold py-1 rounded-md border flex items-center justify-center gap-0.5
                        ${isSoldOut
                          ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                          : canAfford 
                            ? 'bg-amber-500 text-black border-amber-400 hover:bg-amber-400 cursor-pointer active:scale-95' 
                            : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
                      `}
                    >
                      {isSoldOut ? '已售罄' : <><Coins className="w-3 h-3" /> {cost} 金币</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 在售神器 */}
          {relicsForSale.length > 0 && (
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 诸神圣物
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relicsForSale.map((relic) => {
                  const cost = 110;
                  const isSoldOut = purchasedRelicIds.includes(relic.id);
                  const canAfford = playerGold >= cost && !isSoldOut;
                  return (
                    <div
                      key={relic.id}
                      className={`p-2.5 bg-slate-950 border rounded-xl flex items-center justify-between gap-2 ${isSoldOut ? 'border-slate-800 opacity-50' : 'border-slate-800'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-cyan-300 truncate">{relic.name}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{relic.description}</div>
                      </div>
                      <button
                        disabled={isSoldOut || !canAfford}
                        onClick={() => {
                          if (canAfford) {
                            sounds.playVictory();
                            setPurchasedRelicIds(prev => [...prev, relic.id]);
                            onBuyRelic(relic, cost);
                          }
                        }}
                        className={`
                          text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap border flex items-center gap-0.5 flex-shrink-0
                          ${isSoldOut
                            ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            : canAfford 
                              ? 'bg-cyan-500 text-black border-cyan-400 hover:bg-cyan-400 cursor-pointer active:scale-95' 
                              : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
                        `}
                      >
                        {isSoldOut ? '已售罄' : <><Coins className="w-3 h-3" /> {cost}</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 遗忘之池：精简卡牌 */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">冥河洗练 · 删牌</div>
                <div className="text-[10px] text-slate-400">永久移除一张不需要的基础卡牌</div>
              </div>
            </div>

            <button
              disabled={playerGold < PURGE_COST}
              onClick={() => {
                sounds.playClick();
                setIsPurging(true);
              }}
              className={`
                px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border flex items-center gap-1 cursor-pointer whitespace-nowrap
                ${playerGold >= PURGE_COST 
                  ? 'bg-rose-600 text-white border-rose-500 active:scale-95' 
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
              `}
            >
              <Coins className="w-3 h-3" /> {PURGE_COST} 删牌
            </button>
          </div>
        </div>

        {/* 移除卡牌专用弹层 */}
        {isPurging && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-60 flex flex-col items-center justify-center p-3 safe-area-container">
            <div className="max-w-lg w-full bg-slate-900 border border-red-500/60 rounded-2xl p-4 flex flex-col max-h-[85dvh]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-rose-400">选择要移除的一张卡牌</h3>
                <button
                  onClick={() => setIsPurging(false)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold"
                >
                  取消
                </button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 no-scrollbar">
                {playerDeck.map((card, idx) => (
                  <div
                    key={`${card.id}_${idx}`}
                    onClick={() => {
                      sounds.playAttack();
                      onRemoveCard(idx, PURGE_COST);
                      setIsPurging(false);
                    }}
                    className="cursor-pointer active:scale-95 transition-transform flex justify-center"
                  >
                    <CardComponent card={card} compact={true} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
