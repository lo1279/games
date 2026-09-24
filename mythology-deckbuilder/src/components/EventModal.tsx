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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900 border-2 border-cyan-500/70 rounded-3xl p-6 sm:p-8 flex flex-col shadow-[0_0_40px_rgba(6,182,212,0.25)]">
        
        {/* 顶部奇遇头衔 */}
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>{event.mythology} 秘辛奇遇</span>
        </div>

        <h2 className="text-2xl font-black text-slate-100 mb-4">{event.title}</h2>

        {/* 故事叙述卡 */}
        <div className="bg-slate-950/80 rounded-2xl p-5 border border-slate-800 text-sm text-slate-300 leading-relaxed mb-6 italic flex items-start gap-3">
          <Scroll className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
          <div>"{event.story}"</div>
        </div>

        {/* 抉择列表 */}
        <div className="flex flex-col gap-3">
          {event.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => {
                sounds.playVictory();
                onChoose(choice);
              }}
              className="p-4 rounded-xl bg-slate-950 border border-slate-700 hover:border-cyan-400 hover:bg-cyan-950/30 text-left transition-all group cursor-pointer"
            >
              <div className="text-sm font-bold text-slate-200 group-hover:text-cyan-300">
                {idx + 1}. {choice.text}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                ➔ 结果: {choice.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
