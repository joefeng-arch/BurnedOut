const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');

Page({
  data: {
    type: 'shredder',
    stage: 'enter',   // enter | processing | done
    t: {},
    eggCaption: '',   // overlay text from keyword egg (empty = no egg)
    eggEmoji: '',
  },

  onLoad(query) {
    const type = query.type || 'shredder';
    const locale = i18n.getLocale();

    // Resolve egg from globalData (the source of truth — query param is just
    // a hint that an egg exists). globalData carries the localized strings
    // so we don't have to dup the keyword table here.
    const lastVent = (getApp().globalData.lastVent) || {};
    const egg = lastVent.egg || null;
    const eggCaption = egg ? (locale === 'en-GB' ? egg.en : egg.zh) : '';
    const eggEmoji = egg ? egg.emoji : '';

    this.setData({
      type,
      eggCaption,
      eggEmoji,
      t: {
        destroy_processing: i18n.t('destroy_processing'),
        destroy_done: i18n.t('destroy_done'),
      },
    });
    analytics.events.page_view('destroy', {
      destroy_type: type,
      egg_key: egg ? egg.key : null,
    });

    // Light haptic feedback on entry
    wx.vibrateShort({ type: 'light' });

    // Kick off animation
    setTimeout(() => {
      this.setData({ stage: 'processing' });
      analytics.track('destroy_anim_start', { destroy_type: type });
    }, 200);

    // Done state at ~2.4s
    setTimeout(() => {
      this.setData({ stage: 'done' });
      wx.vibrateShort({ type: 'medium' });
      analytics.track('destroy_anim_complete', { destroy_type: type });
    }, 2600);

    // Navigate to result at ~3.2s
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/result/index' });
    }, 3400);
  },
});
