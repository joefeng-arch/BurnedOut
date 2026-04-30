// ============================================================================
// Analytics tracker — batches events, flushes on interval or size threshold
// ============================================================================

const env = require('../config/env.js');
const storage = require('./storage.js');
const { api } = require('./request.js');

const BUFFER_MAX = 20;
const FLUSH_INTERVAL_MS = 15000;

let buffer = [];
let flushing = false;
let timer = null;

function baseProps() {
  const app = getApp();
  return {
    session_id: storage.getOrCreateSessionId(),
    app_version: env.APP_VERSION,
    lang: (app && app.globalData && app.globalData.locale) || 'zh-CN',
    channel: 'mp-weixin',
    is_new_user: storage.dayIndex() === 0,
    day_index: storage.dayIndex(),
  };
}

function track(eventName, properties = {}, pageName) {
  if (!env.FEATURES.analytics_enabled) return;
  buffer.push({
    event_name: eventName,
    page_name: pageName || (properties && properties.page_name) || undefined,
    properties: properties || {},
    ...baseProps(),
  });

  if (buffer.length >= BUFFER_MAX) flush();
  else scheduleFlush();
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const events = buffer.splice(0, buffer.length);
  try {
    await api.trackEvents(events);
  } catch (err) {
    console.warn('analytics flush failed', err);
    // Re-queue up to BUFFER_MAX to avoid unbounded growth
    buffer = events.concat(buffer).slice(0, BUFFER_MAX);
  } finally {
    flushing = false;
  }
}

// Convenience helpers for common events
const events = {
  page_view: (pageName, extra) => track(`${pageName}_view`, extra || {}, pageName),
  click: (eventName, props) => track(eventName, props || {}),
};

module.exports = { track, flush, events };
