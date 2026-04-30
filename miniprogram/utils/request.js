// ============================================================================
// wx.request wrapper — adds auth headers, JSON body, timeout, error normalization
// ============================================================================

const env = require('../config/env.js');
const storage = require('./storage.js');

function request(options) {
  const { path, method = 'GET', data, query, timeout = 10000 } = options;

  let url = env.API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
  if (query && typeof query === 'object') {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const deviceId = storage.getOrCreateDeviceId();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.SUPABASE_ANON_KEY,
        apikey: env.SUPABASE_ANON_KEY,
        'X-Device-ID': deviceId,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const err = new Error(
            (res.data && res.data.message) || `HTTP ${res.statusCode}`,
          );
          err.status = res.statusCode;
          err.body = res.data;
          reject(err);
        }
      },
      fail: (err) => {
        reject(new Error('Network error: ' + (err && err.errMsg)));
      },
    });
  });
}

// ============================================================================
// API surface — mirrors the Edge Functions
// ============================================================================

const api = {
  registerUser: (body) =>
    request({ path: '/users-register', method: 'POST', data: body }),

  // Check-ins
  createCheckIn: (body) =>
    request({ path: '/check-ins', method: 'POST', data: body }),
  getTodayCheckIn: () =>
    request({ path: '/check-ins/today' }),
  getCheckInHistory: (limit = 30, offset = 0) =>
    request({ path: '/check-ins/history', query: { limit, offset } }),

  // Vents
  submitVent: (body) =>
    request({ path: '/vents', method: 'POST', data: body }),
  getTodayVentCount: () =>
    request({ path: '/vents/today-count' }),

  // Quips
  getRandomQuip: (locale, mode, high_risk = false) =>
    request({
      path: '/quips-random',
      query: { locale, mode, high_risk },
    }),

  // Dashboard
  getDashboard: () => request({ path: '/dashboard-user' }),

  // Analytics + Ad events
  trackEvents: (events) =>
    request({ path: '/analytics-events', method: 'POST', data: { events } }),
  trackAdEvents: (events) =>
    request({ path: '/ad-events', method: 'POST', data: { events } }),

  // AI empathy — opt-in, sends vent text to bltcy.ai relay via our edge fn.
  // Bigger timeout because LLM round-trip is multi-second.
  requestAiEmpathy: (body) =>
    request({ path: '/ai-empathy', method: 'POST', data: body, timeout: 12000 }),
};

module.exports = { request, api };
