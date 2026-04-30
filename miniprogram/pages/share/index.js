const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const { api } = require('../../utils/request.js');
const { BURN_LEVELS } = require('../../utils/constants.js');

function avgOf(trend) {
  if (!trend || trend.length === 0) return 0;
  const vals = trend.map((d) => Number(d.burn_level) || 0).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function weekRangeLabel(locale) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  if (locale === 'zh-CN') return `${fmt(start)} - ${fmt(now)}`;
  return `${fmt(start)} – ${fmt(now)}`;
}

Page({
  data: {
    t: {},
    appName: '',
    weekLabel: '',
    avgEmoji: '•',
    avgLevelLabel: '',
    streak: 0,
    ventCount: 0,
    topEmotion: '-',
    footerQuip: '',
    statLabels: {
      streak: '',
      vents: '',
      emotion: '',
    },
    busy: false,

    // Raw for canvas
    _raw: null,
  },

  onLoad() {
    const locale = i18n.getLocale();
    this.setData({
      t: {
        share_title: i18n.t('share_title'),
        share_save: i18n.t('share_save'),
        share_share: i18n.t('share_share'),
      },
      appName: i18n.t('app_name'),
      weekLabel: weekRangeLabel(locale),
      statLabels: {
        streak: locale === 'zh-CN' ? '连续打卡' : 'Streak',
        vents: locale === 'zh-CN' ? '本周发泄' : 'Vents',
        emotion: locale === 'zh-CN' ? '最常见' : 'Top',
      },
      footerQuip:
        locale === 'zh-CN'
          ? '匿名记录，废得有迹可循。'
          : 'Anonymous. Burnt with receipts.',
    });
    analytics.events.page_view('share');
    this.load();
  },

  async load() {
    try {
      const res = await api.getDashboard();
      const avg = avgOf(res.trend || []);
      const levelRounded = Math.max(1, Math.min(5, Math.round(avg) || 1));
      const lv = BURN_LEVELS.find((b) => b.value === levelRounded) || {};

      // Vent count isn't returned by the trend RPC — sum from emotions which
      // includes both check-ins and vents. Close enough for a share card.
      const ventCount = (res.emotions || []).reduce(
        (s, e) => s + (Number(e.count) || 0),
        0,
      );

      const topE = (res.emotions || [])[0];
      const topEmotion = topE
        ? i18n.t('emotion_' + topE.emotion)
        : '-';

      this.setData({
        avgEmoji: lv.emoji || '•',
        avgLevelLabel: avg > 0 ? i18n.t('level_' + levelRounded) : '-',
        streak: Number(res.streak || 0),
        ventCount,
        topEmotion,
        _raw: res,
      });
    } catch (err) {
      wx.showToast({
        title: (err && err.message) || 'Error',
        icon: 'none',
      });
    }
  },

  drawCanvas() {
    return new Promise((resolve) => {
      const ctx = wx.createCanvasContext('shareCanvas', this);
      const W = 600;
      const H = 800;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#2a0008');
      grad.addColorStop(1, '#0a0a0a');
      ctx.setFillStyle(grad);
      ctx.fillRect(0, 0, W, H);

      // Brand
      ctx.setFillStyle('#ff3b30');
      ctx.setFontSize(24);
      ctx.setTextAlign('left');
      ctx.fillText(this.data.appName, 40, 60);

      // Week
      ctx.setFillStyle('rgba(255,255,255,0.5)');
      ctx.setFontSize(18);
      ctx.setTextAlign('right');
      ctx.fillText(this.data.weekLabel, W - 40, 60);

      // Big emoji
      ctx.setFontSize(120);
      ctx.setTextAlign('center');
      ctx.fillText(this.data.avgEmoji, W / 2, 260);

      // Level label
      ctx.setFillStyle('#ffffff');
      ctx.setFontSize(36);
      ctx.fillText(this.data.avgLevelLabel, W / 2, 330);

      // Stat row
      const stats = [
        { value: String(this.data.streak), label: this.data.statLabels.streak },
        { value: String(this.data.ventCount), label: this.data.statLabels.vents },
        { value: this.data.topEmotion, label: this.data.statLabels.emotion },
      ];
      const colW = W / 3;
      stats.forEach((s, i) => {
        const cx = colW * i + colW / 2;
        ctx.setFillStyle('#ffffff');
        ctx.setFontSize(44);
        ctx.fillText(s.value, cx, 480);
        ctx.setFillStyle('rgba(255,255,255,0.5)');
        ctx.setFontSize(20);
        ctx.fillText(s.label, cx, 520);
      });

      // Divider
      ctx.setStrokeStyle('rgba(255,255,255,0.12)');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(40, 620);
      ctx.lineTo(W - 40, 620);
      ctx.stroke();

      // Footer
      ctx.setFillStyle('rgba(255,255,255,0.7)');
      ctx.setFontSize(22);
      ctx.setTextAlign('center');
      ctx.fillText(this.data.footerQuip, W / 2, 680);

      // Tagline
      ctx.setFillStyle('rgba(255,255,255,0.35)');
      ctx.setFontSize(18);
      ctx.fillText(i18n.t('app_tagline'), W / 2, 730);

      ctx.draw(false, () => {
        setTimeout(resolve, 80);
      });
    });
  },

  async saveImage() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    analytics.events.click('share_click_save');

    try {
      await this.drawCanvas();
      const tempFile = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath(
          {
            canvasId: 'shareCanvas',
            width: 600,
            height: 800,
            destWidth: 1200,
            destHeight: 1600,
            success: (r) => resolve(r.tempFilePath),
            fail: (e) => reject(e),
          },
          this,
        );
      });

      wx.saveImageToPhotosAlbum({
        filePath: tempFile,
        success: () => {
          wx.showToast({
            title: i18n.getLocale() === 'zh-CN' ? '已保存' : 'Saved',
            icon: 'success',
          });
          analytics.track('share_save_success');
        },
        fail: (err) => {
          if (err && err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
            wx.showModal({
              title: i18n.getLocale() === 'zh-CN' ? '需要相册权限' : 'Album permission needed',
              content: i18n.getLocale() === 'zh-CN' ? '请在设置中开启相册权限' : 'Please enable album permission in Settings',
              confirmText: i18n.getLocale() === 'zh-CN' ? '去设置' : 'Open Settings',
              success: (r) => {
                if (r.confirm) wx.openSetting();
              },
            });
          } else {
            wx.showToast({ title: 'Save failed', icon: 'none' });
          }
          analytics.track('share_save_fail', { err: err && err.errMsg });
        },
      });
    } catch (e) {
      wx.showToast({ title: 'Error', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  onShareBtn() {
    analytics.events.click('share_click_wechat');
  },

  onShareAppMessage() {
    analytics.track('share_to_friend');
    const locale = i18n.getLocale();
    return {
      title:
        locale === 'zh-CN'
          ? '我今天也有点废，你呢？'
          : 'I am a bit burned out today. You?',
      path: '/pages/home/index',
      imageUrl: '',
    };
  },

  onShareTimeline() {
    analytics.track('share_to_timeline');
    const locale = i18n.getLocale();
    return {
      title:
        locale === 'zh-CN'
          ? '还好吗 — 情绪发泄器'
          : 'You OK? — Emotion Vent',
    };
  },
});
