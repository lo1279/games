import React from 'react';
import { HeroConfig } from '../types/game';
import {
  X,
  Swords,
  Target,
  Zap,
  Heart,
  Sparkles,
  Coins,
  Shield,
  Info,
  Award,
} from 'lucide-react';

interface HeroDetailModalProps {
  hero: HeroConfig | null;
  gold: number;
  isDeployed: boolean;
  onClose: () => void;
  onDeploy: (heroId: string) => void;
}

export const HeroDetailModal: React.FC<HeroDetailModalProps> = ({
  hero,
  gold,
  isDeployed,
  onClose,
  onDeploy,
}) => {
  if (!hero) return null;

  const isAffordable = gold >= hero.cost;

  // 阵营信息映射
  const campMap: Record<
    string,
    { name: string; badgeClass: string; desc: string }
  > = {
    shu: {
      name: '蜀汉',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60',
      desc: '仁德昭烈，义薄云天。善于强化自身攻势与团队协作。',
    },
    wei: {
      name: '曹魏',
      badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-600/60',
      desc: '号令天下，唯才是举。具备强力的军心激励与控制奇效。',
    },
    wu: {
      name: '东吴',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-600/60',
      desc: '据守江东，水火莫测。擅长远程压制与烈焰灼烧。',
    },
    qun: {
      name: '群雄',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
      desc: '悬壶济世，乱世隐者。拥有逆转战局的神医与玄妙特技。',
    },
  };

  // 职业定位映射
  const roleMap: Record<
    string,
    { title: string; tag: string; tagClass: string; desc: string }
  > = {
    warrior: {
      title: '猛将',
      tag: '近战肉搏 / 顺劈强控',
      tagClass: 'bg-red-950/70 text-red-300 border-red-700/50',
      desc: '身先士卒，生命值雄厚，手握神兵拥有范围顺劈或强击退眩晕，为防线中流砥柱。',
    },
    archer: {
      title: '神射',
      tag: '超远狙击 / 连射破甲',
      tagClass: 'bg-orange-950/70 text-orange-300 border-orange-700/50',
      desc: '百步穿杨，拥有全场最远射程与高速连射，专克敌军急先锋与高防单位。',
    },
    strategist: {
      title: '军师',
      tag: '法术奇策 / 范围群伤',
      tagClass: 'bg-blue-950/70 text-blue-300 border-blue-700/50',
      desc: '通晓阴阳，呼风唤雨。技能具有大范围法术伤害与强力减速冰冻，善扫荡敌军大潮。',
    },
    support: {
      title: '辅助',
      tag: '全军庇护 / 治愈回春',
      tagClass: 'bg-teal-950/70 text-teal-300 border-teal-700/50',
      desc: '仁德布泽，济世安民。常驻全军增益光环并提供战地治疗急救，极大提高前排生存率。',
    },
  };

  const campInfo = campMap[hero.camp] || campMap.shu;
  const roleInfo = roleMap[hero.role] || roleMap.warrior;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-stone-900 border-2 border-amber-600/60 rounded-2xl shadow-2xl overflow-hidden text-stone-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 35px rgba(217, 119, 6, 0.25)',
        }}
      >
        {/* 顶部背景装饰横幅 */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border-b border-amber-900/50 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* 头像与外边框 */}
            <div
              className="w-16 h-16 rounded-xl border-2 border-amber-400/80 overflow-hidden flex items-center justify-center font-bold text-2xl shadow-lg shrink-0 relative bg-stone-950"
              style={{
                backgroundColor: hero.color,
                boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)',
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

            {/* 名字、称号与标签 */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-amber-200 tracking-wide">
                  {hero.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium border ${campInfo.badgeClass}`}
                >
                  {campInfo.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium border ${roleInfo.tagClass}`}
                >
                  {roleInfo.title}
                </span>
              </div>
              <div className="text-xs text-amber-400/90 font-medium mt-1">
                {hero.title}
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {roleInfo.tag}
              </div>
            </div>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition"
            title="关闭窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* 详细属性内容区域 */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* 四大核心战斗数值网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 基础伤害 */}
            <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-rose-400 text-xs font-semibold mb-1">
                <Swords size={13} />
                <span>基础攻击</span>
              </div>
              <span className="text-lg font-extrabold text-rose-300">
                {hero.baseDamage}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">单发威能</span>
            </div>

            {/* 攻击范围 */}
            <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-sky-400 text-xs font-semibold mb-1">
                <Target size={13} />
                <span>警戒射程</span>
              </div>
              <span className="text-lg font-extrabold text-sky-300">
                {hero.baseRange}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">视野半径</span>
            </div>

            {/* 攻击间隔 */}
            <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold mb-1">
                <Zap size={13} />
                <span>出手间隔</span>
              </div>
              <span className="text-lg font-extrabold text-amber-300">
                {hero.baseAttackInterval}s
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                {(1 / hero.baseAttackInterval).toFixed(1)} 次/秒
              </span>
            </div>

            {/* 基础生命 */}
            <div className="bg-stone-950/70 p-2.5 rounded-xl border border-stone-800 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold mb-1">
                <Heart size={13} />
                <span>体力上限</span>
              </div>
              <span className="text-lg font-extrabold text-emerald-300">
                {hero.baseHp || 750}
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">承伤韧性</span>
            </div>
          </div>

          {/* 武将定位与兵种特性说明 */}
          <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800/90 text-xs leading-relaxed">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1.5">
              <Shield size={14} />
              <span>武将定位与战术价值</span>
            </div>
            <p className="text-stone-300">{hero.description}</p>
            <p className="text-stone-400 text-[11px] mt-1.5 pt-1.5 border-t border-stone-800/80">
              {roleInfo.desc}
            </p>
          </div>

          {/* 专属战法绝技卡片 */}
          <div className="bg-gradient-to-br from-amber-950/30 to-stone-950 p-3.5 rounded-xl border border-amber-600/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                <span>专属战法：【{hero.skillName}】</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-700/60 font-medium">
                冷却：{hero.skillCooldown} 秒
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              {hero.skillDesc}
            </p>
          </div>

          {/* 阵营羁绊特性说明 */}
          <div className="bg-stone-950/40 p-3 rounded-lg border border-stone-800/60 flex items-start gap-2 text-[11px] text-stone-400">
            <Info size={14} className="text-stone-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-stone-300 font-medium">{campInfo.name}特质：</span>
              <span>{campInfo.desc}</span>
            </div>
          </div>
        </div>

        {/* 底部部署行动栏 */}
        <div className="p-4 bg-stone-950/90 border-t border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">招募消耗:</span>
            <div className="flex items-center gap-1">
              <Coins size={15} className="text-amber-400" />
              <span
                className={`text-base font-extrabold ${
                  isAffordable ? 'text-amber-300' : 'text-stone-500'
                }`}
              >
                {hero.cost} 铜钱
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
            >
              返回
            </button>

            {isDeployed ? (
              <button
                disabled
                className="px-4 py-1.5 rounded-lg text-xs bg-stone-800/80 text-stone-500 border border-stone-700/50 cursor-not-allowed font-medium"
              >
                已在阵中
              </button>
            ) : (
              <button
                onClick={() => {
                  if (isAffordable) {
                    onDeploy(hero.id);
                    onClose();
                  }
                }}
                disabled={!isAffordable}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow ${
                  isAffordable
                    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-amber-600/30 cursor-pointer active:scale-95'
                    : 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed'
                }`}
              >
                <Award size={14} />
                <span>{isAffordable ? '立即招募出战' : '铜钱不足'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
