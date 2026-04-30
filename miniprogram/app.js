// ============================================================================
// App entry — registers anonymous user, flushes analytics, inits locale
// ============================================================================

const storage = require('./utils/storage.js');
const i18n = require('./utils/i18n.js');
const analytics = require('./utils/analytics.js');
const env = require('./config/env.js');
const { api } = require('./utils/request.js');

// Startup config sanity check — surfaces missing keys in DevTools console
// immediately rather than waiting for the first 401 from Supabase.
function assertConfig() {
  const issues = [];
  if (!env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY.indexOf('REPLACE_') === 0) {
    issues.push('SUPABASE_ANON_KEY is a placeholder — fill miniprogram/config/env.js');
  }
  if (!env.API_BASE_URL || env.API_BASE_URL.indexOf('https://') !== 0) {
    issues.push('API_BASE_URL must be HTTPS');
  }
  if (issues.length) {
    console.error('[env] config issues:\n- ' + issues.join('\n- '));
  }
}

App({
  globalData: {
    user: null,
    locale: 'zh-CN',
    device_id: '',
  },

  async onLaunch() {
    assertConfig();

    // Initialize device_id + session
    this.globalData.device_id = storage.getOrCreateDeviceId();
    this.globalData.locale = i18n.getLocale();

    // Register user (idempotent)
    try {
      const res = await api.registerUser({
        device_id: this.globalData.device_id,
        locale: this.globalData.locale,
      });
      this.globalData.user = res.user;
      storage.set(storage.KEYS.USER_ID, res.user.id);
    } catch (err) {
      console.warn('user register failed (will retry later)', err);
    }

    analytics.track('app_launch', { new_user: storage.dayIndex() === 0 });
  },

  onShow() {
    analytics.track('app_show');
  },

  onHide() {
    analytics.flush();
  },
});
