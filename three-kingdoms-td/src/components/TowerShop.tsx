import React, { useState } from 'react';
import { HEROES } from '../config/heroes';
import { HeroConfig } from '../types/game';
import { Coins, ShieldAlert, Sparkles, UserPlus, Info } from 'lucide-react';
import { HeroDetailModal } from './HeroDetailModal';

interface TowerShopProps {
  gold: number;
  placingHeroId: string | null;
  deployedHeroIds?: string[];
  onSelectHeroToPlace: (heroId: string | null) => void;
}

export const TowerShop: React.FC<TowerShopProps> = ({
  gold,
  placingHeroId,
  deployedHeroIds = [],
  onSelectHeroToPlace,
}) => {
  // 当前正在查看全量属性详情的武将
  const [inspectingHero, setInspectingHero] = useState<HeroConfig | null>(null);

  return (
    <div className="w-full md:w-72 bg-stone-900/95 border-t md:border-t-0 md:border-l border-amber-900/40 flex flex-col shadow-2xl z-20 shrink-0 max-h-[35vh] md:max-h-full">
      {/* 头部标题 */}
      <div className="p-2 sm:p-3 border-b border-amber-900/30 flex items-center justify-between bg-stone-950/60 shrink-0">
        <div className="flex items-center gap-2">
          <UserPlus size={15} className="text-amber-400" />
          <span className="text-xs font-bold tracking-wider text-amber-200">主公点将台</span>
        </div>
        <span className="text-[10px] text-stone-400">点击招募 / 属性</span>
      </div>

      {/* 武将列表：小屏幕下支持横向滑动，大屏纵向排列 */}
      <div className="flex-1 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto p-2 space-x-2 md:space-x-0 md:space-y-2 flex flex-row md:flex-col no-scrollbar">
        {HEROES.map((hero: HeroConfig) => {
          const isDeployed = deployedHeroIds.includes(hero.id);
          const isAffordable = gold >= hero.cost;
          const isSelected = placingHeroId === hero.id;

          const campText =
            hero.camp === 'shu'
              ? '蜀国'
              : hero.camp === 'wei'
              ? '魏国'
              : hero.camp === 'wu'
              ? '吴国'
              : '群雄';

          const roleText =
            hero.role === 'warrior'
              ? '猛将·近战'
              : hero.role === 'archer'
              ? '神射·狙击'
              : hero.role === 'support'
              ? '辅助·仁德'
              : '军师·奇策';

          return (
            <div
              key={hero.id}
              onClick={() => {
                if (isDeployed) {
                  // 已在阵中，点击直接弹出属性详情面板
                  setInspectingHero(hero);
                  return;
                }
                if (isSelected) {
                  onSelectHeroToPlace(null);
                } else if (isAffordable) {
                  onSelectHeroToPlace(hero.id);
                } else {
                  // 铜钱不够时，点击也方便直接查看详情
                  setInspectingHero(hero);
                }
              }}
              className={`p-2 sm:p-2.5 rounded-lg border transition cursor-pointer relative group btn-press w-[180px] sm:w-[210px] md:w-full shrink-0 ${
                isDeployed
                  ? 'bg-stone-950/70 border-stone-800/80 opacity-60 hover:opacity-90'
                  : isSelected
                  ? 'bg-amber-950/80 border-amber-400 shadow-lg shadow-amber-500/20'
                  : isAffordable
                  ? 'bg-stone-850 hover:bg-stone-800 border-stone-700/80'
                  : 'bg-stone-900/40 border-stone-800/60 opacity-60 hover:opacity-85'
              }`}
            >
              <div className="flex items-start gap-2">
                {/* 武将头像/将令牌（点击头像可独立呼出详细面板） */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectingHero(hero);
                  }}
                  title="点击查看武将属性图鉴"
                  className="w-11 h-11 rounded-lg border overflow-hidden flex items-center justify-center font-bold text-lg shadow-md shrink-0 relative bg-stone-900 hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: hero.color,
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                    color: '#ffffff',
                  }}
                >
                  <span className="select-none">{hero.avatarChar}</span>
                  {hero.avatarUrl && (
                    <img
                      src={hero.avatarUrl}
                      alt={hero.name}
                      className="w-full h-full object-cover absolute inset-0 z-10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* 武将简略信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-100 flex items-center gap-1">
                      {hero.name}
                      <span className="text-[10px] px-1 py-0.2 rounded bg-stone-950/80 text-stone-300 font-normal border border-stone-700">
                        {campText}
                      </span>
                    </span>

                    {/* 招募价格与查看属性详情图标 */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <Coins size={12} className="text-amber-400" />
                        <span
                          className={`text-xs font-extrabold ${
                            isAffordable ? 'text-amber-300' : 'text-stone-500'
                          }`}
                        >
                          {hero.cost}
                        </span>
                      </div>

                      {/* 专属查看详情按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingHero(hero);
                        }}
                        title="查看详细属性与技能定位"
                        className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-700/80 transition"
                      >
                        <Info size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-amber-500/90 font-medium mt-0.5">
                    {hero.title} · {roleText}
                  </div>

                  <div className="text-[11px] text-stone-400 line-clamp-1 mt-1">
                    {hero.description}
                  </div>
                </div>
              </div>

              {/* 战法技能标签 */}
              <div className="mt-2 pt-1.5 border-t border-stone-800 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1 text-amber-400/90">
                  <Sparkles size={11} />
                  <span>战法:【{hero.skillName}】</span>
                </div>
                <span className="text-stone-500">CD: {hero.skillCooldown}s</span>
              </div>

              {/* 选中与部署状态提示 */}
              {isDeployed ? (
                <div className="absolute top-1 right-8 flex items-center gap-0.5 text-[9px] bg-stone-800 text-stone-400 font-semibold px-1.5 py-0.5 rounded border border-stone-700 shadow">
                  <span>已在阵中</span>
                </div>
              ) : isSelected ? (
                <div className="absolute top-1 right-8 flex items-center gap-0.5 text-[9px] bg-amber-500 text-stone-950 font-bold px-1.5 py-0.5 rounded shadow">
                  <span>部署中...</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 武将全量属性详情浮层 */}
      {inspectingHero && (
        <HeroDetailModal
          hero={inspectingHero}
          gold={gold}
          isDeployed={deployedHeroIds.includes(inspectingHero.id)}
          onClose={() => setInspectingHero(null)}
          onDeploy={(heroId) => {
            onSelectHeroToPlace(heroId);
          }}
        />
      )}

      {/* 底部部署取消指示 */}
      {placingHeroId && (
        <div className="p-3 bg-amber-950/80 border-t border-amber-600/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-amber-300">
            <ShieldAlert size={14} className="animate-bounce" />
            <span>点击战场任意空地即可安营扎寨</span>
          </div>
          <button
            onClick={() => onSelectHeroToPlace(null)}
            className="text-xs px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-600 transition"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
};
