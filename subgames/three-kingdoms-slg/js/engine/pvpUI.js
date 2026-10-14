/**
 * 排位赛（天梯）UI 控制器
 *
 * 三个页签：
 *  - 排位赛：我的段位卡 + 挂载出战队伍 + 开始匹配（随机同段位对手，自动出战）
 *  - 天梯榜：按积分降序的 Top 50（仅统计已挂载队伍的玩家）
 *  - 我的战绩：我发起与被挑战的全部对局，含每场积分变动与可展开战报
 *
 * 依赖边界：只调用 cloud.js（API 层）、pvp.js（标准化与段位纯函数）、
 * pvpBattle.js（种子化推演与校验）、storage.js（挂载索引落本地）；
 * 所有网络与推演失败均已兜底并给出可读提示，绝不抛到调用方。
 */

import {
  isCloudAvailable,
  isSignedIn,
  getCurrentSession,
  getMyProfile,
  findRankedOpponent,
  getRankedBoard,
  getMyRank,
  getProfileById,
  listMyBattles,
  createBattle,
  markBattleSeen,
  postFormation,
  unpostFormation,
} from './cloud.js';
import {
  TIER_LIST,
  tierOf,
  tierByKey,
  pointsToNextTier,
  buildPostedFormation,
  computeRankedPower,
} from './pvp.js';
import { resolvePvpResult, verifyBattleResult } from './pvpBattle.js';
import { makeReport, appendReport } from './report.js';
import { saveGameState } from './storage.js';
import { ARMS } from '../data/generals.js';

/** 单场积分：胜 / 平 / 负（与数据库触发器 apply_pvp_points 中的取值必须一致） */
const PTS_WIN = 25;
const PTS_DRAW = 5;
const PTS_LOSS = -20;

let _game = null;
let _profile = null;    // 我的云端资料（积分/段位/战绩/挂载阵型）
let _battles = [];
let _matching = false;
let _myRank = null;     // 我的天梯名次（仅在切到天梯榜页签时查询）
const _nickCache = new Map();

const ARM_LABEL = (arm) => (ARMS?.[arm]?.icon || '') + (ARMS?.[arm]?.name || arm || '—');

function $(id) { return document.getElementById(id); }

/** HTML 转义，防止昵称等用户可控内容注入 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function setStatus(msg, isError = false) {
  const el = $('pvpStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-error', isError);
  el.classList.toggle('is-ok', !isError && !!msg);
}

function showToast(msg, isError = false) {
  let el = $('pvpToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pvpToast';
    el.className = 'cloud-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('is-error', isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ============ 段位徽章（九阶） ============

/**
 * 九阶纹章片段（局部坐标 60×58；INK 会被替换为该段位主色）。
 * 与 TIER_LIST[].emblem 一一对应。
 */
const EMBLEMS = {
  // 初入茅庐 · 茅草嫩芽
  sprig: '<path d="M30 42 L30 22" fill="none" stroke="INK" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M30 32 q -9 -2 -12 -11 q 10 0 12 7 z" fill="INK"/>'
    + '<path d="M30 37 q 9 -2 12 -11 q -10 0 -12 7 z" fill="INK"/>',
  // 崭露头角 · 破土笋尖
  sprout: '<path d="M30 17 L39 36 L30 32 L21 36 Z" fill="INK"/>',
  // 脱颖而出 · 三柱中立柱最高
  pillars: '<rect x="17" y="31" width="6" height="13" fill="INK"/>'
    + '<rect x="27" y="17" width="6" height="27" fill="INK"/>'
    + '<rect x="37" y="31" width="6" height="13" fill="INK"/>',
  // 声名鹊起 · 声波扩散
  sonar: '<circle cx="30" cy="24" r="3" fill="INK"/>'
    + '<path d="M20 31 A14 14 0 0 1 40 31" fill="none" stroke="INK" stroke-width="2"/>'
    + '<path d="M15 35 A20 20 0 0 1 45 35" fill="none" stroke="INK" stroke-width="2"/>'
    + '<path d="M10 39 A26 26 0 0 1 50 39" fill="none" stroke="INK" stroke-width="2"/>',
  // 如雷贯耳 · 雷霆折线
  bolt: '<path d="M32 16 L21 31 L29 31 L26 45 L39 28 L31 28 Z" fill="INK"/>',
  // 名震八方 · 中心向四方辐射
  radiant: '<path d="M30 15 L30 43" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M16 29 L44 29" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M20 19 L40 39" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M40 19 L20 39" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<circle cx="30" cy="29" r="4" fill="INK"/>',
  // 威震四海 · 三重海浪
  waves: '<path d="M12 21 q4.5 -7 9 0 q4.5 7 9 0 q4.5 -7 9 0" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M12 29 q4.5 -7 9 0 q4.5 7 9 0 q4.5 -7 9 0" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M12 37 q4.5 -7 9 0 q4.5 7 9 0 q4.5 -7 9 0" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>',
  // 举世闻名 · 地球经纬
  globe: '<circle cx="30" cy="29" r="13" fill="none" stroke="INK" stroke-width="2"/>'
    + '<ellipse cx="30" cy="29" rx="5" ry="13" fill="none" stroke="INK" stroke-width="2"/>'
    + '<path d="M17 29 L43 29" fill="none" stroke="INK" stroke-width="2"/>',
  // 震古烁今 · 星芒外环（唯一深底段）
  starburst: '<circle cx="30" cy="29" r="15" fill="none" stroke="INK" stroke-width="1.5"/>'
    + '<path d="M30 15 L30 43" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M16 29 L44 29" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M20 19 L40 39" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="M40 19 L20 39" fill="none" stroke="INK" stroke-width="2" stroke-linecap="round"/>'
    + '<circle cx="30" cy="29" r="4" fill="INK"/>',
};

/**
 * 渲染段位徽章。
 * @param {string} tierKey 段位 key
 * @param {number} size 宽度（px），高度按 60:58 比例
 * @returns {string} SVG 字符串
 */
function tierBadgeSvg(tierKey, size = 26) {
  const t = tierByKey(tierKey);
  const emb = EMBLEMS[t.emblem] || '';
  const h = Math.round(size * 58 / 60);
  return `<svg class="tier-badge" width="${size}" height="${h}" viewBox="0 0 60 58" role="img" aria-label="段位：${esc(t.name)}">`
    + `<path d="M1 1 L59 1 L59 36 Q59 52 30 57 Q1 52 1 36 Z" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2.5"/>`
    + emb.replace(/INK/g, t.ink)
    + '</svg>';
}

/** 「徽章 + 段位名 + 积分」组合（匹配结果里的对手条用） */
function tierTagHtml(tierKey, points, size = 20) {
  const t = tierByKey(tierKey);
  return `<span class="tier-tag">${tierBadgeSvg(tierKey, size)}`
    + `<span class="tier-tag-name" style="color:${t.ink}">${esc(t.name)}</span>`
    + (points != null ? `<span class="tier-tag-pts">${points} 分</span>` : '') + '</span>';
}

// ============ 弹窗与页签 ============

function openModal() {
  const m = $('pvpModal');
  if (!m) return;
  m.style.display = 'flex';
  setStatus('');
  if (!isSignedIn()) {
    $('pvpNeedLogin')?.style.setProperty('display', 'block');
    $('pvpMain')?.style.setProperty('display', 'none');
    return;
  }
  $('pvpNeedLogin')?.style.setProperty('display', 'none');
  $('pvpMain')?.style.setProperty('display', 'block');
  refreshAll();
}

function closeModal() {
  const m = $('pvpModal');
  if (m) m.style.display = 'none';
  setStatus('');
}

function switchTab(tab) {
  document.querySelectorAll('[data-pvp-tab]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-pvp-tab') === tab);
  });
  document.querySelectorAll('[data-pvp-pane]').forEach((p) => {
    p.style.display = (p.getAttribute('data-pvp-pane') === tab) ? 'block' : 'none';
  });
  if (tab === 'board') loadBoard();
  if (tab === 'records') loadRecords();
}

function myId() { return getCurrentSession()?.user?.id || null; }

// ============ 段位卡 ============

function renderTierCard() {
  const box = $('pvpTierCard');
  if (!box) return;
  const points = _profile?.points ?? 0;
  const tier = tierByKey(_profile?.tier) || tierOf(points);
  const nextTier = TIER_LIST[TIER_LIST.indexOf(tier) + 1] || null;
  const next = pointsToNextTier(points);
  const span = tier.max === Infinity ? 1 : Math.max(1, tier.max - tier.min);
  const progress = tier.max === Infinity ? 100 : Math.min(100, Math.round(((points - tier.min) / span) * 100));
  const w = _profile?.wins ?? 0;
  const l = _profile?.losses ?? 0;
  const d = _profile?.draws ?? 0;
  const rate = (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0;

  let rankHtml;
  if (!_profile?.posted_formation) rankHtml = '<span class="pvp-rank-none">未挂载队伍</span>';
  else if (_myRank == null) rankHtml = '<span class="pvp-rank-none">查看天梯榜可知名次</span>';
  else rankHtml = `<span class="pvp-rank-no">第 ${_myRank} 名</span>`;

  box.innerHTML = `
    <div class="pvp-tier-head">
      ${tierBadgeSvg(tier.key, 46)}
      <div class="pvp-tier-info">
        <div class="pvp-tier-name" style="color:${tier.ink}">${esc(tier.name)}</div>
        <div class="pvp-tier-pts">${points}<span class="unit"> 分</span></div>
      </div>
      <div class="pvp-tier-rank">${rankHtml}</div>
    </div>
    <div class="pvp-tier-bar"><div class="pvp-tier-bar-fill" style="width:${progress}%;background:${tier.stroke}"></div></div>
    <div class="pvp-tier-next">${next == null
      ? '已达最高段位 · 震古烁今无上限'
      : `距「${esc(nextTier ? nextTier.name : '下一段')}」还差 <b>${next}</b> 分`}</div>
    <div class="pvp-tier-rec">
      <span><b class="win">${w}</b> 胜</span><span><b class="lose">${l}</b> 负</span><span><b>${d}</b> 平</span>
      <span class="pvp-winrate">胜率 ${rate}%</span>
    </div>`;
}

// ============ 挂载出战队伍 ============

function renderTroopSelect() {
  const troops = _game?.state?.troops || [];
  const sel = $('pvpPostTroop');
  if (!sel) return;
  sel.innerHTML = troops.map((t, i) => {
    const n = (t?.heroes || []).length;
    return `<option value="${i}">第${i + 1}军团 · ${ARM_LABEL(t?.arm)} · ${n}将</option>`;
  }).join('');
  const idx = _game?.state?.postedTroopIndex;
  sel.value = String(idx != null ? idx : (_game?.state?.currentTroopIndex || 0));
}

function currentPostIdx() {
  const sel = $('pvpPostTroop');
  if (sel) return parseInt(sel.value || '0', 10);
  return _game?.state?.postedTroopIndex ?? _game?.state?.currentTroopIndex ?? 0;
}

/** 阵型摘要卡（title/sub 由调用方给，formation 为标准化阵型） */
function formationCardHtml({ title, sub, formation }) {
  if (!formation) return '<div class="pvp-card-empty">该军团未配置武将，请先前往【编队】配置</div>';
  const heroes = formation.heroes || [];
  const heroesHtml = heroes.map((h) => `
    <div class="pvp-hero">
      <span class="pvp-hero-star">${'★'.repeat(Math.min(5, h.star || 4))}</span>
      <span class="pvp-hero-name">${esc(h.name || '未知')}</span>
      <span class="pvp-hero-lv">Lv.${h.level || 1}</span>
      <span class="pvp-hero-sol">${(h.currentSoldiers || 0).toLocaleString()}兵</span>
    </div>`).join('');
  return `
    <div class="pvp-card-head">
      <div class="pvp-card-title">${title}</div>
      <div class="pvp-card-sub">${sub || ''}</div>
    </div>
    <div class="pvp-arm">兵种：${ARM_LABEL(formation.arm)}</div>
    <div class="pvp-heroes">${heroesHtml}</div>`;
}

function renderPostPreview() {
  const box = $('pvpPostPreview');
  if (!box) return;
  const f = buildPostedFormation(_game?.state, currentPostIdx());
  box.style.display = 'block';
  box.innerHTML = formationCardHtml({
    title: `挂载预览 · ${esc(f && f.name ? f.name : '')}`,
    sub: f ? `标准化战力 ${computeRankedPower(f).toLocaleString()}` : '',
    formation: f,
  });
  const posted = !!_profile?.posted_formation;
  const btnPost = $('btnPvpPost');
  const btnUnpost = $('btnPvpUnpost');
  if (btnPost) btnPost.textContent = posted ? '更新挂载队伍' : '挂载出战队伍';
  if (btnUnpost) btnUnpost.style.display = posted ? 'inline-flex' : 'none';
  syncMatchButton();
}

function syncMatchButton() {
  const btn = $('btnPvpMatch');
  if (!btn) return;
  const ready = !!_profile?.posted_formation;
  btn.disabled = !ready || _matching;
  btn.textContent = _matching ? '匹配中…' : '⚔️ 开始匹配';
  btn.title = ready ? '' : '请先挂载出战队伍';
}

async function doPost() {
  const idx = currentPostIdx();
  const f = buildPostedFormation(_game?.state, idx);
  if (!f) { setStatus('该军团未配置武将，无法挂载', true); return; }
  setStatus('挂载中…');
  // 先记进本地存档：即使云端写入失败，下次登录的自愈逻辑也能补挂
  _game.state.postedTroopIndex = idx;
  saveGameState(_game.state);
  const r = await postFormation(_game.state, idx);
  if (r?.error) { setStatus('挂载失败：' + (r.error.message || '请稍后重试'), true); return; }
  const { data } = await getMyProfile().catch(() => ({ data: null }));
  if (data) _profile = data;
  _myRank = null;
  renderPostPreview();
  renderTierCard();
  setStatus(`已挂载第${idx + 1}军团，同段位玩家即可匹配到你`);
  showToast('⚔️ 已挂载，进入匹配池');
}

async function doUnpost() {
  setStatus('撤下中…');
  const r = await unpostFormation();
  if (r?.error) { setStatus('撤下失败：' + (r.error.message || ''), true); return; }
  _game.state.postedTroopIndex = null;
  saveGameState(_game.state);
  const { data } = await getMyProfile().catch(() => ({ data: null }));
  if (data) _profile = data;
  _myRank = null;
  renderPostPreview();
  renderTierCard();
  setStatus('已撤下，你已退出匹配池与天梯榜（积分保留）');
  showToast('已撤下出战队伍');
}

// ============ 匹配与出战 ============

/** 共享种子：随机但随对战行落库，双方读取同一 seed 即可重算出同结果 */
function makeSeed() {
  return `pvp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** 按「我的视角」把 result 换算为积分增量 */
function pointsForMe(battle) {
  const me = myId();
  const iAmChallenger = battle.challenger_id === me;
  if (battle.result === 'draw') return PTS_DRAW;
  const won = battle.result === (iAmChallenger ? 'challenger' : 'defender');
  return won ? PTS_WIN : PTS_LOSS;
}

async function doMatch() {
  if (_matching) return;
  if (!_profile?.posted_formation) { setStatus('请先挂载出战队伍', true); return; }
  const mine = buildPostedFormation(_game?.state, _game.state.postedTroopIndex);
  if (!mine) { setStatus('挂载的队伍已失效（该军团已无武将），请重新挂载', true); return; }

  _matching = true;
  syncMatchButton();
  setStatus('正在匹配同段位对手…');

  try {
    const tierKey = _profile?.tier || tierOf(_profile?.points ?? 0).key;
    const { data: opp, scope, error } = await findRankedOpponent(tierKey);
    if (error) { setStatus('匹配失败：' + (error.message || '请稍后重试'), true); return; }
    if (!opp || !opp.posted_formation) {
      setStatus('匹配池为空——还没有其他玩家挂载出战队伍，请稍后再试', true);
      return;
    }

    setStatus('两军交战…');
    const seed = makeSeed();
    const { winner, report } = resolvePvpResult(mine, opp.posted_formation, seed);
    const { data: battle, error: insErr } = await createBattle({
      defenderId: opp.id,
      challengerFormation: mine,
      defenderFormation: opp.posted_formation,
      seed,
      result: winner,
      report,
      challengerPower: computeRankedPower(mine),
      defenderPower: opp.power || 0,
    });
    if (insErr || !battle) {
      setStatus('战报写入失败：' + ((insErr && insErr.message) || '未能读回记录'), true);
      return;
    }

    // 积分由数据库触发器结算完毕，重新拉资料以展示新积分与新段位
    const { data: fresh } = await getMyProfile().catch(() => ({ data: null }));
    if (fresh) _profile = fresh;
    const v = verifyBattleResult(battle);
    renderMatchResult(battle, opp, scope, v);
    renderTierCard();
    archiveLadderReport(battle, opp);
    setStatus(v.ok ? '对战结束，积分已由服务器结算' : '战报校验不一致，结果可能异常', !v.ok);
  } catch (e) {
    setStatus('对战异常：' + (e?.message || e), true);
  } finally {
    _matching = false;
    syncMatchButton();
    loadRecords({ silent: true });
  }
}

/**
 * 把天梯战报归档进「战报全书」（存档内的 battleReports，随整包存档跨设备同步）。
 * 战绩页只展示胜败与得分，完整战报统一到战报全书的「天梯」分类下查阅。
 */
function archiveLadderReport(battle, opp) {
  if (!_game?.state) return;
  const delta = pointsForMe(battle);
  const report = appendReport(_game.state, makeReport({
    category: 'ladder',
    // 标题只写模式名，对手名交给副标题与详情标题承载，避免出现「曹操 vs 曹操」
    title: '天梯对战',
    isVictory: delta > 0,
    summary: battle.report?.summary || {},
    logs: battle.report?.logs || [],
    extra: {
      selfName: _profile?.nickname || '我',
      opponentId: opp.id,
      opponentName: opp.nickname || '无名玩家',
      opponentTier: opp.tier,
      opponentTierName: tierByKey(opp.tier).name,
      pointsDelta: delta,
      seed: battle.seed,
      battleId: battle.id,
      scopeCrossTier: opp.tier !== (_profile?.tier || tierOf(_profile?.points ?? 0).key),
    },
  }));
  saveGameState(_game.state);
  // 若战报全书正开着，顺带刷新一次
  if (typeof _game.renderReports === 'function' && _game.reportFilter === 'ladder') _game.renderReports();
  return report;
}

function renderMatchResult(battle, opp, scope, verification) {
  const box = $('pvpMatchResult');
  if (!box || !battle) return;
  const s = battle.report?.summary || {};
  const delta = pointsForMe(battle);
  const afterPoints = _profile?.points ?? 0;
  const beforePoints = afterPoints - delta;
  const beforeTier = tierOf(beforePoints);
  const afterTier = tierByKey(_profile?.tier) || tierOf(afterPoints);
  const cls = delta > 0 ? 'win' : (delta < 0 ? 'lose' : 'draw');
  const label = delta > 0 ? '胜' : (delta < 0 ? '负' : '平');
  const scopeText = scope === 'same' ? '' : '<span class="pvp-scope">跨段位匹配</span>';

  box.style.display = 'block';
  box.innerHTML = `
    <div class="pvp-mr-opp">
      ${tierTagHtml(opp.tier, opp.points)}${scopeText}
      <span class="pvp-mr-opp-power">战力 ${(opp.power || 0).toLocaleString()}</span>
    </div>
    <div class="pvp-report-head ${cls}">
      <span class="pvp-report-badge">${label}</span>
      <span>回合 ${s.rounds || '—'} · 我方余兵 ${(Number(s.playerFinalSoldiers) || 0).toLocaleString()} · 敌方余兵 ${(Number(s.enemyFinalSoldiers) || 0).toLocaleString()}</span>
    </div>
    <div class="pvp-pts-delta ${cls}">
      积分 ${delta > 0 ? '+' : ''}${delta}
      <span class="pvp-pts-tot">${beforePoints} → ${afterPoints}</span>
      ${beforeTier.key !== afterTier.key ? `<span class="pvp-tier-chg">${delta > 0 ? '↑ 晋升' : '↓ 降段'}「${esc(afterTier.name)}」</span>` : ''}
    </div>
    <div class="pvp-report-verify ${verification?.ok ? 'ok' : 'warn'}">
      ${verification?.ok
        ? '✅ 战报可复现校验通过（同种子重算结果一致）'
        : `⚠️ 校验未通过：重算=${verification?.winner || '—'}，存储=${verification?.stored || battle.result || '—'}`}
    </div>
    <details class="pvp-report-logs">
      <summary>展开完整战报（${(battle.report?.logs || []).length} 条）</summary>
      <div class="pvp-log-list">${logsHtml(battle.report?.logs)}</div>
    </details>`;
}

function logsHtml(logs) {
  return (logs || []).slice(0, 300).map((l) => `<div class="pvp-log">[R${l.round}] ${esc(l.text || l.message || '')}</div>`).join('');
}

// ============ 天梯榜 ============

async function loadBoard() {
  const box = $('pvpBoardList');
  const rankBox = $('pvpMyRankRow');
  if (box) box.innerHTML = '<div class="pvp-loading">载入中…</div>';

  const { data, error } = await getRankedBoard(50);
  if (error) {
    if (box) box.innerHTML = `<div class="pvp-card-empty">天梯榜加载失败：${esc(error.message || '')}</div>`;
    return;
  }
  const list = data || [];
  const me = myId();
  if (box) {
    box.innerHTML = list.length === 0
      ? '<div class="pvp-card-empty">暂无玩家挂载出战队伍</div>'
      : list.map((p, i) => `
        <div class="pvp-row ${p.id === me ? 'is-me' : ''}">
          <span class="pvp-rank-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
          ${tierBadgeSvg(p.tier, 22)}
          <span class="pvp-row-name">${esc(p.nickname || '无名玩家')}${p.id === me ? '<span class="pvp-tag-me">我</span>' : ''}</span>
          <span class="pvp-row-tier" style="color:${tierByKey(p.tier).ink}">${esc(tierByKey(p.tier).name)}</span>
          <span class="pvp-row-pts">${p.points ?? 0}</span>
          <span class="pvp-row-power">${(p.power || 0).toLocaleString()}</span>
          <span class="pvp-row-rec">${p.wins || 0}胜 ${p.losses || 0}负</span>
        </div>`).join('');
  }

  const { data: rank } = await getMyRank().catch(() => ({ data: null }));
  _myRank = rank?.rank ?? null;
  if (rankBox) {
    rankBox.innerHTML = rank
      ? `<div class="pvp-my-rank-inner">
          ${tierBadgeSvg(_profile?.tier || tierOf(_profile?.points ?? 0).key, 20)}
          <span class="pvp-my-rank-name">我的名次</span>
          <span class="pvp-my-rank-no">第 ${rank.rank} 名</span>
          <span class="pvp-my-rank-pts">${rank.points} 分</span>
        </div>`
      : '<div class="pvp-my-rank-inner"><span class="pvp-rank-none">你尚未挂载出战队伍，不计入天梯榜</span></div>';
  }
  renderTierCard();
}

// ============ 战绩 ============

async function resolveNicknames(ids) {
  const need = [...new Set(ids.filter(Boolean))].filter((id) => !_nickCache.has(id));
  await Promise.all(need.map(async (id) => {
    try {
      const { data } = await getProfileById(id);
      _nickCache.set(id, data?.nickname || '无名玩家');
    } catch (e) {
      _nickCache.set(id, '未知玩家');
    }
  }));
}

async function loadRecords({ silent = false } = {}) {
  const { data, error } = await listMyBattles(50);
  if (error) {
    if (!silent) setStatus('战绩加载失败：' + (error.message || ''), true);
    return;
  }
  _battles = data || [];
  const me = myId();
  await resolveNicknames(_battles.map((b) => (b.challenger_id === me ? b.defender_id : b.challenger_id)));
  // 我作为防守方且尚未查看的对局标记已读（RLS 仅允许防守方更新）
  _battles.forEach((b) => {
    if (b.defender_id === me && !b.defender_seen) markBattleSeen(b.id).catch(() => {});
  });
  renderRecordList();
}

/**
 * 战绩列表：只展示「基础信息 + 积分」，完整战报一律去战报全书查阅。
 * 这是刻意的职责切分——战绩回答「我打了几场、赢了多少」，战报全书回答「那一场到底怎么打的」。
 */
function renderRecordList() {
  const box = $('pvpRecordList');
  if (!box) return;
  const me = myId();
  if (_battles.length === 0) { box.innerHTML = '<div class="pvp-card-empty">暂无对战记录</div>'; return; }
  box.innerHTML = _battles.map((b) => {
    const iAmChallenger = b.challenger_id === me;
    const otherId = iAmChallenger ? b.defender_id : b.challenger_id;
    const nick = _nickCache.get(otherId) || '未知玩家';
    const delta = pointsForMe(b);
    const cls = delta > 0 ? 'win' : (delta < 0 ? 'lose' : 'draw');
    const label = delta > 0 ? '胜' : (delta < 0 ? '负' : '平');
    return `
      <div class="pvp-record ${cls}">
        <div class="pvp-record-main">
          <span class="pvp-role ${iAmChallenger ? 'atk' : 'def'}">${iAmChallenger ? '我发起' : '被挑战'}</span>
          <span class="pvp-record-name">${esc(nick)}</span>
          <span class="pvp-outcome ${cls}">${label}</span>
          <span class="pvp-pts-chip ${cls}">${delta > 0 ? '+' : ''}${delta} 分</span>
          <span class="pvp-record-time">${fmtTime(b.created_at)}</span>
        </div>
        <div class="pvp-record-guide">
          完整战报（含逐回合战损与兵种克制过程）请前往底部导航
          <b>战报 → 天梯</b> 分类查看。
          <button class="pvp-guide-btn" data-report-id="${esc(String(b.seed || ''))}" type="button">前往战报全书 ›</button>
        </div>
      </div>`;
  }).join('');

  box.querySelectorAll('.pvp-guide-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal();
      // 切到战报全书并预筛到「天梯」分类
      if (typeof _game?.switchTab === 'function') _game.switchTab('tabReports');
      if (typeof _game?.setReportFilter === 'function') _game.setReportFilter('ladder');
      else if (typeof _game?.renderReports === 'function') _game.renderReports();
    });
  });
}

// ============ 刷新入口 ============

async function refreshAll() {
  try {
    const r = await getMyProfile();
    if (r.data) _profile = r.data;
  } catch (e) { /* 拉取失败不阻断，界面按 0 分兜底 */ }
  renderTroopSelect();
  renderPostPreview();
  renderTierCard();
  setStatus('');
}

// ============ 事件绑定 ============

function bindEvents(game) {
  _game = game;

  $('btnPvpOpen')?.addEventListener('click', openModal);
  $('btnPvpModalClose')?.addEventListener('click', closeModal);
  $('pvpModal')?.addEventListener('click', (e) => { if (e.target === $('pvpModal')) closeModal(); });

  $('btnPvpGotoLogin')?.addEventListener('click', () => {
    closeModal();
    $('btnCloudAccount')?.click();
  });

  document.querySelectorAll('[data-pvp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-pvp-tab')));
  });

  $('pvpPostTroop')?.addEventListener('change', renderPostPreview);
  $('btnPvpPost')?.addEventListener('click', doPost);
  $('btnPvpUnpost')?.addEventListener('click', doUnpost);
  $('btnPvpMatch')?.addEventListener('click', doMatch);
}

/**
 * 应用入口调用：绑定排位赛 UI 事件。
 * 云端不可用时隐藏入口（与云端存档按钮一致的整体降级策略，保留纯单机体验）。
 * @param {object} game GameApp 实例
 */
export function initPvpUI(game) {
  const btn = $('btnPvpOpen');
  if (!btn) return;
  try {
    if (!isCloudAvailable()) { btn.style.display = 'none'; return; }
  } catch (e) {
    btn.style.display = 'none';
    return;
  }
  bindEvents(game);
}
