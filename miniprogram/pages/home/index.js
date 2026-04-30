const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const env = require('../../config/env.js');
const { getTodayPhrase } = require('../../utils/daily-phrases.js');

function buildT(locale) {
  const keys = [
    'home_question', 'home_vent_now', 'home_checkin', 'home_smash',
    'home_see_trend', 'home_privacy',
  ];
  const out = {};
  for (const k of keys) out[k] = i18n.t(k);
  return out;
}

Page({
  data: {
    appName: env.APP_NAME_CN,
    t: {},
    locale: 'zh-CN',
    dailyPhrase: '',
  },

  onLoad() {
    const locale = i18n.getLocale();
    this.setData({
      t: buildT(locale),
      locale,
      appName: locale === 'zh-CN' ? env.APP_NAME_CN : env.APP_NAME_EN,
      dailyPhrase: getTodayPhrase(locale),
    });
    analytics.events.page_view('home');
  },

  goVent() {
    analytics.events.click('home_click_vent');
    wx.navigateTo({ url: '/pages/vent/index' });
  },

  goCheckin() {
    analytics.events.click('home_click_checkin');
    wx.navigateTo({ url: '/pages/checkin/index' });
  },

  goSmash() {
    analytics.events.click('home_click_smash');
    wx.navigateTo({ url: '/pages/smash/index' });
  },

  goDashboard() {
    analytics.events.click('home_click_dashboard');
    wx.navigateTo({ url: '/pages/dashboard/index' });
  },

  switchLang(e) {
    const lang = e.currentTarget.dataset.lang;
    i18n.setLocale(lang);
    this.setData({
      t: buildT(lang),
      locale: lang,
      appName: lang === 'zh-CN' ? env.APP_NAME_CN : env.APP_NAME_EN,
      dailyPhrase: getTodayPhrase(lang),
    });
    analytics.events.click('home_switch_lang', { lang });
  },

  onShareAppMessage() {
    return {
      title: i18n.getLocale() === 'zh-CN' ? '还好吗？来发泄一下' : 'You OK? Come vent.',
      path: '/pages/home/index',
    };
  },
});
