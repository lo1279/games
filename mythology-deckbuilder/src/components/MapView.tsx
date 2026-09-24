import React from 'react';
import type { MapNode, NodeType } from '../types/relic';
import { Swords, Skull, Flame, ShoppingBag, Sparkles, Crown } from 'lucide-react';
import { sounds } from '../audio/soundSynth';

interface MapViewProps {
  floors: MapNode[][];
  currentFloor: number;
  onSelectNode: (node: MapNode) => void;
  playerDeckCount: number;
  playerHp: number;
  playerMaxHp: number;
  playerGold: number;
  heroAvatar: string;
  heroName: string;
  onOpenDeckView: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  floors,
  currentFloor,
  onSelectNode,
  playerDeckCount,
  playerHp,
  playerMaxHp,
  playerGold,
  heroAvatar,
  heroName,
  onOpenDeckView,
}) => {
  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'battle':
        return <Swords className="w-5 h-5 text-rose-400" />;
      case 'elite':
        return <Skull className="w-5 h-5 text-purple-400 animate-pulse" />;
      case 'rest':
        return <Flame className="w-5 h-5 text-amber-400" />;
      case 'shop':
        return <ShoppingBag className="w-5 h-5 text-yellow-400" />;
      case 'event':
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      case 'boss':
        return <Crown className="w-7 h-7 text-amber-300 animate-bounce" />;
    }
  };

  const getNodeTypeName = (type: NodeType) => {
    switch (type) {
      case 'battle':
        return '遭遇战';
      case 'elite':
        return '精英领主';
      case 'rest':
        return '神圣休憩';
      case 'shop':
        return '诸神黑市';
      case 'event':
        return '神话奇遇';
      case 'boss':
        return '灭世神王 BOSS';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-4xl mx-auto select-none">
      
      {/* 顶部探险者状态 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
            {heroAvatar}
          </div>
          <div>
            <h2 className="text-base font-extrabold text-amber-300">{heroName}</h2>
            <div className="text-xs text-rose-400 font-semibold mt-0.5">
              生命: {playerHp} / {playerMaxHp}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-amber-400 font-bold bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            💰 {playerGold} 神晶
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onOpenDeckView();
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer font-bold"
          >
            📜 查看套牌 ({playerDeckCount})
          </button>
        </div>
      </div>

      {/* 爬塔节点树路线图 */}
      <div className="my-6 flex-1 flex flex-col justify-center items-center gap-6 relative">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">
          —— 诸神长廊 · 裂隙前线 (当前层数: 第 {currentFloor + 1} 层) ——
        </div>

        {/* 倒序或正序显示楼层（从最上层 Boss 到当前层） */}
        <div className="flex flex-col-reverse gap-8 w-full max-w-xl">
          {floors.map((floorNodes, floorIdx) => {
            const isCurrentFloor = floorIdx === currentFloor;
            const isPassedFloor = floorIdx < currentFloor;

            return (
              <div key={floorIdx} className="flex flex-col items-center relative">
                
                {/* 楼层标识 */}
                <div className="text-[10px] text-slate-500 uppercase font-semibold mb-2">
                  Layer {floorIdx + 1}
                </div>

                {/* 节点行 */}
                <div className="flex items-center justify-center gap-6 w-full">
                  {floorNodes.map((node) => {
                    const isClickable = isCurrentFloor;
                    return (
                      <div
                        key={node.id}
                        onClick={() => {
                          if (isClickable) {
                            sounds.playClick();
                            onSelectNode(node);
                          }
                        }}
                        className={`
                          relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300
                          ${isPassedFloor 
                            ? 'bg-slate-900/40 border-slate-800 opacity-40 grayscale' 
                            : isClickable 
                              ? 'bg-slate-900 border-amber-400 hover:scale-110 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.4)]' 
                              : 'bg-slate-950 border-slate-800 opacity-60 cursor-not-allowed'}
                        `}
                      >
                        <div className="p-2 bg-slate-950 rounded-xl mb-1 shadow-inner">
                          {getNodeIcon(node.type)}
                        </div>
                        <div className="text-[11px] font-bold text-slate-200">
                          {node.name}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {getNodeTypeName(node.type)}
                        </div>

                        {/* 当前指示小角标 */}
                        {isClickable && (
                          <div className="absolute -top-2 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shadow animate-pulse">
                            可选
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="text-center text-xs text-slate-500 italic pb-2">
        点击当层高亮节点即可进入相应神话挑战或事件。
      </div>
    </div>
  );
};
