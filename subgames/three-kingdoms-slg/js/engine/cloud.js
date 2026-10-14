/**
 * 三国志·战略版 - 云服务接入核心模块 (WorkBuddy Cloud Service)
 *
 * 职责：
 *  1. 初始化 WorkBuddyCloud 客户端（CDN 全局，纯 HTML 项目无打包器）；
 *  2. 封装端用户鉴权（登录 / 注册 / 登出 / 会话监听）；
 *  3. 封装云端存档读写（player_saves 表，owner_id 由 auth.uid() 服务端自动归属，RLS 隔离）。
 *
 * 设计约束（遵循 cloud-service skill）：
 *  - 仅下发 publicConfig 四项公开值，绝不持有任何密钥；
 *  - 所有调用 try/catch，失败返回 { error } 且不抛出，保证游戏本地逻辑不被打断；
 *  - 写入时永不在前端拼 owner_id（RLS 策略 + DEFAULT auth.uid() 双保险）。
 */

// 排位赛资料同步依赖的纯函数（标准阵型快照 + 标准化战力 + 段位表）
import { computeRankedPower, buildPostedFormation, TIER_LIST } from './pvp.js';

// 由 workbuddy_cloud_service 激活返回，以下四项为「可公开下发到前端」的唯一安全值。
// endpoint 为本应用发布域数据面，随发布固定，非硬编码猜测值。
const PUBLIC_CONFIG = {
  endpoint: 'https://sanguo-slg-53583.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_e4AAf18vVSyi8IVkeuxBLN_7wU0QnD8rWRxgK1KcNRPFDBYbrQoBgDy',
};

const TABLE_SAVES = 'player_saves';

let _cloud = null;          // 初始化后的客户端实例（懒加载）
let _session = null;        // 当前会话缓存
const _authListeners = [];  // 登录态变化订阅者

/**
 * 获取（懒初始化）云端客户端。
 * CDN 脚本在 <head> 中以经典脚本加载，会在 deferred 的 module 之前执行完毕，
 * 因此本函数被调用时 window.WorkBuddyCloud 必定已就绪；若 CDN 加载失败则优雅降级。
 * @returns {object|null}
 */
function getCloud() {
  if (_cloud) return _cloud;
  const W = typeof window !== 'undefined' ? window.WorkBuddyCloud : null;
  if (!W || typeof W.createWorkBuddyCloud !== 'function') {
    console.warn('[Cloud] SDK 未加载，云端功能不可用（游戏以本地模式继续运行）');
    return null;
  }
  _cloud = W.createWorkBuddyCloud({
    endpoint: PUBLIC_CONFIG.endpoint,
    oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
    publishableKey: PUBLIC_CONFIG.publishableKey,
  });
  return _cloud;
}

/** 云端 SDK 是否可用（用于 UI 决定展示登录入口） */
export function isCloudAvailable() {
  return !!getCloud();
}

/** 是否已登录 */
export function isSignedIn() {
  return !!_session;
}

/** 获取缓存会话 */
export function getCurrentSession() {
  return _session;
}

/** 订阅登录态变化，返回取消订阅函数 */
export function onAuthChange(cb) {
  if (typeof cb === 'function') _authListeners.push(cb);
  return () => {
    const i = _authListeners.indexOf(cb);
    if (i >= 0) _authListeners.splice(i, 1);
  };
}

function emitAuth() {
  _authListeners.forEach((cb) => {
    try { cb(_session); } catch (e) { /* 单个监听器异常不影响其余 */ }
  });
}

/**
 * 应用入口调用一次：预热会话并订阅变化。
 * 必须在调用任何受保护的数据读写之前执行。
 */
export async function initCloudAuth() {
  const cloud = getCloud();
  if (!cloud) return null;
  try {
    const { data } = await cloud.auth.getSession();
    _session = data || null;
  } catch (e) {
    _session = null;
  }
  // 会话变化监听（登录 / 登出 / 刷新）
  const unsub = cloud.auth.onAuthStateChange((event, session) => {
    _session = session || null;
    emitAuth();
  });
  // 保留句柄避免未使用告警（部分运行环境会回收匿名函数）
  if (typeof unsub !== 'function') { /* noop */ }
  return _session;
}

/** 获取当前登录用户信息（昵称/邮箱等），未登录返回 null */
export async function getCurrentUser() {
  const cloud = getCloud();
  if (!cloud || !_session) return null;
  const { data, error } = await cloud.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

// ===================== 鉴权操作 =====================

/** 邮箱 + 密码登录 */
export async function signInWithPassword(email, password) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  return cloud.auth.signInWithPassword({ email, password });
}

/**
 * 发送邮箱验证码（注册/登录共用）。
 * @returns {Promise<{verificationId:string, isExistingUser:boolean, error?:object}>}
 */
export async function sendEmailOtp(email) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  const { data, error } = await cloud.auth.sendOtp({ email });
  if (error) return { error };
  return {
    verificationId: data?.verificationId,
    isExistingUser: !!data?.isExistingUser,
  };
}

/**
 * 校验邮箱验证码；新用户需带 password 完成注册，老用户仅验证码即可登录。
 */
export async function verifyEmailOtp({ email, verificationId, isExistingUser, token, password }) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  return cloud.auth.verifyOtp({
    email,
    verificationId,
    isExistingUser,
    token,
    password: isExistingUser ? undefined : password,
  });
}

/**
 * 发送手机短信验证码。手机号按 SDK 要求原样传入（SDK 负责 +86 归一化）。
 * @returns {Promise<{verificationId:string, isExistingUser:boolean, error?:object}>}
 */
export async function sendPhoneOtp(phone) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  const { data, error } = await cloud.auth.sendOtp({ phone });
  if (error) return { error };
  return {
    verificationId: data?.verificationId,
    isExistingUser: !!data?.isExistingUser,
  };
}

/** 校验手机验证码完成登录（短信注册通常无密码）
 *  ⚠️ 必须把发送阶段拿到的 isExistingUser 透传给 SDK：
 *  SDK 据此区分「登录已存在账号」与「注册新账号」，缺省会被当作注册，
 *  已存在账号即报「用户已注册」。逻辑与 verifyEmailOtp 对齐。 */
export async function verifyPhoneOtp({ phone, verificationId, token, isExistingUser }) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  return cloud.auth.verifyOtp({ phone, verificationId, token, isExistingUser });
}

/** 登出 */
export async function signOut() {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  const res = await cloud.auth.signOut();
  _session = null;
  return res;
}

// ===================== 写入层：读-判-写（替代 upsert） =====================

/**
 * 统一的「读-判-写」助手：先按冲突列读一行，有则 update，无则 insert，再回读校验。
 *
 * ⚠️ 为什么弃用 upsert：
 * SDK 的 upsert 依赖 `Prefer: resolution=merge-duplicates` 与 `on_conflict` 查询参数
 * 来实现「冲突则更新」。实测该数据面网关并不保证透传这些写请求头——INSERT 能成功，
 * 但冲突行会被**静默丢弃**（不报错、不更新、返回空）。后果：
 *   - player_saves：只有第一次存档真正落库，之后所有存档都丢了；
 *   - profiles：只有昵称那次 INSERT 成功，后续更新全部丢失，
 *     玩家会因缺少挂载阵型而从匹配池与天梯榜中「消失」，且极难排查。
 * 因此改为不依赖 Prefer/on_conflict 的显式 insert / update，并用回读确认真的落库。
 *
 * @param {string} table 表名
 * @param {string} conflictCol 冲突列（player_saves→owner_id，profiles→id）
 * @param {string} conflictVal 冲突值（当前登录用户 id，绝不手拼他人值）
 * @param {object} fullRow 插入整行
 * @param {object} patch 更新字段（不含冲突列）
 * @returns {Promise<{data?:object|null, error?:object, verified?:boolean, mode?:'insert'|'update'}>}
 */
async function writeRow(table, conflictCol, conflictVal, fullRow, patch) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  if (!_session?.user?.id) return { error: { message: '未登录' } };
  try {
    const { data: existing, error: readErr } = await cloud.database
      .from(table).select('*').eq(conflictCol, conflictVal).maybeSingle();
    if (readErr) return { error: readErr };

    let writeErr = null;
    if (existing) {
      const r = await cloud.database.from(table).update(patch).eq(conflictCol, conflictVal);
      writeErr = r.error;
    } else {
      const r = await cloud.database.from(table).insert(fullRow);
      writeErr = r.error;
    }
    if (writeErr) return { error: writeErr };

    // 回读校验：本网关下写接口的返回体不可依赖，必须确认行真的变了
    const { data: after } = await cloud.database
      .from(table).select('*').eq(conflictCol, conflictVal).maybeSingle();
    if (!after) {
      // 未生效则重试一次（覆盖并发首建等竞态）
      if (existing) {
        const r = await cloud.database.from(table).update(patch).eq(conflictCol, conflictVal);
        if (r.error) return { error: r.error };
      } else {
        const r = await cloud.database.from(table).insert(fullRow);
        if (r.error) return { error: r.error };
      }
      const { data: after2 } = await cloud.database
        .from(table).select('*').eq(conflictCol, conflictVal).maybeSingle();
      return {
        data: after2 || null,
        verified: !!after2,
        mode: existing ? 'update' : 'insert',
      };
    }
    return { data: after, verified: true, mode: existing ? 'update' : 'insert' };
  } catch (e) {
    return { error: { message: String(e?.message || e) } };
  }
}

/**
 * 尾随限流：把高频调用收敛为「每 minInterval 最多执行一次，且始终以最后一次参数执行」。
 * 用于存档推送与资料同步——二者都会被 saveGameState 高频触发，
 * 而读-判-写是 3 次往返，不限流会在连点时打出写风暴。
 * @returns {Function} 包装后的函数；若包装函数返回 Promise，则复用同一次排队的 Promise
 */
function throttleTrailing(fn, minInterval) {
  let timer = null;
  let lastAt = 0;
  let pendingArgs = null;
  let pendingPromise = null;
  let pendingResolve = null;
  return (...args) => {
    pendingArgs = args;
    if (pendingPromise) return pendingPromise;
    pendingPromise = new Promise((resolve) => { pendingResolve = resolve; });
    // 从未执行过则立即执行，否则等到间隔耗尽
    const wait = lastAt === 0 ? 0 : Math.max(0, minInterval - (Date.now() - lastAt));
    timer = setTimeout(async () => {
      timer = null;
      lastAt = Date.now();
      const a = pendingArgs;
      pendingArgs = null;
      const resolve = pendingResolve;
      pendingPromise = null;
      pendingResolve = null;
      try {
        resolve(await fn(...a));
      } catch (e) {
        resolve({ error: { message: String(e?.message || e) } });
      }
    }, wait);
    return pendingPromise;
  };
}

// ===================== 云端存档（player_saves） =====================

/**
 * 拉取当前用户的云端存档。
 * @returns {Promise<{data:object|null, error?:object}>} data 为存档对象，无存档时 data=null
 */
export async function loadCloudSave() {
  const cloud = getCloud();
  if (!cloud) return { data: null, error: { message: '云端不可用' } };
  if (!_session) return { data: null };
  try {
    const { data, error } = await cloud.database
      .from(TABLE_SAVES)
      .select('save_data, updated_at')
      .maybeSingle();
    if (error) return { data: null, error };
    return { data: data?.save_data || null, updatedAt: data?.updated_at || null };
  } catch (e) {
    return { data: null, error: { message: String(e?.message || e) } };
  }
}

/**
 * 写入云端存档。
 * owner_id 由服务端 DEFAULT auth.uid() 填入，前端绝不发送（见 writeRow 说明）。
 * @returns {Promise<{error?:object}>}
 */
export async function saveCloudSave(state) {
  if (!_session?.user?.id) return { error: { message: '未登录' } };
  const nowIso = new Date().toISOString();
  const row = { save_data: state, updated_at: nowIso };
  // 注意：不传 owner_id，由服务端 DEFAULT auth.uid() 归属
  const r = await writeRow(TABLE_SAVES, 'owner_id', _session.user.id, row, row);
  if (r.error) return { error: r.error };
  if (!r.verified) return { error: { message: '云端存档写入未生效（已重试）' } };
  return {};
}

/**
 * 异步推送存档到云端（fire-and-forget，尾随限流 4s）。
 * 供 storage.saveGameState 在写 localStorage 后调用；失败仅告警，不阻断游戏。
 */
export const pushCloudSave = throttleTrailing(async (state) => {
  const r = await saveCloudSave(state);
  if (r?.error) {
    console.warn('[Cloud] 云端存档推送失败（本地存档不受影响）:', r.error.message || r.error);
  }
  return r;
}, 4000);

/** 清空云端存档（登出或重置时调用） */
export async function clearCloudSave() {
  const cloud = getCloud();
  if (!cloud || !_session) return { error: { message: '未登录' } };
  try {
    // 不手动拼 owner_id：DELETE 的 RLS USING 策略已限定仅可删除本人行
    const { data, error } = await cloud.database
      .from(TABLE_SAVES)
      .delete()
      .select();
    if (error) return { error };
    return { removed: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    return { error: { message: String(e?.message || e) } };
  }
}

// ===================== 玩家资料（profiles） =====================

/** 读取自己的资料；未登录返回 { data:null } */
export async function getMyProfile() {
  const cloud = getCloud();
  if (!cloud || !_session?.user?.id) return { data: null };
  const { data, error } = await cloud.database
    .from('profiles')
    .select('*')
    .eq('id', _session.user.id)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data || null };
}

/**
 * 写入/更新自己的资料。
 * id = 当前登录用户（= auth.uid()）；RLS 仅允许写本人行。
 * 走 writeRow（读-判-写），不再使用 upsert——原因见 writeRow 注释。
 * @returns {Promise<{data?:object, error?:object}>}
 */
export async function saveProfile(patch) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  if (!_session?.user?.id) return { error: { message: '未登录' } };
  const nowIso = new Date().toISOString();
  const fullRow = { id: _session.user.id, ...patch, updated_at: nowIso };
  const r = await writeRow('profiles', 'id', _session.user.id, fullRow, { ...patch, updated_at: nowIso });
  if (r.error) return { error: r.error };
  if (!r.verified) return { error: { message: '资料写入未生效（已重试）' } };
  return { data: r.data };
}

/** 读取指定玩家公开资料（昵称/段位/积分/战力/胜负） */
export async function getProfileById(userId) {
  const cloud = getCloud();
  if (!cloud) return { data: null, error: { message: '云端不可用' } };
  const { data, error } = await cloud.database
    .from('profiles')
    .select('id, nickname, tier, points, power, wins, losses, draws')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data || null };
}

/** 天梯榜：仅统计已挂载出战队伍的玩家，按积分倒序（最多 50） */
export async function getRankedBoard(limit = 50) {
  const cloud = getCloud();
  if (!cloud) return { data: [], error: { message: '云端不可用' } };
  const { data, error } = await cloud.database
    .from('profiles')
    .select('id, nickname, tier, points, power, wins, losses, draws, posted_at')
    .not('posted_formation', 'is', null)
    .order('points', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error };
  return { data: data || [] };
}

/**
 * 我的名次（1 起）。统计「已挂载队伍且积分高于我」的人数 + 1。
 * 未挂载队伍时返回 null——未挂载即不在榜。
 */
export async function getMyRank() {
  const cloud = getCloud();
  if (!cloud || !_session?.user?.id) return { data: null, error: { message: '未登录' } };
  const { data: me, error: meErr } = await getMyProfile();
  if (meErr) return { data: null, error: meErr };
  if (!me || !me.posted_formation) return { data: null };
  const { data, error } = await cloud.database
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('posted_formation', 'is', null)
    .gt('points', me.points || 0);
  if (error) return { data: null, error };
  return { data: { rank: (data?.count || 0) + 1, points: me.points || 0, tier: me.tier } };
}

/**
 * 排位匹配：在「已挂载出战队伍」的玩家里随机抽一个对手。
 * 降级链：同段位 → 相邻段位（上下各一阶）→ 全池。
 * @param {string} myTier 我的段位 key
 * @returns {Promise<{data?:object|null, scope?:'same'|'adjacent'|'all', error?:object}>}
 */
export async function findRankedOpponent(myTier, sample = 30) {
  const cloud = getCloud();
  if (!cloud || !_session?.user?.id) return { data: null, error: { message: '未登录' } };
  const me = _session.user.id;
  const COLS = 'id, nickname, tier, points, power, posted_formation, posted_at';
  const pool = () => cloud.database
    .from('profiles')
    .select(COLS)
    .not('posted_formation', 'is', null)
    .neq('id', me);

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // ① 同段位
  const same = await pool().eq('tier', myTier).order('points', { ascending: false }).limit(sample);
  if (same.error) return { data: null, error: same.error };
  if (same.data && same.data.length > 0) return { data: pick(same.data), scope: 'same' };

  // ② 相邻段位
  const order = TIER_LIST.map((t) => t.key);
  const i = Math.max(0, order.indexOf(myTier));
  const neighbors = [order[i - 1], order[i + 1]].filter(Boolean);
  for (const key of neighbors) {
    const r = await pool().eq('tier', key).order('points', { ascending: false }).limit(sample);
    if (r.error) continue;
    if (r.data && r.data.length > 0) return { data: pick(r.data), scope: 'adjacent' };
  }

  // ③ 全池
  const all = await pool().order('points', { ascending: false }).limit(sample);
  if (all.error) return { data: null, error: all.error };
  if (!all.data || all.data.length === 0) return { data: null, scope: 'all' };
  return { data: pick(all.data), scope: 'all' };
}

// ===================== 玩家对战（pvp_battles） =====================

/**
 * 创建一场对战记录（挑战方调用）。
 * 胜负 result 与战报 report 由前端用 resolvePvpResult 计算后传入（已含 seed，可复现校验）。
 * challenger_id 由前端发送 = 当前登录用户（= auth.uid()）；RLS 仅允许插入本人为挑战方的行。
 */
export async function createBattle({ defenderId, challengerFormation, defenderFormation, seed, result, report, challengerPower = 0, defenderPower = 0 }) {
  const cloud = getCloud();
  if (!cloud) return { error: { message: '云端不可用' } };
  if (!_session?.user?.id) return { error: { message: '未登录' } };
  if (!defenderId || !seed || !result) return { error: { message: '参数缺失' } };
  const { error: insErr } = await cloud.database
    .from('pvp_battles')
    .insert({
      challenger_id: _session.user.id,
      defender_id: defenderId,
      challenger_formation: challengerFormation,
      defender_formation: defenderFormation,
      seed,
      result,
      report,
      challenger_power: challengerPower,
      defender_power: defenderPower,
    });
  if (insErr) return { error: insErr };
  // 回读刚插入的行：insert 后链 .select() 的返回体在本网关下不可依赖
  const { data: row } = await cloud.database
    .from('pvp_battles')
    .select('*')
    .eq('challenger_id', _session.user.id)
    .eq('seed', seed)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { error: { message: '对战记录写入后未能读回' } };
  return { data: row };
}

/** 读取我的全部对战（我挑战的 + 我被挑战的），按时间倒序 */
export async function listMyBattles(limit = 50) {
  const cloud = getCloud();
  if (!cloud || !_session?.user?.id) return { data: [], error: { message: '未登录' } };
  const me = _session.user.id;
  const { data, error } = await cloud.database
    .from('pvp_battles')
    .select('*')
    .or(`challenger_id.eq.${me},defender_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error };
  return { data: data || [] };
}

/** 防守方标记已读（仅防守方本人可更新，RLS 限制） */
export async function markBattleSeen(battleId) {
  const cloud = getCloud();
  if (!cloud || !_session?.user?.id) return { error: { message: '未登录' } };
  const { error } = await cloud.database
    .from('pvp_battles')
    .update({ defender_seen: true })
    .eq('id', battleId);
  if (error) return { error };
  return {};
}

/**
 * 挂载出战队伍：把当前选中的军团生成「排位赛标准阵型」写入云端，并同步展示战力。
 * 只有挂载了队伍的玩家才会进入匹配池与天梯榜。
 * 尾随限流 6s：由 saveGameState 高频触发，而写-判-写是 3 次往返。
 * @param {object} state 游戏存档
 * @param {number} [troopIndex] 指定军团；缺省用当前出征军团
 * @returns {Promise<{data?:object, error?:object, skipped?:boolean}>}
 */
export const postFormation = throttleTrailing(async (state, troopIndex) => {
  if (!state || !_session?.user?.id) return { skipped: true };
  const formation = buildPostedFormation(state, troopIndex);
  if (!formation) {
    return { skipped: true, error: { message: '该军团未配置武将，无法挂载' } };
  }
  const power = computeRankedPower(formation);
  const r = await saveProfile({
    posted_formation: formation,
    posted_at: new Date().toISOString(),
    power,
  });
  if (r.error) {
    // 必须可见：静默失败会让玩家从匹配池与天梯榜中消失，且极难排查
    console.warn('[Cloud] 挂载出战队伍失败（将无法参与匹配与天梯榜）:', r.error.message || r.error);
  }
  return r;
}, 6000);

/** 撤下出战队伍：退出匹配池并从天梯榜移除（积分与战绩保留） */
export async function unpostFormation() {
  const r = await saveProfile({ posted_formation: null, posted_at: null });
  if (r.error) console.warn('[Cloud] 撤下出战队伍失败:', r.error.message || r.error);
  return r;
}
