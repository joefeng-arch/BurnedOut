// ============================================================================
// Daily phrase pool — date-deterministic, no backend roundtrip
// ============================================================================
//
// Why client-side: this is decorative micro-copy, not editable content. Round-
// tripping to Supabase for a 1-line string would add latency on the most
// trafficked page (home). Refreshing the pool means shipping a code update,
// which is fine for V1 — we ship patches more often than once a month anyway.
//
// Selection is deterministic by date so the same user sees the same phrase
// when they reopen the app the same day. The hash uses (year * 366 + dayOfYear)
// to avoid the boundary effect of plain modulo at year-end.

const PHRASES_ZH = [
  '周三是星期一的儿子。',
  '再坏也只是一天。',
  '你今天已经赢了起床。',
  '能撑到现在,你已经很厉害了。',
  '老板看不见你内心的中指。',
  '想骂就骂,反正没人记得。',
  '不是你不行,是这事它不行。',
  '上班是为了下班。',
  '今天的崩溃额度还有,别浪费。',
  '哭也是一种生产力。',
  '凡是杀不死你的,都让你想请假。',
  '你不是机器人,情绪才是常态。',
  '会议是用来浪费时间的,不是浪费你的。',
  '今天的你,和昨天的你,都已经尽力了。',
  '世上无难事,只要肯放弃。',
  'KPI 是发明出来恶心人的。',
  '别和傻 X 共情,你会变傻。',
  '内心毛骨悚然,脸上风轻云淡。',
  '能拖到下班的事,都是小事。',
  '休息不是奖励,是必需品。',
  '没有人值得你献祭周末。',
  '有些情绪不是问题,是信号。',
  '你的疲惫是真的,不是矫情。',
  '生活不一定要有意义,撑住就好。',
  '工作就是工作,别和它谈恋爱。',
  '今天少做一点也死不了。',
  '世界不会塌的,你的肩膀才会。',
  '允许自己,什么也不想做。',
  '焦虑不会让事情变好,只会让你变累。',
  '"还好吗" 三个字,问的是你不是别人。',
  '你今天值得一杯不健康的奶茶。',
  '能装睡就别强撑,假装也是休息。',
  '凌晨三点的清醒不是清醒,是疲惫的另一面。',
  '别问值不值,先问累不累。',
  '今天不想骂人,是不爱了。',
];

const PHRASES_EN = [
  "Wednesday is Monday's son.",
  "It's only one day. It can't all be bad.",
  "You already won by getting up.",
  "If you're still here, you're winning.",
  "Your boss can't see your mental middle finger.",
  "Vent if you want. Nobody remembers.",
  "It's not you. It's the situation.",
  "We work so we can stop working.",
  "Your daily breakdown quota is still available.",
  "Crying is also productivity.",
  "What doesn't kill you makes you want a sick day.",
  "You're not a robot. Feelings are normal.",
  "Meetings waste time. Not yours specifically.",
  "Yesterday-you and today-you both did their best.",
  "Nothing is impossible if you're willing to quit.",
  "KPIs were invented to ruin perfectly good days.",
  "Don't empathise with idiots. You'll become one.",
  "Calm face. Internal screaming.",
  "If it can wait until 5pm, it's not urgent.",
  "Rest isn't a reward. It's a requirement.",
  "Nobody is worth your weekend.",
  "Some feelings aren't problems. They're signals.",
  "Your tiredness is real, not dramatic.",
  "Life doesn't need meaning. Just keep going.",
  "Work is work. Don't fall in love with it.",
  "Doing less today won't kill you.",
  "The world won't collapse. Your shoulders will.",
  "It's OK to do absolutely nothing.",
  "Anxiety doesn't fix things. It just makes you tired.",
  "'You OK?' is asking about you. Not them.",
  "You've earned an unhealthy bubble tea.",
  "If you can fake-sleep, do. Faking is also resting.",
  "3am alertness isn't clarity. It's exhaustion.",
  "Don't ask if it's worth it. Ask if you're tired.",
  "If you don't feel like cursing today, you've stopped caring.",
];

// Day-of-year (1..366), timezone-safe enough for our needs (we don't care
// about minute-precision UTC).
function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

function getTodayPhrase(locale) {
  const pool = locale === 'en-GB' ? PHRASES_EN : PHRASES_ZH;
  const now = new Date();
  const seed = now.getFullYear() * 366 + dayOfYear(now);
  return pool[seed % pool.length];
}

module.exports = {
  getTodayPhrase,
  // Exported for tests / future ops dashboard
  _PHRASES_ZH: PHRASES_ZH,
  _PHRASES_EN: PHRASES_EN,
};
