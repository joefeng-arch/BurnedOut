const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const ads = require('../../utils/ads.js');

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
        result_smash: i18n.t('result_smash'),
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

  // Second smash entry point — we already exposed it on the home page; the
  // moment right after a vent is the highest-intent moment for a "go smash
  // some plates to keep venting physically" CTA.
  goSmash() {
    analytics.events.click('result_click_smash');
    wx.redirectTo({ url: '/pages/smash/index' });
  },

  async backHome() {
    analytics.events.click('result_click_back_home');
    // Try interstitial here (PRD: insert at back-to-home)
    await ads.showInterstitial({ page_name: 'result' });
    wx.reLaunch({ url: '/pages/home/index' });
  },
});
