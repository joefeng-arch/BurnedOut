// ============================================================================
// Smash plate page — shake-to-smash stress relief
// ============================================================================
//
// Detection: wx.startAccelerometer at 'game' interval (~20Hz). On each
// reading we compute the magnitude g = sqrt(x²+y²+z²). At rest g≈1.0; a
// firm shake exceeds ~2.5. We require 350ms debounce between consecutive
// smashes so a continuous shake doesn't fire dozens of plates per second
// (that would be both ugly and quota-burning).
//
// Animation: each smash sets `plateState='breaking'` which triggers CSS
// transitions on the plate + spawns 6 fragments at randomized angles.
// After 600ms we reset to 'idle' so a fresh plate fades in.

const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const ads = require('../../utils/ads.js');
const sound = require('../../utils/sound.js');
const counter = require('../../utils/smash-counter.js');
const { AD_UNLOCK_TYPES } = require('../../utils/constants.js');

const SHAKE_THRESHOLD = 2.5;       // g; tune on real device
const SHAKE_DEBOUNCE_MS = 350;     // min interval between smashes
const FRAGMENT_COUNT = 6;
const ANIM_DURATION_MS = 600;
const SOUND_SRC = '/assets/sounds/plate-smash.mp3'; // user will drop file in

Page({
  data: {
    t: {},
    plateState: 'idle',          // 'idle' | 'breaking'
    fragments: [],
    smashed: 0,
    remaining: 0,
    record: 0,
    exhausted: false,
    canUnlock: true,
    soundOn: false,
    showHint: true,              // first-use hint, dismissed after 1st smash
  },

  onLoad() {
    const locale = i18n.getLocale();
    this.setData({
      t: {
        smash_title: i18n.t('smash_title'),
        smash_hint: i18n.t('smash_hint'),
        smash_smashed: locale === 'zh-CN' ? '已摔' : 'Smashed',
        smash_remaining: locale === 'zh-CN' ? '剩' : 'Left',
        smash_record: i18n.t('smash_record', { n: 0 }),
        smash_exhausted: i18n.t('smash_exhausted'),
        smash_unlock_ad: i18n.t('smash_unlock_ad'),
        smash_done: i18n.t('smash_done'),
        smash_sound_on: i18n.t('smash_sound_on'),
        smash_sound_off: i18n.t('smash_sound_off'),
      },
    });
    this._lastShake = 0;
    this.refreshStatus();
    analytics.events.page_view('smash');
  },

  onShow() {
    this.startShakeDetect();
    // Refresh in case user came back from an ad unlock flow
    this.refreshStatus();
    this.setData({ soundOn: sound.isEnabled() });
  },

  onHide() {
    this.stopShakeDetect();
    this.flushSession();
  },

  onUnload() {
    this.stopShakeDetect();
    sound.disposeAll();
    this.flushSession();
  },

  refreshStatus() {
    const s = counter.getStatus();
    this.setData({
      smashed: s.smashed,
      remaining: s.remaining,
      record: s.record,
      exhausted: s.exhausted,
      canUnlock: s.can_unlock,
    });
  },

  // -------------------------------------------------------------------------
  // Shake detection
  // -------------------------------------------------------------------------
  startShakeDetect() {
    if (this._listening) return;
    this._listening = true;
    this._sessionStart = Date.now();
    this._sessionStartCount = this.data.smashed;

    this._onAccel = (res) => {
      const g = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z);
      if (g < SHAKE_THRESHOLD) return;
      const now = Date.now();
      if (now - this._lastShake < SHAKE_DEBOUNCE_MS) return;
      this._lastShake = now;
      this.handleShake();
    };

    wx.startAccelerometer({ interval: 'game' });
    wx.onAccelerometerChange(this._onAccel);
  },

  stopShakeDetect() {
    if (!this._listening) return;
    this._listening = false;
    if (this._onAccel) wx.offAccelerometerChange(this._onAccel);
    try { wx.stopAccelerometer(); } catch {}
  },

  handleShake() {
    if (this.data.exhausted) {
      // Out of plates — buzz once but don't waste any quota
      wx.vibrateShort({ type: 'heavy' });
      return;
    }
    this.smashOnePlate();
  },

  // -------------------------------------------------------------------------
  // Smash animation
  // -------------------------------------------------------------------------
  smashOnePlate() {
    if (this.data.plateState === 'breaking') return; // ignore mid-anim shakes
    if (!counter.increment()) {
      // Race: quota changed under us. Refresh and bail.
      this.refreshStatus();
      return;
    }

    // Generate fragments at random angles around the plate center.
    const frags = [];
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      const angle = (i / FRAGMENT_COUNT) * 2 * Math.PI + (Math.random() - 0.5) * 0.6;
      const dist = 220 + Math.random() * 100; // rpx
      frags.push({
        id: Date.now() + i,
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist),
        rot: Math.round((Math.random() - 0.5) * 720),
      });
    }

    const newSmashed = this.data.smashed + 1;
    this.setData({
      plateState: 'breaking',
      fragments: frags,
      smashed: newSmashed,
      remaining: Math.max(0, this.data.remaining - 1),
      record: Math.max(this.data.record, newSmashed),
      showHint: false,
    });

    // Sensory feedback
    sound.play(SOUND_SRC);
    wx.vibrateLong();

    // Reset for next plate
    setTimeout(() => {
      const status = counter.getStatus();
      this.setData({
        plateState: 'idle',
        fragments: [],
        exhausted: status.exhausted,
      });
    }, ANIM_DURATION_MS);

    // Milestone messages — silent toast every 10/50/100 to keep it punchy
    if (newSmashed === 10 || newSmashed === 50 || newSmashed === 100) {
      const msg = i18n.t('smash_milestone_' + newSmashed);
      if (msg) wx.showToast({ title: msg, icon: 'none' });
    }
  },

  // -------------------------------------------------------------------------
  // Ad unlock
  // -------------------------------------------------------------------------
  async onUnlockTap() {
    if (!this.data.canUnlock) {
      wx.showToast({ title: i18n.t('smash_unlock_maxed'), icon: 'none' });
      return;
    }
    analytics.events.click('smash_click_unlock_ad');

    const { completed, reason } = await ads.showRewardVideo({
      unlock_type: AD_UNLOCK_TYPES.EXTRA_SMASH,
      page_name: 'smash',
    });

    if (completed) {
      counter.grantAdUnlock();
      this.refreshStatus();
      analytics.track('smash_unlock_success');
      wx.showToast({ title: '+' + counter.PER_UNLOCK, icon: 'success' });
    } else if (reason === 'not_configured' || reason === 'api_unavailable') {
      wx.showToast({
        title: i18n.getLocale() === 'zh-CN' ? '广告暂不可用' : 'Ads unavailable',
        icon: 'none',
      });
    }
  },

  // -------------------------------------------------------------------------
  // Sound toggle
  // -------------------------------------------------------------------------
  toggleSound() {
    const next = !this.data.soundOn;
    sound.setEnabled(next);
    this.setData({ soundOn: next });
    analytics.events.click('smash_toggle_sound', { sound_on: next });
    if (next) wx.showToast({ title: '🔊', icon: 'none' });
  },

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  onDoneTap() {
    analytics.events.click('smash_click_done');
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/home/index' }) });
  },

  // Track session-level metrics: how many plates this user smashed in one
  // sitting. The aggregate is useful for measuring engagement; individual
  // smashes are too high-cardinality to log every time.
  flushSession() {
    if (!this._sessionStart) return;
    const sessionCount = this.data.smashed - (this._sessionStartCount || 0);
    if (sessionCount > 0) {
      analytics.track('smash_session_end', {
        count: sessionCount,
        duration_ms: Date.now() - this._sessionStart,
      });
    }
    this._sessionStart = null;
  },

  onShareAppMessage() {
    return {
      title: i18n.getLocale() === 'zh-CN'
        ? `今天我摔了 ${this.data.record} 个盘子`
        : `I smashed ${this.data.record} plates today`,
      path: '/pages/home/index',
    };
  },
});
