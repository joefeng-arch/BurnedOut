const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const { api } = require('../../utils/request.js');
const { BURN_LEVELS, EMOTION_TAGS } = require('../../utils/constants.js');

Page({
  data: {
    t: {},
    levels: [],
    emotionOptions: [],
    selectedLevel: null,
    // Object map for fast WXML truthy lookup. Reason: WXML's expression
    // evaluator handles `obj[key]` reliably but `array.indexOf(key) > -1`
    // does not always re-evaluate after setData. Vent page uses the same
    // pattern for the same reason.
    selectedEmotions: {},
    submitting: false,
    canSubmit: false,
    alreadyCheckedIn: false,
  },

  onLoad() {
    const locale = i18n.getLocale();

    this.setData({
      t: {
        checkin_title: i18n.t('checkin_title'),
        checkin_subtitle: i18n.t('checkin_subtitle'),
        checkin_emotion: i18n.t('checkin_emotion'),
        checkin_submit: i18n.t('checkin_submit'),
        checkin_already: i18n.t('checkin_already'),
        go_dashboard: locale === 'zh-CN' ? '看看趋势' : 'See trend',
      },
      levels: BURN_LEVELS.map((lv) => ({
        value: lv.value,
        emoji: lv.emoji,
        label: i18n.t('level_' + lv.value),
      })),
      emotionOptions: EMOTION_TAGS.map((key) => ({
        key,
        label: i18n.t('emotion_' + key),
      })),
    });

    analytics.events.page_view('checkin');

    // Check if user has already checked in today
    api.getTodayCheckIn()
      .then((res) => {
        if (res && res.checkin) {
          // API returns emotion_tags as array; convert to object map.
          const map = {};
          (res.checkin.emotion_tags || []).forEach((k) => { map[k] = true; });
          this.setData({
            alreadyCheckedIn: true,
            selectedLevel: res.checkin.burn_level,
            selectedEmotions: map,
          });
          wx.showToast({
            title: i18n.t('checkin_already'),
            icon: 'none',
          });
        }
      })
      .catch(() => {
        // 404 / no check-in today — normal state
      });
  },

  pickLevel(e) {
    if (this.data.alreadyCheckedIn) return;
    const value = Number(e.currentTarget.dataset.value);
    this.setData({
      selectedLevel: value,
      canSubmit: true,
    });
    analytics.track('checkin_select_level', { burn_level: value });
    wx.vibrateShort({ type: 'light' });
  },

  toggleEmotion(e) {
    if (this.data.alreadyCheckedIn) return;
    const key = e.currentTarget.dataset.key;
    const next = { ...this.data.selectedEmotions };
    if (next[key]) delete next[key];
    else next[key] = true;
    this.setData({ selectedEmotions: next });
    analytics.track('checkin_toggle_emotion', { emotion_tag: key });
    wx.vibrateShort({ type: 'light' });
  },

  async submit() {
    if (this.data.alreadyCheckedIn) {
      wx.redirectTo({ url: '/pages/dashboard/index' });
      return;
    }
    if (!this.data.selectedLevel || this.data.submitting) return;

    // Convert object map → array for the API payload.
    const emotionTags = Object.keys(this.data.selectedEmotions);

    this.setData({ submitting: true });
    analytics.events.click('checkin_click_submit', {
      burn_level: this.data.selectedLevel,
      emotion_count: emotionTags.length,
    });

    try {
      await api.createCheckIn({
        burn_level: this.data.selectedLevel,
        emotion_tags: emotionTags,
      });
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({
        title: i18n.t('checkin_success'),
        icon: 'success',
      });
      analytics.track('checkin_success', {
        burn_level: this.data.selectedLevel,
      });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/dashboard/index' });
      }, 900);
    } catch (err) {
      this.setData({ submitting: false });
      if (err.status === 409) {
        wx.showToast({
          title: i18n.t('checkin_already'),
          icon: 'none',
        });
      } else {
        wx.showToast({
          title: (err && err.message) || 'Error',
          icon: 'none',
        });
      }
    }
  },
});
