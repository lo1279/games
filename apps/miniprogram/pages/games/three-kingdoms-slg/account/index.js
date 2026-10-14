// pages/games/three-kingdoms-slg/account/index.js
/**
 * ☁️ 云端账号（对齐 Web cloudUI）
 *  云端优先：若 WorkBuddyCloud SDK 注入可用，则走真实登录/注册/存档同步；
 *  本地降级：小程序未注入云端 SDK 时，使用本地昵称档案，保证功能可演示。
 */

const cloud = require('../engine/cloud.js');
const { loadGameState, saveGameState } = require('../engine/storage.js');

const LOCAL_PROFILE_KEY = 'slg_local_profile_v1';

Page({
  data: {
    cloudAvailable: false,
    signedIn: false,
    profile: null,         // { nickname, tier, points, power, wins, losses }
    modeLabel: '检测中...',
    email: '',
    password: '',
    otp: '',
    showLogin: false
  },

  onShow() { this.refresh(); },

  refresh() {
    const available = !!(cloud.isCloudAvailable && cloud.isCloudAvailable());
    let signedIn = false;
    let profile = null;
    if (available) {
      const s = cloud.getCurrentSession && cloud.getCurrentSession();
      signedIn = !!s;
    } else {
      // 本地降级档案
      try {
        const raw = wx.getStorageSync(LOCAL_PROFILE_KEY);
        if (raw) { profile = raw; signedIn = true; }
      } catch (e) {}
    }
    this.setData({
      cloudAvailable: available,
      signedIn,
      profile,
      modeLabel: available ? '云端已连接' : '本地模式（云端未连接）'
    });
  },

  openLogin() {
    if (this.data.cloudAvailable) {
      this.setData({ showLogin: true });
    } else {
      wx.showModal({
        title: '本地昵称',
        editable: true,
        placeholderText: '输入主公名号',
        success: (res) => {
          if (res.confirm && res.content) {
            const p = { nickname: res.content, tier: 'bronze', points: 1000, power: 0, wins: 0, losses: 0 };
            try { wx.setStorageSync(LOCAL_PROFILE_KEY, p); } catch (e) {}
            this.setData({ signedIn: true, profile: p });
            wx.showToast({ title: '已登录（本地）', icon: 'success' });
          }
        }
      });
    }
  },

  closeLogin() { this.setData({ showLogin: false }); },

  onEmail(e) { this.setData({ email: e.detail.value }); },
  onPassword(e) { this.setData({ password: e.detail.value }); },
  onOtp(e) { this.setData({ otp: e.detail.value }); },

  async doCloudLogin() {
    const { email, password } = this.data;
    if (!email || !password) { wx.showToast({ title: '请输入邮箱与密码', icon: 'none' }); return; }
    wx.showLoading({ title: '登录中...' });
    const r = await cloud.signInWithPassword(email, password);
    wx.hideLoading();
    if (r.error) { wx.showToast({ title: r.error.message || '登录失败', icon: 'none' }); return; }
    this.setData({ showLogin: false });
    this.refresh();
    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  async logout() {
    if (this.data.cloudAvailable) {
      await cloud.signOut();
    } else {
      try { wx.removeStorageSync(LOCAL_PROFILE_KEY); } catch (e) {}
    }
    this.setData({ signedIn: false, profile: null });
    wx.showToast({ title: '已退出', icon: 'none' });
  },

  syncNow() {
    const state = loadGameState();
    if (this.data.cloudAvailable) {
      wx.showLoading({ title: '同步中...' });
      cloud.saveCloudSave(state).then(r => {
        wx.hideLoading();
        if (r.error) wx.showToast({ title: '同步失败', icon: 'none' });
        else wx.showToast({ title: '已同步云端', icon: 'success' });
      });
    } else {
      saveGameState(state);
      wx.showToast({ title: '已保存本地', icon: 'success' });
    }
  },

  back() { wx.navigateBack({ delta: 1 }); }
});
