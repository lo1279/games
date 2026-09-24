import React from 'react';
import type { MythEvent, EventChoice } from '../data/events';
import { Sparkles, Scroll } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface EventModalProps {
  event: MythEvent;
  onChoose: (choice: EventChoice) => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, onChoose }) => {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 safe-area-container select-none">
      <div className="max-w-lg w-full bg-slate-900 border-2 border-cyan-500/70 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col shadow-2xl max-h-[92dvh] overflow-y-auto no-scrollbar">
        
        {/* 顶部奇遇头衔 */}
        <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{event.mythology} 秘辛奇遇</span>
        </div>

        <h2 className="text-lg sm:text-2xl font-black text-slate-100 mb-3">{event.title}</h2>

        {/* 故事叙述卡 */}
        <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 italic flex items-start gap-2.5">
          <Scroll className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
          <div>"{event.story}"</div>
        </div>

        {/* 抉择列表 */}
        <div className="flex flex-col gap-2 sm:gap-3">
          {event.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => {
                sounds.playVictory();
                onChoose(choice);
              }}
              className="p-3 sm:p-4 rounded-xl bg-slate-950 border border-slate-700 hover:border-cyan-400 hover:bg-cyan-950/30 text-left transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                {idx + 1}. {choice.text}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                ➔ 结果: {choice.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
