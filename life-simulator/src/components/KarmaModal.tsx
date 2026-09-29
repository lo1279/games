import React, { useState } from 'react';
import type { KarmaState, KarmaUpgrades } from '../types/game';
import {
  UPGRADE_CONFIG,
  DIVINE_TALENTS_CONFIG,
  upgradeKarmaSkill,
  unlockDivineTalent,
} from '../engine/karmaEngine';
import { Sparkles, Flame, ShieldCheck, Check, X } from 'lucide-react';

interface KarmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  karmaState: KarmaState;
  onUpdateKarma: (newState: KarmaState) => void;
}

export const KarmaModal: React.FC<KarmaModalProps> = ({
  isOpen,
  onClose,
  karmaState,
  onUpdateKarma,
}) => {
  const [activeTab, setActiveTab] = useState<'skills' | 'divine'>('skills');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleUpgrade = (skillKey: keyof Omit<KarmaUpgrades, 'unlockedDivineTalents'>) => {
    const res = upgradeKarmaSkill(karmaState, skillKey);
    if (res.success) {
      onUpdateKarma(res.newState);
      showToast('突破成功！下一世获得全新天道赐福！');
    } else {
      showToast(res.error || '升级失败');
    }
  };

  const handleUnlockDivine = (talentId: string) => {
    const res = unlockDivineTalent(karmaState, talentId);
    if (res.success) {
      onUpdateKarma(res.newState);
      showToast('天命解锁！该神级天赋已注入轮回池！');
    } else {
      showToast(res.error || '解锁失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden">
        {/* 顶部标题与功德币展示 */}
        <div className="shrink-0 p-4 border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25">
              <Flame className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">轮回神殿</h2>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                  第 {karmaState.reincarnationCount} 世宿慧
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>功德余额：{karmaState.karmaCoins}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 选项卡切换 */}
        <div className="shrink-0 flex border-b border-slate-800 px-4 pt-2 gap-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('skills')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'skills'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            宿命特权升级
          </button>
          <button
            onClick={() => setActiveTab('divine')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'divine'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            神级天命秘录
          </button>
        </div>

        {/* 提示条 */}
        {toastMsg && (
          <div className="shrink-0 bg-amber-500/20 text-amber-300 border-b border-amber-500/30 px-4 py-1.5 text-xs text-center font-medium animate-pulse">
            {toastMsg}
          </div>
        )}

        {/* 列表滚动内容 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain">
          {activeTab === 'skills' && (
            <>
              {(Object.keys(UPGRADE_CONFIG) as (keyof typeof UPGRADE_CONFIG)[]).map((key) => {
                const cfg = UPGRADE_CONFIG[key];
                const currentLvl = karmaState.upgrades[key] || 0;
                const isMax = currentLvl >= cfg.maxLevel;
                const cost = isMax ? 0 : cfg.costs[currentLvl];
                const canAfford = karmaState.karmaCoins >= cost;

                return (
                  <div
                    key={key}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{cfg.title}</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/20">
                            Lv.{currentLvl}/{cfg.maxLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{cfg.desc}</p>
                      </div>

                      <button
                        disabled={isMax || !canAfford}
                        onClick={() => handleUpgrade(key)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                          isMax
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : canAfford
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400'
                            : 'bg-slate-700/60 text-slate-400 border border-slate-600/60 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? '已至圆满' : `${cost} 功德 升级`}
                      </button>
                    </div>

                    <div className="text-[11px] text-amber-300/90 font-medium bg-slate-900/60 p-2 rounded-xl flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{cfg.getEffectDesc(currentLvl)}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'divine' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 px-1">
                消耗功德可永久解封神级天命，解封后将永久注入每一次人生的天赋摇号池：
              </p>

              {DIVINE_TALENTS_CONFIG.map((talent) => {
                const isUnlocked = karmaState.upgrades.unlockedDivineTalents.includes(talent.id);
                const canAfford = karmaState.karmaCoins >= talent.cost;

                return (
                  <div
                    key={talent.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-amber-950/20 to-slate-900 border-amber-500/40 shadow-sm'
                        : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            传说天命
                          </span>
                          <span className="font-extrabold text-sm text-amber-200">{talent.name}</span>
                          {isUnlocked && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <Check className="w-3 h-3" />
                              已解封
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{talent.desc}</p>
                      </div>

                      {!isUnlocked && (
                        <button
                          disabled={!canAfford}
                          onClick={() => handleUnlockDivine(talent.id)}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 hover:from-amber-400 hover:to-orange-400'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          {talent.cost} 功德 解封
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            功德永久绑定，即使重开转生也不会丢失
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
};
