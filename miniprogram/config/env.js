// ============================================================================
// Environment config — single source of truth for API URL + public keys
// ============================================================================

// Supabase Edge Functions base URL
const API_BASE_URL = 'https://hdsqunbgppopzgqvtjvu.supabase.co/functions/v1';

// Supabase publishable (anon) key — safe to embed in client code; RLS protects data
// Replace with your full publishable key
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkc3F1bmJncHBvcHpncXZ0anZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTg0MzQsImV4cCI6MjA4ODA5NDQzNH0.Vqzw7rkbWbmH6FfOSBrSaDXafe2T-cEowsQ4LdvFrzs';

// App config
const APP_VERSION = '1.0.0';
const APP_NAME_CN = '还好吗';
const APP_NAME_EN = 'You OK?';

// Feature flags (can flip during testing)
const FEATURES = {
  ads_enabled: true,
  msg_sec_check_enabled: true,
  analytics_enabled: true,
};

// Ad unit IDs — replace with your real ones from WeChat Ads console
const AD_UNITS = {
  reward_video: 'adunit-xxxxxxxxxxxxxxxx',
  interstitial: 'adunit-xxxxxxxxxxxxxxxx',
  native: 'adunit-xxxxxxxxxxxxxxxx',
};

module.exports = {
  API_BASE_URL,
  SUPABASE_ANON_KEY,
  APP_VERSION,
  APP_NAME_CN,
  APP_NAME_EN,
  FEATURES,
  AD_UNITS,
};
