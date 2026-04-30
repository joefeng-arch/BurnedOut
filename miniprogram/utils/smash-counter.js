// ============================================================================
// Smash plate quota — pure client-side rate limiting
// ============================================================================
//
// Why client-only: smashing a plate is purely visual feedback. We do NOT want
// to write a DB row per shake (30k+ inserts/day at scale, for zero analytic
// value). The aggregate "smashed today" count is captured via the analytics
// pipeline at session-end via track('smash_session_end', { count }).
//
// Quotas:
//   - 30 free smashes per day
//   - +20 per reward-video unlock
//   - max 3 ad unlocks per day
//   - hard cap = 30 + 20*3 = 90 plates/day
//
// Storage shape:
//   smash_daily = { date: 'YYYY-MM-DD', smashed: 0, ad_unlocks: 0 }
//   smash_record = number   // personal best (single-day total ever achieved)

const storage = require('./storage.js');

const KEY_DAILY = 'smash_daily';
const KEY_RECORD = 'smash_record';

const FREE_LIMIT = 30;
const PER_UNLOCK = 20;
const MAX_UNLOCKS = 3;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaily() {
  const today = todayStr();
  const cur = storage.get(KEY_DAILY, null);
  if (!cur || cur.date !== today) {
    return { date: today, smashed: 0, ad_unlocks: 0 };
  }
  return cur;
}

function setDaily(daily) {
  storage.set(KEY_DAILY, daily);
}

/**
 * Compute current quota status without mutating state.
 * @returns {{
 *   smashed: number,
 *   limit: number,
 *   remaining: number,
 *   ad_unlocks: number,
 *   max_unlocks: number,
 *   can_unlock: boolean,
 *   exhausted: boolean,
 *   record: number,
 * }}
 */
function getStatus() {
  const d = getDaily();
  const limit = FREE_LIMIT + d.ad_unlocks * PER_UNLOCK;
  const remaining = Math.max(0, limit - d.smashed);
  return {
    smashed: d.smashed,
    limit,
    remaining,
    ad_unlocks: d.ad_unlocks,
    max_unlocks: MAX_UNLOCKS,
    can_unlock: d.ad_unlocks < MAX_UNLOCKS,
    exhausted: remaining === 0,
    record: storage.get(KEY_RECORD, 0),
  };
}

/**
 * Increment smashed count by 1 if quota allows.
 * Updates personal record if today's count surpasses it.
 * @returns {boolean} true if smash was allowed and counted, false if quota exhausted
 */
function increment() {
  const d = getDaily();
  const limit = FREE_LIMIT + d.ad_unlocks * PER_UNLOCK;
  if (d.smashed >= limit) return false;
  d.smashed += 1;
  setDaily(d);

  // Update personal record live (so the user sees it tick during smashing)
  const record = storage.get(KEY_RECORD, 0);
  if (d.smashed > record) {
    storage.set(KEY_RECORD, d.smashed);
  }
  return true;
}

/**
 * Grant +PER_UNLOCK plates after a successful reward video.
 * @returns {boolean} true if granted, false if user already maxed out
 */
function grantAdUnlock() {
  const d = getDaily();
  if (d.ad_unlocks >= MAX_UNLOCKS) return false;
  d.ad_unlocks += 1;
  setDaily(d);
  return true;
}

module.exports = {
  getStatus,
  increment,
  grantAdUnlock,
  FREE_LIMIT,
  PER_UNLOCK,
  MAX_UNLOCKS,
};
