// ============================================================================
// Storage helpers — persistent via wx.setStorageSync
// ============================================================================

const KEYS = {
  DEVICE_ID: 'device_id',
  USER_ID: 'user_id',
  LOCALE: 'locale',
  REGION: 'region',
  FIRST_LAUNCH_AT: 'first_launch_at',
  SESSION_ID: 'session_id',
  LAST_SESSION_AT: 'last_session_at',
};

function get(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return v !== '' && v !== undefined && v !== null ? v : fallback;
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.warn('storage.set failed', key, e);
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch {}
}

// Generate a v4-ish UUID (not cryptographically strong; good enough for device_id)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOrCreateDeviceId() {
  let id = get(KEYS.DEVICE_ID);
  if (!id) {
    id = generateId();
    set(KEYS.DEVICE_ID, id);
    set(KEYS.FIRST_LAUNCH_AT, Date.now());
  }
  return id;
}

// Session = 30 min of inactivity resets
function getOrCreateSessionId() {
  const last = get(KEYS.LAST_SESSION_AT, 0);
  const now = Date.now();
  let sid = get(KEYS.SESSION_ID);
  if (!sid || now - last > 30 * 60 * 1000) {
    sid = generateId();
    set(KEYS.SESSION_ID, sid);
  }
  set(KEYS.LAST_SESSION_AT, now);
  return sid;
}

function dayIndex() {
  const first = get(KEYS.FIRST_LAUNCH_AT, Date.now());
  return Math.floor((Date.now() - first) / (24 * 60 * 60 * 1000));
}

module.exports = {
  KEYS,
  get,
  set,
  remove,
  generateId,
  getOrCreateDeviceId,
  getOrCreateSessionId,
  dayIndex,
};
