-- ============================================================================
-- 还好吗？情绪发泄器 / You OK? — V2 Schema
-- Migration: 20260303000000_v2_schema.sql
-- ============================================================================
-- V2 supersedes V1. This migration DROPS all V1 tables and recreates from scratch.
-- Only safe to run if no production data needs preserving.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DROP V1 + V2 (clean slate — idempotent, safe to re-run)
-- ----------------------------------------------------------------------------

-- Tables (V1 and V2)
DROP TABLE IF EXISTS ad_events CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS vent_logs CASCADE;
DROP TABLE IF EXISTS check_ins CASCADE;
DROP TABLE IF EXISTS quips CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Functions (V1)
DROP FUNCTION IF EXISTS get_global_stats() CASCADE;
DROP FUNCTION IF EXISTS get_regional_stats(region_enum) CASCADE;
DROP FUNCTION IF EXISTS get_all_regional_stats() CASCADE;

-- Types (V1 + V2) — dropping types cascades to drop dependent functions/columns
DROP TYPE IF EXISTS locale_enum CASCADE;
DROP TYPE IF EXISTS region_enum CASCADE;
DROP TYPE IF EXISTS emotion_tag_enum CASCADE;
DROP TYPE IF EXISTS vent_mode_enum CASCADE;
DROP TYPE IF EXISTS destroy_type_enum CASCADE;
DROP TYPE IF EXISTS quip_mode_enum CASCADE;
DROP TYPE IF EXISTS char_bucket_enum CASCADE;
DROP TYPE IF EXISTS ad_type_enum CASCADE;
DROP TYPE IF EXISTS ad_stage_enum CASCADE;
DROP TYPE IF EXISTS ad_unlock_type_enum CASCADE;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

CREATE TYPE locale_enum AS ENUM ('zh-CN', 'en-GB');
CREATE TYPE region_enum AS ENUM ('CN', 'UK', 'NORDIC', 'OTHER');

-- Emotion tags (multi-select on check-in AND vent)
-- 累 / 烦 / 气 / 空 / 想哭
CREATE TYPE emotion_tag_enum AS ENUM (
  'tired',
  'annoyed',
  'angry',
  'empty',
  'sad'
);

-- Vent mode — sets tone of quip returned
-- 快速乱喷 / 文明发疯 / 深夜低气压
CREATE TYPE vent_mode_enum AS ENUM (
  'quick_rant',
  'polite_rage',
  'late_night'
);

-- Destroy animation type (for analytics / unlock via ad)
-- 碎纸机 / 火烧 / 黑洞 / 垃圾车
CREATE TYPE destroy_type_enum AS ENUM (
  'shredder',
  'fire',
  'black_hole',
  'garbage_truck'
);

-- Quip tone
-- 毒舌 / 温和 / 冷静
CREATE TYPE quip_mode_enum AS ENUM (
  'savage',
  'gentle',
  'calm'
);

-- Char count buckets (per PRD 埋点口径)
CREATE TYPE char_bucket_enum AS ENUM (
  'bucket_1_20',
  'bucket_21_50',
  'bucket_51_100',
  'bucket_100_plus'
);

-- Ad events
CREATE TYPE ad_type_enum AS ENUM ('reward', 'interstitial', 'native');
CREATE TYPE ad_stage_enum AS ENUM (
  'request',
  'fill_success',
  'fill_fail',
  'show',
  'close',
  'reward_grant',
  'reward_use'
);
CREATE TYPE ad_unlock_type_enum AS ENUM (
  'extra_vent',
  'advanced_destroy',
  'weekly_report',
  'share_card',
  'comeback_template'
);

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Users (anonymous, device-based)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  locale locale_enum NOT NULL DEFAULT 'zh-CN',
  region region_enum NOT NULL DEFAULT 'CN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_device_id ON users(device_id);

-- Check-ins (1 per user per day)
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  burn_level SMALLINT NOT NULL CHECK (burn_level BETWEEN 1 AND 5),
  emotion_tags emotion_tag_enum[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_check_ins_user_date ON check_ins(user_id, date DESC);
CREATE INDEX idx_check_ins_date ON check_ins(date DESC);
CREATE INDEX idx_check_ins_burn_level ON check_ins(burn_level);

-- Vent logs (default 3/day, +1 per rewarded ad, max 6/day — enforced at API layer)
CREATE TABLE vent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  char_count_bucket char_bucket_enum NOT NULL,
  emotion_tags emotion_tag_enum[] NOT NULL DEFAULT '{}',
  vent_mode vent_mode_enum NOT NULL,
  destroy_type destroy_type_enum NOT NULL,
  unlocked_by_ad BOOLEAN NOT NULL DEFAULT FALSE,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,  -- true when msgSecCheck marked content high-risk
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vent_logs_user_created ON vent_logs(user_id, created_at DESC);
CREATE INDEX idx_vent_logs_created ON vent_logs(created_at DESC);
CREATE INDEX idx_vent_logs_mode ON vent_logs(vent_mode);

-- Analytics events (generic event ingestion per PRD 埋点方案)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  page_name TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  app_version TEXT,
  lang locale_enum,
  network_type TEXT,
  channel TEXT,
  is_new_user BOOLEAN,
  day_index INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_user_created ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_properties ON analytics_events USING GIN (properties);

-- Ad events (IAA funnel tracking)
CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ad_type ad_type_enum NOT NULL,
  stage ad_stage_enum NOT NULL,
  unlock_type ad_unlock_type_enum,
  is_completed BOOLEAN,
  page_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_events_user_created ON ad_events(user_id, created_at DESC);
CREATE INDEX idx_ad_events_type_stage ON ad_events(ad_type, stage);
CREATE INDEX idx_ad_events_unlock ON ad_events(unlock_type) WHERE unlock_type IS NOT NULL;

-- Quips (post-vent reassurance text, varied by tone)
CREATE TABLE quips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale locale_enum NOT NULL,
  mode_tag quip_mode_enum NOT NULL,
  content TEXT NOT NULL,
  is_high_risk_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quips_locale_mode ON quips(locale, mode_tag);
CREATE INDEX idx_quips_risk ON quips(is_high_risk_fallback);

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------------------

-- Count today's vents for a user (for 3+3 frequency limiting)
-- p_unlocked_by_ad: NULL = all, TRUE = only ad-unlocked, FALSE = only free
CREATE OR REPLACE FUNCTION count_today_vents(
  p_user_id UUID,
  p_unlocked_by_ad BOOLEAN DEFAULT NULL
)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INT
  FROM vent_logs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND (p_unlocked_by_ad IS NULL OR unlocked_by_ad = p_unlocked_by_ad);
$$;

-- Weekly burn level trend (last 7 days, with gaps as NULL)
CREATE OR REPLACE FUNCTION get_user_weekly_trend(p_user_id UUID)
RETURNS TABLE(date DATE, burn_level SMALLINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d::DATE AS date,
    c.burn_level
  FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') AS d
  LEFT JOIN check_ins c ON c.user_id = p_user_id AND c.date = d::DATE
  ORDER BY d ASC;
$$;

-- Emotion distribution across last 7 days (check-ins + vents combined)
CREATE OR REPLACE FUNCTION get_user_weekly_emotions(p_user_id UUID)
RETURNS TABLE(emotion emotion_tag_enum, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  WITH unnested AS (
    SELECT unnest(emotion_tags) AS emotion
    FROM check_ins
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - INTERVAL '6 days'
    UNION ALL
    SELECT unnest(emotion_tags) AS emotion
    FROM vent_logs
    WHERE user_id = p_user_id
      AND created_at >= CURRENT_DATE - INTERVAL '6 days'
  )
  SELECT emotion, COUNT(*)::BIGINT AS count
  FROM unnested
  GROUP BY emotion
  ORDER BY count DESC;
$$;

-- Current streak (consecutive check-in days ending today or yesterday)
CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_streak INT := 0;
  v_check_date DATE := CURRENT_DATE;
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM check_ins WHERE user_id = p_user_id AND date = CURRENT_DATE)
    INTO v_exists;
  -- If no check-in today, measure streak ending yesterday
  IF NOT v_exists THEN
    v_check_date := CURRENT_DATE - 1;
  END IF;

  LOOP
    SELECT EXISTS(SELECT 1 FROM check_ins WHERE user_id = p_user_id AND date = v_check_date)
      INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  END LOOP;

  RETURN v_streak;
END;
$$;

-- Random quip by locale + tone
CREATE OR REPLACE FUNCTION get_random_quip(
  p_locale locale_enum DEFAULT 'zh-CN',
  p_mode quip_mode_enum DEFAULT 'gentle',
  p_is_high_risk BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT content
  FROM quips
  WHERE locale = p_locale
    AND mode_tag = p_mode
    AND is_high_risk_fallback = p_is_high_risk
  ORDER BY random()
  LIMIT 1;
$$;

-- Peak pressure hour (for Dashboard's "本周高压时段")
CREATE OR REPLACE FUNCTION get_user_peak_hour(p_user_id UUID)
RETURNS TABLE(hour INT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT EXTRACT(HOUR FROM created_at)::INT AS hour, COUNT(*)::BIGINT AS count
  FROM vent_logs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE - INTERVAL '6 days'
  GROUP BY hour
  ORDER BY count DESC
  LIMIT 3;
$$;

-- This week vs last week delta (for Dashboard)
CREATE OR REPLACE FUNCTION get_user_weekly_delta(p_user_id UUID)
RETURNS TABLE(
  this_week_avg NUMERIC,
  last_week_avg NUMERIC,
  delta NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH this_week AS (
    SELECT AVG(burn_level)::NUMERIC AS avg_level
    FROM check_ins
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - INTERVAL '6 days'
  ),
  last_week AS (
    SELECT AVG(burn_level)::NUMERIC AS avg_level
    FROM check_ins
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - INTERVAL '13 days'
      AND date < CURRENT_DATE - INTERVAL '6 days'
  )
  SELECT
    ROUND(COALESCE(this_week.avg_level, 0), 2),
    ROUND(COALESCE(last_week.avg_level, 0), 2),
    ROUND(COALESCE(this_week.avg_level, 0) - COALESCE(last_week.avg_level, 0), 2)
  FROM this_week, last_week;
$$;

-- ----------------------------------------------------------------------------
-- RLS (all tables closed by default; Edge Functions use service_role key)
-- ----------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE vent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quips ENABLE ROW LEVEL SECURITY;

-- Public read-only access to quips (in case we want client to call directly)
CREATE POLICY "quips_read_public" ON quips FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- SEED DATA: QUIPS (zh-CN + en-GB × savage/gentle/calm + high-risk fallback)
-- ----------------------------------------------------------------------------

INSERT INTO quips (locale, mode_tag, content, is_high_risk_fallback) VALUES
-- zh-CN / savage 毒舌
('zh-CN', 'savage', '骂得挺有文采，建议投稿《故事会》。', FALSE),
('zh-CN', 'savage', '你的废度已达巅峰，可以开班收徒了。', FALSE),
('zh-CN', 'savage', '老板知道你在这骂他吗？', FALSE),
('zh-CN', 'savage', '字字珠玑，句句扎心，建议装裱收藏。', FALSE),
('zh-CN', 'savage', '刚才那段情绪价值拉满，我都替你解气了。', FALSE),
-- zh-CN / gentle 温和
('zh-CN', 'gentle', '骂完好一点了吗？先抱抱你。', FALSE),
('zh-CN', 'gentle', '今天很累吧，你已经做得够好了。', FALSE),
('zh-CN', 'gentle', '情绪没有对错，释放出来就好。', FALSE),
('zh-CN', 'gentle', '有我这个树洞接住你，不用撑着。', FALSE),
('zh-CN', 'gentle', '你是人不是机器，累了就休息。', FALSE),
-- zh-CN / calm 冷静
('zh-CN', 'calm', '深呼吸，情绪只是情绪，你不是情绪本身。', FALSE),
('zh-CN', 'calm', '24 小时后再看这件事，可能就没那么严重了。', FALSE),
('zh-CN', 'calm', '你已经骂过了，现在可以放下了。', FALSE),
('zh-CN', 'calm', '把这件事写下来，再把纸丢进垃圾桶。', FALSE),
-- zh-CN / high-risk fallback（msgSecCheck 命中时的柔性兜底，不说教）
('zh-CN', 'gentle', '先停一下，深呼吸 10 秒钟。', TRUE),
('zh-CN', 'gentle', '今晚真的很辛苦，要不要联系一个可以说话的人？', TRUE),
('zh-CN', 'gentle', '如果需要帮助：全国 24 小时心理援助热线 400-161-9995。', TRUE),

-- en-GB / savage
('en-GB', 'savage', 'Eloquent rage. You should write a memoir.', FALSE),
('en-GB', 'savage', 'Peak burnout. Teaching qualification unlocked.', FALSE),
('en-GB', 'savage', 'Does your boss know you write like this?', FALSE),
('en-GB', 'savage', 'That was unhinged in the best possible way.', FALSE),
-- en-GB / gentle
('en-GB', 'gentle', 'Better now? Here is a hug.', FALSE),
('en-GB', 'gentle', 'Long day. You are doing better than you think.', FALSE),
('en-GB', 'gentle', 'No feeling is wrong. Letting it out is enough.', FALSE),
('en-GB', 'gentle', 'You are human, not a machine. Rest is allowed.', FALSE),
-- en-GB / calm
('en-GB', 'calm', 'Breathe. Feelings are just feelings — not you.', FALSE),
('en-GB', 'calm', 'Revisit this in 24 hours. Odds are it looks smaller.', FALSE),
('en-GB', 'calm', 'Write it down, then throw the paper away.', FALSE),
-- en-GB / high-risk fallback
('en-GB', 'gentle', 'Take 10 seconds. Breathe.', TRUE),
('en-GB', 'gentle', 'Hard night. Maybe reach out to someone you trust?', TRUE),
('en-GB', 'gentle', 'If you need help now: Samaritans UK 116 123 — free, 24/7.', TRUE);

-- ============================================================================
-- V2 Schema Done.
-- Tables: users, check_ins, vent_logs, analytics_events, ad_events, quips
-- Functions: count_today_vents, get_user_weekly_trend, get_user_weekly_emotions,
--            get_user_streak, get_user_peak_hour, get_user_weekly_delta,
--            get_random_quip
-- ============================================================================
