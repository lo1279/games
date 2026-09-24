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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-slate-900 border-2 border-yellow-500/80 rounded-3xl p-6 sm:p-8 flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(234,179,8,0.25)]">
        
        {/* 顶部标题与金币 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/20 text-yellow-400 rounded-xl border border-yellow-500/40">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-yellow-300">诸神黑市 · 万界商会</h2>
              <p className="text-xs text-slate-400">汇聚华夏、奥林匹斯与阿斯加德的稀有宝物与神术残篇。</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 rounded-xl border border-yellow-500/40 text-yellow-400 font-extrabold text-sm">
              <Coins className="w-4 h-4" />
              <span>{playerGold} 神晶</span>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 商店主体内容 */}
        <div className="flex-1 overflow-y-auto py-6 space-y-8 pr-1">
          
          {/* 在售神术卡牌 */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> 神术拓片 (点击选购)
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
              {cardsForSale.map((card) => {
                const cost = 45;
                const isSoldOut = purchasedCardIds.includes(card.id);
                const canAfford = playerGold >= cost && !isSoldOut;
                return (
                  <div key={card.id} className="flex flex-col items-center gap-2">
                    <CardComponent
                      card={card}
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
                        text-xs font-bold px-4 py-1.5 rounded-lg border flex items-center gap-1
                        ${isSoldOut
                          ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                          : canAfford 
                            ? 'bg-amber-500 text-black border-amber-400 hover:bg-amber-400 cursor-pointer' 
                            : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
                      `}
                    >
                      {isSoldOut ? '已售罄' : <><Coins className="w-3.5 h-3.5" /> {cost} 金币</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 在售神器 */}
          {relicsForSale.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> 诸神圣物
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relicsForSale.map((relic) => {
                  const cost = 110;
                  const isSoldOut = purchasedRelicIds.includes(relic.id);
                  const canAfford = playerGold >= cost && !isSoldOut;
                  return (
                    <div
                      key={relic.id}
                      className={`p-4 bg-slate-950 border rounded-2xl flex items-center justify-between gap-4 ${isSoldOut ? 'border-slate-800 opacity-50' : 'border-slate-700'}`}
                    >
                      <div>
                        <div className="text-sm font-bold text-cyan-300">{relic.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{relic.description}</div>
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
                          text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap border flex items-center gap-1
                          ${isSoldOut
                            ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            : canAfford 
                              ? 'bg-cyan-500 text-black border-cyan-400 hover:bg-cyan-400 cursor-pointer' 
                              : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
                        `}
                      >
                        {isSoldOut ? '已售罄' : <><Coins className="w-3.5 h-3.5" /> {cost} 金币</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 遗忘之池：精简与移除套牌卡牌 */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-200">冥河遗忘洗练 · 精简卡牌</div>
                <div className="text-xs text-slate-400">从你的套牌中永久移除一张不需要的基础卡牌。</div>
              </div>
            </div>

            <button
              disabled={playerGold < PURGE_COST}
              onClick={() => {
                sounds.playClick();
                setIsPurging(true);
              }}
              className={`
                px-5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer
                ${playerGold >= PURGE_COST 
                  ? 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500' 
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}
              `}
            >
              <Coins className="w-3.5 h-3.5" /> {PURGE_COST} 移除卡牌
            </button>
          </div>
        </div>

        {/* 移除卡牌专用弹层 */}
        {isPurging && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-60 flex flex-col items-center justify-center p-6">
            <div className="max-w-4xl w-full bg-slate-900 border border-red-500/60 rounded-2xl p-6 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-lg font-bold text-rose-400">请选择要从套牌中永久移除的一张卡牌</h3>
                <button
                  onClick={() => setIsPurging(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold"
                >
                  取消
                </button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-4 p-2">
                {playerDeck.map((card, idx) => (
                  <div
                    key={`${card.id}_${idx}`}
                    onClick={() => {
                      sounds.playAttack();
                      onRemoveCard(idx, PURGE_COST);
                      setIsPurging(false);
                    }}
                    className="cursor-pointer hover:scale-105 transition-transform"
                  >
                    <CardComponent card={card} />
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
