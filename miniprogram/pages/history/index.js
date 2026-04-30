const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const { api } = require('../../utils/request.js');
const { BURN_LEVELS } = require('../../utils/constants.js');

const PAGE_SIZE = 30;

function formatDate(dateStr, locale) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const y = d.getFullYear();
    if (locale === 'zh-CN') return `${y}年${m}月${day}日`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${y}`;
  } catch (e) {
    return dateStr;
  }
}

Page({
  data: {
    t: {},
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    offset: 0,
  },

  onLoad() {
    this.setData({
      t: {
        history_title: i18n.t('history_title'),
        history_empty: i18n.t('history_empty'),
      },
    });
    analytics.events.page_view('history');
    this.loadPage(true);
  },

  onPullDownRefresh() {
    this.setData({ items: [], offset: 0, hasMore: true });
    this.loadPage(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return;
    this.loadPage(false);
  },

  async loadPage(isInitial) {
    const locale = i18n.getLocale();
    if (isInitial) this.setData({ loading: true });
    else this.setData({ loadingMore: true });

    try {
      const res = await api.getCheckInHistory(PAGE_SIZE, this.data.offset);
      const raw = (res && res.items) || [];
      const mapped = raw.map((row) => {
        const lv = BURN_LEVELS.find((b) => b.value === row.burn_level) || {};
        return {
          id: row.id,
          date: row.date,
          dateLabel: formatDate(row.date, locale),
          burn_level: row.burn_level,
          levelLabel: i18n.t('level_' + row.burn_level),
          emoji: lv.emoji || '•',
          emotionLabels: (row.emotion_tags || []).map((tag) =>
            i18n.t('emotion_' + tag),
          ),
        };
      });

      const items = isInitial ? mapped : this.data.items.concat(mapped);
      this.setData({
        items,
        offset: items.length,
        hasMore: raw.length === PAGE_SIZE,
        loading: false,
        loadingMore: false,
      });
    } catch (err) {
      this.setData({ loading: false, loadingMore: false });
      wx.showToast({
        title: (err && err.message) || 'Error',
        icon: 'none',
      });
    }
  },
});
