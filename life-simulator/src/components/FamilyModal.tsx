import React, { useState } from 'react';
import type { FamilyState, Partner, Talent } from '../types/game';
import {
  CANDIDATE_PARTNERS,
  interactWithPartner,
  proposeToPartner,
  giveBirthToChild,
} from '../engine/familyEngine';
import { Heart, Users, X, Gift, Crown, Baby } from 'lucide-react';

interface FamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  family: FamilyState;
  cash: number;
  availableTalents: Talent[];
  onUpdateFamily: (newFamily: FamilyState, cashChange: number) => void;
}

export const FamilyModal: React.FC<FamilyModalProps> = ({
  isOpen,
  onClose,
  family,
  cash,
  availableTalents,
  onUpdateFamily,
}) => {
  const [activeTab, setActiveTab] = useState<'partner' | 'children'>('partner');
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [newChildName, setNewChildName] = useState('');

  if (!isOpen) return null;

  const showToast = (text: string, isError: boolean = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 2500);
  };

  // 确立恋爱对象
  const handleSelectPartner = (candidate: (typeof CANDIDATE_PARTNERS)[0]) => {
    const newPartner: Partner = {
      ...candidate,
      favorability: 30,
      isMarried: false,
    };
    onUpdateFamily(
      {
        ...family,
        partner: newPartner,
      },
      0
    );
    showToast(`邂逅了【${candidate.name}】！心头泛起阵阵涟漪。`);
  };

  // 约会提升好感
  const handleDate = () => {
    const res = interactWithPartner(family, cash);
    if (res.success) {
      onUpdateFamily(res.newFamily, -res.cashSpent);
      showToast('浪漫约会圆满结束！伴侣对你的好感度显著提升。');
    } else {
      showToast(res.error || '约会失败', true);
    }
  };

  // 求婚结婚
  const handlePropose = () => {
    const res = proposeToPartner(family, cash);
    if (res.success) {
      onUpdateFamily(res.newFamily, -res.cashSpent);
      showToast('🎉 求婚成功！盛大婚礼全城瞩目，家族声望提升！');
    } else {
      showToast(res.error || '求婚受挫', true);
    }
  };

  // 诞下子嗣
  const handleGiveBirth = () => {
    const inherited = availableTalents[0] || undefined;
    const res = giveBirthToChild(family, newChildName, inherited);
    if (res.success) {
      onUpdateFamily(res.newFamily, 0);
      setNewChildName('');
      showToast('👶 喜得贵子/千金！家族迎来了生机勃勃的新生命！');
    } else {
      showToast(res.error || '诞生失败', true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[88dvh] flex flex-col bg-slate-900 border-t sm:border border-pink-500/30 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-pink-500/10 overflow-hidden animate-drawer-up sm:animate-scale-up">
        {/* 移动端顶部把手条 */}
        <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto sm:hidden mt-2.5 -mb-1 shrink-0" />

        {/* 顶部标题与家族声望 */}
        <div className="shrink-0 p-3.5 sm:p-4 border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-pink-500/25 text-sm sm:text-base shrink-0">
              ❤️
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-black text-white tracking-tight">情缘与家族谱系</h2>
                <span className="text-[10px] font-bold text-pink-300 bg-pink-500/15 border border-pink-500/30 px-1.5 py-0.5 rounded-full shrink-0">
                  第 {family.generation} 代世家
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-pink-300 mt-0.5">
                <span>家族声望：{family.familyPrestige}</span>
                <span>· 可支配现金：{cash.toFixed(1)}万</span>
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
            onClick={() => setActiveTab('partner')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'partner'
                ? 'border-pink-400 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>良缘伴侣</span>
          </button>
          <button
            onClick={() => setActiveTab('children')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'children'
                ? 'border-pink-400 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>子嗣培育 ({family.children.length}/3)</span>
          </button>
        </div>

        {/* 提示条 */}
        {toastMsg && (
          <div
            className={`shrink-0 border-b px-4 py-1.5 text-xs text-center font-medium animate-pulse ${
              toastMsg.isError
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
          >
            {toastMsg.text}
          </div>
        )}

        {/* 列表滚动内容 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain">
          {activeTab === 'partner' && (
            <>
              {family.partner ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-950/20 via-slate-800/90 to-slate-800 border border-pink-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">{family.partner.avatar}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-white">{family.partner.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40">
                            {family.partner.isMarried ? '已结发为夫妻 💍' : '恋爱相处中 💌'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">{family.partner.identity}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-pink-300 font-bold">好感度</span>
                      <p className="text-lg font-black text-pink-400">{family.partner.favorability}/100</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60 leading-relaxed">
                    ✨ <span className="font-semibold text-pink-300">家庭增益：</span>
                    {family.partner.annualBonusDesc}
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleDate}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-pink-200 border border-pink-500/30 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5 text-pink-400" />
                      <span>浪漫约会 (2万)</span>
                    </button>

                    {!family.partner.isMarried && (
                      <button
                        onClick={handlePropose}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-xs font-bold text-white flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shadow-md shadow-pink-500/20"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>求婚结发 (10万)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 px-1">
                    红尘漫漫，你在青春岁月与商海浮沉中邂逅了各具魅力的意中人：
                  </p>

                  {CANDIDATE_PARTNERS.map((cand) => (
                    <div
                      key={cand.id}
                      className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2 hover:border-pink-500/40 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{cand.avatar}</span>
                          <div>
                            <span className="font-bold text-sm text-white">{cand.name}</span>
                            <p className="text-xs text-slate-400">{cand.identity}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectPartner(cand)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-sm"
                        >
                          倾心结识
                        </button>
                      </div>

                      <p className="text-[11px] text-pink-300/90 bg-slate-900/60 p-2 rounded-xl leading-relaxed">
                        {cand.annualBonusDesc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'children' && (
            <div className="space-y-3">
              {family.children.length > 0 ? (
                <div className="space-y-2.5">
                  {family.children.map((child) => (
                    <div
                      key={child.id}
                      className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{child.name}</span>
                          <span className="text-xs text-indigo-400 font-semibold">({child.gender})</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {child.age} 岁
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          成长资质：<span className="text-amber-300 font-bold">{child.potential}</span> 点 · 遗传天赋：
                          <span className="text-indigo-300">
                            {child.talentInherited ? child.talentInherited.name : '家族厚德'}
                          </span>
                        </p>
                      </div>

                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                        传承候选人
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  暂无子女。结为连理后方可诞下子嗣并开启世代继承。
                </div>
              )}

              {/* 孕育新生命操作区 */}
              {family.partner?.isMarried && family.children.length < 3 && (
                <div className="p-3.5 rounded-2xl bg-slate-850 border border-pink-500/30 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pink-300">
                    <Baby className="w-4 h-4" />
                    <span>孕育下一代新生命</span>
                  </div>

                  <input
                    type="text"
                    placeholder="为子女取名（留空则系统取雅名）"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                  />

                  <button
                    onClick={handleGiveBirth}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    喜得贵子/千金 👶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 (适配手机底部横条安全区) */}
        <div className="shrink-0 px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            终局时可将家族部分家资与天赋传承给二代子嗣
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
