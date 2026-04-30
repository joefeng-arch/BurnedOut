// ============================================================================
// AI empathy daily quota — pure client-side
// ============================================================================
//
// Each AI empathy call costs us real money (~¥0.0006 with deepseek-v4-flash).
// Cap at 3/day per device to keep average cost well under 2 fen/user/day even
// in worst case. If a real cost problem appears we'll layer server-side rate
// limiting on top — for now client-side is enough to handle non-malicious use.
//
// Storage shape:
//   ai_empathy_daily = { date: 'YYYY-MM-DD', used: number }

const storage = require('./storage.js');

const KEY_DAILY = 'ai_empathy_daily';
const DAILY_LIMIT = 3;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaily() {
  const today = todayStr();
  const cur = storage.get(KEY_DAILY, null);
  if (!cur || cur.date !== today) {
    return { date: today, used: 0 };
  }
  return cur;
}

function getStatus() {
  const d = getDaily();
  return {
    used: d.used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - d.used),
    exhausted: d.used >= DAILY_LIMIT,
  };
}

/**
 * Mark one empathy request as consumed. Call this AFTER a successful API
 * response — never on failure (don't punish the user for our outage).
 * @returns {boolean} true if consumed, false if already at limit
 */
function consume() {
  const d = getDaily();
  if (d.used >= DAILY_LIMIT) return false;
  d.used += 1;
  storage.set(KEY_DAILY, d);
  return true;
}

module.exports = {
  getStatus,
  consume,
  DAILY_LIMIT,
};
