// ============================================================================
// Domain constants
// ============================================================================

// Burn levels 1 (满电) → 5 (关机)
const BURN_LEVELS = [
  { value: 1, emoji: '🔋', key: 'full_battery' },
  { value: 2, emoji: '🔌', key: 'a_bit_tired' },
  { value: 3, emoji: '🪫', key: 'low_battery' },
  { value: 4, emoji: '💀', key: 'very_burned' },
  { value: 5, emoji: '⚫', key: 'shutdown' },
];

// Emotion tags (matches DB enum)
const EMOTION_TAGS = ['tired', 'annoyed', 'angry', 'empty', 'sad'];

// Vent modes
const VENT_MODES = ['quick_rant', 'polite_rage', 'late_night'];

// Destroy types
const DESTROY_TYPES = ['shredder', 'fire', 'black_hole', 'garbage_truck'];

// Char count buckets
function bucketChars(len) {
  if (len <= 20) return 'bucket_1_20';
  if (len <= 50) return 'bucket_21_50';
  if (len <= 100) return 'bucket_51_100';
  return 'bucket_100_plus';
}

// Ad unlock types (for ad_events)
const AD_UNLOCK_TYPES = {
  EXTRA_VENT: 'extra_vent',
  ADVANCED_DESTROY: 'advanced_destroy',
  WEEKLY_REPORT: 'weekly_report',
  SHARE_CARD: 'share_card',
  COMEBACK_TEMPLATE: 'comeback_template',
};

module.exports = {
  BURN_LEVELS,
  EMOTION_TAGS,
  VENT_MODES,
  DESTROY_TYPES,
  bucketChars,
  AD_UNLOCK_TYPES,
};
