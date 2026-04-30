const i18n = require('../../utils/i18n.js');
const analytics = require('../../utils/analytics.js');
const ads = require('../../utils/ads.js');
const aiQuota = require('../../utils/ai-quota.js');
const { api } = require('../../utils/request.js');

function charLabel(bucket, locale) {
  const map = {
    bucket_1_20: locale === 'zh-CN' ? '1-20 字' : '1-20 chars',
    bucket_21_50: locale === 'zh-CN' ? '21-50 字' : '21-50 chars',
    bucket_51_100: locale === 'zh-CN' ? '51-100 字' : '51-100 chars',
    bucket_100_plus: locale === 'zh-CN' ? '100+ 字' : '100+ chars',
  };
  return map[bucket] || '';
}

function buildQuotaText(locale) {
  const q = aiQuota.getStatus();
  return locale === 'zh-CN'
    ? `今日剩余 ${q.remaining}/${q.limit} 次`
    : `${q.remaining}/${q.limit} left today`;
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

    // AI empathy state machine
    //   aiAvailable=true  → CTA card visible (payload in memory + quota left)
    //   aiState: 'idle' | 'loading' | 'done'
    aiAvailable: false,
    aiState: 'idle',
    aiResponse: '',
    aiQuotaText: '',
  },

  onLoad() {
    const locale = i18n.getLocale();
    const last = (getApp().globalData.lastVent) || {};
    const aiPayload = (getApp().globalData.aiPayload) || null;
    const quota = aiQuota.getStatus();

    // Show AI CTA only if (a) we have the in-memory text, (b) it hasn't
    // expired (5min TTL), and (c) the user has any quota left today.
    const payloadFresh = !!(aiPayload && aiPayload.expires_at > Date.now());
    const aiAvailable = payloadFresh && quota.remaining > 0;

    this.setData({
      t: {
        result_title: i18n.t('result_title'),
        result_retry: i18n.t('result_retry'),
        result_dashboard: i18n.t('result_dashboard'),
        result_smash: i18n.t('result_smash'),
        result_back_home: i18n.t('result_back_home'),
        ai_empathy_cta: i18n.t('ai_empathy_cta'),
        ai_empathy_button: i18n.t('ai_empathy_button'),
        ai_empathy_loading: i18n.t('ai_empathy_loading'),
        ai_empathy_label: i18n.t('ai_empathy_label'),
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
      aiAvailable,
      aiQuotaText: buildQuotaText(locale),
    });

    analytics.events.page_view('result', {
      vent_mode: last.mode,
      char_count_bucket: last.charBucket,
      is_flagged: !!last.isFlagged,
      ai_available: aiAvailable,
    });

    // If payload exists but is expired, drop it now — it's dead weight.
    if (aiPayload && !payloadFresh) {
      delete getApp().globalData.aiPayload;
    }
  },

  onUnload() {
    // Privacy hygiene: nuke the in-memory vent text the moment the user
    // leaves this page. retry/goSmash/goDashboard all wx.redirectTo away,
    // which fires onUnload — so this catches every exit path.
    delete getApp().globalData.aiPayload;
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

  // ─── AI empathy opt-in flow ──────────────────────────────────────────────

  async requestEmpathy() {
    const aiPayload = (getApp().globalData.aiPayload) || null;
    const locale = i18n.getLocale();

    // Defensive re-checks — UI guards already gated us, but state could have
    // drifted (e.g. user lingered past TTL).
    if (!aiPayload || aiPayload.expires_at <= Date.now()) {
      wx.showToast({ title: i18n.t('ai_empathy_expired'), icon: 'none' });
      this.setData({ aiAvailable: false });
      return;
    }
    const quota = aiQuota.getStatus();
    if (quota.exhausted) {
      wx.showToast({ title: i18n.t('ai_empathy_limit'), icon: 'none' });
      this.setData({ aiAvailable: false });
      return;
    }

    // Strong opt-in: confirm dialog spelling out the privacy trade-off.
    // This is the moment we send vent text outside the device for the only
    // time in the entire app — it has to be explicit.
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: i18n.t('ai_empathy_confirm_title'),
        content: i18n.t('ai_empathy_confirm_body'),
        confirmText: i18n.t('ai_empathy_confirm_ok'),
        cancelText: i18n.t('ai_empathy_confirm_cancel'),
        success: (r) => resolve(r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) {
      analytics.events.click('result_ai_empathy_declined');
      return;
    }

    analytics.events.click('result_ai_empathy_request', {
      vent_mode: aiPayload.vent_mode,
      emotion_tags: aiPayload.emotion_tags,
    });
    this.setData({ aiState: 'loading', aiResponse: '' });

    try {
      const res = await api.requestAiEmpathy({
        vent_text: aiPayload.text,
        emotion_tags: aiPayload.emotion_tags,
        vent_mode: aiPayload.vent_mode,
        locale,
      });
      const empathy = (res && res.empathy) || '';
      if (!empathy) throw new Error('empty empathy');

      // Self-destruct payload right after success — text has done its job.
      delete getApp().globalData.aiPayload;
      aiQuota.consume();

      this.setData({
        aiState: 'done',
        aiResponse: empathy,
        aiQuotaText: buildQuotaText(locale),
      });

      analytics.track('ai_empathy_success', {
        vent_mode: aiPayload.vent_mode,
        emotion_tags: aiPayload.emotion_tags,
        usage_prompt_tokens: res.usage?.prompt_tokens,
        usage_completion_tokens: res.usage?.completion_tokens,
      });
    } catch (err) {
      console.warn('ai empathy failed', err);
      this.setData({ aiState: 'idle' });
      const msgKey = err.body?.error === 'not_configured'
        ? 'ai_empathy_not_configured'
        : 'ai_empathy_error';
      wx.showToast({ title: i18n.t(msgKey), icon: 'none' });
      analytics.track('ai_empathy_failed', {
        error_code: err.body?.error || 'network',
        status: err.status,
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
