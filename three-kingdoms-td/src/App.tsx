import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, MasterSkillsCooldown } from './core/GameEngine';
import { STAGES } from './config/stages';
import { StageConfig, PlacedTower } from './types/game';
import { TopBar } from './components/TopBar';
import { TowerShop } from './components/TowerShop';
import { TowerPanel } from './components/TowerPanel';
import { BottomControls } from './components/BottomControls';
import { GameOverModal } from './components/GameOverModal';
import { sound } from './core/SoundEffects';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // 响应式状态同步
  const [currentStage, setCurrentStage] = useState<StageConfig>(STAGES[0]);
  const [gold, setGold] = useState<number>(STAGES[0].initialGold);
  const [lives, setLives] = useState<number>(STAGES[0].initialLives);
  const [currentWave, setCurrentWave] = useState<number>(0);
  const [totalWaves, setTotalWaves] = useState<number>(STAGES[0].waves.length);
  const [waveInProgress, setWaveInProgress] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // 交互状态
  const [placingHeroId, setPlacingHeroId] = useState<string | null>(null);
  const [selectedTower, setSelectedTower] = useState<PlacedTower | null>(null);
  const [deployedHeroIds, setDeployedHeroIds] = useState<string[]>([]);
  const [prepCountdown, setPrepCountdown] = useState<number>(0);
  const [skillsCooldown, setSkillsCooldown] = useState<MasterSkillsCooldown>({
    freezeCd: 0,
    maxFreezeCd: 20,
    fireCd: 0,
    maxFireCd: 30,
  });
  const [gameOverState, setGameOverState] = useState<{ show: boolean; victory: boolean }>({
    show: false,
    victory: false,
  });

  // 初始化引擎
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, currentStage, {
      onGoldChange: (newGold) => setGold(newGold),
      onLivesChange: (newLives) => setLives(newLives),
      onWaveChange: (wave, total) => {
        setCurrentWave(wave);
        setTotalWaves(total);
      },
      onWaveStatusChange: (inProgress) => {
        setWaveInProgress(inProgress);
      },
      onGameOver: (victory) => {
        setGameOverState({ show: true, victory });
      },
      onSelectTower: (tower) => {
        setSelectedTower(tower);
      },
      onTowersChange: (ids) => {
        setDeployedHeroIds(ids);
      },
      onSkillsCooldownChange: (cooldowns) => {
        setSkillsCooldown(cooldowns);
      },
      onPrepCountdownChange: (secondsLeft) => {
        setPrepCountdown(secondsLeft);
      },
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
    };
  }, [currentStage]);

  // 切换关卡
  const handleSelectStage = useCallback((stage: StageConfig) => {
    setCurrentStage(stage);
    setGameOverState({ show: false, victory: false });
    setSelectedTower(null);
    setPlacingHeroId(null);
    setDeployedHeroIds([]);
    setPrepCountdown(0);
    setSkillsCooldown({ freezeCd: 0, maxFreezeCd: 20, fireCd: 0, maxFireCd: 30 });
    setWaveInProgress(false);
  }, []);

  // 重新开始本关
  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetStage(currentStage);
      setGameOverState({ show: false, victory: false });
      setSelectedTower(null);
      setPlacingHeroId(null);
      setDeployedHeroIds([]);
      setPrepCountdown(0);
      setSkillsCooldown({ freezeCd: 0, maxFreezeCd: 20, fireCd: 0, maxFireCd: 30 });
      setWaveInProgress(false);
      setIsPaused(false);
    }
  }, [currentStage]);

  // 暂停切换
  const handleTogglePause = useCallback(() => {
    if (engineRef.current) {
      const nextPaused = !engineRef.current.isPaused;
      engineRef.current.isPaused = nextPaused;
      setIsPaused(nextPaused);
    }
  }, []);

  // 倍速切换
  const handleToggleSpeed = useCallback(() => {
    if (engineRef.current) {
      const nextSpeed = engineRef.current.gameSpeed === 1 ? 2 : 1;
      engineRef.current.gameSpeed = nextSpeed;
      setGameSpeed(nextSpeed);
    }
  }, []);

  // 声音切换
  const handleToggleSound = useCallback(() => {
    sound.enabled = !sound.enabled;
    setSoundEnabled(sound.enabled);
  }, []);

  // 开始下一波
  const handleStartWave = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startNextWave();
    }
  }, []);

  // 借东风技能
  const handleCastFreeze = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.castFreezeSkill();
    }
  }, []);

  // 火烧连营技能
  const handleCastFireBomb = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.castFireBombSkill();
    }
  }, []);

  // 升级防守武将
  const handleUpgradeTower = useCallback((tower: PlacedTower) => {
    if (engineRef.current) {
      engineRef.current.upgradeTower(tower);
    }
  }, []);

  // 出售撤阵武将
  const handleSellTower = useCallback((tower: PlacedTower) => {
    if (engineRef.current) {
      engineRef.current.sellTower(tower);
    }
  }, []);

  // 选中待放置英雄
  const handleSelectHeroToPlace = useCallback((heroId: string | null) => {
    setPlacingHeroId(heroId);
    if (engineRef.current) {
      engineRef.current.placingHeroId = heroId;
      if (heroId) {
        engineRef.current.selectTower(null);
      }
    }
  }, []);

  // Canvas 点击事件
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // 1. 如果正在放置武将
    if (placingHeroId) {
      const col = Math.floor(clickX / 50);
      const row = Math.floor(clickY / 50);
      const success = engine.placeTower(placingHeroId, col, row);
      if (success) {
        setPlacingHeroId(null);
        engine.placingHeroId = null;
      }
      return;
    }

    // 2. 否则检测是否点击了场上的防御塔
    let clickedTower: PlacedTower | null = null;
    for (const t of engine.towers) {
      const dist = Math.hypot(t.x - clickX, t.y - clickY);
      if (dist <= 24) {
        clickedTower = t;
        break;
      }
    }

    engine.selectTower(clickedTower);
  };

  // Canvas 鼠标移动预览
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    engine.mousePos = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseLeave = () => {
    if (engineRef.current) {
      engineRef.current.mousePos = null;
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setPlacingHeroId(null);
    if (engineRef.current) {
      engineRef.current.placingHeroId = null;
      engineRef.current.selectTower(null);
    }
  };

  // 移动端 Touch 触控事件适配（微信小程序与手机浏览器核心兼容）
  const getCanvasCoordsFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getCanvasCoordsFromClient(touch.clientX, touch.clientY);
    if (!coords) return;

    const engine = engineRef.current;
    if (!engine) return;

    // 1. 如果正在放置武将
    if (placingHeroId) {
      const col = Math.floor(coords.x / 50);
      const row = Math.floor(coords.y / 50);
      const success = engine.placeTower(placingHeroId, col, row);
      if (success) {
        setPlacingHeroId(null);
        engine.placingHeroId = null;
      }
      return;
    }

    // 2. 否则检测点击场上的武将
    let clickedTower: PlacedTower | null = null;
    for (const t of engine.towers) {
      const dist = Math.hypot(t.x - coords.x, t.y - coords.y);
      if (dist <= 26) {
        clickedTower = t;
        break;
      }
    }
    engine.selectTower(clickedTower);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const coords = getCanvasCoordsFromClient(touch.clientX, touch.clientY);
    if (!coords || !engineRef.current) return;
    engineRef.current.mousePos = coords;
  };

  const handleCanvasTouchEnd = () => {
    if (engineRef.current) {
      engineRef.current.mousePos = null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-stone-950 select-none overflow-hidden text-stone-100">
      {/* 顶部导航控制栏 */}
      <TopBar
        currentStage={currentStage}
        gold={gold}
        lives={lives}
        currentWave={currentWave}
        totalWaves={totalWaves}
        isPaused={isPaused}
        gameSpeed={gameSpeed}
        soundEnabled={soundEnabled}
        onTogglePause={handleTogglePause}
        onToggleSpeed={handleToggleSpeed}
        onToggleSound={handleToggleSound}
        onRestart={handleRestart}
        onChangeStage={handleSelectStage}
      />

      {/* 主工作区：移动端上下分层 (flex-col)，桌面端左右分层 (md:flex-row) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* 游戏战场 Canvas 区域 */}
        <div className="flex-1 flex items-center justify-center bg-stone-950 p-1 sm:p-2 md:p-3 relative overflow-hidden min-h-0">
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-900/60 bg-stone-900 max-w-full max-h-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1000}
              height={600}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onContextMenu={handleCanvasContextMenu}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              className="cursor-crosshair block touch-none"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: '1000 / 600',
                objectFit: 'contain',
              }}
            />

            {/* 选中防御塔详情面板 */}
            {selectedTower && (
              <TowerPanel
                tower={selectedTower}
                gold={gold}
                onUpgrade={handleUpgradeTower}
                onSell={handleSellTower}
                onClose={() => {
                  if (engineRef.current) engineRef.current.selectTower(null);
                }}
              />
            )}

            {/* 底部控制台：发兵、锦囊技能 */}
            <BottomControls
              gold={gold}
              waveInProgress={waveInProgress}
              currentWave={currentWave}
              totalWaves={totalWaves}
              skillsCooldown={skillsCooldown}
              prepCountdown={prepCountdown}
              onStartWave={handleStartWave}
              onCastFreeze={handleCastFreeze}
              onCastFireBomb={handleCastFireBomb}
            />
          </div>
        </div>

        {/* 右侧主公点将台招募面板 */}
        <TowerShop
          gold={gold}
          placingHeroId={placingHeroId}
          deployedHeroIds={deployedHeroIds}
          onSelectHeroToPlace={handleSelectHeroToPlace}
        />
      </div>

      {/* 胜负结算弹窗 */}
      {gameOverState.show && (
        <GameOverModal
          victory={gameOverState.victory}
          currentStage={currentStage}
          onRestart={handleRestart}
          onNextStage={handleSelectStage}
        />
      )}
    </div>
  );
};

export default App;
