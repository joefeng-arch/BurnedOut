import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Trash2, Share2, ArrowRight, Globe, CheckCircle2, Loader2, X, Download, CalendarDays } from 'lucide-react';
import html2canvas from 'html2canvas';
import { api } from './services/api';

type Lang = 'zh' | 'en';
type Step = 'splash' | 'checkin' | 'dashboard' | 'vent' | 'destroy' | 'result' | 'history';

interface CheckInRecord {
  id: string;
  level: number;
  date: string;
  created_at: string;
}

const T = {
  zh: {
    title: "废了么",
    subtitle: "极简情绪发泄",
    start: "开始",
    q_burnout: "今天你废了吗？",
    levels: [
      "还行 (Surviving)",
      "有点废 (Meh)",
      "很废 (Burned)",
      "彻底废了 (Fried)",
      "已灭 (Gone)"
    ],
    dash_title: (percent: number) => `今天全球有 ${percent}% 的人和你一样废`,
    dash_subtitle: (count: string | number) => `今天已有 ${count} 人骂过了`,
    vent_btn: "想骂一下？",
    share_btn: "分享我的废度",
    history_btn: "打卡记录",
    vent_placeholder: "输入你想发泄的内容，无字数限制...",
    destroy_btn: "销毁",
    back: "返回",
    share_generating: "生成中...",
    share_tip: "长按图片保存到相册",
    share_download: "保存图片",
    share_close: "关闭",
    share_date: () => {
      const d = new Date();
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    },
    share_tagline: "和全世界一起废",
    streak: (n: number) => `连续废了 ${n} 天`,
    streak_zero: "今天是新的开始",
    trend_title: "最近 7 天",
    history_title: "我的废度记录",
    history_empty: "还没有打卡记录",
    history_total: (n: number) => `共 ${n} 次打卡`,
  },
  en: {
    title: "Burned Out?",
    subtitle: "Minimalist Venting Tool",
    start: "Start",
    q_burnout: "Are you burned out today?",
    levels: [
      "Surviving",
      "Meh",
      "Burned",
      "Fried",
      "Gone"
    ],
    dash_title: (percent: number) => `Today ${percent}% of people are as burned out as you`,
    dash_subtitle: (count: string | number) => `${count} people screamed with you today`,
    vent_btn: "Want to vent?",
    share_btn: "Share my burnout",
    history_btn: "Check-in History",
    vent_placeholder: "Type whatever you want to vent, no limits...",
    destroy_btn: "Destroy",
    back: "Back",
    share_generating: "Generating...",
    share_tip: "Long press to save image",
    share_download: "Save Image",
    share_close: "Close",
    share_date: () => {
      const d = new Date();
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    share_tagline: "Burned out with the world",
    streak: (n: number) => `${n}-day burnout streak`,
    streak_zero: "Today is a fresh start",
    trend_title: "Last 7 days",
    history_title: "My Burnout Log",
    history_empty: "No check-ins yet",
    history_total: (n: number) => `${n} total check-ins`,
  }
};

const LEVEL_LABELS_ZH = ['还行', '有点废', '很废', '彻底废了', '已灭'];
const LEVEL_LABELS_EN = ['Surviving', 'Meh', 'Burned', 'Fried', 'Gone'];
const LEVEL_EMOJIS = ['😐', '😩', '🔥', '💀', '☠️'];

const LEVEL_COLORS = [
  'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
  'bg-stone-800 hover:bg-stone-700 text-stone-300',
  'bg-orange-900/40 hover:bg-orange-900/60 text-orange-200 border border-orange-900/50',
  'bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900/50',
  'bg-red-950 hover:bg-red-900 text-red-500 border border-red-900'
];

// Bar colors for the 7-day trend (by level 1-5)
const LEVEL_BAR_COLORS = ['#a1a1aa', '#78716c', '#ea580c', '#dc2626', '#991b1b'];

// Calculate streak from sorted history (newest first)
function calcStreak(history: CheckInRecord[]): number {
  if (history.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let expectedDate = new Date(today);

  // If today's check-in is missing, start checking from yesterday
  if (history[0]?.date !== today) {
    expectedDate.setDate(expectedDate.getDate() - 1);
  }

  for (const record of history) {
    const expected = expectedDate.toISOString().split('T')[0];
    if (record.date === expected) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (record.date < expected) {
      break;
    }
  }

  return streak;
}

// Get last 7 days trend from history
function getLast7Days(history: CheckInRecord[]): (number | null)[] {
  const result: (number | null)[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const record = history.find(h => h.date === dateStr);
    result.push(record ? record.level : null);
  }

  return result;
}

export default function App() {
  const [step, setStep] = useState<Step>('splash');
  const [lang, setLang] = useState<Lang>('zh');
  const [level, setLevel] = useState<number | null>(null);
  const [ventText, setVentText] = useState('');
  const [isDestroying, setIsDestroying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [quip, setQuip] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const t = T[lang];

  // Auto-detect language on mount
  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('en')) {
      setLang('en');
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.getCheckInHistory(30);
      const data = res.data || [];
      setHistory(data);
      setStreak(calcStreak(data));
    } catch (e) {
      console.warn('Failed to fetch history');
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const locale = lang === 'zh' ? 'zh-CN' : 'en-GB';
      const region = lang === 'zh' ? 'CN' : 'UK';

      await api.registerUser(locale, region);

      try {
        const checkIn = await api.getTodayCheckIn();
        setLevel(checkIn.level - 1);
        const [stats] = await Promise.all([
          api.getGlobalStats(),
          fetchHistory(),
        ]);
        setGlobalStats(stats);
        setStep('dashboard');
      } catch (e) {
        await fetchHistory();
        setStep('checkin');
      }
    } catch (e) {
      console.error('Failed to start', e);
      setStep('checkin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelSelect = async (idx: number) => {
    setLevel(idx);
    setIsLoading(true);
    try {
      await api.createCheckIn(idx + 1);
      const [stats] = await Promise.all([
        api.getGlobalStats(),
        fetchHistory(),
      ]);
      setGlobalStats(stats);
      setStep('dashboard');
    } catch (e) {
      console.error('Failed to check in', e);
      const stats = await api.getGlobalStats();
      setGlobalStats(stats);
      await fetchHistory();
      setStep('dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDestroy = async () => {
    if (!ventText.trim()) return;
    setIsDestroying(true);

    try {
      const locale = lang === 'zh' ? 'zh-CN' : 'en-GB';
      const res = await api.createVent(ventText.length, locale);
      setQuip(res.quip);
    } catch (e) {
      console.error('Failed to vent', e);
      setQuip(lang === 'zh' ? '你的愤怒已被宇宙回收' : 'Your rage has been recycled by the universe');
    }

    setTimeout(() => {
      setIsDestroying(false);
      setVentText('');
      setStep('result');
    }, 2000);
  };

  const getPercent = () => {
    if (!globalStats || level === null) return 73;
    const count = globalStats.level_distribution[String(level + 1)] || 0;
    const total = globalStats.today_check_ins || 1;
    return Math.round((count / total) * 100) || 0;
  };

  const getVentCount = () => {
    if (!globalStats) return '120K';
    const count = globalStats.today_vents || 0;
    return count > 1000 ? `${(count / 1000).toFixed(1)}K` : count;
  };

  const last7Days = getLast7Days(history);

  const handleShare = async () => {
    setShowShareModal(true);
    setIsGeneratingShare(true);
    setShareImageUrl(null);

    await new Promise(r => setTimeout(r, 100));

    if (!shareCardRef.current) {
      setIsGeneratingShare(false);
      return;
    }

    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      setShareImageUrl(url);
    } catch (e) {
      console.error('Failed to generate share image', e);
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleDownloadShare = () => {
    if (!shareImageUrl) return;
    const a = document.createElement('a');
    a.href = shareImageUrl;
    a.download = `burned-out-${new Date().toISOString().split('T')[0]}.png`;
    a.click();
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4
  };

  // 7-day trend bar component (reused in dashboard & share card)
  const TrendBars = ({ data, height = 40 }: { data: (number | null)[], height?: number }) => {
    const days = lang === 'zh'
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    // Get actual day-of-week labels for the last 7 days
    const today = new Date();
    const dayLabels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    });

    return (
      <div className="flex items-end gap-2 justify-between">
        {data.map((lvl, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-md transition-all"
              style={{
                height: lvl ? `${(lvl / 5) * height}px` : '4px',
                backgroundColor: lvl ? LEVEL_BAR_COLORS[lvl - 1] : '#27272a',
                minHeight: 4,
              }}
            />
            <span className="text-[10px] text-zinc-600">{dayLabels[i]}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5] flex justify-center overflow-hidden font-sans">
      <div className="w-full max-w-md relative min-h-screen flex flex-col">

        <AnimatePresence mode="wait">
          {/* SPLASH SCREEN */}
          {step === 'splash' && (
            <motion.div
              key="splash"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-8"
              >
                <Flame className="w-24 h-24 text-red-600 mb-6 mx-auto" strokeWidth={1.5} />
                <h1 className="text-5xl font-bold tracking-tighter text-center mb-3">
                  {t.title}
                </h1>
                <p className="text-zinc-500 text-center tracking-widest uppercase text-sm">
                  {t.subtitle}
                </p>
              </motion.div>

              <div className="flex gap-4 mb-12">
                <button
                  onClick={() => setLang('zh')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${lang === 'zh' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
                >
                  中文
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${lang === 'en' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
                >
                  English
                </button>
              </div>

              <button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full bg-white text-black py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t.start} <ArrowRight className="w-5 h-5" /></>}
              </button>
            </motion.div>
          )}

          {/* CHECK-IN SCREEN */}
          {step === 'checkin' && (
            <motion.div
              key="checkin"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 flex flex-col p-6 pt-20"
            >
              <h2 className="text-4xl font-bold mb-12 leading-tight tracking-tight">
                {t.q_burnout}
              </h2>

              <div className="flex flex-col gap-3 relative">
                {isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-2xl backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
                {t.levels.map((lvl, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => handleLevelSelect(idx)}
                    disabled={isLoading}
                    className={`p-5 rounded-2xl text-left font-medium text-lg transition-all active:scale-[0.98] ${LEVEL_COLORS[idx]}`}
                  >
                    <span className="opacity-50 mr-4 font-mono text-sm">0{idx + 1}</span>
                    {lvl}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* DASHBOARD SCREEN */}
          {step === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 flex flex-col p-6 pt-12"
            >
              {/* Streak Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 flex items-center gap-3"
              >
                <div className="flex items-center gap-1.5 text-sm">
                  {streak > 0 ? (
                    <>
                      <span className="text-lg">{'🔥'.repeat(Math.min(streak, 5))}</span>
                      <span className="font-bold text-orange-400">{t.streak(streak)}</span>
                    </>
                  ) : (
                    <span className="text-zinc-600">{t.streak_zero}</span>
                  )}
                </div>
              </motion.div>

              {/* Global Stats Card */}
              <div className="mb-4 flex items-center gap-2 text-zinc-500 text-sm font-medium uppercase tracking-wider">
                <Globe className="w-4 h-4" /> Global Stats
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full -mr-10 -mt-10" />
                <h3 className="text-3xl font-bold mb-4 leading-tight relative z-10">
                  {t.dash_title(getPercent())}
                </h3>
                <p className="text-zinc-400 relative z-10">
                  {t.dash_subtitle(getVentCount())}
                </p>
              </div>

              {/* 7-Day Trend */}
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 mb-6">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3 font-medium">
                  {t.trend_title}
                </div>
                <TrendBars data={last7Days} height={36} />
              </div>

              <div className="flex-1" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setStep('vent')}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-semibold text-lg transition-colors active:scale-[0.98] shadow-[0_0_40px_rgba(220,38,38,0.3)]"
                >
                  {t.vent_btn}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleShare}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-medium transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> {t.share_btn}
                  </button>
                  <button
                    onClick={() => setStep('history')}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-medium transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CalendarDays className="w-4 h-4" /> {t.history_btn}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* HISTORY SCREEN */}
          {step === 'history' && (
            <motion.div
              key="history"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 flex flex-col p-6 pt-12"
            >
              <button
                onClick={() => setStep('dashboard')}
                className="text-zinc-500 mb-6 text-sm font-medium hover:text-white transition-colors self-start"
              >
                ← {t.back}
              </button>

              <h2 className="text-3xl font-bold mb-2 tracking-tight">{t.history_title}</h2>
              <p className="text-zinc-500 text-sm mb-6">
                {streak > 0 && <span className="text-orange-400 font-medium">{t.streak(streak)} · </span>}
                {t.history_total(history.length)}
              </p>

              {history.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600">
                  {t.history_empty}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pb-8">
                  {history.map((record, i) => {
                    const lvl = record.level - 1; // 0-indexed
                    const label = lang === 'zh' ? LEVEL_LABELS_ZH[lvl] : LEVEL_LABELS_EN[lvl];
                    const emoji = LEVEL_EMOJIS[lvl];
                    const dateObj = new Date(record.date + 'T00:00:00');
                    const dateStr = lang === 'zh'
                      ? `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
                      : dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const dayStr = lang === 'zh'
                      ? ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()]
                      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

                    return (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 p-4 bg-zinc-900/40 rounded-xl border border-zinc-800/50"
                      >
                        <span className="text-2xl">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs text-zinc-500">
                            {dateStr} {lang === 'zh' ? `周${dayStr}` : dayStr}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-zinc-600">
                          Lv.{record.level}
                        </div>
                        {/* Level bar */}
                        <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(record.level / 5) * 100}%`,
                              backgroundColor: LEVEL_BAR_COLORS[lvl],
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* VENT SCREEN */}
          {step === 'vent' && (
            <motion.div
              key="vent"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="flex-1 flex flex-col p-6 pt-12 relative"
            >
              <button
                onClick={() => setStep('dashboard')}
                className="text-zinc-500 mb-6 text-sm font-medium hover:text-white transition-colors self-start"
              >
                ← {t.back}
              </button>

              <motion.div
                className={`flex-1 flex flex-col ${isDestroying ? 'animate-shake' : ''}`}
                animate={isDestroying ? { scale: 0.8, opacity: 0, filter: 'blur(10px)' } : {}}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              >
                <textarea
                  value={ventText}
                  onChange={(e) => setVentText(e.target.value)}
                  placeholder={t.vent_placeholder}
                  className="flex-1 w-full bg-transparent text-2xl md:text-3xl leading-relaxed resize-none focus:outline-none placeholder:text-zinc-700 text-zinc-300"
                  autoFocus
                  disabled={isDestroying}
                />
              </motion.div>

              {!isDestroying && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-6"
                >
                  <button
                    onClick={handleDestroy}
                    disabled={!ventText.trim()}
                    className="w-full bg-white disabled:bg-zinc-800 disabled:text-zinc-600 text-black py-5 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" /> {t.destroy_btn}
                  </button>
                </motion.div>
              )}

              {isDestroying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                >
                  <div className="w-full h-full bg-red-500 mix-blend-overlay opacity-20 animate-pulse" />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* RESULT SCREEN */}
          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit="out"
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            >
              <CheckCircle2 className="w-16 h-16 text-zinc-700 mb-8" strokeWidth={1} />
              <h2 className="text-2xl md:text-3xl font-medium leading-relaxed text-zinc-300 mb-12">
                "{quip}"
              </h2>

              <button
                onClick={() => setStep('dashboard')}
                className="px-8 py-3 rounded-full border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors text-sm font-medium"
              >
                {t.back}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Share Card — rendered off-screen, captured by html2canvas */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div
            ref={shareCardRef}
            style={{
              width: 375,
              padding: 40,
              backgroundColor: '#050505',
              color: '#f5f5f5',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#71717a' }}>
              <span>🔥</span>
              <span>{lang === 'zh' ? '废了么' : 'Burned Out?'}</span>
              <span style={{ marginLeft: 'auto' }}>{t.share_date()}</span>
            </div>

            {/* Level Display */}
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 64, lineHeight: 1 }}>
                {level !== null ? LEVEL_EMOJIS[level] : '🔥'}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 16 }}>
                {level !== null
                  ? (lang === 'zh' ? LEVEL_LABELS_ZH[level] : LEVEL_LABELS_EN[level])
                  : '???'}
              </div>
              <div style={{ fontSize: 14, color: '#a1a1aa', marginTop: 8 }}>
                Level {level !== null ? level + 1 : '?'} / 5
              </div>
            </div>

            {/* Streak */}
            {streak > 0 && (
              <div style={{
                textAlign: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: '#fb923c',
                padding: '8px 0',
              }}>
                {'🔥'.repeat(Math.min(streak, 7))} {t.streak(streak)}
              </div>
            )}

            {/* 7-day trend bars */}
            <div style={{
              backgroundColor: '#18181b',
              borderRadius: 12,
              padding: 16,
              border: '1px solid #27272a',
            }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 10, letterSpacing: 1 }}>
                {t.trend_title.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 36 }}>
                {last7Days.map((lvl, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: lvl ? `${(lvl / 5) * 36}px` : '4px',
                    minHeight: 4,
                    backgroundColor: lvl ? LEVEL_BAR_COLORS[lvl - 1] : '#27272a',
                    borderRadius: 4,
                  }} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{
              backgroundColor: '#18181b',
              borderRadius: 12,
              padding: 16,
              border: '1px solid #27272a',
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {t.dash_title(getPercent())}
              </div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>
                {t.dash_subtitle(getVentCount())}
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#52525b', paddingTop: 4 }}>
              {t.share_tagline}
            </div>
          </div>
        </div>

        {/* Share Modal Overlay */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowShareModal(false)}
                  className="self-end text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                {isGeneratingShare ? (
                  <div className="w-full aspect-[3/4] bg-zinc-900 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
                    <span className="ml-3 text-zinc-500">{t.share_generating}</span>
                  </div>
                ) : shareImageUrl ? (
                  <img
                    src={shareImageUrl}
                    alt="Share card"
                    className="w-full rounded-2xl shadow-2xl"
                    style={{ userSelect: 'none' }}
                  />
                ) : null}

                {shareImageUrl && (
                  <>
                    <p className="text-zinc-500 text-sm">{t.share_tip}</p>
                    <button
                      onClick={handleDownloadShare}
                      className="w-full bg-white text-black py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <Download className="w-5 h-5" /> {t.share_download}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
