// ============================================================================
// Keyword-triggered destroy easter eggs
// ============================================================================
//
// Detection runs CLIENT-SIDE only, BEFORE the vent text leaves the device for
// msgSecCheck. The detected variant key is passed via globalData/URL to the
// destroy page for a visual flourish, then discarded. We never store the
// keyword or the matched variant — the analytics 'destroy_egg_triggered'
// event records only the variant key (e.g. 'boss'), which is non-PII.
//
// Order matters: we return the FIRST match, so put more specific patterns
// before broader ones (e.g. 'leader' before 'team' if you ever add 'team').

const KEYWORDS = [
  // variant key, regex (case-insensitive), overlay zh, overlay en, emoji
  {
    key: 'boss',
    re: /老板|上司|老?板|leader|manager|boss/i,
    zh: '老板的椅子着火了',
    en: "The boss's chair is on fire",
    emoji: '🪑',
  },
  {
    key: 'overtime',
    re: /加班|996|007|overtime|\bot\b/i,
    zh: '工位被吸进黑洞了',
    en: 'Your desk got sucked into the void',
    emoji: '💼',
  },
  {
    key: 'client',
    re: /客户|甲方|乙方|client|customer/i,
    zh: '一车需求文档翻倒了',
    en: 'A truckload of specs just flipped over',
    emoji: '📂',
  },
  {
    key: 'monday',
    re: /周一|星期一|周日晚上|sunday night|monday/i,
    zh: '砸碎了所有闹钟',
    en: 'Smashed every alarm clock',
    emoji: '⏰',
  },
  {
    key: 'quit',
    re: /想离职|裸辞|不干了|quit|resign/i,
    zh: '一脚踢开了门',
    en: 'Kicked the door open',
    emoji: '🚪',
  },
  {
    key: 'cry',
    re: /想哭|哭了|cry|crying|tears/i,
    zh: '今晚下雨。没关系。',
    en: "It's raining tonight. That's OK.",
    emoji: '🌧️',
  },
  {
    key: 'kpi',
    re: /kpi|okr|绩效|考核/i,
    zh: 'KPI 被烧成灰了',
    en: 'KPIs reduced to ash',
    emoji: '📊',
  },
  {
    key: 'meeting',
    re: /开会|会议|meeting|standup|review/i,
    zh: '会议室爆炸了',
    en: 'The meeting room exploded',
    emoji: '💥',
  },
];

/**
 * Detect the first matching egg variant for a vent text.
 * Returns null if no match.
 *
 * @param {string} text  Vent text (already trimmed by caller)
 * @returns {{ key: string, zh: string, en: string, emoji: string } | null}
 */
function detectEgg(text) {
  if (!text) return null;
  for (const k of KEYWORDS) {
    if (k.re.test(text)) {
      return { key: k.key, zh: k.zh, en: k.en, emoji: k.emoji };
    }
  }
  return null;
}

module.exports = {
  detectEgg,
  _KEYWORDS: KEYWORDS,
};
