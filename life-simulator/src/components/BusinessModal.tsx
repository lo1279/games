import React, { useState } from 'react';
import type { PersonalAssets, InvestmentType } from '../types/game';
import {
  REAL_ESTATE_CATALOG,
  INDUSTRY_CATALOG,
  tradeInvestment,
  buyRealEstate,
  foundCompany,
} from '../engine/marketEngine';
import { TrendingUp, Home, Briefcase, X } from 'lucide-react';

interface BusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  age?: number;
  assets: PersonalAssets;
  onUpdateAssets: (newAssets: PersonalAssets) => void;
}

export const BusinessModal: React.FC<BusinessModalProps> = ({
  isOpen,
  onClose,
  assets,
  onUpdateAssets,
}) => {
  const [activeTab, setActiveTab] = useState<'invest' | 'realEstate' | 'company'>('invest');
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');

  if (!isOpen) return null;

  const showToast = (text: string, isError: boolean = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 2500);
  };

  // 投资买入/赎回操作
  const handleTrade = (type: InvestmentType, amount: number, isBuy: boolean) => {
    const res = tradeInvestment(assets, type, amount, isBuy);
    if (res.success) {
      onUpdateAssets(res.newAssets);
      showToast(isBuy ? `成功追加 ${amount} 万元持仓！` : `成功赎回 ${amount} 万元现金！`);
    } else {
      showToast(res.error || '交易失败', true);
    }
  };

  // 购置房产
  const handleBuyHouse = (estateId: string) => {
    const res = buyRealEstate(assets, estateId);
    if (res.success) {
      onUpdateAssets(res.newAssets);
      showToast('恭喜！房产过户完成，每年可收取固定租金分红！');
    } else {
      showToast(res.error || '购买失败', true);
    }
  };

  // 创办企业
  const handleFoundCompany = (industry: 'catering' | 'media' | 'tech') => {
    const res = foundCompany(assets, industry, newCompanyName.trim());
    if (res.success) {
      onUpdateAssets(res.newAssets);
      setNewCompanyName('');
      showToast('公司创办成功！正式开启商海大亨之旅！');
    } else {
      showToast(res.error || '创办失败', true);
    }
  };

  // 汇总个人总净资产
  const totalNetWorth =
    assets.cash +
    assets.investments.deposit +
    assets.investments.fund +
    assets.investments.crypto +
    Object.entries(assets.realEstates).reduce((sum, [id, count]) => {
      const e = REAL_ESTATE_CATALOG.find((x) => x.id === id);
      return sum + (e ? e.price * count : 0);
    }, 0);

  const getMarketBadge = (sentiment: 'bear' | 'normal' | 'bull') => {
    switch (sentiment) {
      case 'bull':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">行情：激进大牛市 🔥</span>;
      case 'bear':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">行情：低迷熊市 ❄️</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">行情：稳健震荡 ⚖️</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col bg-slate-900 border border-emerald-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
        {/* 顶部个人资产速览 */}
        <div className="shrink-0 p-4 border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-transparent flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">商海大亨 · 资产管理</h2>
              {getMarketBadge(assets.marketSentiment)}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-300">
                现金：<span className="text-emerald-400 font-extrabold text-sm">{assets.cash.toFixed(1)}</span> 万元
              </span>
              <span className="text-slate-400">
                净资产：<span className="text-amber-300 font-bold">{totalNetWorth.toFixed(1)}</span> 万元
              </span>
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
            onClick={() => setActiveTab('invest')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'invest'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>金融理财</span>
          </button>
          <button
            onClick={() => setActiveTab('realEstate')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'realEstate'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>房产置业</span>
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'company'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>创业公司</span>
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

        {/* 选项卡内容区域 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 overscroll-contain">
          {/* 金融理财 */}
          {activeTab === 'invest' && (
            <div className="space-y-3">
              {/* 银行定期 */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">银行大额保本定存</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                        低风险
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">年化收益约 3.5%，安全保本，绝不亏损。</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">当前持仓</span>
                    <p className="text-sm font-black text-emerald-400">
                      {(assets.investments.deposit || 0).toFixed(1)} 万元
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTrade('deposit', 10, true)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white transition-colors active:scale-95 cursor-pointer"
                  >
                    存入 +10万
                  </button>
                  <button
                    onClick={() => handleTrade('deposit', 10, false)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors active:scale-95 cursor-pointer"
                  >
                    赎回 -10万
                  </button>
                </div>
              </div>

              {/* 核心基金 */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">沪深/纳斯达克核心成长基金</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                        中风险
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">随宏观牛熊市波动（-15% ~ +40%），受智力加成。</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">当前持仓</span>
                    <p className="text-sm font-black text-blue-400">
                      {(assets.investments.fund || 0).toFixed(1)} 万元
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTrade('fund', 20, true)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white transition-colors active:scale-95 cursor-pointer"
                  >
                    买入 +20万
                  </button>
                  <button
                    onClick={() => handleTrade('fund', 20, false)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors active:scale-95 cursor-pointer"
                  >
                    卖出 -20万
                  </button>
                </div>
              </div>

              {/* 高风险数字资产 */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">硬核科技股权与加密风投</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                        高风险
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">暴利与爆仓共存（-60% ~ +200%），运气极度关键。</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">当前持仓</span>
                    <p className="text-sm font-black text-rose-400">
                      {(assets.investments.crypto || 0).toFixed(1)} 万元
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleTrade('crypto', 50, true)}
                    className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-bold text-white transition-colors active:scale-95 cursor-pointer shadow-md"
                  >
                    博一把 +50万
                  </button>
                  <button
                    onClick={() => handleTrade('crypto', 50, false)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors active:scale-95 cursor-pointer"
                  >
                    止盈/割肉 -50万
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 房产置业 */}
          {activeTab === 'realEstate' && (
            <div className="space-y-3">
              {REAL_ESTATE_CATALOG.map((estate) => {
                const count = assets.realEstates[estate.id] || 0;
                const canAfford = assets.cash >= estate.price;

                return (
                  <div
                    key={estate.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{estate.name}</span>
                        {count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            已拥有 {count} 套
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        售价：<span className="text-white font-bold">{estate.price}万</span> · 每年租金回报：
                        <span className="text-emerald-400 font-semibold">+{estate.annualRent}万/年</span>
                      </p>
                    </div>

                    <button
                      disabled={!canAfford}
                      onClick={() => handleBuyHouse(estate.id)}
                      className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                        canAfford
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      购置
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 创业公司 */}
          {activeTab === 'company' && (
            <div className="space-y-3">
              {/* 名下已有公司 */}
              {assets.companies.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400">我旗下的产业</h3>
                  {assets.companies.map((comp) => (
                    <div
                      key={comp.id}
                      className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-amber-200">{comp.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                            {comp.stage === 'listed' ? '已上市敲钟 🔔' : '创业推进中'}
                          </span>
                        </div>
                        <span className="text-xs text-emerald-400 font-bold">
                          年利润分红：+{comp.annualRevenue}万
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex justify-between">
                        <span>所属行业：{comp.industryName}</span>
                        <span>企业估值：{comp.valuation} 万元</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 创办新公司 */}
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-700/80 space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-300">创办新企业</span>
                  <input
                    type="text"
                    placeholder="输入公司/品牌名称（选填）"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  {INDUSTRY_CATALOG.map((ind) => {
                    const canAfford = assets.cash >= ind.cost;

                    return (
                      <div
                        key={ind.industry}
                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-750 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{ind.industryName}</span>
                            <span className="text-[10px] text-amber-400 font-semibold">
                              需启动金：{ind.cost}万
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ind.desc}</p>
                        </div>

                        <button
                          disabled={!canAfford}
                          onClick={() => handleFoundCompany(ind.industry)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:from-emerald-500 hover:to-cyan-500'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          }`}
                        >
                          创办
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            每年岁末随年轮推进自动结算投资盈亏与租金利润
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
