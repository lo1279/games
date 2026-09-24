import React from 'react';
import { Wind, Flame, Swords, ShieldAlert } from 'lucide-react';
import { MasterSkillsCooldown } from '../core/GameEngine';

interface BottomControlsProps {
  gold: number;
  waveInProgress: boolean;
  currentWave: number;
  totalWaves: number;
  skillsCooldown?: MasterSkillsCooldown;
  prepCountdown?: number;
  onStartWave: () => void;
  onCastFreeze: () => void;
  onCastFireBomb: () => void;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  gold,
  waveInProgress,
  currentWave,
  totalWaves,
  skillsCooldown = { freezeCd: 0, maxFreezeCd: 20, fireCd: 0, maxFireCd: 30 },
  prepCountdown = 0,
  onStartWave,
  onCastFreeze,
  onCastFireBomb,
}) => {
  const freezeCdLeft = Math.ceil(skillsCooldown.freezeCd);
  const fireCdLeft = Math.ceil(skillsCooldown.fireCd);

  const isFreezeInCd = skillsCooldown.freezeCd > 0;
  const isFireInCd = skillsCooldown.fireCd > 0;

  const canAffordFreeze = gold >= 100;
  const canAffordFire = gold >= 150;

  const canCastFreeze = canAffordFreeze && !isFreezeInCd;
  const canCastFire = canAffordFire && !isFireInCd;

  const allWavesCompleted = currentWave >= totalWaves && !waveInProgress;
  const isPrepping = !waveInProgress && prepCountdown > 0 && currentWave < totalWaves;
  const prepSecondsLeft = Math.ceil(prepCountdown);

  // 冷却遮罩比例
  const freezeCdPercent = isFreezeInCd ? (skillsCooldown.freezeCd / skillsCooldown.maxFreezeCd) * 100 : 0;
  const fireCdPercent = isFireInCd ? (skillsCooldown.fireCd / skillsCooldown.maxFireCd) * 100 : 0;

  return (
    <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 flex flex-wrap items-center justify-end gap-1.5 sm:gap-3 z-20 pointer-events-auto">
      {/* 主公锦囊妙计快捷栏 */}
      <div className="bg-stone-900/95 border border-amber-900/60 rounded-xl p-1 sm:p-1.5 flex items-center gap-1 sm:gap-2 backdrop-blur-md shadow-xl">
        <div className="hidden sm:flex text-[11px] font-bold text-amber-400/80 px-1.5 sm:px-2 items-center gap-1 border-r border-stone-800">
          <span>锦囊</span>
        </div>

        {/* 借东风 */}
        <button
          onClick={onCastFreeze}
          disabled={!canCastFreeze}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition btn-press border relative overflow-hidden ${
            isFreezeInCd
              ? 'bg-stone-900/90 text-sky-400/60 border-sky-950/60 cursor-not-allowed'
              : canAffordFreeze
              ? 'bg-sky-950/80 hover:bg-sky-900 text-sky-200 border-sky-600/50 shadow-md shadow-sky-900/40'
              : 'bg-stone-850 text-stone-500 border-stone-800 cursor-not-allowed'
          }`}
          title={
            isFreezeInCd
              ? `冷却中 (还剩 ${freezeCdLeft} 秒 / 总CD: ${skillsCooldown.maxFreezeCd}s)`
              : `消耗100军饷：冰封定身全场所有敌军 3.5 秒 (冷却: ${skillsCooldown.maxFreezeCd}s)`
          }
        >
          {/* CD 进度半透明黑色遮罩 */}
          {isFreezeInCd && (
            <div
              className="absolute inset-y-0 right-0 bg-stone-950/70 border-l border-sky-500/30 transition-all pointer-events-none"
              style={{ width: `${freezeCdPercent}%` }}
            />
          )}

          <Wind size={15} className={isFreezeInCd ? 'text-sky-500/50' : 'text-sky-400'} />
          <div className="flex flex-col items-start leading-none relative z-10">
            <span>
              {isFreezeInCd ? `东风 (${freezeCdLeft}s)` : '借东风 (100)'}
            </span>
            <span className="text-[9px] text-sky-400/70 font-normal mt-0.5">
              {isFreezeInCd ? `CD倒计时` : `CD: ${skillsCooldown.maxFreezeCd}s`}
            </span>
          </div>
        </button>

        {/* 火烧连营 */}
        <button
          onClick={onCastFireBomb}
          disabled={!canCastFire}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition btn-press border relative overflow-hidden ${
            isFireInCd
              ? 'bg-stone-900/90 text-red-400/60 border-red-950/60 cursor-not-allowed'
              : canAffordFire
              ? 'bg-red-950/80 hover:bg-red-900 text-red-200 border-red-600/50 shadow-md shadow-red-900/40'
              : 'bg-stone-850 text-stone-500 border-stone-800 cursor-not-allowed'
          }`}
          title={
            isFireInCd
              ? `冷却中 (还剩 ${fireCdLeft} 秒 / 总CD: ${skillsCooldown.maxFireCd}s)`
              : `消耗150军饷：对全场所有敌人降下烈焰轰炸并附带持续灼烧 (冷却: ${skillsCooldown.maxFireCd}s)`
          }
        >
          {/* CD 进度半透明黑色遮罩 */}
          {isFireInCd && (
            <div
              className="absolute inset-y-0 right-0 bg-stone-950/70 border-l border-red-500/30 transition-all pointer-events-none"
              style={{ width: `${fireCdPercent}%` }}
            />
          )}

          <Flame size={15} className={isFireInCd ? 'text-red-500/50' : 'text-red-400'} />
          <div className="flex flex-col items-start leading-none relative z-10">
            <span>
              {isFireInCd ? `火攻 (${fireCdLeft}s)` : '火烧连营 (150)'}
            </span>
            <span className="text-[9px] text-red-400/70 font-normal mt-0.5">
              {isFireInCd ? `CD倒计时` : `CD: ${skillsCooldown.maxFireCd}s`}
            </span>
          </div>
        </button>
      </div>

      {/* 擂鼓发兵 / 迎敌主按钮（支持 10s 备战自动进入与随时手动提前开战） */}
      <button
        onClick={onStartWave}
        disabled={waveInProgress || allWavesCompleted}
        className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-2xl transition btn-press border ${
          allWavesCompleted
            ? 'bg-stone-800 text-stone-400 border-stone-700 cursor-not-allowed'
            : waveInProgress
            ? 'bg-amber-950/70 text-amber-400 border-amber-700/50 cursor-not-allowed animate-pulse'
            : isPrepping
            ? 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-stone-950 border-amber-300 shadow-amber-500/40 ring-2 ring-amber-400/30 animate-pulse'
            : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 border-amber-400 shadow-amber-600/40'
        }`}
      >
        {waveInProgress ? (
          <>
            <ShieldAlert size={16} className="animate-spin" />
            <span>进攻中...</span>
          </>
        ) : allWavesCompleted ? (
          <span>全线大捷！</span>
        ) : isPrepping ? (
          <>
            <Swords size={16} />
            <div className="flex flex-col items-start text-left leading-tight">
              <span className="font-extrabold text-stone-950 text-[11px] sm:text-xs">
                第 {currentWave + 1} 波 · {prepSecondsLeft}s
              </span>
              <span className="text-[9px] text-stone-900/90 font-medium">
                [立即迎击]
              </span>
            </div>
          </>
        ) : (
          <>
            <Swords size={16} />
            <span>迎击 (第 {currentWave + 1} 波)</span>
          </>
        )}
      </button>
    </div>
  );
};
