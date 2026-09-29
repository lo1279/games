import React, { useState, useEffect, useCallback } from 'react';
import type { Talent, KarmaState, PersonalAssets, FamilyState, Child, DiceResult } from './types/game';
import {
  createNewGame,
  drawRandomTalents,
  applyTalentSelection,
  startLifeWithAttributes,
  advanceOneYear,
  resolveDecision,
  resolveDiceChallenge,
} from './engine/gameEngine';
import { loadKarmaState, saveKarmaState } from './engine/karmaEngine';
import { evaluateLife } from './engine/lifeEvaluation';
import { createInheritedGame } from './engine/familyEngine';
import { TalentSelector } from './components/TalentSelector';
import { AttrAllocator } from './components/AttrAllocator';
import { HeaderStats } from './components/HeaderStats';
import { LifeTimeline } from './components/LifeTimeline';
import { DecisionModal } from './components/DecisionModal';
import { GameOverModal } from './components/GameOverModal';
import { AchievementDrawer } from './components/AchievementDrawer';
import { KarmaModal } from './components/KarmaModal';
import { BusinessModal } from './components/BusinessModal';
import { FamilyModal } from './components/FamilyModal';
import { DiceChallengeModal } from './components/DiceChallengeModal';
import { Trophy, Sparkles, Flame } from 'lucide-react';

export const App: React.FC = () => {
  const [karmaState, setKarmaState] = useState<KarmaState>(() => loadKarmaState());
  const [gameState, setGameState] = useState(() => createNewGame());
  const [tempSelectedTalents, setTempSelectedTalents] = useState<Talent[]>([]);
  const [isAchievementOpen, setIsAchievementOpen] = useState(false);
  const [isKarmaOpen, setIsKarmaOpen] = useState(false);
  const [isBusinessOpen, setIsBusinessOpen] = useState(false);
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);

  // 动态最大可选天赋槽位 (基础3 + 神殿升级)
  const maxTalentSlots = 3 + (karmaState.upgrades.extraTalentSlotsLevel || 0);
  // 动态初始分配点数 (基础20 + 神殿升级*2)
  const totalAttrPoints = 20 + (karmaState.upgrades.extraAttrPointsLevel || 0) * 2;

  // 天赋选择切换
  const handleToggleTalent = (talent: Talent) => {
    setTempSelectedTalents((prev) => {
      const exists = prev.some((t) => t.id === talent.id);
      if (exists) {
        return prev.filter((t) => t.id !== talent.id);
      }
      if (prev.length >= maxTalentSlots) {
        return prev;
      }
      return [...prev, talent];
    });
  };

  // 重新抽天赋
  const handleRerollTalents = () => {
    setTempSelectedTalents([]);
    setGameState((prev) => ({
      ...prev,
      allTalentsPool: drawRandomTalents(),
    }));
  };

  // 确认天赋选择，进入属性加点阶段
  const handleConfirmTalents = () => {
    if (tempSelectedTalents.length !== maxTalentSlots) return;
    setGameState((prev) => applyTalentSelection(prev, tempSelectedTalents));
  };

  // 完成加点，正式转生进入 0 岁
  const handleStartLife = (
    allocated: { charm: number; intelligence: number; strength: number; wealth: number },
    name: string,
    gender: '男' | '女'
  ) => {
    setGameState((prev) => startLifeWithAttributes(prev, allocated, name, gender));
  };

  // 推进下一年
  const handleNextYear = useCallback(() => {
    setGameState((prev) => advanceOneYear(prev));
  }, []);

  // 做出关键抉择
  const handleSelectDecision = (optionId: string) => {
    setGameState((prev) => resolveDecision(prev, optionId));
  };

  // 自动演进定时器
  useEffect(() => {
    if (!gameState.autoPlay || gameState.phase !== 'playing' || gameState.isDead) {
      return;
    }

    const timer = setInterval(() => {
      handleNextYear();
    }, gameState.playSpeedMs);

    return () => clearInterval(timer);
  }, [gameState.autoPlay, gameState.phase, gameState.isDead, gameState.playSpeedMs, handleNextYear]);

  // 切换自动演进
  const handleToggleAutoPlay = () => {
    setGameState((prev) => ({
      ...prev,
      autoPlay: !prev.autoPlay,
    }));
  };

  // 调节速度 (1000ms -> 500ms -> 250ms -> 1000ms)
  const handleChangeSpeed = () => {
    setGameState((prev) => {
      const speeds = [1000, 500, 250];
      const nextIdx = (speeds.indexOf(prev.playSpeedMs) + 1) % speeds.length;
      return {
        ...prev,
        playSpeedMs: speeds[nextIdx],
      };
    });
  };

  // 重新开始游戏 (结算本世功德并进入下一轮回)
  const handleRestart = () => {
    // 结算功德
    if (gameState.isDead || gameState.phase === 'summary') {
      const summary = evaluateLife(gameState);
      const earned = summary.karmaEarned;
      const updatedKarma: KarmaState = {
        ...karmaState,
        karmaCoins: karmaState.karmaCoins + earned,
        totalKarmaEarned: karmaState.totalKarmaEarned + earned,
        reincarnationCount: karmaState.reincarnationCount + 1,
      };
      setKarmaState(updatedKarma);
      saveKarmaState(updatedKarma);
    }

    setTempSelectedTalents([]);
    setGameState(createNewGame(gameState.unlockedAchievementIds));
  };

  // 更新商海资产状态
  const handleUpdateAssets = (newAssets: PersonalAssets) => {
    setGameState((prev) => ({
      ...prev,
      assets: newAssets,
    }));
  };

  // 更新良缘与家族状态 (兼顾现金消费扣减)
  const handleUpdateFamily = (newFamily: FamilyState, cashChange: number) => {
    setGameState((prev) => ({
      ...prev,
      family: newFamily,
      assets: {
        ...prev.assets,
        cash: Math.max(0, Math.round((prev.assets.cash + cashChange) * 10) / 10),
      },
    }));
  };

  // 家族世代继承：二代子嗣继承家资与天赋开局
  const handleInheritChild = (child: Child) => {
    // 结算功德
    const summary = evaluateLife(gameState);
    const earned = summary.karmaEarned;
    const updatedKarma: KarmaState = {
      ...karmaState,
      karmaCoins: karmaState.karmaCoins + earned,
      totalKarmaEarned: karmaState.totalKarmaEarned + earned,
      reincarnationCount: karmaState.reincarnationCount + 1,
    };
    setKarmaState(updatedKarma);
    saveKarmaState(updatedKarma);

    const inheritedOpt = createInheritedGame(gameState, child);
    setTempSelectedTalents(inheritedOpt.inheritedTalent ? [inheritedOpt.inheritedTalent] : []);
    setGameState(createNewGame(gameState.unlockedAchievementIds, inheritedOpt));
  };

  // 解决 D20 奇遇掷点挑战结果
  const handleResolveChallenge = (result: DiceResult) => {
    setGameState((prev) => resolveDiceChallenge(prev, result));
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* 顶部常驻导航栏 (适配刘海与微信小程序右上角胶囊区域) */}
      <nav className="shrink-0 border-b border-slate-800/80 px-3 sm:px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2 flex items-center justify-between backdrop-blur-md bg-slate-900/80 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white">人生模拟器</span>
            <span className="text-[10px] text-pink-400 font-bold ml-1.5 px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/20">
              轮回录 V3.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 轮回神殿入口 */}
          <button
            onClick={() => setIsKarmaOpen(true)}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/40 hover:to-orange-600/40 text-amber-300 text-xs font-bold border border-amber-500/40 transition-colors cursor-pointer active:scale-95 transition-transform"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>神殿</span>
            <span className="text-amber-400 font-extrabold ml-0.5">({karmaState.karmaCoins})</span>
          </button>

          {/* 成就图鉴 */}
          <button
            onClick={() => setIsAchievementOpen(true)}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer active:scale-95 transition-transform"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>成就</span>
            <span className="text-amber-400 font-bold">
              {gameState.unlockedAchievementIds.length}/{gameState.achievements.length}
            </span>
          </button>
        </div>
      </nav>

      {/* 主界面切换 */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {gameState.phase === 'talent' && (
          <TalentSelector
            talents={gameState.allTalentsPool}
            selectedTalents={tempSelectedTalents}
            maxSlots={maxTalentSlots}
            onToggleTalent={handleToggleTalent}
            onReroll={handleRerollTalents}
            onConfirm={handleConfirmTalents}
          />
        )}

        {gameState.phase === 'alloc' && (
          <AttrAllocator
            selectedTalents={gameState.selectedTalents}
            totalPoints={totalAttrPoints}
            onBack={() => setGameState((prev) => ({ ...prev, phase: 'talent' }))}
            onStartLife={handleStartLife}
          />
        )}

        {(gameState.phase === 'playing' ||
          gameState.phase === 'decision' ||
          gameState.phase === 'summary') && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <HeaderStats
              age={gameState.age}
              name={gameState.name}
              gender={gameState.gender}
              attrs={gameState.attrs}
              tags={gameState.tags}
              cash={gameState.assets?.cash || 0}
              partnerName={gameState.family?.partner?.name}
              onOpenBusiness={() => setIsBusinessOpen(true)}
              onOpenFamily={() => setIsFamilyOpen(true)}
            />

            <LifeTimeline
              logs={gameState.logs}
              isDead={gameState.isDead}
              autoPlay={gameState.autoPlay}
              playSpeedMs={gameState.playSpeedMs}
              age={gameState.age}
              onNextYear={handleNextYear}
              onToggleAutoPlay={handleToggleAutoPlay}
              onChangeSpeed={handleChangeSpeed}
              onRestart={handleRestart}
              onOpenBusiness={() => setIsBusinessOpen(true)}
            />
          </div>
        )}
      </main>

      {/* 关键抉择弹窗 */}
      {gameState.phase === 'decision' && gameState.currentDecision && (
        <DecisionModal
          decision={gameState.currentDecision}
          state={gameState}
          onSelectOption={handleSelectDecision}
        />
      )}

      {/* D20 奇遇与渡劫掷骰检定弹窗 (方案3) */}
      {gameState.phase === 'challenge' && gameState.currentChallenge && (
        <DiceChallengeModal
          challenge={gameState.currentChallenge}
          state={gameState}
          onResolve={handleResolveChallenge}
        />
      )}

      {/* 终局总结弹窗 (接入神殿前往与家族二代世代传承) */}
      {gameState.phase === 'summary' && (
        <GameOverModal
          state={gameState}
          onRestart={handleRestart}
          onOpenKarma={() => setIsKarmaOpen(true)}
          onInheritChild={handleInheritChild}
        />
      )}

      {/* 成就图鉴抽屉 */}
      <AchievementDrawer
        isOpen={isAchievementOpen}
        onClose={() => setIsAchievementOpen(false)}
        achievements={gameState.achievements}
        unlockedIds={gameState.unlockedAchievementIds}
      />

      {/* 轮回神殿弹窗 (方案4) */}
      <KarmaModal
        isOpen={isKarmaOpen}
        onClose={() => setIsKarmaOpen(false)}
        karmaState={karmaState}
        onUpdateKarma={(newKarma) => {
          setKarmaState(newKarma);
          saveKarmaState(newKarma);
        }}
      />

      {/* 商海大亨与资产管理弹窗 (方案1) */}
      {gameState.assets && (
        <BusinessModal
          isOpen={isBusinessOpen}
          onClose={() => setIsBusinessOpen(false)}
          age={gameState.age}
          assets={gameState.assets}
          onUpdateAssets={handleUpdateAssets}
        />
      )}

      {/* 良缘情缘与家族世代弹窗 (方案2) */}
      {gameState.family && (
        <FamilyModal
          isOpen={isFamilyOpen}
          onClose={() => setIsFamilyOpen(false)}
          family={gameState.family}
          cash={gameState.assets?.cash || 0}
          availableTalents={gameState.selectedTalents}
          onUpdateFamily={handleUpdateFamily}
        />
      )}
    </div>
  );
};

export default App;
