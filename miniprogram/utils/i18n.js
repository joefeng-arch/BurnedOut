// ============================================================================
// i18n — zh-CN / en-GB
// ============================================================================

const strings = {
  'zh-CN': {
    app_name: '还好吗',
    app_tagline: '情绪发泄器',
    home_question: '今天你废了吗？',
    home_vent_now: '马上发泄',
    home_checkin: '今日打卡',
    home_see_trend: '看看最近状态',
    home_privacy: '匿名使用，不保存发泄原文',

    checkin_title: '今日打卡',
    checkin_subtitle: '选一下你现在的电量',
    checkin_emotion: '现在最像哪种情绪？',
    checkin_submit: '完成打卡',
    checkin_success: '打卡成功',
    checkin_already: '今日已打过卡了',

    // Burn levels
    level_1: '满电',
    level_2: '有点累',
    level_3: '快没电',
    level_4: '很废',
    level_5: '完全关机',

    // Emotion tags
    emotion_tired: '累',
    emotion_annoyed: '烦',
    emotion_angry: '气',
    emotion_empty: '空',
    emotion_sad: '想哭',

    // Vent modes
    mode_quick_rant: '快速乱喷',
    mode_polite_rage: '文明发疯',
    mode_late_night: '深夜低气压',

    vent_placeholder: '打在这，一键销毁，不留痕迹',
    vent_destroy: '立即销毁',
    vent_chars: '{n} 字',
    vent_warning: '内容不会保存，只统计匿名数据',
    vent_limit_reached: '今日免费次数用完啦',
    vent_unlock_via_ad: '看个广告再发泄一次',
    vent_max_reached: '今天额度都用完了，明天再来',

    // Destroy types
    destroy_shredder: '碎纸机',
    destroy_fire: '火烧',
    destroy_black_hole: '黑洞',
    destroy_garbage_truck: '垃圾车',
    destroy_processing: '正在替你处理这团破情绪…',
    destroy_done: '已替你处理这团破情绪',

    // Result
    result_title: '搞定了',
    result_retry: '再来一轮',
    result_dashboard: '看看我最近有多废',
    result_smash: '摔几个盘子',
    result_back_home: '回首页',

    // Dashboard
    dashboard_title: '最近状态',
    dashboard_7_day: '近 7 天废度',
    dashboard_peak_hour: '本周高压时段',
    dashboard_emotions: '最常见情绪',
    dashboard_streak: '连续打卡 {n} 天',
    dashboard_delta_up: '比上周更废了 ({delta})',
    dashboard_delta_down: '比上周好一点 ({delta})',
    dashboard_delta_same: '和上周差不多',

    // History
    history_title: '打卡记录',
    history_empty: '还没有打卡记录',

    // Share
    share_title: '我的废度',
    share_save: '长按保存图片',
    share_share: '分享给朋友',

    // Smash plates
    home_smash: '摔盘子 · 摇晃手机',
    smash_title: '摔盘子',
    smash_hint: '摇晃手机摔碎它',
    smash_record: '今日记录 {n}',
    smash_exhausted: '今日额度用完了',
    smash_unlock_ad: '看广告 +20 个',
    smash_unlock_maxed: '今日已解锁上限',
    smash_done: '差不多了 →',
    smash_sound_on: '🔊 音效已开',
    smash_sound_off: '🔇 开音效',
    smash_milestone_10: '热身完毕',
    smash_milestone_50: '店家要破产了',
    smash_milestone_100: '你今天可以了',
  },
  'en-GB': {
    app_name: 'You OK?',
    app_tagline: 'Emotion Vent',
    home_question: 'Burned out today?',
    home_vent_now: 'Vent now',
    home_checkin: 'Check in',
    home_see_trend: 'See my trend',
    home_privacy: 'Anonymous. We never store what you type.',

    checkin_title: 'Daily Check-in',
    checkin_subtitle: 'How charged are you today?',
    checkin_emotion: 'Which emotion fits?',
    checkin_submit: 'Check in',
    checkin_success: 'Checked in',
    checkin_already: 'Already checked in today',

    level_1: 'Fully charged',
    level_2: 'A bit tired',
    level_3: 'Low battery',
    level_4: 'Very burned',
    level_5: 'Shut down',

    emotion_tired: 'Tired',
    emotion_annoyed: 'Annoyed',
    emotion_angry: 'Angry',
    emotion_empty: 'Empty',
    emotion_sad: 'Sad',

    mode_quick_rant: 'Quick rant',
    mode_polite_rage: 'Polite rage',
    mode_late_night: 'Late night',

    vent_placeholder: 'Type here. One tap to destroy. No trace.',
    vent_destroy: 'Destroy now',
    vent_chars: '{n} chars',
    vent_warning: 'Content is never saved. Only anon stats.',
    vent_limit_reached: 'Free vents used up today',
    vent_unlock_via_ad: 'Watch an ad to unlock one more',
    vent_max_reached: 'Daily limit reached. See you tomorrow.',

    destroy_shredder: 'Shredder',
    destroy_fire: 'Fire',
    destroy_black_hole: 'Black hole',
    destroy_garbage_truck: 'Garbage truck',
    destroy_processing: 'Destroying your mess…',
    destroy_done: 'Gone. Cleaned up for you.',

    result_title: 'All done',
    result_retry: 'Go again',
    result_dashboard: 'See my trend',
    result_smash: 'Smash some plates',
    result_back_home: 'Back',

    dashboard_title: 'Recent State',
    dashboard_7_day: 'Last 7 days',
    dashboard_peak_hour: 'Peak hours this week',
    dashboard_emotions: 'Most common emotions',
    dashboard_streak: '{n} day streak',
    dashboard_delta_up: 'Worse than last week ({delta})',
    dashboard_delta_down: 'Better than last week ({delta})',
    dashboard_delta_same: 'About the same as last week',

    history_title: 'Check-in History',
    history_empty: 'No check-ins yet',

    share_title: 'My burnout stats',
    share_save: 'Long press to save',
    share_share: 'Share with friends',

    // Smash plates
    home_smash: 'Smash plates · shake to play',
    smash_title: 'Smash Plates',
    smash_hint: 'Shake your phone hard',
    smash_record: 'Today {n}',
    smash_exhausted: "You're out of plates today",
    smash_unlock_ad: 'Watch ad for 20 more',
    smash_unlock_maxed: 'Max unlocks reached',
    smash_done: 'Enough →',
    smash_sound_on: '🔊 SFX on',
    smash_sound_off: '🔇 Enable SFX',
    smash_milestone_10: 'Warmed up',
    smash_milestone_50: 'The shop is going bankrupt',
    smash_milestone_100: 'You did good today',
  },
};

function getLocale() {
  try {
    const cached = wx.getStorageSync('locale');
    if (cached) return cached;
    const sysInfo = wx.getSystemInfoSync();
    const lang = (sysInfo.language || 'zh_CN').toLowerCase();
    return lang.startsWith('zh') ? 'zh-CN' : 'en-GB';
  } catch (e) {
    return 'zh-CN';
  }
}

function t(key, vars) {
  const locale = getApp()?.globalData?.locale || getLocale();
  const raw = (strings[locale] && strings[locale][key]) || strings['zh-CN'][key] || key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

function setLocale(locale) {
  wx.setStorageSync('locale', locale);
  const app = getApp();
  if (app) app.globalData.locale = locale;
}

module.exports = { t, getLocale, setLocale };
