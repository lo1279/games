import {
  StageConfig,
  PlacedTower,
  EnemyEntity,
  Projectile,
  FloatingText,
  Particle,
  HeroConfig,
  VisualSkillEffect,
} from '../types/game';
import { HEROES } from '../config/heroes';
import { ENEMIES } from '../config/enemies';
import { sound } from './SoundEffects';

export interface MasterSkillsCooldown {
  freezeCd: number;
  maxFreezeCd: number;
  fireCd: number;
  maxFireCd: number;
}

export interface GameEngineCallbacks {
  onGoldChange: (gold: number) => void;
  onLivesChange: (lives: number) => void;
  onWaveChange: (wave: number, totalWaves: number) => void;
  onWaveStatusChange: (inProgress: boolean) => void;
  onGameOver: (victory: boolean) => void;
  onSelectTower: (tower: PlacedTower | null) => void;
  onTowersChange?: (deployedHeroIds: string[]) => void;
  onSkillsCooldownChange?: (cooldowns: MasterSkillsCooldown) => void;
  onPrepCountdownChange?: (secondsLeft: number) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stage: StageConfig;
  private callbacks: GameEngineCallbacks;

  public gold: number = 0;
  public lives: number = 20;
  public currentWaveIndex: number = 0;
  public isPaused: boolean = false;
  public gameSpeed: number = 1; // 1x or 2x
  public isRunning: boolean = false;
  public selectedTower: PlacedTower | null = null;
  public placingHeroId: string | null = null; // 当前正在准备放置的英雄

  // 主公锦囊技能冷却时间（秒）
  public static readonly MAX_FREEZE_CD = 20;
  public static readonly MAX_FIRE_CD = 30;
  public freezeSkillCooldown: number = 0;
  public fireBombSkillCooldown: number = 0;
  private lastCdBroadcastSec: number = 0; // 控制 CD 变动通知频率

  // 波次备战自动倒计时（秒）
  public static readonly MAX_PREP_TIME = 10;
  public prepCountdown: number = 0;
  private lastPrepBroadcastSec: number = 0;

  // 实体列表
  public towers: PlacedTower[] = [];
  public enemies: EnemyEntity[] = [];
  public projectiles: Projectile[] = [];
  public floatingTexts: FloatingText[] = [];
  public particles: Particle[] = [];
  public visualEffects: VisualSkillEffect[] = []; // 华丽大招与刀芒特效列表

  // 出兵状态
  private waveInProgress: boolean = false;
  private waveEnemyQueue: { enemyId: string; spawnTime: number }[] = [];
  private waveTimer: number = 0;

  // 鼠标悬停位置（用于显示建造预览）
  public mousePos: { x: number; y: number } | null = null;

  // 图片资产缓存
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private mapBgImage: HTMLImageElement | null = null;

  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  constructor(canvas: HTMLCanvasElement, stage: StageConfig, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D Context not available');
    }
    this.ctx = context;
    this.stage = stage;
    this.callbacks = callbacks;
    this.preloadHeroImages();
    this.preloadEnemyImages();
    this.resetStage(stage);
  }

  // 预加载敌军（小兵与 Boss）图片
  private preloadEnemyImages(): void {
    Object.values(ENEMIES).forEach((enemy) => {
      const img = new Image();
      img.src = `/assets/enemies/${enemy.id}.png`;
      this.imageCache.set(`enemy_${enemy.id}`, img);
    });
  }

  // 预加载英雄立绘（头像、待机姿态、攻击姿态）
  private preloadHeroImages(): void {
    HEROES.forEach((h) => {
      // 基础头像
      if (h.avatarUrl) {
        const img = new Image();
        img.src = h.avatarUrl;
        this.imageCache.set(h.id, img);
      }

      // 待机姿态 (idle)
      const idleImg = new Image();
      idleImg.src = `/assets/heroes/${h.id}_idle.png`;
      this.imageCache.set(`${h.id}_idle`, idleImg);

      // 攻击姿态 (attack)
      const attackImg = new Image();
      attackImg.src = `/assets/heroes/${h.id}_attack.png`;
      this.imageCache.set(`${h.id}_attack`, attackImg);
    });
  }

  // 加载关卡地图背景图
  private loadMapBackground(): void {
    const bgUrl = `/assets/maps/${this.stage.id}_bg.jpg`;
    const img = new Image();
    img.src = bgUrl;
    img.onload = () => {
      this.mapBgImage = img;
    };
    img.onerror = () => {
      this.mapBgImage = null;
    };
  }

  // 重置关卡
  public resetStage(stage: StageConfig) {
    this.stage = stage;
    this.gold = stage.initialGold;
    this.lives = stage.initialLives;
    this.currentWaveIndex = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.floatingTexts = [];
    this.particles = [];
    this.visualEffects = [];
    this.selectedTower = null;
    this.placingHeroId = null;
    this.waveInProgress = false;
    this.waveEnemyQueue = [];
    this.waveTimer = 0;
    this.loadMapBackground();

    this.freezeSkillCooldown = 0;
    this.fireBombSkillCooldown = 0;
    this.lastCdBroadcastSec = 0;
    this.prepCountdown = 0;
    this.lastPrepBroadcastSec = 0;

    this.callbacks.onGoldChange(this.gold);
    this.callbacks.onLivesChange(this.lives);
    this.callbacks.onWaveChange(0, stage.waves.length);
    this.callbacks.onWaveStatusChange(false);
    this.callbacks.onSelectTower(null);
    this.callbacks.onTowersChange?.([]);
    this.callbacks.onSkillsCooldownChange?.({
      freezeCd: 0,
      maxFreezeCd: GameEngine.MAX_FREEZE_CD,
      fireCd: 0,
      maxFireCd: GameEngine.MAX_FIRE_CD,
    });
    this.callbacks.onPrepCountdownChange?.(0);
  }

  // 开始下一波出兵（手动点击或备战倒计时结束自动触发）
  public startNextWave(): boolean {
    if (this.waveInProgress) return false;
    if (this.currentWaveIndex >= this.stage.waves.length) return false;

    // 清空备战倒计时状态
    this.prepCountdown = 0;
    this.callbacks.onPrepCountdownChange?.(0);

    const waveConfig = this.stage.waves[this.currentWaveIndex];
    this.waveEnemyQueue = [];

    let currentOffset = 0.5; // 波次开启后初始 0.5 秒
    waveConfig.spawns.forEach((spawn) => {
      currentOffset += spawn.delayBefore;
      for (let i = 0; i < spawn.count; i++) {
        this.waveEnemyQueue.push({
          enemyId: spawn.enemyId,
          spawnTime: currentOffset + i * spawn.interval,
        });
      }
    });

    // 按时间排序
    this.waveEnemyQueue.sort((a, b) => a.spawnTime - b.spawnTime);
    this.waveInProgress = true;
    this.waveTimer = 0;

    sound.playDrum();
    this.currentWaveIndex++;
    this.callbacks.onWaveChange(this.currentWaveIndex, this.stage.waves.length);
    this.callbacks.onWaveStatusChange(true);
    return true;
  }

  // 放置武将防御塔
  public placeTower(heroId: string, col: number, row: number): boolean {
    const hero = HEROES.find((h) => h.id === heroId);
    if (!hero) return false;

    // 检查该武将是否已在阵中（每位武将限部署一人）
    const isAlreadyDeployed = this.towers.some((t) => t.heroId === heroId);
    if (isAlreadyDeployed) {
      sound.playAlarm();
      this.addFloatingText(col * 50 + 25, row * 50 + 25, `【${hero.name}】已在阵中，不可重复出战!`, '#ef4444', 16, true);
      return false;
    }

    // 检查是否有足够的金币
    if (this.gold < hero.cost) {
      sound.playAlarm();
      return false;
    }

    // 检查格子是否被占用
    const slotKey = `${col},${row}`;
    const isSlotValid = this.stage.towerSlots.some((s) => s.col === col && s.row === row);
    if (!isSlotValid) return false;

    const alreadyOccupied = this.towers.some((t) => t.col === col && t.row === row);
    if (alreadyOccupied) return false;

    // 扣除金币并创建防御塔
    this.gold -= hero.cost;
    this.callbacks.onGoldChange(this.gold);

    const x = col * 50 + 25;
    const y = row * 50 + 25;

    const maxHp = (hero.baseHp || 700);

    const newTower: PlacedTower = {
      id: `tower_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      heroId: hero.id,
      col,
      row,
      x,
      y,
      level: 1,
      damage: hero.baseDamage,
      range: hero.baseRange,
      attackInterval: hero.baseAttackInterval,
      attackTimer: 0,
      skillTimer: 0,
      totalDamageDealt: 0,
      kills: 0,
      targetId: null,
      angle: 0,
      hp: maxHp,
      maxHp,
      isDown: false,
      recoveryTimer: 0,
    };

    this.towers.push(newTower);
    this.selectTower(newTower);
    this.callbacks.onTowersChange?.(this.towers.map((t) => t.heroId));
    sound.playUpgrade();

    // 放置特效
    this.spawnParticles(x, y, hero.color, 16);
    this.addFloatingText(x, y - 20, `${hero.name} 奉命出战!`, hero.color, 18);

    return true;
  }

  // 升级已选武将
  public upgradeTower(tower: PlacedTower): boolean {
    // 通过 id 锁定战场上的真实实体，防止操作副本导致升级未持久化
    const realTower = this.towers.find((t) => t.id === tower.id);
    if (!realTower) return false;

    const hero = HEROES.find((h) => h.id === realTower.heroId);
    if (!hero) return false;

    const upgradeCost = Math.floor(hero.cost * (0.8 * realTower.level));
    if (this.gold < upgradeCost) {
      sound.playAlarm();
      return false;
    }

    if (realTower.level >= 5) {
      return false; // 最大5星
    }

    this.gold -= upgradeCost;
    this.callbacks.onGoldChange(this.gold);

    realTower.level++;
    realTower.damage = Math.floor(hero.baseDamage * (1 + (realTower.level - 1) * 0.45));
    realTower.range = Math.floor(hero.baseRange * (1 + (realTower.level - 1) * 0.12));
    realTower.attackInterval = Math.max(0.35, hero.baseAttackInterval * (1 - (realTower.level - 1) * 0.08));

    // 升级生命值成长：每星 +35% 生命上限，并瞬间治疗 35% 生命
    const baseHp = hero.baseHp || 700;
    const oldMax = realTower.maxHp;
    realTower.maxHp = Math.floor(baseHp * (1 + (realTower.level - 1) * 0.35));
    realTower.hp = Math.min(realTower.maxHp, realTower.hp + (realTower.maxHp - oldMax) + Math.floor(realTower.maxHp * 0.2));
    if (realTower.isDown) {
      realTower.isDown = false;
      realTower.recoveryTimer = 0;
    }

    this.selectedTower = realTower;

    sound.playUpgrade();
    this.spawnParticles(realTower.x, realTower.y, '#fbbf24', 24);
    this.addFloatingText(
      realTower.x,
      realTower.y - 25,
      realTower.level === 5 ? `★真·${hero.name} 破界觉醒!★` : `${hero.name} 晋升 ${realTower.level}星!`,
      '#f59e0b',
      20,
      true
    );

    this.callbacks.onSelectTower({ ...realTower });
    return true;
  }

  // 撤阵（出售防御塔）
  public sellTower(tower: PlacedTower): void {
    const hero = HEROES.find((h) => h.id === tower.heroId);
    if (!hero) return;

    // 返还总投入的 70%
    const totalInvested = hero.cost + Math.floor(hero.cost * 0.8 * (tower.level - 1));
    const refund = Math.floor(totalInvested * 0.7);

    this.gold += refund;
    this.callbacks.onGoldChange(this.gold);

    this.towers = this.towers.filter((t) => t.id !== tower.id);
    this.selectTower(null);
    this.callbacks.onTowersChange?.(this.towers.map((t) => t.heroId));

    sound.playCoin();
    this.addFloatingText(tower.x, tower.y - 15, `+${refund} 军饷 (撤阵)`, '#fbbf24', 16);
  }

  // 选中武将塔
  public selectTower(tower: PlacedTower | null): void {
    this.selectedTower = tower;
    this.callbacks.onSelectTower(tower ? { ...tower } : null);
  }

  // 主公技能：借东风（全屏冰冻/静止 3.5秒）
  public castFreezeSkill(): boolean {
    if (this.freezeSkillCooldown > 0) {
      sound.playAlarm();
      this.addFloatingText(500, 260, `【借东风】锦囊冷却中 (还剩 ${Math.ceil(this.freezeSkillCooldown)}s)`, '#38bdf8', 18, true);
      return false;
    }

    if (this.gold < 100) {
      sound.playAlarm();
      return false;
    }
    this.gold -= 100;
    this.callbacks.onGoldChange(this.gold);

    // 触发冷却
    this.freezeSkillCooldown = GameEngine.MAX_FREEZE_CD;
    this.notifySkillsCooldown();

    sound.playThunder();
    this.enemies.forEach((enemy) => {
      enemy.stunTimer = 3.5;
    });

    this.addFloatingText(500, 200, '主公妙计：借东风·全场冰封！', '#38bdf8', 28, true);
    for (let i = 0; i < 60; i++) {
      this.spawnParticles(Math.random() * 1000, Math.random() * 600, '#7dd3fc', 3);
    }
    return true;
  }

  // 主公技能：火烧连营（全屏大范围烈火轰炸）
  public castFireBombSkill(): boolean {
    if (this.fireBombSkillCooldown > 0) {
      sound.playAlarm();
      this.addFloatingText(500, 260, `【火烧连营】锦囊冷却中 (还剩 ${Math.ceil(this.fireBombSkillCooldown)}s)`, '#ef4444', 18, true);
      return false;
    }

    if (this.gold < 150) {
      sound.playAlarm();
      return false;
    }
    this.gold -= 150;
    this.callbacks.onGoldChange(this.gold);

    // 触发冷却
    this.fireBombSkillCooldown = GameEngine.MAX_FIRE_CD;
    this.notifySkillsCooldown();

    sound.playExplosion();
    this.enemies.forEach((enemy) => {
      const dmg = 450;
      enemy.hp -= dmg;
      enemy.burnTimer = 4;
      enemy.burnDps = 60;
      this.addFloatingText(enemy.x, enemy.y - 10, `-${dmg}`, '#ef4444', 18, true);
      this.spawnParticles(enemy.x, enemy.y, '#f97316', 15);
    });

    this.addFloatingText(500, 200, '主公妙计：火烧连营·烈焰天罚！', '#ef4444', 28, true);
    return true;
  }

  // 广播锦囊技能冷却
  private notifySkillsCooldown(): void {
    this.callbacks.onSkillsCooldownChange?.({
      freezeCd: Math.max(0, this.freezeSkillCooldown),
      maxFreezeCd: GameEngine.MAX_FREEZE_CD,
      fireCd: Math.max(0, this.fireBombSkillCooldown),
      maxFireCd: GameEngine.MAX_FIRE_CD,
    });
  }

  // 启动主引擎
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop(this.lastTimestamp);
  }

  // 停止主引擎
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // 主循环
  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    let dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // 防止切后台导致 dt 过大
    if (dt > 0.1) dt = 0.1;

    if (!this.isPaused) {
      const actualDt = dt * this.gameSpeed;
      this.update(actualDt);
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  // 核心逻辑更新
  private update(dt: number): void {
    // 0. 更新主公锦囊技能冷却时间
    let cdChanged = false;
    if (this.freezeSkillCooldown > 0) {
      this.freezeSkillCooldown = Math.max(0, this.freezeSkillCooldown - dt);
      cdChanged = true;
    }
    if (this.fireBombSkillCooldown > 0) {
      this.fireBombSkillCooldown = Math.max(0, this.fireBombSkillCooldown - dt);
      cdChanged = true;
    }
    if (cdChanged) {
      // 节流通知：每 0.1 秒或归零时向 React 组件同步一次冷却进度
      this.lastCdBroadcastSec += dt;
      if (this.lastCdBroadcastSec >= 0.1 || this.freezeSkillCooldown === 0 || this.fireBombSkillCooldown === 0) {
        this.lastCdBroadcastSec = 0;
        this.notifySkillsCooldown();
      }
    }

    // 0.1 更新波次备战倒计时（每波打完后 10 秒休整，倒计时结束自动开打，亦可手动点击提前开打）
    if (!this.waveInProgress && this.prepCountdown > 0 && this.currentWaveIndex < this.stage.waves.length) {
      this.prepCountdown = Math.max(0, this.prepCountdown - dt);
      this.lastPrepBroadcastSec += dt;
      if (this.lastPrepBroadcastSec >= 0.1 || this.prepCountdown === 0) {
        this.lastPrepBroadcastSec = 0;
        this.callbacks.onPrepCountdownChange?.(this.prepCountdown);
      }
      if (this.prepCountdown === 0) {
        // 倒计时结束，自动开战
        this.startNextWave();
      }
    }

    // 1. 处理波次生成
    if (this.waveInProgress) {
      this.waveTimer += dt;
      // 遍历队列看谁该出场
      for (let i = this.waveEnemyQueue.length - 1; i >= 0; i--) {
        const item = this.waveEnemyQueue[i];
        if (this.waveTimer >= item.spawnTime) {
          this.spawnEnemy(item.enemyId);
          this.waveEnemyQueue.splice(i, 1);
        }
      }

      // 如果队列空了并且场上敌人全灭 -> 波次完成
      if (this.waveEnemyQueue.length === 0 && this.enemies.length === 0) {
        this.waveInProgress = false;
        this.callbacks.onWaveStatusChange(false);
        // 奖励波次军饷（平滑梯度，避免暴富通胀）
        const bonusGold = 30 + this.currentWaveIndex * 12;
        this.gold += bonusGold;
        this.callbacks.onGoldChange(this.gold);
        sound.playCoin();
        this.addFloatingText(500, 260, `波次防御成功！犒劳军饷 +${bonusGold}`, '#fbbf24', 24, true);

        // 检查是否通关整场战役
        if (this.currentWaveIndex >= this.stage.waves.length) {
          this.callbacks.onGameOver(true);
        } else {
          // 还有后续波次：开启 10 秒备战倒计时（可调整阵容或手动提前迎击）
          this.prepCountdown = GameEngine.MAX_PREP_TIME;
          this.lastPrepBroadcastSec = 0;
          this.callbacks.onPrepCountdownChange?.(this.prepCountdown);
          this.addFloatingText(500, 300, `休整备战中：${GameEngine.MAX_PREP_TIME} 秒后自动发兵 (可点击提前迎击)`, '#38bdf8', 20, true);
        }
      }
    }

    // 2. 更新敌人士兵
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // 眩晕判定
      if (enemy.stunTimer > 0) {
        enemy.stunTimer -= dt;
      } else {
        // 张角 Boss 特性：黄天当立，清除减速
        if (enemy.typeId === 'boss_zhangjiao' && enemy.slowTimer > 0) {
          enemy.slowTimer = 0;
        }

        // 华雄 Boss 特性：半血暴走冲锋
        if (enemy.typeId === 'boss_huaxiong' && enemy.hp < enemy.maxHp * 0.5 && !enemy.bossSkillTriggered) {
          enemy.bossSkillTriggered = true;
          enemy.baseSpeed *= 1.45;
          sound.playDrum();
          this.addFloatingText(enemy.x, enemy.y - 25, '【华雄·骁勇劈山】全军随我冲锋！', '#ef4444', 20, true);
          this.spawnParticles(enemy.x, enemy.y, '#ef4444', 25);
        }

        // 吕布 Boss 特性：濒危天下无双霸体
        if (enemy.typeId === 'boss_lvbu' && enemy.hp < enemy.maxHp * 0.4 && !enemy.bossSkillTriggered) {
          enemy.bossSkillTriggered = true;
          enemy.stunTimer = 0;
          enemy.slowTimer = 0;
          enemy.armor = 0.7; // 巨额护甲
          sound.playThunder();
          this.addFloatingText(enemy.x, enemy.y - 30, '【吕布·天下无双】谁敢决一死战！', '#ef4444', 24, true);
          this.spawnParticles(enemy.x, enemy.y, '#dc2626', 40);
        }

        // 减速判定
        let currentSpeed = enemy.baseSpeed;
        if (enemy.slowTimer > 0) {
          enemy.slowTimer -= dt;
          currentSpeed *= 0.5; // 减速50%
        }

        // 沿路径前进
        const targetWaypoint = this.stage.path[enemy.waypointIndex];
        if (targetWaypoint) {
          const dx = targetWaypoint.x - enemy.x;
          const dy = targetWaypoint.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          const moveDist = currentSpeed * dt;

          if (Math.abs(dx) > 0.5) {
            enemy.facingRight = dx > 0;
          }

          if (dist <= moveDist) {
            enemy.x = targetWaypoint.x;
            enemy.y = targetWaypoint.y;
            enemy.waypointIndex++;
            if (enemy.waypointIndex >= this.stage.path.length) {
              enemy.reachedEnd = true;
            }
          } else {
            enemy.x += (dx / dist) * moveDist;
            enemy.y += (dy / dist) * moveDist;
            enemy.distanceTraveled += moveDist;
          }
        }
      }

      // 敌军反击附近点将台判定（内置 1.4 秒 CD）
      if (!enemy.attackTowerTimer) enemy.attackTowerTimer = 0;
      if (enemy.attackTowerTimer > 0) {
        enemy.attackTowerTimer -= dt;
      } else if (enemy.stunTimer <= 0) {
        // 寻找附近的守关武将（85 码内，且未倒下休整）
        let nearbyTower: PlacedTower | null = null;
        let minDist = 85;
        for (const t of this.towers) {
          if (!t.isDown) {
            const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
            if (d < minDist) {
              minDist = d;
              nearbyTower = t;
            }
          }
        }

        if (nearbyTower) {
          // 根据兵种决定反击伤害与攻击间隔
          let atkDmg = 18;
          let cd = 1.3;

          if (enemy.typeId === 'siege_ram') {
            atkDmg = 75; // 破阵冲车重创城防
            cd = 2.4;
          } else if (enemy.typeId === 'shield_guard') {
            atkDmg = 24;
            cd = 1.6;
          } else if (enemy.typeId === 'xiliang_cavalry') {
            atkDmg = 32;
            cd = 1.1;
          } else if (enemy.typeId === 'evil_sorcerer') {
            atkDmg = 28;
            cd = 1.5;
          } else if (enemy.typeId === 'boss_zhangjiao') {
            atkDmg = 85;
            cd = 1.8;
          } else if (enemy.typeId === 'boss_huaxiong') {
            atkDmg = 110;
            cd = 1.5;
          } else if (enemy.typeId === 'boss_lvbu') {
            atkDmg = 160;
            cd = 1.2;
          }

          enemy.attackTowerTimer = cd;
          this.applyDamageToTower(nearbyTower, atkDmg, enemy);
        }
      }

      // 灼烧伤害
      if (enemy.burnTimer > 0) {
        enemy.burnTimer -= dt;
        const burnDmg = enemy.burnDps * dt;
        enemy.hp -= burnDmg;
        if (Math.random() < 0.15) {
          this.spawnParticles(enemy.x, enemy.y, '#f97316', 2);
        }
      }

      // 检查阵亡
      if (enemy.hp <= 0 && !enemy.isDead) {
        enemy.isDead = true;
        this.gold += enemy.rewardGold;
        this.callbacks.onGoldChange(this.gold);
        sound.playCoin();
        this.addFloatingText(enemy.x, enemy.y - 12, `+${enemy.rewardGold}`, '#fbbf24', 16);
        this.spawnParticles(enemy.x, enemy.y, enemy.color, enemy.isBoss ? 40 : 15);
      }

      // 检查突破防线抵扣生命
      if (enemy.reachedEnd) {
        const loss = enemy.isBoss ? 5 : 1;
        this.lives -= loss;
        this.callbacks.onLivesChange(Math.max(0, this.lives));
        sound.playAlarm();
        this.addFloatingText(enemy.x, enemy.y - 20, `敌军突入！军心 -${loss}`, '#ef4444', 20, true);

        if (this.lives <= 0) {
          this.callbacks.onGameOver(false);
        }
      }

      if (enemy.isDead || enemy.reachedEnd) {
        this.enemies.splice(i, 1);
      }
    }

    // 3. 更新防御塔与开火
    this.towers.forEach((tower) => {
      const hero = HEROES.find((h) => h.id === tower.heroId);
      if (!hero) return;

      // 倒下休整逻辑：倒计时回血复苏
      if (tower.isDown) {
        tower.recoveryTimer -= dt;
        if (tower.recoveryTimer <= 0) {
          tower.isDown = false;
          tower.hp = Math.floor(tower.maxHp * 0.65); // 复原65%血量重返前线
          sound.playUpgrade();
          this.spawnParticles(tower.x, tower.y, '#22c55e', 20);
          this.addFloatingText(tower.x, tower.y - 25, `【${hero.name}】休整完毕 重整旗鼓!`, '#22c55e', 18, true);
        }
        return; // 倒下期间无法攻击或释放大招
      }

      if (tower.buffTimer && tower.buffTimer > 0) {
        tower.buffTimer -= dt;
      }

      // 递减攻击动作动画计时器
      if (tower.attackAnimationTimer && tower.attackAnimationTimer > 0) {
        tower.attackAnimationTimer -= dt;
        if (tower.attackAnimationTimer < 0) {
          tower.attackAnimationTimer = 0;
        }
      }

      tower.attackTimer += dt;
      tower.skillTimer += dt;

      // 索敌：在射程内，寻找行进距离最远（最接近终点）的敌人
      let bestTarget: EnemyEntity | null = null;
      let maxDist = -1;

      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
        if (dist <= tower.range) {
          if (enemy.distanceTraveled > maxDist) {
            maxDist = enemy.distanceTraveled;
            bestTarget = enemy;
          }
        }
      }

      const effectiveInterval = tower.buffTimer && tower.buffTimer > 0 ? tower.attackInterval * 0.6 : tower.attackInterval;

      // 辅助特异性逻辑：若为华佗或刘备，检查是否有友军需要治疗或战法回转已满
      const isSupport = hero.role === 'support';
      let woundedAlly: PlacedTower | null = null;
      if (isSupport) {
        // 寻找射程内（或刘备全场）受伤最重的友方武将（包括处于休整中的武将）
        let lowestHpRatio = 0.99;
        for (const ally of this.towers) {
          const allyHero = HEROES.find((h) => h.id === ally.heroId);
          const maxHp = ally.maxHp || (allyHero?.baseHp || 700);
          const ratio = ally.isDown ? 0 : ally.hp / maxHp;
          const dist = Math.hypot(ally.x - tower.x, ally.y - tower.y);
          // 华佗需在射程内，刘备全图感召
          if (hero.id === 'huatuo' && dist > tower.range) continue;
          if (ratio < lowestHpRatio) {
            lowestHpRatio = ratio;
            woundedAlly = ally;
          }
        }
      }

      // 主动战法技能释放（支持武将在场上无敌兵时也可以释放全军回春/仁德）
      if (tower.skillTimer >= hero.skillCooldown && (bestTarget || woundedAlly || (isSupport && this.waveInProgress))) {
        tower.skillTimer = 0;
        tower.attackAnimationTimer = 0.45;
        this.triggerHeroSkill(tower, hero, bestTarget || undefined, woundedAlly || undefined);
      }
      // 华佗专属普攻：优先治疗友军
      else if (hero.id === 'huatuo' && woundedAlly && tower.attackTimer >= effectiveInterval) {
        tower.attackTimer = 0;
        tower.attackAnimationTimer = 0.35;
        tower.angle = Math.atan2(woundedAlly.y - tower.y, woundedAlly.x - tower.x);
        this.healAllyTower(tower, woundedAlly, 45 + tower.level * 15);
      }
      // 普通攻击（对敌军）
      else if (bestTarget) {
        tower.targetId = bestTarget.id;
        tower.angle = Math.atan2(bestTarget.y - tower.y, bestTarget.x - tower.x);

        if (tower.attackTimer >= effectiveInterval) {
          tower.attackTimer = 0;
          tower.attackAnimationTimer = 0.35; // 触发普通攻击姿态动画 0.35秒
          this.fireTowerAttack(tower, hero, bestTarget);
        }
      } else {
        tower.targetId = null;
      }
    });

    // 4. 更新弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // 跟踪目标或者飞向固定点
      let tx = p.targetX;
      let ty = p.targetY;
      if (p.targetEnemyId) {
        const target = this.enemies.find((e) => e.id === p.targetEnemyId);
        if (target) {
          tx = target.x;
          ty = target.y;
        }
      }

      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;

      // 如果是穿透弹道（黄忠穿云箭/孙尚香散射箭）
      if (p.piercing) {
        if (!p.hitEnemyIds) p.hitEnemyIds = [];
        for (const enemy of this.enemies) {
          if (!p.hitEnemyIds.includes(enemy.id)) {
            const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            if (d <= enemy.size + p.radius + 6) {
              p.hitEnemyIds.push(enemy.id);
              this.applyDamageToEnemy(enemy, p.damage, p.damageType, undefined, true);
              this.spawnParticles(enemy.x, enemy.y, p.color, 8);
            }
          }
        }
      }

      if (dist <= step || dist < 12) {
        // 命中目标
        if (!p.piercing) {
          this.hitProjectile(p, tx, ty);
        }
        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    }

    // 5. 更新飘字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.elapsed += dt;
      ft.y -= 25 * dt; // 向上浮动
      ft.alpha = Math.max(0, 1 - ft.elapsed / ft.duration);
      if (ft.elapsed >= ft.duration) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 6. 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life += dt;
      pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 7. 更新华丽战法与大范围刀光特效
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const fx = this.visualEffects[i];
      fx.elapsed += dt;
      if (fx.elapsed >= fx.duration) {
        this.visualEffects.splice(i, 1);
      }
    }
  }

  // 生成敌方单位
  private spawnEnemy(enemyId: string): void {
    const config = ENEMIES[enemyId];
    if (!config) return;

    const startPos = this.stage.path[0];
    const newEnemy: EnemyEntity = {
      id: `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      typeId: config.id,
      name: config.name,
      char: config.char,
      x: startPos.x,
      y: startPos.y,
      hp: config.maxHp,
      maxHp: config.maxHp,
      speed: config.speed,
      baseSpeed: config.speed,
      armor: config.armor,
      magicResist: config.magicResist,
      rewardGold: config.rewardGold,
      color: config.color,
      size: config.size,
      isBoss: !!config.isBoss,
      waypointIndex: 1,
      distanceTraveled: 0,
      slowTimer: 0,
      stunTimer: 0,
      burnTimer: 0,
      burnDps: 0,
      isDead: false,
      reachedEnd: false,
      facingRight: this.stage.path[1] ? this.stage.path[1].x >= startPos.x : true,
    };

    this.enemies.push(newEnemy);

    if (config.isBoss) {
      sound.playDrum();
      this.addFloatingText(startPos.x, startPos.y - 30, `敌将【${config.name}】亲自领兵杀到！`, '#ef4444', 32, true);
    }
  }

  // 武将普通攻击
  private fireTowerAttack(tower: PlacedTower, hero: HeroConfig, target: EnemyEntity): void {
    // 弹道类型与声音
    if (hero.projectileType === 'arrow') {
      sound.playArrowShoot();
      this.projectiles.push({
        id: `proj_${Date.now()}`,
        x: tower.x,
        y: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: target.id,
        speed: 460,
        damage: tower.damage,
        damageType: 'physical',
        type: 'arrow',
        color: '#f59e0b',
        radius: 4,
      });
    } else if (hero.projectileType === 'slash') {
      sound.playSlash();
      // 关羽/近战斩击：直接顺劈斩
      this.applyDamageToEnemy(target, tower.damage, 'physical', tower);
      this.spawnCrescentSlash(tower.x, tower.y, tower.angle, 78, '#22c55e', '#86efac');

      // 溅射周围 80 码
      this.enemies.forEach((other) => {
        if (other.id !== target.id && Math.hypot(other.x - target.x, other.y - target.y) <= 80) {
          this.applyDamageToEnemy(other, tower.damage * 0.45, 'physical', tower);
        }
      });
    } else if (hero.projectileType === 'spear') {
      // 张飞/赵云连刺突袭
      sound.playSlash();
      this.applyDamageToEnemy(target, tower.damage, 'physical', tower);
      this.spawnCrescentSlash(tower.x, tower.y, tower.angle, 70, '#38bdf8', '#bae6fd');
    } else if (hero.projectileType === 'lightning') {
      // 诸葛亮雷击
      sound.playThunder();
      this.applyDamageToEnemy(target, tower.damage, 'magic', tower);
      target.slowTimer = 2.0; // 减速
      this.spawnLightningEffect(tower.x, tower.y, target.x, target.y);

      // 闪电链弹射另外 2 个目标
      let bounceCount = 2;
      let lastPos = { x: target.x, y: target.y };
      for (const other of this.enemies) {
        if (other.id !== target.id && bounceCount > 0) {
          const d = Math.hypot(other.x - lastPos.x, other.y - lastPos.y);
          if (d <= 140) {
            this.applyDamageToEnemy(other, tower.damage * 0.7, 'magic', tower);
            other.slowTimer = 1.5;
            this.spawnLightningEffect(lastPos.x, lastPos.y, other.x, other.y);
            lastPos = { x: other.x, y: other.y };
            bounceCount--;
          }
        }
      }
    } else if (hero.projectileType === 'fireball') {
      // 周瑜赤壁火球
      sound.playExplosion();
      this.projectiles.push({
        id: `proj_${Date.now()}`,
        x: tower.x,
        y: tower.y,
        targetX: target.x,
        targetY: target.y,
        targetEnemyId: target.id,
        speed: 380,
        damage: tower.damage,
        damageType: 'magic',
        type: 'fireball',
        color: '#ef4444',
        radius: 8,
        aoeRadius: 80,
        burnDuration: 3,
      });
    }
  }

  // 释放专属名将大招技能
  private triggerHeroSkill(tower: PlacedTower, hero: HeroConfig, target?: EnemyEntity, ally?: PlacedTower): void {
    if (hero.id === 'guanyu' && target) {
      // 关羽【青龙偃月斩】：呼啸而出的巨型青龙破空烈风刀芒
      sound.playSlash();
      sound.playThunder();
      const dmg = tower.damage * 3.2;
      this.applyDamageToEnemy(target, dmg, 'physical', tower, true);
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】青龙破千军!`, '#22c55e', 24, true);

      // 扇形贯穿判定与大招刀气实体
      this.visualEffects.push({
        id: `fx_dragon_${Date.now()}`,
        type: 'guanyu_dragon',
        x: tower.x,
        y: tower.y,
        targetX: target.x,
        targetY: target.y,
        angle: tower.angle,
        radius: 180,
        color: '#22c55e',
        secondaryColor: '#86efac',
        duration: 0.65,
        elapsed: 0,
      });

      // 贯穿前方 180 码范围内的所有敌人
      this.enemies.forEach((e) => {
        const d = Math.hypot(e.x - tower.x, e.y - tower.y);
        const a = Math.atan2(e.y - tower.y, e.x - tower.x);
        let diffA = Math.abs(a - tower.angle);
        while (diffA > Math.PI) diffA = Math.abs(diffA - Math.PI * 2);
        if (d <= 190 && diffA < 0.65) {
          this.applyDamageToEnemy(e, tower.damage * 1.8, 'physical', tower);
          this.spawnParticles(e.x, e.y, '#22c55e', 15);
        }
      });
      this.spawnParticles(target.x, target.y, '#4ade80', 35);
    } else if (hero.id === 'zhangfei') {
      // 张飞【当阳怒吼】：当阳桥碎骨咆哮，全场三重雷霆冲击波
      sound.playDrum();
      sound.playThunder();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】谁敢与我决一死战!`, '#eab308', 24, true);

      this.visualEffects.push({
        id: `fx_shock_${Date.now()}`,
        type: 'zhangfei_shock',
        x: tower.x,
        y: tower.y,
        angle: 0,
        radius: 200,
        color: '#eab308',
        secondaryColor: '#a855f7',
        duration: 0.75,
        elapsed: 0,
      });

      this.enemies.forEach((e) => {
        if (Math.hypot(e.x - tower.x, e.y - tower.y) <= 200) {
          e.stunTimer = 2.2;
          this.applyDamageToEnemy(e, tower.damage * 1.8, 'physical', tower, true);
        }
      });
      this.spawnParticles(tower.x, tower.y, '#fbbf24', 40);
    } else if (hero.id === 'zhugeliang' && target) {
      // 诸葛亮【八卦神雷阵】：八卦阵盘显现，九天落雷轰炸
      sound.playThunder();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】雷霆听吾号令!`, '#38bdf8', 24, true);

      this.visualEffects.push({
        id: `fx_zhuge_${Date.now()}`,
        type: 'zhuge_lightning',
        x: target.x,
        y: target.y,
        angle: 0,
        radius: 160,
        color: '#38bdf8',
        secondaryColor: '#facc15',
        duration: 0.8,
        elapsed: 0,
      });

      this.enemies.forEach((e) => {
        if (Math.hypot(e.x - target.x, e.y - target.y) <= 160) {
          this.applyDamageToEnemy(e, tower.damage * 2.5, 'magic', tower);
          e.slowTimer = 4.0;
          this.spawnLightningEffect(tower.x, tower.y, e.x, e.y);
        }
      });
    } else if (hero.id === 'zhouyu' && target) {
      // 周瑜【火烧赤壁】：凤凰业火焚天
      sound.playExplosion();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】赤壁业火，燃尽千帆!`, '#ef4444', 24, true);

      this.visualEffects.push({
        id: `fx_fire_${Date.now()}`,
        type: 'zhouyu_firestorm',
        x: target.x,
        y: target.y,
        angle: tower.angle,
        radius: 150,
        color: '#ef4444',
        secondaryColor: '#f97316',
        duration: 0.9,
        elapsed: 0,
      });

      this.enemies.forEach((e) => {
        if (Math.hypot(e.x - target.x, e.y - target.y) <= 150) {
          this.applyDamageToEnemy(e, tower.damage * 2.2, 'magic', tower);
          e.burnTimer = 5.0;
          e.burnDps = 100;
        }
      });
      this.spawnParticles(target.x, target.y, '#dc2626', 45);
    } else if (hero.id === 'caocao') {
      // 曹操：短歌行·对酒当歌，全场帝王金龙霸气大阵与三军战旗
      sound.playDrum();
      sound.playThunder();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】对酒当歌，人生几何!`, '#fbbf24', 24, true);

      // 全场帝王战阵光环
      this.visualEffects.push({
        id: `fx_caocao_${Date.now()}`,
        type: 'caocao_imperial',
        x: tower.x,
        y: tower.y,
        angle: 0,
        radius: 380,
        color: '#fbbf24',
        secondaryColor: '#a855f7',
        duration: 1.2,
        elapsed: 0,
      });

      this.towers.forEach((t) => {
        t.buffTimer = 6.0;
        this.spawnParticles(t.x, t.y, '#f59e0b', 20);
        this.addFloatingText(t.x, t.y - 20, '魏武神威·攻速+50%!', '#fde047', 15, true);
      });
    } else if (hero.id === 'zhaoyun' && target) {
      // 赵云：龙胆破军，银枪连刺
      sound.playSlash();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】一身是胆，破阵如风!`, '#059669', 24, true);

      this.visualEffects.push({
        id: `fx_spear_${Date.now()}`,
        type: 'zhaoyun_spear_storm',
        x: tower.x,
        y: tower.y,
        targetX: target.x,
        targetY: target.y,
        angle: tower.angle,
        radius: 120,
        color: '#10b981',
        secondaryColor: '#6ee7b7',
        duration: 0.55,
        elapsed: 0,
      });

      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!target.isDead && !target.reachedEnd) {
            this.applyDamageToEnemy(target, tower.damage * 1.0, 'physical', tower, true);
            this.spawnCrescentSlash(tower.x, tower.y, tower.angle + (Math.random() - 0.5) * 0.3, 85, '#34d399', '#a7f3d0');
          }
        }, i * 65);
      }
    } else if (hero.id === 'huangzhong') {
      // 黄忠：落日穿云箭，全场超远贯穿弹道
      sound.playArrowShoot();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】穿云贯日，百步穿杨!`, '#d97706', 24, true);
      const angle = tower.angle;
      const targetDist = 950;
      this.projectiles.push({
        id: `pierce_${Date.now()}`,
        x: tower.x,
        y: tower.y,
        targetX: tower.x + Math.cos(angle) * targetDist,
        targetY: tower.y + Math.sin(angle) * targetDist,
        targetEnemyId: null,
        speed: 720,
        damage: tower.damage * 3.5,
        damageType: 'physical',
        type: 'arrow',
        color: '#fbbf24',
        radius: 8,
        piercing: true,
        hitEnemyIds: [],
      });
    } else if (hero.id === 'sunshangxiang') {
      // 孙尚香：百花缭乱·漫天花雨乾坤轮
      sound.playArrowShoot();
      sound.playSlash();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】百花飞刃，破阵夺魂!`, '#ec4899', 24, true);

      // 生成百花缭乱绽放光环实体
      this.visualEffects.push({
        id: `fx_blossom_${Date.now()}`,
        type: 'sunshangxiang_blossom',
        x: tower.x,
        y: tower.y,
        angle: 0,
        radius: 180,
        color: '#ec4899',
        secondaryColor: '#f43f5e',
        duration: 0.8,
        elapsed: 0,
      });

      // 八方齐射旋转粉红烈焰乾坤飞轮
      for (let i = 0; i < 8; i++) {
        const rad = (i * Math.PI) / 4;
        const dist = 360;
        this.projectiles.push({
          id: `fan_${Date.now()}_${i}`,
          x: tower.x,
          y: tower.y,
          targetX: tower.x + Math.cos(rad) * dist,
          targetY: tower.y + Math.sin(rad) * dist,
          targetEnemyId: null,
          speed: 520,
          damage: tower.damage * 2.0,
          damageType: 'physical',
          type: 'slash',
          color: '#ec4899',
          radius: 8,
          piercing: true,
          hitEnemyIds: [],
        });
      }

      // 伴随百花落英粉红飞散粒子
      for (let i = 0; i < 25; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = Math.random() * 120 + 40;
        this.particles.push({
          x: tower.x,
          y: tower.y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          color: Math.random() > 0.5 ? '#f472b6' : '#fb7185',
          alpha: 1,
          size: Math.random() * 4 + 3,
          life: 0,
          maxLife: 0.6,
        });
      }
    } else if (hero.id === 'liubei') {
      // 9. 刘备大招【仁德昭天·桃园结义】：全场在阵武将甘霖回血 300点，休整武将提速苏醒 6秒
      sound.playUpgrade();
      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】仁德昭彰，匡扶汉室!`, '#22c55e', 24, true);

      this.visualEffects.push({
        id: `fx_liubei_${Date.now()}`,
        type: 'liubei_benevolence',
        x: tower.x,
        y: tower.y,
        angle: 0,
        radius: 360,
        color: '#22c55e',
        secondaryColor: '#facc15',
        duration: 1.1,
        elapsed: 0,
      });

      // 仁泽全军
      const healAmt = 300 + (tower.level - 1) * 80;
      this.towers.forEach((t) => {
        const allyHero = HEROES.find((h) => h.id === t.heroId);
        const maxHp = t.maxHp || (allyHero?.baseHp || 700);

        if (t.isDown) {
          // 削减休整倒计时 6 秒
          t.recoveryTimer = Math.max(0, t.recoveryTimer - 6);
          this.addFloatingText(t.x, t.y - 25, '仁德感召·休整-6s!', '#86efac', 17, true);
          if (t.recoveryTimer === 0) {
            t.isDown = false;
            t.hp = Math.floor(maxHp * 0.65);
            this.addFloatingText(t.x, t.y - 35, `【${allyHero?.name}】闻声力竭复苏!`, '#4ade80', 20, true);
          }
        } else {
          const oldHp = t.hp;
          t.hp = Math.min(maxHp, t.hp + healAmt);
          const actualHealed = t.hp - oldHp;
          if (actualHealed > 0) {
            this.addFloatingText(t.x, t.y - 20, `+${actualHealed} 仁德`, '#4ade80', 16, true);
          }
        }
        this.spawnParticles(t.x, t.y, '#22c55e', 14);
      });
    } else if (hero.id === 'huatuo') {
      // 10. 华佗大招【青囊回春·麻沸散】：定点布施药阵，恢复重伤武将450血，麻痹迟缓周围敌军2.0s
      sound.playUpgrade();
      sound.playDrum();

      const healTarget = ally || tower;
      const healAmt = 450 + (tower.level - 1) * 120;
      const allyHero = HEROES.find((h) => h.id === healTarget.heroId);
      const maxHp = healTarget.maxHp || (allyHero?.baseHp || 700);

      this.addFloatingText(tower.x, tower.y - 36, `【${hero.skillName}】青囊秘术，起死回生!`, '#0d9488', 24, true);

      // 药阵视觉特效
      this.visualEffects.push({
        id: `fx_huatuo_${Date.now()}`,
        type: 'huatuo_healing',
        x: healTarget.x,
        y: healTarget.y,
        angle: 0,
        radius: 130,
        color: '#14b8a6',
        secondaryColor: '#a7f3d0',
        duration: 1.2,
        elapsed: 0,
      });

      // 救治重伤武将
      if (healTarget.isDown) {
        healTarget.isDown = false;
        healTarget.recoveryTimer = 0;
        healTarget.hp = Math.floor(maxHp * 0.75);
        this.addFloatingText(healTarget.x, healTarget.y - 30, `【${allyHero?.name}】神药复苏! +${healTarget.hp}`, '#2dd4bf', 22, true);
      } else {
        const oldHp = healTarget.hp;
        healTarget.hp = Math.min(maxHp, healTarget.hp + healAmt);
        this.addFloatingText(healTarget.x, healTarget.y - 20, `+${healTarget.hp - oldHp} 青囊回春`, '#2dd4bf', 18, true);
      }
      this.spawnParticles(healTarget.x, healTarget.y, '#2dd4bf', 22);

      // 麻沸散药气扩散：麻痹周围敌人
      this.enemies.forEach((enemy) => {
        const d = Math.hypot(enemy.x - healTarget.x, enemy.y - healTarget.y);
        if (d <= 140) {
          enemy.stunTimer = Math.max(enemy.stunTimer, 2.0);
          this.applyDamageToEnemy(enemy, tower.damage * 1.5, 'magic', tower);
          this.addFloatingText(enemy.x, enemy.y - 12, '麻沸散·麻痹!', '#99f6e4', 16, true);
          this.spawnParticles(enemy.x, enemy.y, '#0d9488', 8);
        }
      });
    } else {
      // 通用大招强化
      sound.playSlash();
      if (target) {
        this.applyDamageToEnemy(target, tower.damage * 2.5, 'physical', tower, true);
        this.addFloatingText(tower.x, tower.y - 30, `【${hero.skillName}】!`, hero.color, 20, true);
      }
    }
  }

  // 华佗普通治疗技能
  private healAllyTower(healer: PlacedTower, target: PlacedTower, amount: number): void {
    const allyHero = HEROES.find((h) => h.id === target.heroId);
    const maxHp = target.maxHp || (allyHero?.baseHp || 700);

    if (target.isDown) {
      target.recoveryTimer = Math.max(0, target.recoveryTimer - 1.5);
      this.addFloatingText(target.x, target.y - 15, '金针通络 -1.5s', '#5eead4', 13);
      this.spawnParticles(target.x, target.y, '#14b8a6', 4);
      return;
    }

    if (target.hp >= maxHp) return;

    const oldHp = target.hp;
    target.hp = Math.min(maxHp, target.hp + amount);
    const actual = target.hp - oldHp;
    if (actual > 0) {
      this.addFloatingText(target.x, target.y - 18, `+${actual}`, '#2dd4bf', 14);
      this.spawnParticles(target.x, target.y, '#2dd4bf', 5);
    }
  }

  // 弹道命中处理
  private hitProjectile(p: Projectile, x: number, y: number): void {
    if (p.aoeRadius) {
      // 范围爆炸 (如火球)
      sound.playExplosion();
      this.spawnParticles(x, y, p.color, 25);
      this.enemies.forEach((enemy) => {
        const d = Math.hypot(enemy.x - x, enemy.y - y);
        if (d <= (p.aoeRadius || 0)) {
          this.applyDamageToEnemy(enemy, p.damage, p.damageType);
          if (p.burnDuration) {
            enemy.burnTimer = p.burnDuration;
            enemy.burnDps = 45;
          }
        }
      });
    } else if (p.targetEnemyId) {
      const target = this.enemies.find((e) => e.id === p.targetEnemyId);
      if (target) {
        this.applyDamageToEnemy(target, p.damage, p.damageType);
        this.spawnParticles(target.x, target.y, p.color, 6);
      }
    }
  }

  // 武将点将台受创扣血与倒下判定
  public applyDamageToTower(tower: PlacedTower, damage: number, attacker?: EnemyEntity): void {
    if (tower.isDown) return;

    // 刘备被动光环【仁德之风】：周围 160 码内有未休整刘备时，减免 15% 伤害
    let finalDmg = damage;
    const hasLiubeiNearby = this.towers.some((t) => {
      if (t.heroId === 'liubei' && !t.isDown) {
        return Math.hypot(t.x - tower.x, t.y - tower.y) <= 160;
      }
      return false;
    });

    if (hasLiubeiNearby) {
      finalDmg = Math.max(1, Math.floor(damage * 0.85));
    }

    tower.hp = Math.max(0, tower.hp - finalDmg);

    // 飘红色伤害字
    this.addFloatingText(
      tower.x + (Math.random() * 16 - 8),
      tower.y - 20,
      hasLiubeiNearby ? `-${finalDmg} (仁德)` : `-${finalDmg}`,
      hasLiubeiNearby ? '#fb923c' : '#ef4444',
      15
    );

    // 受击红光粒子
    if (Math.random() < 0.4) {
      this.spawnParticles(tower.x, tower.y, hasLiubeiNearby ? '#22c55e' : '#ef4444', 4);
    }

    // 检查是否负伤倒下
    if (tower.hp <= 0) {
      tower.isDown = true;
      tower.recoveryTimer = 16; // 16秒重伤休整倒计时
      sound.playAlarm();
      const hero = HEROES.find((h) => h.id === tower.heroId);
      this.addFloatingText(
        tower.x,
        tower.y - 32,
        `【${hero?.name || '武将'}】负伤休整中!`,
        '#f87171',
        20,
        true
      );
      this.spawnParticles(tower.x, tower.y, '#991b1b', 30);
    }
  }

  // 结算敌兵伤害
  private applyDamageToEnemy(
    enemy: EnemyEntity,
    rawDmg: number,
    type: 'physical' | 'magic',
    tower?: PlacedTower,
    isCrit?: boolean
  ): void {
    let reduction = type === 'physical' ? enemy.armor : enemy.magicResist;
    reduction = Math.min(0.8, Math.max(0, reduction)); // 最高减伤 80%

    let finalDmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));
    if (isCrit) {
      finalDmg = Math.floor(finalDmg * 1.5);
    }

    enemy.hp -= finalDmg;

    if (tower) {
      tower.totalDamageDealt += finalDmg;
      if (enemy.hp <= 0) {
        tower.kills++;
      }
    }

    // 飘字伤害
    const textColor = isCrit ? '#facc15' : type === 'physical' ? '#ffffff' : '#38bdf8';
    this.addFloatingText(
      enemy.x + (Math.random() * 20 - 10),
      enemy.y - 10,
      isCrit ? `暴击 -${finalDmg}!` : `-${finalDmg}`,
      textColor,
      isCrit ? 20 : 14,
      isCrit
    );
  }

  // 生成粒子
  public spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: Math.random() * 3 + 2,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3,
      });
    }
  }

  // 生成震撼大弧月牙刀光（普通挥砍与连刺）
  public spawnCrescentSlash(x: number, y: number, angle: number, radius = 75, color = '#22c55e', secondaryColor = '#86efac'): void {
    this.visualEffects.push({
      id: `slash_${Date.now()}_${Math.random()}`,
      type: 'crescent_slash',
      x,
      y,
      angle,
      radius,
      color,
      secondaryColor,
      duration: 0.28,
      elapsed: 0,
    });

    // 刀尖破空溅射飞舞粒子
    for (let i = 0; i < 6; i++) {
      const pAngle = angle + (Math.random() - 0.5) * 1.2;
      const dist = radius * (0.6 + Math.random() * 0.4);
      this.particles.push({
        x: x + Math.cos(pAngle) * dist,
        y: y + Math.sin(pAngle) * dist,
        vx: Math.cos(pAngle) * 160,
        vy: Math.sin(pAngle) * 160,
        color: secondaryColor,
        alpha: 1,
        size: Math.random() * 3 + 2,
        life: 0,
        maxLife: 0.3,
      });
    }
  }

  // 生成刀光特效（保留兼容）
  private spawnSlashEffect(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    this.spawnCrescentSlash(x1, y1, angle, 75, color);
  }

  // 生成闪电链特效
  private spawnLightningEffect(x1: number, y1: number, x2: number, y2: number): void {
    const steps = 6;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    for (let i = 0; i < steps; i++) {
      const jitterX = (Math.random() - 0.5) * 18;
      const jitterY = (Math.random() - 0.5) * 18;
      this.particles.push({
        x: x1 + dx * i + jitterX,
        y: y1 + dy * i + jitterY,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        color: '#67e8f9',
        alpha: 1,
        size: 4,
        life: 0,
        maxLife: 0.2,
      });
    }
  }

  // 添加飘字
  public addFloatingText(x: number, y: number, text: string, color: string, fontSize = 16, isCrit = false): void {
    this.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      alpha: 1,
      duration: 1.0,
      elapsed: 0,
      fontSize,
      isCrit,
    });
  }

  // 画面渲染
  private render(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 绘制古风地图底图与地面肌理
    this.renderMapBackground();

    // 2. 绘制出兵路线与城门营寨
    this.renderPathAndGates();

    // 3. 绘制塔防基座与建造槽位
    this.renderTowerSlots();

    // 4. 绘制敌军士兵
    this.renderEnemies();

    // 5. 绘制已部署名将防御塔
    this.renderTowers();

    // 6. 绘制弹道飞行物
    this.renderProjectiles();

    // 7. 绘制粒子
    this.renderParticles();

    // 8. 绘制华丽名将战法与大范围刀芒特效
    this.renderVisualEffects();

    // 9. 绘制建造放置预览与范围圈
    this.renderPlacementPreview();

    // 10. 绘制伤害飘字
    this.renderFloatingTexts();
  }

  // 地图背景渲染（三大历史战役地貌与动态景观）
  private renderMapBackground(): void {
    const { ctx, canvas } = this;
    const time = performance.now();

    // 优先绘制关卡真实美术背景大图
    if (this.mapBgImage && this.mapBgImage.complete && this.mapBgImage.naturalWidth > 0) {
      ctx.drawImage(this.mapBgImage, 0, 0, canvas.width, canvas.height);
      return;
    }

    if (this.stage.bgTheme === 'yellow_sand') {
      // 1. 曲阳平乱·黄土荒原
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGrad.addColorStop(0, '#2d241e');
      bgGrad.addColorStop(0.5, '#221a15');
      bgGrad.addColorStop(1, '#18120e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 黄土沙丘浅暗斑块
      ctx.fillStyle = 'rgba(180, 83, 9, 0.05)';
      ctx.beginPath();
      ctx.ellipse(300, 150, 180, 90, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(750, 420, 200, 100, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // 枯草木桩与拒马装饰
      ctx.fillStyle = '#78350f';
      const decorPosts = [
        { x: 120, y: 70 }, { x: 420, y: 380 }, { x: 500, y: 140 },
        { x: 780, y: 360 }, { x: 880, y: 520 }, { x: 200, y: 540 }
      ];
      decorPosts.forEach((post) => {
        ctx.fillRect(post.x, post.y, 4, 12);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(post.x - 3, post.y + 4, 10, 3);
      });
    } else if (this.stage.bgTheme === 'stone_fortress') {
      // 2. 虎牢雄关·青黑山石要塞
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGrad.addColorStop(0, '#1c2430');
      bgGrad.addColorStop(0.5, '#131922');
      bgGrad.addColorStop(1, '#0b0f16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 峡谷两侧黑石峭壁阴影
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(260, 0);
      ctx.lineTo(140, 280);
      ctx.lineTo(0, 320);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(canvas.width, canvas.height);
      ctx.lineTo(canvas.width - 240, canvas.height);
      ctx.lineTo(canvas.width - 150, canvas.height - 240);
      ctx.lineTo(canvas.width, canvas.height - 300);
      ctx.closePath();
      ctx.fill();

      // 烽火台烽烟轻雾（右上角）
      ctx.save();
      const smokeY = (time * 0.04) % 60;
      ctx.fillStyle = 'rgba(203, 213, 225, 0.12)';
      ctx.beginPath();
      ctx.arc(880, 80 - smokeY, 16 + smokeY * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // 3. 决战下邳·水淹七军护城泽国
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGrad.addColorStop(0, '#0c1a2e');
      bgGrad.addColorStop(0.5, '#081220');
      bgGrad.addColorStop(1, '#040913');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 荡漾水波光斑动画
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const waveOffset = Math.sin((time * 0.002) + i * 1.5) * 15;
        const cy = 100 + i * 110;
        ctx.beginPath();
        ctx.moveTo(50, cy + waveOffset);
        ctx.bezierCurveTo(300, cy - 20 + waveOffset, 600, cy + 20 + waveOffset, 950, cy + waveOffset);
        ctx.stroke();
      }

      // 芦苇丛生斑块
      ctx.fillStyle = 'rgba(22, 101, 52, 0.15)';
      ctx.beginPath();
      ctx.ellipse(360, 260, 90, 45, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(720, 160, 110, 50, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 细微战棋网格参考纹理
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  // 路线与古代营寨城楼渲染
  private renderPathAndGates(): void {
    const { ctx, stage } = this;
    if (stage.path.length < 2) return;
    const isWater = stage.bgTheme === 'water_margin';
    const isStone = stage.bgTheme === 'stone_fortress';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 兵道底层护基
    ctx.strokeStyle = isWater ? '#1e293b' : isStone ? '#334155' : '#78350f';
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.moveTo(stage.path[0].x, stage.path[0].y);
    for (let i = 1; i < stage.path.length; i++) {
      ctx.lineTo(stage.path[i].x, stage.path[i].y);
    }
    ctx.stroke();

    // 兵道主路面（水泽为栈道板、要塞为青石板、荒原为砂砾路）
    ctx.strokeStyle = isWater ? '#3b4252' : isStone ? '#1e293b' : '#451a03';
    ctx.lineWidth = 36;
    ctx.stroke();

    // 道路中央战马行军虚线
    ctx.strokeStyle = isWater ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.22)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 14]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制敌军寨门（出兵点）
    const startP = stage.path[0];
    ctx.save();
    ctx.translate(startP.x, startP.y);

    // 营门黑木牌坊
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-22, -18, 44, 36);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-20, -16, 40, 32);

    // 门顶黑瓦
    ctx.fillStyle = '#0c0a09';
    ctx.beginPath();
    ctx.moveTo(-26, -16);
    ctx.lineTo(0, -28);
    ctx.lineTo(26, -16);
    ctx.closePath();
    ctx.fill();

    // 门额与字号
    ctx.fillStyle = '#fef2f2';
    ctx.font = 'bold 12px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('敌寨', 0, 2);
    ctx.restore();

    // 绘制守关主帅大营（终点）
    const endP = stage.path[stage.path.length - 1];
    ctx.save();
    ctx.translate(endP.x, endP.y);

    // 中军大帐外营
    ctx.fillStyle = '#14532d';
    ctx.fillRect(-24, -20, 48, 40);
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(-22, -18, 44, 36);

    // 金黄帅帐顶盖与飞檐
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.moveTo(-30, -18);
    ctx.lineTo(0, -32);
    ctx.lineTo(30, -18);
    ctx.closePath();
    ctx.fill();

    // 帅印字样
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('主帅营', 0, 2);
    ctx.restore();
  }

  // 汉白玉雕花点将台基座渲染
  private renderTowerSlots(): void {
    const { ctx, stage } = this;
    const time = performance.now();
    const breathe = 0.3 + 0.18 * Math.sin(time * 0.004);

    stage.towerSlots.forEach((slot) => {
      const cx = slot.col * 50 + 25;
      const cy = slot.row * 50 + 25;
      const isOccupied = this.towers.some((t) => t.col === slot.col && t.row === slot.row);

      ctx.save();
      ctx.translate(cx, cy);

      if (isOccupied) {
        // 已驻扎名将：坚固青铜覆石底座
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-21, -21, 42, 42, 7);
        ctx.fill();
        ctx.stroke();

        // 四角铜钉加固
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-18, -18, 3, 3);
        ctx.fillRect(15, -18, 3, 3);
        ctx.fillRect(-18, 15, 3, 3);
        ctx.fillRect(15, 15, 3, 3);
      } else {
        // 空置点将台：汉白玉微雕八卦台 + 金色呼吸微光
        ctx.fillStyle = `rgba(217, 119, 6, ${breathe * 0.25})`;
        ctx.strokeStyle = `rgba(245, 158, 11, ${breathe + 0.3})`;
        ctx.lineWidth = 1.5;

        // 双层八角石台
        ctx.beginPath();
        ctx.roundRect(-20, -20, 40, 40, 6);
        ctx.fill();
        ctx.stroke();

        // 内层阵纹
        ctx.strokeStyle = `rgba(251, 191, 36, ${breathe * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(254, 243, 199, ${breathe + 0.5})`;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点将台', 0, 0);
      }

      ctx.restore();
    });
  }

  // 敌军渲染
  private renderEnemies(): void {
    const { ctx } = this;

    this.enemies.forEach((enemy) => {
      // 敌兵身体圆盘
      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // 受击/眩晕微震
      if (enemy.stunTimer > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(-enemy.size - 2, -enemy.size - 2, (enemy.size + 2) * 2, (enemy.size + 2) * 2);
      }

      // 检查是否有对应的敌人图片资源
      const enemyImg = this.imageCache.get(`enemy_${enemy.typeId}`);
      const hasImage = enemyImg && enemyImg.complete && enemyImg.naturalWidth > 0;

      // 绘制角色身体：带智能朝向翻转 (facingRight)
      ctx.save();
      if (enemy.facingRight === false) {
        // 向左行走时，水平镜像翻转
        ctx.scale(-1, 1);
      }

      if (hasImage) {
        // 图形渲染：boss稍放大，普通小兵适当比例，避免过小
        const renderSize = enemy.isBoss ? enemy.size * 2.8 : enemy.size * 2.5;
        // 如果是 boss，添加微光脚环
        if (enemy.isBoss) {
          ctx.beginPath();
          ctx.ellipse(0, enemy.size * 0.6, enemy.size * 1.1, enemy.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fill();
        }
        ctx.drawImage(enemyImg, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
      } else {
        // 优雅降级：经典古典印章
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();

        // 敌将单字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(enemy.size * 0.9)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(enemy.char, 0, 1);
      }
      ctx.restore();

      // 减速冰冻特效遮罩
      if (enemy.slowTimer > 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 灼烧烈焰特效提示
      if (enemy.burnTimer > 0) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 血条 (始终正向绘制，置于角色头顶)
      const barW = Math.max(28, enemy.size * 2 + 8);
      const barH = enemy.isBoss ? 6 : 4;
      const barY = -enemy.size * (enemy.isBoss ? 1.4 : 1.3) - 6;
      const hpPct = Math.max(0, enemy.hp / enemy.maxHp);

      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(-barW / 2, barY, barW, barH);

      ctx.fillStyle = enemy.isBoss ? '#ef4444' : hpPct > 0.4 ? '#22c55e' : '#f97316';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      // Boss 名字标签提示
      if (enemy.isBoss) {
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(enemy.name, 0, barY - 4);
      }

      ctx.restore();
    });
  }

  // 武将塔渲染
  private renderTowers(): void {
    const { ctx } = this;

    this.towers.forEach((tower) => {
      const hero = HEROES.find((h) => h.id === tower.heroId);
      if (!hero) return;

      const isSelected = this.selectedTower?.id === tower.id;

      // 如果选中，绘制金黄射程指示圈
      if (isSelected) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(tower.x, tower.y);

      // 武将底盘光圈
      ctx.fillStyle = hero.color;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // 朝向指针
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(tower.angle) * 22, Math.sin(tower.angle) * 22);
      ctx.stroke();

      // 检查待机与攻击姿态图片
      const isAttacking = (tower.attackAnimationTimer ?? 0) > 0;
      const attackImg = this.imageCache.get(`${hero.id}_attack`);
      const idleImg = this.imageCache.get(`${hero.id}_idle`);

      const hasAttackSprite = attackImg && attackImg.complete && attackImg.naturalWidth > 0;
      const hasIdleSprite = idleImg && idleImg.complete && idleImg.naturalWidth > 0;

      // 判断当前应该渲染哪个图片：攻击中且有攻击图优先攻击图，否则待机图
      const activeSprite = isAttacking && hasAttackSprite ? attackImg : hasIdleSprite ? idleImg : null;

      if (activeSprite) {
        // 根据武将索敌朝向（tower.angle）计算水平镜像（当目标在左侧时朝左镜像翻转）
        ctx.save();
        const isFacingLeft = Math.cos(tower.angle) < -0.1 && (tower.targetId !== null);
        if (isFacingLeft) {
          ctx.scale(-1, 1);
        }

        // 攻击姿态略微前倾放大提升打击感，整体尺寸大幅提升以清晰看清挥刀动作
        const spriteSize = isAttacking ? 86 : 74;
        const offsetY = isAttacking ? -12 : -10;

        ctx.drawImage(activeSprite, -spriteSize / 2, -spriteSize / 2 + offsetY, spriteSize, spriteSize);
        ctx.restore();
      } else {
        // 优雅降级方案：经典圆形将令头像
        const avatarImg = this.imageCache.get(hero.id);
        if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, -18, -18, 36, 36);
          ctx.restore();

          // 金色将令包边
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 武将将令字样
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hero.avatarChar, 0, 0);
        }
      }

      // 星级 ★ (位置略向下调，确保不被放大的武将身体遮挡)
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px serif';
      ctx.textAlign = 'center';
      const stars = '★'.repeat(tower.level);
      ctx.fillText(stars, 0, 30);

      // 武将生命值血条 (受创或选中时常驻显示)
      const hpPct = Math.max(0, tower.hp / (tower.maxHp || 700));
      const tBarW = 38;
      const tBarH = 4;
      const tBarY = -42;

      // 仅在非满血或倒下或选中时显示生命条
      if (hpPct < 0.99 || tower.isDown || isSelected) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-tBarW / 2, tBarY, tBarW, tBarH);

        ctx.fillStyle = tower.isDown ? '#94a3b8' : hpPct > 0.4 ? '#22c55e' : '#ef4444';
        ctx.fillRect(-tBarW / 2, tBarY, tBarW * hpPct, tBarH);

        // 边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-tBarW / 2, tBarY, tBarW, tBarH);
      }

      // 负伤休整中遮罩与倒计时标签
      if (tower.isDown) {
        // 灰色休整光罩
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.arc(0, -6, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f87171';
        ctx.fillText(`休整 ${Math.ceil(tower.recoveryTimer)}s`, 0, -48);
      }

      ctx.restore();
    });
  }

  // 弹道渲染
  private renderProjectiles(): void {
    const { ctx } = this;

    this.projectiles.forEach((p) => {
      ctx.save();
      if (p.type === 'arrow') {
        const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
      } else if (p.type === 'fireball') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'slash') {
        // 孙尚香百花缭乱·飞旋乾坤金轮
        ctx.translate(p.x, p.y);
        ctx.rotate(performance.now() * 0.015);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 金色轮刃风刺
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (p.radius * 0.4), Math.sin(a) * (p.radius * 0.4));
          ctx.lineTo(Math.cos(a) * (p.radius * 1.5), Math.sin(a) * (p.radius * 1.5));
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  }

  // 粒子渲染
  private renderParticles(): void {
    const { ctx } = this;

    this.particles.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }

  // 放置预览
  private renderPlacementPreview(): void {
    if (!this.placingHeroId || !this.mousePos) return;
    const hero = HEROES.find((h) => h.id === this.placingHeroId);
    if (!hero) return;

    const { ctx } = this;
    const col = Math.floor(this.mousePos.x / 50);
    const row = Math.floor(this.mousePos.y / 50);

    const isSlotValid = this.stage.towerSlots.some((s) => s.col === col && s.row === row);
    const isOccupied = this.towers.some((t) => t.col === col && t.row === row);
    const isAlreadyDeployed = this.towers.some((t) => t.heroId === this.placingHeroId);
    const canPlace = isSlotValid && !isOccupied && !isAlreadyDeployed && this.gold >= hero.cost;

    const cx = col * 50 + 25;
    const cy = row * 50 + 25;

    // 绘制射程圈
    ctx.strokeStyle = canPlace ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
    ctx.fillStyle = canPlace ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, hero.baseRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 预览图标
    const avatarImg = this.imageCache.get(hero.id);
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, cx - 18, cy - 18, 36, 36);
      ctx.restore();

      ctx.strokeStyle = canPlace ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = canPlace ? hero.color : 'rgba(239, 68, 68, 0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hero.avatarChar, cx, cy);
    }
  }

  // 飘字渲染
  private renderFloatingTexts(): void {
    const { ctx } = this;

    this.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `${ft.isCrit ? 'bold' : 'normal'} ${ft.fontSize}px serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 描边以凸显字体
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
    ctx.globalAlpha = 1.0;
  }

  // 渲染华丽名将战法与大魄力刀芒特效
  private renderVisualEffects(): void {
    const { ctx } = this;

    this.visualEffects.forEach((fx) => {
      const progress = fx.elapsed / fx.duration;
      const alpha = Math.max(0, 1 - progress);

      ctx.save();

      if (fx.type === 'crescent_slash') {
        // 1. 普通攻击超大弧月刀芒 (关羽/近战)
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);

        // 弧度展开扇面
        const startRad = -Math.PI * 0.42;
        const endRad = Math.PI * 0.42;
        const r = fx.radius * (0.8 + progress * 0.35);

        // 外层微光流光
        ctx.beginPath();
        ctx.arc(0, 0, r, startRad, endRad);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 14 * alpha;
        ctx.lineCap = 'round';
        ctx.globalAlpha = alpha * 0.55;
        ctx.stroke();

        // 核心高光白色炽刃
        ctx.beginPath();
        ctx.arc(0, 0, r, startRad + 0.1, endRad - 0.1);
        ctx.strokeStyle = fx.secondaryColor || '#ffffff';
        ctx.lineWidth = 6 * alpha;
        ctx.lineCap = 'round';
        ctx.globalAlpha = alpha * 0.95;
        ctx.stroke();

        // 弯月内部充盈微光
        ctx.beginPath();
        ctx.arc(0, 0, r, startRad, endRad);
        ctx.arc(0, 0, r * 0.65, endRad, startRad, true);
        ctx.closePath();
        ctx.fillStyle = fx.color;
        ctx.globalAlpha = alpha * 0.18;
        ctx.fill();
      } else if (fx.type === 'guanyu_dragon') {
        // 2. 关羽大招【青龙偃月斩】：呼啸而出的贯穿青龙烈风狂岚
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);

        const dist = 220 * progress;
        const width = 120 + progress * 40;

        // 破地狂岚
        const grad = ctx.createLinearGradient(dist - 60, 0, dist + 90, 0);
        grad.addColorStop(0, 'rgba(34, 197, 94, 0)');
        grad.addColorStop(0.5, `rgba(74, 222, 128, ${alpha * 0.85})`);
        grad.addColorStop(0.9, `rgba(240, 253, 244, ${alpha * 0.95})`);
        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');

        // 龙首破空巨型月牙
        ctx.beginPath();
        ctx.ellipse(dist, 0, 75, width / 2, 0, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(dist - 35, 0, 45, width * 0.35, 0, Math.PI / 2, -Math.PI / 2, true);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 青龙战气龙纹金光刃线
        ctx.beginPath();
        ctx.arc(dist, 0, width / 2, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 7 * alpha;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 龙形青炎飞散
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 16 * alpha;
        ctx.globalAlpha = alpha * 0.4;
        ctx.stroke();
      } else if (fx.type === 'zhangfei_shock') {
        // 3. 张飞大招【当阳怒吼】：三重断桥裂地震荡波
        ctx.translate(fx.x, fx.y);
        const curR = fx.radius * Math.min(1, progress * 1.3);

        // 外层震波
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 8 * alpha;
        ctx.globalAlpha = alpha * 0.85;
        ctx.stroke();

        // 中层紫电雷霆圈
        if (curR > 30) {
          ctx.beginPath();
          ctx.arc(0, 0, curR * 0.72, 0, Math.PI * 2);
          ctx.strokeStyle = fx.secondaryColor || '#a855f7';
          ctx.lineWidth = 6 * alpha;
          ctx.globalAlpha = alpha * 0.75;
          ctx.stroke();
        }

        // 核心碎石波纹
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
        ctx.globalAlpha = alpha * 0.4;
        ctx.fill();
      } else if (fx.type === 'zhuge_lightning') {
        // 4. 诸葛亮大招【八卦神雷阵】：八卦阵盘与天顶九天神雷
        ctx.translate(fx.x, fx.y);
        const r = fx.radius * 0.75;

        // 旋转八卦太极阵盘
        ctx.rotate(progress * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha * 0.85;
        ctx.stroke();

        // 太极阴阳双鱼
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 炽白贯天落雷光柱
        ctx.rotate(-progress * 1.5);
        const boltAlpha = Math.sin(progress * Math.PI) * 0.95;
        ctx.globalAlpha = boltAlpha;

        const lightningGrad = ctx.createLinearGradient(0, -280, 0, 0);
        lightningGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        lightningGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.6)');
        lightningGrad.addColorStop(1, 'rgba(255, 255, 255, 1)');

        ctx.fillStyle = lightningGrad;
        ctx.fillRect(-18, -280, 36, 280);

        // 雷暴落地点光晕
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.fill();
      } else if (fx.type === 'zhouyu_firestorm') {
        // 5. 周瑜大招【火烧赤壁】：赤壁业火凤凰
        ctx.translate(fx.x, fx.y);
        const r = fx.radius * (0.6 + progress * 0.5);

        // 业火火海
        const fireGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, r);
        fireGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
        fireGrad.addColorStop(0.4, `rgba(239, 68, 68, ${alpha * 0.8})`);
        fireGrad.addColorStop(0.8, `rgba(249, 115, 22, ${alpha * 0.5})`);
        fireGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = fireGrad;
        ctx.fill();

        // 烈焰凤凰展翅光刃
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4 * alpha;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
      } else if (fx.type === 'zhaoyun_spear_storm') {
        // 6. 赵云大招【龙胆破军】：疾风暴雨枪芒
        ctx.translate(fx.x, fx.y);
        ctx.rotate(fx.angle);

        const spearLen = 140 * (0.5 + progress * 0.6);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 4 * alpha;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(spearLen, 0);
        ctx.stroke();

        // 枪头银龙高光
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(spearLen, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.type === 'caocao_imperial') {
        // 7. 曹操大招【短歌行·对酒当歌】：全场帝王八荒战阵与魏武金龙光晕
        ctx.translate(fx.x, fx.y);
        const curR = fx.radius * Math.min(1, progress * 1.5);

        // 外层帝王金环
        ctx.beginPath();
        ctx.arc(0, 0, curR, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 10 * alpha;
        ctx.globalAlpha = alpha * 0.85;
        ctx.stroke();

        // 旋转八荒阵纹
        ctx.rotate(progress * 0.8);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (curR * 0.2), Math.sin(a) * (curR * 0.2));
          ctx.lineTo(Math.cos(a) * curR, Math.sin(a) * curR);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2.5 * alpha;
          ctx.stroke();
        }

        // 核心紫金王气光柱
        ctx.rotate(-progress * 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, curR * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.fill();

        // 帝王金色将令光盾
        ctx.beginPath();
        ctx.arc(0, 0, 55, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4 * alpha;
        ctx.stroke();
      } else if (fx.type === 'sunshangxiang_blossom') {
        // 8. 孙尚香大招【百花缭乱·漫天花雨】：绽放粉红与火红烈焰飞轮莲华
        ctx.translate(fx.x, fx.y);
        const r = fx.radius * Math.min(1, progress * 1.4);

        // 极速旋转的漫天莲华飞刃
        ctx.rotate(progress * 4.5);

        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * (r * 0.55), Math.sin(a) * (r * 0.55), r * 0.45, r * 0.18, a, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? `rgba(236, 72, 153, ${alpha * 0.65})` : `rgba(244, 63, 94, ${alpha * 0.65})`;
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2 * alpha;
          ctx.stroke();
        }

        // 核心花蕊火轮
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 6 * alpha;
        ctx.stroke();
      } else if (fx.type === 'liubei_benevolence') {
        // 9. 刘备大招【仁德昭天】：全场桃园结义金绿甘霖法阵
        ctx.translate(fx.x, fx.y);
        const r = fx.radius * Math.min(1, progress * 1.6);

        // 柔和翡翠金绿甘霖光晕
        const benevGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, r);
        benevGrad.addColorStop(0, `rgba(134, 239, 172, ${alpha * 0.5})`);
        benevGrad.addColorStop(0.5, `rgba(34, 197, 94, ${alpha * 0.3})`);
        benevGrad.addColorStop(0.85, `rgba(250, 204, 21, ${alpha * 0.2})`);
        benevGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = benevGrad;
        ctx.fill();

        // 旋转桃园金龙护体灵环
        ctx.rotate(-progress * 1.2);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4 * alpha;
        ctx.stroke();

        // 仁德金芒外环
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5 * alpha;
        ctx.stroke();
      } else if (fx.type === 'huatuo_healing') {
        // 10. 华佗大招【青囊回春】：青翠药阵灵芝符印与回春神光
        ctx.translate(fx.x, fx.y);
        const r = fx.radius * (0.6 + progress * 0.45);

        // 药圣清灵翡翠水波
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 191, ${alpha * 0.28})`;
        ctx.fill();
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 3.5 * alpha;
        ctx.stroke();

        // 内层青囊灵符六角星芒阵
        ctx.rotate(progress * 1.8);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * (r * 0.85), Math.sin(a) * (r * 0.85));
          ctx.strokeStyle = '#99f6e4';
          ctx.lineWidth = 2 * alpha;
          ctx.stroke();
        }

        // 核心灵药鼎光印
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(204, 251, 241, ${alpha * 0.6})`;
        ctx.fill();
      }

      ctx.restore();
    });
  }
}
