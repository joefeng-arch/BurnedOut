const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const { api } = require('../../utils/request.js');

function burnColor(level) {
  // 1 green → 5 red
  const colors = ['#4cd964', '#ffcc00', '#ff9500', '#ff6b35', '#ff3b30'];
  const idx = Math.max(0, Math.min(4, (level || 1) - 1));
  return colors[idx];
}

function dayShort(dateStr, locale) {
  // dateStr like '2026-04-20'
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (locale === 'zh-CN') {
      return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    }
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
  } catch (e) {
    return '';
  }
}

function formatHour(h, locale) {
  if (h === null || h === undefined) return '';
  const hh = String(h).padStart(2, '0');
  return `${hh}:00 - ${hh}:59`;
}

Page({
  data: {
    t: {},
    loading: true,
    trend: [],
    emotions: [],
    streakLabel: '',
    deltaLabel: '',
    peakHourLabel: '',
  },

  onLoad() {
    this.setData({
      t: {
        dashboard_title: i18n.t('dashboard_title'),
        dashboard_7_day: i18n.t('dashboard_7_day'),
        dashboard_peak_hour: i18n.t('dashboard_peak_hour'),
        dashboard_emotions: i18n.t('dashboard_emotions'),
        share_share: i18n.t('share_share'),
        history_title: i18n.t('history_title'),
      },
    });
    analytics.events.page_view('dashboard');
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    const locale = i18n.getLocale();
    this.setData({ loading: true });
    try {
      const res = await api.getDashboard();
      const trend = (res.trend || []).map((d) => {
        const level = Number(d.burn_level) || 0;
        return {
          date: d.date,
          avg: level,
          pct: level > 0 ? Math.round((level / 5) * 100) : 4,
          color: burnColor(level),
          dayShort: dayShort(d.date, locale),
        };
      });

      const emotions = (res.emotions || []).map((e) => ({
        tag: e.emotion,
        count: e.count,
        label: i18n.t('emotion_' + e.emotion),
      }));

      const streak = Number(res.streak || 0);
      const streakLabel = streak > 0
        ? i18n.t('dashboard_streak', { n: streak })
        : '';

      let deltaLabel = '';
      // weekly_delta returns { this_week_avg, last_week_avg, delta }
      const wd = res.weekly_delta;
      if (wd && wd.last_week_avg !== null && wd.last_week_avg !== undefined && Number(wd.last_week_avg) > 0) {
        const delta = Number(wd.delta) || 0;
        const absDelta = Math.abs(delta).toFixed(1);
        if (delta > 0.2) {
          deltaLabel = i18n.t('dashboard_delta_up', { delta: '+' + absDelta });
        } else if (delta < -0.2) {
          deltaLabel = i18n.t('dashboard_delta_down', { delta: '-' + absDelta });
        } else {
          deltaLabel = i18n.t('dashboard_delta_same');
        }
      }
      // No deltaLabel if there's no last week data — avoids the misleading
      // "和上周差不多" message for users with only today's data.

      let peakHourLabel = '';
      if (res.peak_hours && res.peak_hours.length) {
        peakHourLabel = res.peak_hours
          .slice(0, 2)
          .map((ph) => formatHour(ph.hour, locale))
          .join(' · ');
      }

      this.setData({
        trend,
        emotions,
        streakLabel,
        deltaLabel,
        peakHourLabel,
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({
        title: (err && err.message) || 'Error',
        icon: 'none',
      });
    }
  },

  goShare() {
    analytics.events.click('dashboard_click_share');
    wx.navigateTo({ url: '/pages/share/index' });
  },

  goHistory() {
    analytics.events.click('dashboard_click_history');
    wx.navigateTo({ url: '/pages/history/index' });
  },
});
