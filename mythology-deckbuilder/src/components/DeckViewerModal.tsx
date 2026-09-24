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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 flex flex-col max-h-[85vh] shadow-2xl">
        
        {/* 顶部标题 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-slate-100">
              当前神明套牌 ({deck.length} 张)
            </h2>
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

        {/* 卡牌列表 */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
          {deck.map((card, i) => (
            <div key={`${card.id}_${i}`} className="scale-95 origin-top">
              <CardComponent card={card} disabled />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
