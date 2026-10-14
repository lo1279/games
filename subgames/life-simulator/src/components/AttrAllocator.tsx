import React, { useState } from 'react';
import type { Talent } from '../types/game';
import { Sparkles, Dice5, User, Plus, Minus, ArrowLeft } from 'lucide-react';

interface AttrAllocatorProps {
  selectedTalents: Talent[];
  totalPoints?: number;
  onBack: () => void;
  onStartLife: (
    allocated: { charm: number; intelligence: number; strength: number; wealth: number },
    name: string,
    gender: '男' | '女'
  ) => void;
}

const RANDOM_NAMES = [
  '林清玄', '陆子安', '苏青禾', '沈知意', '江澄', '陈墨', '顾北辰', '温如玉', '白洛衡', '谢长风',
  '姜云锦', '叶晚秋', '宋雨薇', '许梦然', '黎语嫣', '乔雪见', '赵凌月', '钟灵毓', '秦初夏', '楚千寻'
];

export const AttrAllocator: React.FC<AttrAllocatorProps> = ({
  selectedTalents,
  totalPoints = 20,
  onBack,
  onStartLife,
}) => {
  const [name, setName] = useState(
    () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
  );
  const [gender, setGender] = useState<'男' | '女'>('男');

  const [alloc, setAlloc] = useState({
    charm: 5,
    intelligence: 5,
    strength: 5,
    wealth: 5,
  });

  // 计算天赋带来的初始加成
  const talentBonus = selectedTalents.reduce(
    (acc, t) => {
      if (t.statBonus) {
        acc.charm += t.statBonus.charm || 0;
        acc.intelligence += t.statBonus.intelligence || 0;
        acc.strength += t.statBonus.strength || 0;
        acc.wealth += t.statBonus.wealth || 0;
      }
      return acc;
    },
    { charm: 0, intelligence: 0, strength: 0, wealth: 0 }
  );

  const usedPoints = alloc.charm + alloc.intelligence + alloc.strength + alloc.wealth;
  const remainingPoints = totalPoints - usedPoints;

  const handleAdjust = (key: keyof typeof alloc, delta: number) => {
    if (delta > 0 && remainingPoints <= 0) return;
    if (delta < 0 && alloc[key] <= 0) return;
    setAlloc((prev) => ({ ...prev, [key]: prev[key] + delta }));
  };

  const handleRandomizeAlloc = () => {
    let left = totalPoints;
    const keys: (keyof typeof alloc)[] = ['charm', 'intelligence', 'strength', 'wealth'];
    const newAlloc = { charm: 0, intelligence: 0, strength: 0, wealth: 0 };

    for (let i = 0; i < keys.length - 1; i++) {
      const take = Math.floor(Math.random() * (left / 2 + 3));
      newAlloc[keys[i]] = take;
      left -= take;
    }
    newAlloc[keys[keys.length - 1]] = Math.max(0, left);
    setAlloc(newAlloc);
  };

  const handleRandomName = () => {
    const rName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setName(rName);
  };

  const statsMeta = [
    {
      key: 'charm' as const,
      label: '颜值魅力',
      desc: '影响人际关系、演艺星途与异性吸引力',
      color: 'text-pink-400',
    },
    {
      key: 'intelligence' as const,
      label: '智商才智',
      desc: '影响高考升学、科研攻关与高智商职业',
      color: 'text-cyan-400',
    },
    {
      key: 'strength' as const,
      label: '体质健康',
      desc: '抵御急症与疾病，长寿与运动关键',
      color: 'text-emerald-400',
    },
    {
      key: 'wealth' as const,
      label: '家境财富',
      desc: '开局家庭扶持与成长资源优势',
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-2xl mx-auto overflow-hidden">
      {/* 滚动内容区域 */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-4 overscroll-contain">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">转生加点</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            设定身份并自由分配 <span className="text-indigo-400 font-bold">{totalPoints}</span> 点初始天赋点数
          </p>
        </div>

        {/* 角色基础身份设定 */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 sm:space-y-4 shadow-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>角色姓名</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  maxLength={8}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 font-medium"
                />
                <button
                  type="button"
                  onClick={handleRandomName}
                  title="随机姓名"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                >
                  <Dice5 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">生理性别</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('男')}
                  className={`py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 cursor-pointer ${
                    gender === '男'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-xs'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  ♂ 男孩
                </button>
                <button
                  type="button"
                  onClick={() => setGender('女')}
                  className={`py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 cursor-pointer ${
                    gender === '女'
                      ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow-xs'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  ♀ 女孩
                </button>
              </div>
            </div>
          </div>

          {/* 携带的天赋预览 */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium mr-1.5">携带天赋:</span>
            <div className="inline-flex flex-wrap gap-1 mt-1">
              {selectedTalents.map((t) => (
                <span
                  key={t.id}
                  className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 属性点分配卡片 */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs sm:text-sm font-semibold text-slate-300">属性分配</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-medium text-slate-400">
                可用点数：
                <span
                  className={`font-extrabold text-sm sm:text-base ml-1 ${
                    remainingPoints === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {remainingPoints}
                </span>
              </span>

              <button
                onClick={handleRandomizeAlloc}
                className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Dice5 className="w-3.5 h-3.5" />
                <span>一键加点</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-0.5">
            {statsMeta.map(({ key, label, desc, color }) => {
              const baseVal = alloc[key];
              const bonus = talentBonus[key];
              const total = Math.max(0, baseVal + bonus);

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-800/40 border border-slate-800"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className={`text-xs sm:text-sm font-bold shrink-0 ${color}`}>{label}</span>
                      <span className="text-xs font-semibold text-white truncate">
                        {total}
                        {bonus !== 0 && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({baseVal}{bonus > 0 ? `+${bonus}` : `-${Math.abs(bonus)}`})
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {desc}
                      {key === 'strength' && total < 5 && (
                        <span className="text-emerald-400 ml-1">（保底 5 点）</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      onClick={() => handleAdjust(key, -1)}
                      disabled={baseVal <= 0}
                      className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center border border-slate-700 transition-all cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-5 text-center font-bold text-xs sm:text-sm text-slate-100">{baseVal}</span>
                    <button
                      onClick={() => handleAdjust(key, 1)}
                      disabled={remainingPoints <= 0}
                      className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center border border-slate-700 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部吸底操作栏 (支持全面屏安全区) */}
      <div className="shrink-0 backdrop-blur-md bg-slate-900/95 border-t border-slate-800 px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shadow-xl">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700 transition-all cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>重选天赋</span>
        </button>

        <button
          disabled={remainingPoints > 0}
          onClick={() => onStartLife(alloc, name.trim() || '李逍遥', gender)}
          className={`flex-1 sm:flex-none px-4 sm:px-8 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 text-center ${
            remainingPoints === 0
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-500/25 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {remainingPoints > 0 ? `剩 ${remainingPoints} 点未分` : '开启新的人生之旅 🚀'}
        </button>
      </div>
    </div>
  );
};
