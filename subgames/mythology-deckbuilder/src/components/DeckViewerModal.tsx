import React from 'react';
import type { Card } from '../types/card';
import { CardComponent } from './CardComponent';
import { X, Layers } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface DeckViewerModalProps {
  deck: Card[];
  onClose: () => void;
}

export const DeckViewerModal: React.FC<DeckViewerModalProps> = ({ deck, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 safe-area-container select-none">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-3xl p-3 sm:p-6 flex flex-col max-h-[90dvh] shadow-2xl">
        
        {/* 顶部标题 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <h2 className="text-sm sm:text-lg font-bold text-slate-100">
              当前神明套牌 ({deck.length} 张)
            </h2>
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

        {/* 卡牌列表 */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 no-scrollbar justify-items-center">
          {deck.map((card, i) => (
            <div key={`${card.id}_${i}`} className="flex justify-center">
              <CardComponent card={card} compact={true} disabled />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
