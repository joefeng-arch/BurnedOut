// ============================================================================
// Ads SDK wrapper — reward video + interstitial
// Tracks ad funnel via ad-events endpoint.
// ============================================================================

const env = require('../config/env.js');
const storage = require('./storage.js');
const { api } = require('./request.js');

let rewardAd = null;
let interstitialAd = null;

function sessionId() {
  return storage.getOrCreateSessionId();
}

// Guard against placeholder ad unit IDs (anything that is empty, undefined,
// or still contains the "xxxx" from the env.js template). In that state we
// silently no-op so the app can run through WeChat review before the 流量主
// account is provisioned.
function isValidAdUnit(adUnitId) {
  if (!adUnitId) return false;
  if (typeof adUnitId !== 'string') return false;
  if (adUnitId.indexOf('xxxx') > -1) return false;
  return true;
}

function trackAd(stage, opts = {}) {
  if (!env.FEATURES.ads_enabled) return;
  api
    .trackAdEvents([
      {
        ad_type: opts.ad_type || 'reward',
        stage,
        session_id: sessionId(),
        unlock_type: opts.unlock_type,
        is_completed: opts.is_completed,
        page_name: opts.page_name,
      },
    ])
    .catch((err) => console.warn('ad event track failed', err));
}

// ---------------------------------------------------------------------------
// Reward video — resolves with { completed: boolean }
// ---------------------------------------------------------------------------
function showRewardVideo({ unlock_type, page_name }) {
  return new Promise((resolve) => {
    if (!wx.createRewardedVideoAd) {
      resolve({ completed: false, reason: 'api_unavailable' });
      return;
    }
    if (!isValidAdUnit(env.AD_UNITS.reward_video)) {
      console.warn('[ads] reward_video adUnitId not configured — skipping');
      resolve({ completed: false, reason: 'not_configured' });
      return;
    }

    if (!rewardAd) {
      rewardAd = wx.createRewardedVideoAd({ adUnitId: env.AD_UNITS.reward_video });
    }

    trackAd('request', { ad_type: 'reward', unlock_type, page_name });

    let didClose = false;
    let completed = false;

    const onClose = (res) => {
      if (didClose) return;
      didClose = true;
      completed = !!(res && res.isEnded !== false);
      trackAd('close', {
        ad_type: 'reward',
        unlock_type,
        is_completed: completed,
        page_name,
      });
      if (completed) {
        trackAd('reward_grant', { ad_type: 'reward', unlock_type, page_name });
      }
      rewardAd.offClose(onClose);
      rewardAd.offError(onError);
      resolve({ completed });
    };
    const onError = (err) => {
      if (didClose) return;
      didClose = true;
      console.warn('reward ad error', err);
      trackAd('fill_fail', { ad_type: 'reward', unlock_type, page_name });
      rewardAd.offClose(onClose);
      rewardAd.offError(onError);
      resolve({ completed: false, reason: 'error' });
    };

    rewardAd.onClose(onClose);
    rewardAd.onError(onError);

    rewardAd.load().then(() => {
      trackAd('fill_success', { ad_type: 'reward', unlock_type, page_name });
      trackAd('show', { ad_type: 'reward', unlock_type, page_name });
      rewardAd.show().catch((err) => {
        console.warn('reward show failed', err);
        onError(err);
      });
    }).catch((err) => onError(err));
  });
}

// ---------------------------------------------------------------------------
// Interstitial — throttled (1 per session, 3 per day max, min 2 vent gap)
// ---------------------------------------------------------------------------
const INTERSTITIAL_KEYS = {
  DAILY: 'interstitial_daily',   // { date: 'YYYY-MM-DD', count: 0 }
  SESSION: 'interstitial_session', // sessionId shown in
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function canShowInterstitial() {
  const daily = storage.get(INTERSTITIAL_KEYS.DAILY, { date: '', count: 0 });
  if (daily.date === todayStr() && daily.count >= 3) return false;
  const session = storage.get(INTERSTITIAL_KEYS.SESSION);
  if (session && session === sessionId()) return false;
  return true;
}

function markInterstitialShown() {
  const today = todayStr();
  const daily = storage.get(INTERSTITIAL_KEYS.DAILY, { date: '', count: 0 });
  const newDaily = {
    date: today,
    count: daily.date === today ? daily.count + 1 : 1,
  };
  storage.set(INTERSTITIAL_KEYS.DAILY, newDaily);
  storage.set(INTERSTITIAL_KEYS.SESSION, sessionId());
}

function showInterstitial({ page_name } = {}) {
  if (!canShowInterstitial()) return Promise.resolve({ shown: false, reason: 'throttled' });
  if (!wx.createInterstitialAd) return Promise.resolve({ shown: false, reason: 'api_unavailable' });
  if (!isValidAdUnit(env.AD_UNITS.interstitial)) {
    console.warn('[ads] interstitial adUnitId not configured — skipping');
    return Promise.resolve({ shown: false, reason: 'not_configured' });
  }

  if (!interstitialAd) {
    interstitialAd = wx.createInterstitialAd({ adUnitId: env.AD_UNITS.interstitial });
  }

  trackAd('request', { ad_type: 'interstitial', page_name });
  return interstitialAd
    .show()
    .then(() => {
      markInterstitialShown();
      trackAd('show', { ad_type: 'interstitial', page_name });
      return { shown: true };
    })
    .catch((err) => {
      console.warn('interstitial show failed', err);
      trackAd('fill_fail', { ad_type: 'interstitial', page_name });
      return { shown: false, reason: 'error' };
    });
}

module.exports = { showRewardVideo, showInterstitial };
