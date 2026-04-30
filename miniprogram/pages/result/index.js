const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const ads = require('../../utils/ads.js');
const { AD_UNLOCK_TYPES } = require('../../utils/constants.js');

function charLabel(bucket, locale) {
  const map = {
    bucket_1_20: locale === 'zh-CN' ? '1-20 字' : '1-20 chars',
    bucket_21_50: locale === 'zh-CN' ? '21-50 字' : '21-50 chars',
    bucket_51_100: locale === 'zh-CN' ? '51-100 字' : '51-100 chars',
    bucket_100_plus: locale === 'zh-CN' ? '100+ 字' : '100+ chars',
  };
  return map[bucket] || '';
}

Page({
  data: {
    t: {},
    statsLabels: {},
    charCountLabel: '',
    emotionLabel: '',
    quip: '',
    mode: '',
    bucket: '',
    emotionTags: [],
    isFlagged: false,
  },

  onLoad() {
    const locale = i18n.getLocale();
    const last = (getApp().globalData.lastVent) || {};

    this.setData({
      t: {
        result_title: i18n.t('result_title'),
        result_retry: i18n.t('result_retry'),
        result_dashboard: i18n.t('result_dashboard'),
        result_unlock: i18n.t('result_unlock'),
        result_back_home: i18n.t('result_back_home'),
      },
      statsLabels: {
        chars: locale === 'zh-CN' ? '本次字数' : 'Chars',
        mood: locale === 'zh-CN' ? '情绪' : 'Mood',
      },
      charCountLabel: charLabel(last.charBucket, locale),
      emotionLabel: (last.emotionTags || [])
        .map((tag) => i18n.t('emotion_' + tag))
        .join(' · '),
      quip: last.quip || '',
      mode: last.mode || '',
      bucket: last.charBucket || '',
      emotionTags: last.emotionTags || [],
      isFlagged: !!last.isFlagged,
    });

    analytics.events.page_view('result', {
      vent_mode: last.mode,
      char_count_bucket: last.charBucket,
      is_flagged: !!last.isFlagged,
    });
  },

  retry() {
    analytics.events.click('result_click_retry');
    wx.redirectTo({ url: '/pages/vent/index' });
  },

  goDashboard() {
    analytics.events.click('result_click_dashboard');
    wx.redirectTo({ url: '/pages/dashboard/index' });
  },

  async unlockPremium() {
    analytics.events.click('result_click_reward_unlock', {
      unlock_type: AD_UNLOCK_TYPES.ADVANCED_DESTROY,
    });
    const { completed, reason } = await ads.showRewardVideo({
      unlock_type: AD_UNLOCK_TYPES.ADVANCED_DESTROY,
      page_name: 'result',
    });
    if (completed) {
      wx.showToast({ title: i18n.getLocale() === 'zh-CN' ? '已解锁' : 'Unlocked', icon: 'success' });
      analytics.track('result_unlock_success', { unlock_type: AD_UNLOCK_TYPES.ADVANCED_DESTROY });
    } else if (reason === 'not_configured' || reason === 'api_unavailable') {
      wx.showToast({
        title: i18n.getLocale() === 'zh-CN' ? '广告暂不可用' : 'Ads unavailable',
        icon: 'none',
      });
    }
  },

  async backHome() {
    analytics.events.click('result_click_back_home');
    // Try interstitial here (PRD: insert at back-to-home)
    await ads.showInterstitial({ page_name: 'result' });
    wx.reLaunch({ url: '/pages/home/index' });
  },
});
