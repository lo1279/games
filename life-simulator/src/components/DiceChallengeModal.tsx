import React, { useState } from 'react';
import type { DiceChallenge, DiceResult, GameState } from '../types/game';
import { rollD20Check } from '../engine/adventureEngine';
import { Dices, Sparkles, AlertCircle, Award, CheckCircle2, XCircle } from 'lucide-react';

interface DiceChallengeModalProps {
  challenge: DiceChallenge;
  state: GameState;
  onResolve: (result: DiceResult) => void;
}

export const DiceChallengeModal: React.FC<DiceChallengeModalProps> = ({
  challenge,
  state,
  onResolve,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<DiceResult | null>(null);

  const attrVal = (state.attrs[challenge.checkAttr] as number) || 0;
  const attrBonus = Math.floor(attrVal * challenge.attrScale);

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);

    // 摇号动效模拟 (800ms)
    setTimeout(() => {
      const res = rollD20Check(challenge, state.attrs);
      setRollResult(res);
      setIsRolling(false);
    }, 800);
  };

  const handleFinish = () => {
    if (!rollResult) return;
    onResolve(rollResult);
  };

  const getAttrChinese = (key: string) => {
    const map: Record<string, string> = {
      charm: '颜值魅力',
      intelligence: '智商才智',
      strength: '体质健康',
      wealth: '家境财富',
      happiness: '快乐心态',
      luck: '气运鸿运',
      spiritualRoot: '天地灵根',
    };
    return map[key] || key;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in overscroll-contain">
      <div className="w-full max-w-md flex flex-col bg-slate-900 border border-indigo-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-indigo-500/15 space-y-4 overflow-hidden">
        {/* 顶部标题与分类 */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>【命运交错 · D20 奇遇检定】</span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">{challenge.title}</h2>
          <p className="text-xs text-slate-300 leading-relaxed px-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            {challenge.description}
          </p>
        </div>

        {/* 挑战目标与属性补正计算卡片 */}
        <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400">通关难度阈值 (DC)</span>
            <p className="text-lg font-black text-amber-400">≥ {challenge.targetDC} 点</p>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-slate-400">依赖补正属性</span>
            <p className="text-xs font-bold text-cyan-300">
              {getAttrChinese(challenge.checkAttr)} (+{attrBonus})
            </p>
          </div>
        </div>

        {/* 核心投掷区域 */}
        <div className="py-4 flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-24 h-24 rounded-3xl flex flex-col items-center justify-center border-2 shadow-2xl transition-all duration-300 ${
              isRolling
                ? 'animate-spin border-amber-400 bg-amber-500/20 shadow-amber-500/30'
                : rollResult
                ? rollResult.isCriticalSuccess
                  ? 'border-amber-400 bg-gradient-to-tr from-amber-500/30 to-orange-500/30 text-amber-300 shadow-amber-500/40 scale-105'
                  : rollResult.isSuccess
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-emerald-500/30'
                  : 'border-rose-400 bg-rose-500/20 text-rose-300 shadow-rose-500/30'
                : 'border-indigo-500/40 bg-slate-800/80 text-indigo-300'
            }`}
          >
            {isRolling ? (
              <Dices className="w-10 h-10 animate-bounce text-amber-300" />
            ) : rollResult ? (
              <>
                <span className="text-3xl font-black">{rollResult.rawRoll}</span>
                <span className="text-[10px] text-slate-400">
                  +{rollResult.attrBonus} = {rollResult.totalScore}
                </span>
              </>
            ) : (
              <Dices className="w-10 h-10" />
            )}
          </div>

          {/* 投掷结果文案 */}
          {rollResult && (
            <div className="text-center space-y-1 animate-fade-in">
              {rollResult.isCriticalSuccess ? (
                <div className="flex items-center justify-center gap-1 text-amber-300 font-extrabold text-sm">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>★ 掷出 20 点！天命大成功！</span>
                </div>
              ) : rollResult.isCriticalFumble ? (
                <div className="flex items-center justify-center gap-1 text-rose-400 font-bold text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>掷出 1 点！天道弄人大失败！</span>
                </div>
              ) : rollResult.isSuccess ? (
                <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>检定达成！判定成功！</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-rose-400 font-bold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>总分未达阈值，检定失败！</span>
                </div>
              )}

              <p className="text-xs text-slate-300 px-2 pt-1 leading-relaxed">
                {rollResult.isCriticalSuccess
                  ? challenge.criticalSuccessReward.logText
                  : rollResult.isSuccess
                  ? challenge.successReward.logText
                  : challenge.failurePenalty.logText}
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="pt-2">
          {!rollResult ? (
            <button
              disabled={isRolling}
              onClick={handleRoll}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Dices className="w-5 h-5" />
              <span>{isRolling ? '命运轮盘旋转中...' : '掷出 D20 逆天改命！'}</span>
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
            >
              接受命运抉择 ➔
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
