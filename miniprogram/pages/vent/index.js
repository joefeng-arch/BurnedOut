const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const ads = require('../../utils/ads.js');
const { api } = require('../../utils/request.js');
const { EMOTION_TAGS, VENT_MODES, DESTROY_TYPES, bucketChars, AD_UNLOCK_TYPES } = require('../../utils/constants.js');
const { detectEgg } = require('../../utils/keyword-eggs.js');

function buildT() {
  return {
    vent_placeholder: i18n.t('vent_placeholder'),
    vent_destroy: i18n.t('vent_destroy'),
    vent_chars: i18n.t('vent_chars', { n: 0 }),
    vent_warning: i18n.t('vent_warning'),
    vent_limit_reached: i18n.t('vent_limit_reached'),
    vent_unlock_via_ad: i18n.t('vent_unlock_via_ad'),
    vent_max_reached: i18n.t('vent_max_reached'),
  };
}

Page({
  data: {
    t: {},
    modes: [],
    emotions: [],
    selectedMode: 'quick_rant',
    selectedEmotions: {},
    text: '',
    submitting: false,
    todayCount: null,   // { free, unlocked, remaining_free, remaining_unlocks }
    countHint: '',
    unlockedByAd: false,
  },

  async onLoad(query) {
    const t = buildT();
    const modes = VENT_MODES.map((k) => ({ key: k, label: i18n.t('mode_' + k) }));
    const emotions = EMOTION_TAGS.map((k) => ({ key: k, label: i18n.t('emotion_' + k) }));
    this.setData({ t, modes, emotions });
    analytics.events.page_view('vent');

    if (query.unlocked === '1') {
      this.setData({ unlockedByAd: true });
    }

    await this.refreshCount();
  },

  async refreshCount() {
    try {
      const res = await api.getTodayVentCount();
      this.setData({ todayCount: res });
      this.updateHint(res);
    } catch (err) {
      console.warn('today count failed', err);
    }
  },

  updateHint(count) {
    if (!count) return;
    const t = this.data.t;
    const locale = i18n.getLocale();
    if (count.remaining_free > 0 && !this.data.unlockedByAd) {
      // show remaining free
      this.setData({
        countHint:
          locale === 'zh-CN'
            ? `今日剩余 ${count.remaining_free}/${count.free_limit} 次`
            : `${count.remaining_free}/${count.free_limit} free left today`,
      });
    } else if (count.remaining_unlocks > 0) {
      this.setData({ countHint: t.vent_unlock_via_ad });
    } else {
      this.setData({ countHint: t.vent_max_reached });
    }
  },

  selectMode(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedMode: key });
    analytics.track('vent_mode_select', { vent_mode: key });
  },

  toggleEmotion(e) {
    const key = e.currentTarget.dataset.key;
    const next = { ...this.data.selectedEmotions };
    if (next[key]) delete next[key];
    else next[key] = true;
    this.setData({ selectedEmotions: next });
    analytics.track('vent_tag_select', { emotion_tag: key });
  },

  onInput(e) {
    const text = e.detail.value;
    this.setData({
      text,
      't.vent_chars': i18n.t('vent_chars', { n: text.length }),
    });
  },

  async submit() {
    const { text, selectedMode, selectedEmotions, todayCount, unlockedByAd, submitting } = this.data;
    if (submitting) return;
    if (!text.trim()) return;

    // Enforce limit client-side for instant feedback
    if (!unlockedByAd && todayCount && todayCount.remaining_free <= 0) {
      // Offer ad unlock
      if (todayCount.remaining_unlocks > 0) {
        this.offerAdUnlock();
      } else {
        wx.showToast({ title: i18n.t('vent_max_reached'), icon: 'none' });
      }
      return;
    }

    this.setData({ submitting: true });
    analytics.track('vent_submit_click', {
      vent_mode: selectedMode,
      char_count_bucket: bucketChars(text.length),
    });

    const tags = Object.keys(selectedEmotions);
    const destroyType = DESTROY_TYPES[Math.floor(Math.random() * DESTROY_TYPES.length)];

    // Keyword easter egg detection — runs locally, before any network call.
    // We pass only the variant KEY downstream (not the matched text) so the
    // raw vent content stays on-device.
    const egg = detectEgg(text);

    try {
      const res = await api.submitVent({
        content: text,
        emotion_tags: tags,
        vent_mode: selectedMode,
        destroy_type: destroyType,
        unlocked_by_ad: unlockedByAd,
      });

      analytics.track('vent_submit_success', {
        vent_mode: selectedMode,
        char_count_bucket: bucketChars(text.length),
        is_flagged: res.is_flagged,
        emotion_tags: tags,
      });

      if (egg) {
        analytics.track('destroy_egg_triggered', { egg_key: egg.key });
      }

      // Persist payload for destroy + result pages
      const app = getApp();
      app.globalData.lastVent = {
        charCount: text.length,
        charBucket: bucketChars(text.length),
        emotionTags: tags,
        mode: selectedMode,
        destroyType,
        quip: res.quip,
        isFlagged: res.is_flagged,
        egg, // {key, zh, en, emoji} | null
      };

      const eggParam = egg ? '&egg=' + egg.key : '';
      wx.redirectTo({
        url: '/pages/destroy/index?type=' + destroyType + eggParam,
      });
    } catch (err) {
      console.warn('vent submit failed', err);
      if (err.status === 429) {
        wx.showToast({ title: i18n.t('vent_max_reached'), icon: 'none' });
      } else {
        wx.showToast({ title: 'Oops, try again', icon: 'none' });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  async offerAdUnlock() {
    wx.showModal({
      title: i18n.t('vent_limit_reached'),
      content: i18n.t('vent_unlock_via_ad'),
      confirmText: 'OK',
      cancelText: 'Cancel',
      success: async (r) => {
        if (!r.confirm) return;
        const { completed, reason } = await ads.showRewardVideo({
          unlock_type: AD_UNLOCK_TYPES.EXTRA_VENT,
          page_name: 'vent',
        });
        if (completed) {
          this.setData({ unlockedByAd: true });
          await this.refreshCount();
          wx.showToast({ title: '+1', icon: 'success' });
        } else if (reason === 'not_configured' || reason === 'api_unavailable') {
          wx.showToast({
            title: i18n.getLocale() === 'zh-CN' ? '广告暂不可用' : 'Ads unavailable',
            icon: 'none',
          });
        }
      },
    });
  },
});
