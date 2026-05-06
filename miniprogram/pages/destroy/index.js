const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const sound = require('../../utils/sound.js');

// One sound file per destroy variant. Filenames intentionally short + ASCII
// for cross-platform path safety (iOS in particular flakes on URL-encoded
// CJK paths inside InnerAudioContext.src).
//
// Note: 'black_hole' / 'garbage_truck' map to shorter filenames. The
// underscore-vs-dash inconsistency is because the DB enum uses underscores
// (snake_case) while web/asset convention is dashes — we don't try to
// reconcile them, just map explicitly here.
const SOUND_BY_TYPE = {
  shredder:      '/assets/sounds/destroy-shredder.mp3',
  fire:          '/assets/sounds/destroy-fire.mp3',
  black_hole:    '/assets/sounds/destroy-hole.mp3',
  garbage_truck: '/assets/sounds/destroy-truck.mp3',
};

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
      // Fire the per-type sound effect synchronously with the processing
      // stage. sound.play() is a no-op when SFX is disabled (default off)
      // OR when the file is missing — so this is safe even if a future
      // type gets added without an mp3.
      const src = SOUND_BY_TYPE[type];
      if (src) sound.play(src);
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
