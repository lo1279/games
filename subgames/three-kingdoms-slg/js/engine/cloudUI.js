/**
 * 三国志·战略版 - 云端账号 UI 与启动同步控制器（仅手机号注册/登录）
 *
 * 负责：
 *  - 应用入口初始化云端鉴权并订阅登录态变化；
 *  - 登录/注册弹窗（手机号 + 短信验证码；首次登录引导设置昵称）的交互；
 *  - 启动或从登录态变化后，把云端存档拉回游戏覆盖本地（跨设备续战）；
 *  - 顶部账号按钮的状态呈现与登出。
 *
 * 仅依赖 cloud.js（API 层）与 storage.js（pullCloudSave / saveGameState），
 * 不接触游戏业务逻辑；所有网络失败均已 try/catch 兜底，绝不阻断游戏。
 */

import {
  isCloudAvailable,
  initCloudAuth,
  isSignedIn,
  getCurrentSession,
  onAuthChange,
  sendPhoneOtp,
  verifyPhoneOtp,
  signOut,
  pushCloudSave,
  getMyProfile,
  saveProfile,
  postFormation,
} from './cloud.js';
import { pullCloudSave, saveGameState } from './storage.js';

// OTP 挑战状态（发送与校验之间跨事件保存）
let _phonePend = null;
let _pendingPhone = '';   // 登录用的手机号（用于昵称步骤的脱敏）
let _game = null;
let _profile = null;      // 资料缓存（含 nickname）
let _needNickname = false; // 已登录但尚无昵称，需停留在昵称步骤
let _onEnter = null;       // 进入游戏的回调（由 main.js 注入：创建 GameApp 实例）

/** 把创建好的 GameApp 实例交给云端模块（用于同步存档、挂载队伍等） */
export function setGame(game) { _game = game; }

/** 轻量提示条 */
function showToast(msg, isError = false) {
  let el = document.getElementById('cloudToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cloudToast';
    el.className = 'cloud-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('is-error', isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('cloudStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-error', isError);
  el.classList.toggle('is-ok', !isError && !!msg);
}

function $(id) { return document.getElementById(id); }

// ============ 头部账号按钮 ============
function renderAccountChip() {
  const btn = $('btnCloudAccount');
  const text = $('cloudAccountText');
  if (!btn || !text) return;
  if (isSignedIn()) {
    const u = getCurrentSession()?.user;
    const name = _profile?.nickname || u?.phone || '已登录';
    btn.classList.add('is-signed');
    text.textContent = '☁ ' + name;
  } else {
    btn.classList.remove('is-signed');
    text.textContent = '云端登录';
  }
}

// ============ 弹窗开关 ============
function openModal() {
  const m = $('cloudModal');
  if (!m) return;
  if (isSignedIn()) {
    _needNickname = !(_profile && _profile.nickname);
  } else {
    _needNickname = false;
  }
  if (_needNickname) showNicknamePane(); else showPhonePane();
  refreshModalView();
  m.style.display = 'flex';
}
function closeModal() {
  const m = $('cloudModal');
  if (m) m.style.display = 'none';
  setStatus('');
}

/** 显示强制登录门禁：全屏不可关闭（is-gate 样式使遮罩不透明、点遮罩不关） */
function showGate() {
  const m = $('cloudModal');
  if (!m) return;
  m.classList.add('is-gate');
  m.style.display = 'flex';
  const closeBtn = $('btnCloudModalClose');
  if (closeBtn) closeBtn.style.display = 'none';
  // 门禁始终停留在手机号登录步骤
  _needNickname = false;
  showPhonePane();
  refreshModalView();
}
/** 收起门禁（登录成功后调用） */
function hideGate() {
  const m = $('cloudModal');
  if (m) { m.classList.remove('is-gate'); m.style.display = 'none'; }
  const closeBtn = $('btnCloudModalClose');
  if (closeBtn) closeBtn.style.display = '';
}

/** 切换到手机号输入步骤 */
function showPhonePane() {
  const phone = $('cloudPhonePane');
  const nick = $('cloudNicknamePane');
  if (phone) phone.style.display = 'block';
  if (nick) nick.style.display = 'none';
}
/** 切换到昵称设置步骤 */
function showNicknamePane() {
  const phone = $('cloudPhonePane');
  const nick = $('cloudNicknamePane');
  if (phone) phone.style.display = 'none';
  if (nick) nick.style.display = 'block';
}

/** 根据登录态切换「已登录视图」与「鉴权视图」；首登设昵称时强制停留在昵称步骤 */
function refreshModalView() {
  const signed = $('cloudSignedInView');
  const auth = $('cloudAuthView');
  if (!isSignedIn()) {
    if (signed) signed.style.display = 'none';
    if (auth) auth.style.display = 'block';
    return;
  }
  if (_needNickname) {
    if (signed) signed.style.display = 'none';
    if (auth) auth.style.display = 'block';
    showNicknamePane();
    return;
  }
  if (signed) signed.style.display = 'block';
  if (auth) auth.style.display = 'none';
  const u = getCurrentSession()?.user;
  const nameEl = $('cloudUserName');
  if (nameEl) nameEl.textContent = _profile?.nickname || u?.phone || '已登录用户';
}

// ============ 启动：从云端拉取存档覆盖本地 ============
async function syncFromCloudToGame(game, { silentIfEmpty = false } = {}) {
  const { data, error } = await pullCloudSave();
  if (error) {
    setStatus('拉取云端存档失败：' + error.message, true);
    return;
  }
  if (!data) {
    pushCloudSave(game.state);
    // 首次注册、云端无存档：若本地已挂载过队伍则补挂一次（否则玩家会从匹配池消失）
    refreshPostedFormation(game.state);
    return;
  }
  game.state = data;
  saveGameState(game.state);
  if (typeof game.renderAll === 'function') game.renderAll();
  // 云端存档可能换设备后阵容不同，按新存档重新挂载
  refreshPostedFormation(game.state);
  showToast(silentIfEmpty ? '☁ 已从云端同步存档' : '☁ 已用云端存档覆盖本地');
}

/**
 * 按存档里的 postedTroopIndex 重新挂载出战队伍。
 * 未挂载过（postedTroopIndex 为空）则不动——挂载是玩家的显式选择，不该替他做。
 */
function refreshPostedFormation(state) {
  if (!state || state.postedTroopIndex == null) return;
  postFormation(state, state.postedTroopIndex).then((r) => {
    if (r?.error) {
      console.warn('[Cloud] 挂载队伍刷新失败:', r.error.message || r.error);
      showToast('⚠️ 挂载队伍同步失败，可能暂时无法参与匹配', true);
    }
  });
}

// ============ 登录后流程 ============
/** 手机号验证成功后：已设昵称则完成登录，否则进入昵称步骤 */
async function afterLoginSetup(phone) {
  _pendingPhone = phone || '';
  let prof = null;
  try {
    const r = await getMyProfile();
    prof = r.data || null;
  } catch (e) { /* 忽略，按无资料处理 */ }
  _profile = prof;
  if (prof && prof.nickname) {
    finishLogin();
    return;
  }
  _needNickname = true;
  refreshModalView();
  setStatus('欢迎！请先设置一个昵称');
}

/** 登录完成：进入游戏、用云端存档覆盖本地、收起门禁 */
function finishLogin() {
  _needNickname = false;
  setStatus('');
  // 进入游戏（创建 GameApp 实例并交给云端模块）—— 未登录前游戏实例不存在
  if (typeof _onEnter === 'function') _onEnter();
  // 用云端存档覆盖本地（离线兜底模式下 pull 会失败被忽略，不影响游戏）
  if (window.game) syncFromCloudToGame(window.game, { silentIfEmpty: true });
  hideGate();
  showToast('☁ 登录成功，已同步存档');
}

/** 手机号脱敏：138****1234 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || '';
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

// ============ 事件绑定 ============
function bindEvents() {
  $('btnCloudAccount')?.addEventListener('click', openModal);
  $('btnCloudModalClose')?.addEventListener('click', closeModal);
  $('cloudModal')?.addEventListener('click', (e) => {
    if (e.target === $('cloudModal')) {
      // 门禁（强制登录）模式下不可点遮罩关闭，避免逃逸进游戏
      if ($('cloudModal').classList.contains('is-gate')) return;
      closeModal();
    }
  });

  // 短信：发送验证码
  $('btnCloudSendSms')?.addEventListener('click', async () => {
    const phone = $('cloudPhone')?.value.trim();
    if (!/^1\d{10}$/.test(phone)) { setStatus('请输入正确的 11 位手机号', true); return; }
    setStatus('发送验证码中…');
    const r = await sendPhoneOtp(phone);
    if (r.error) { setStatus('发送失败：' + (r.error.message || '请稍后重试'), true); return; }
    _phonePend = { verificationId: r.verificationId, isExistingUser: r.isExistingUser };
    setStatus('验证码已发送至 ' + phone);
    startResendCooldown($('btnCloudSendSms'));
  });

  // 短信：校验并登录/注册
  $('btnCloudSmsLogin')?.addEventListener('click', async () => {
    const phone = $('cloudPhone')?.value.trim();
    const code = $('cloudSmsCode')?.value.trim();
    if (!_phonePend) { setStatus('请先获取验证码', true); return; }
    if (!code) { setStatus('请输入验证码', true); return; }
    setStatus('登录中…');
    const { error } = await verifyPhoneOtp({
      phone,
      verificationId: _phonePend.verificationId,
      token: code,
      isExistingUser: _phonePend.isExistingUser,
    });
    if (error) { setStatus('登录失败：' + (error.message || '验证码错误'), true); return; }
    _phonePend = null;
    await afterLoginSetup(phone);
  });

  // 首次登录：设置昵称
  $('btnCloudSetNick')?.addEventListener('click', async () => {
    const nick = $('cloudNickname')?.value.trim();
    if (!nick || nick.length < 2 || nick.length > 12) { setStatus('昵称需 2-12 字', true); return; }
    setStatus('保存中…');
    const phone = _pendingPhone || getCurrentSession()?.user?.phone || '';
    const { error } = await saveProfile({ nickname: nick, phone_masked: maskPhone(phone) });
    if (error) { setStatus('保存失败：' + (error.message || ''), true); return; }
    _profile = { ...(_profile || {}), nickname: nick, phone_masked: maskPhone(phone) };
    // 昵称是上榜与对战的必要信息之一；若本地此前已挂载队伍，这里补挂一次
    refreshPostedFormation(_game?.state);
    finishLogin();
  });

  // 已登录视图：立即同步 / 退出
  $('btnCloudSyncNow')?.addEventListener('click', () => {
    if (_game) syncFromCloudToGame(_game, { silentIfEmpty: false });
  });
  $('btnCloudLogout')?.addEventListener('click', async () => {
    await signOut();
    _profile = null;
    _needNickname = false;
    showToast('☁ 已退出登录（本地存档保留）');
    // 回到门禁由 onAuthChange(null) 统一触发 showGate
  });

  // 订阅登录态变化（登录/登出/刷新）
  onAuthChange((session) => {
    renderAccountChip();
    if (session) {
      // 登录态变化：刷新资料缓存；进入游戏与云端同步由 finishLogin 统一处理，避免重复
      getMyProfile().then(r => { _profile = r.data || null; renderAccountChip(); }).catch(() => {});
    } else {
      _profile = null;
      // 登出：回到强制登录门禁（云端此时应可用）
      showGate();
    }
    refreshModalView();
  });
}

/** 发送验证码后的倒计时 */
function startResendCooldown(btn) {
  if (!btn) return;
  let left = 60;
  btn.disabled = true;
  const tick = () => {
    if (left <= 0) { btn.disabled = false; btn.textContent = '获取验证码'; return; }
    btn.textContent = `重新发送(${left}s)`;
    left -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

/**
 * 应用入口调用：初始化云端、绑定 UI、启动同步。
 * @param {object} game GameApp 实例
 */
/**
 * 应用入口调用：初始化云端鉴权、绑定登录 UI、按登录态决定门禁或进入游戏。
 * @param {object} opts
 * @param {function} [opts.onEnter] 进入游戏的回调（main.js 注入：创建 GameApp 实例并交给云端模块）
 */
export async function initCloudSync(opts = {}) {
  _onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : null;

  if (!isCloudAvailable()) {
    // 云端不可用：降级为离线游客模式，直接进入游戏（进度不存云端）
    const btn = $('btnCloudAccount');
    if (btn) btn.style.display = 'none';
    showToast('⚠️ 云端服务不可用，当前为离线模式（进度不存云端）');
    if (_onEnter) _onEnter();
    return;
  }
  try {
    await initCloudAuth();
  } catch (e) {
    console.warn('[Cloud] 初始化鉴权失败，降级为离线游客模式:', e);
    const btn = $('btnCloudAccount');
    if (btn) btn.style.display = 'none';
    showToast('⚠️ 云端鉴权失败，当前为离线模式（进度不存云端）');
    if (_onEnter) _onEnter();
    return;
  }
  bindEvents();
  renderAccountChip();

  if (isSignedIn()) {
    // 已登录：拉资料 → 进入游戏 → 同步云端存档（finishLogin 内完成）→ 补挂队伍自愈
    const r = await getMyProfile().catch(() => ({ data: null }));
    _profile = r.data || null;
    await afterLoginSetup(getCurrentSession()?.user?.phone || '');
    // 首登且无昵称（如刷新页面）：停留在昵称设置步骤，需把门禁显示出来
    if (_needNickname) showGate();
    // 自愈：早期版本因 upsert 缺陷，云端 profiles 可能缺失挂载数据。
    // 若本地记得自己挂载过（postedTroopIndex 有值）而云端没有，说明同步失败过，补挂一次。
    if (_profile && !_profile.posted_formation && window.game?.state?.postedTroopIndex != null) {
      const sr = await postFormation(window.game.state, window.game.state.postedTroopIndex);
      if (sr?.error) {
        console.warn('[Cloud] 挂载队伍自愈同步失败:', sr.error.message || sr.error);
      } else {
        showToast('⚔️ 已补同步挂载队伍');
        _profile = { ...(_profile || {}), ...(sr.data || {}) };
      }
    }
  } else {
    // 未登录：显示强制登录门禁，不创建游戏实例、不读取本地进度
    showGate();
  }
}
