-- ============================================================
-- Burned Out? / 废了么 — Initial Database Schema
-- Supabase (PostgreSQL) Migration
-- ============================================================

-- ------------------------------------------------------------
-- 1. Custom ENUM types
-- ------------------------------------------------------------

CREATE TYPE locale_enum AS ENUM ('zh-CN', 'en-GB');
CREATE TYPE region_enum AS ENUM ('CN', 'UK', 'NORDIC', 'OTHER');

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

-- Anonymous users (no registration required, device-based identity)
CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id  TEXT NOT NULL UNIQUE,
    locale     locale_enum NOT NULL DEFAULT 'zh-CN',
    region     region_enum NOT NULL DEFAULT 'OTHER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  users IS 'Anonymous users identified by device_id';
COMMENT ON COLUMN users.device_id IS 'Client-generated unique device identifier (UUID v4 recommended)';

-- Daily burnout check-in (5-level scale, one per user per day)
CREATE TABLE check_ins (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level      SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
    date       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_daily_checkin UNIQUE (user_id, date)
);

COMMENT ON TABLE  check_ins IS 'Daily burnout level check-in (1-5)';
COMMENT ON COLUMN check_ins.level IS '1=还行(Surviving) 2=有点废(Meh) 3=很废(Burned) 4=彻底废了(Fried) 5=已灭(Gone)';

-- Vent logs (only char count stored — content is NEVER persisted)
CREATE TABLE vent_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    char_count INT NOT NULL CHECK (char_count > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  vent_logs IS 'Vent records — only character count, content never stored';

-- Quips / resonance quotes (共鸣语), culturally adapted per locale
CREATE TABLE quips (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text       TEXT NOT NULL,
    locale     locale_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE quips IS 'Humorous resonance quotes shown after vent destruction';

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

CREATE INDEX idx_users_device_id       ON users      (device_id);
CREATE INDEX idx_checkins_user_date    ON check_ins   (user_id, date DESC);
CREATE INDEX idx_checkins_date         ON check_ins   (date);
CREATE INDEX idx_checkins_date_level   ON check_ins   (date, level);
CREATE INDEX idx_ventlogs_user         ON vent_logs   (user_id);
CREATE INDEX idx_ventlogs_created      ON vent_logs   (created_at);
CREATE INDEX idx_quips_locale          ON quips       (locale);

-- ------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- ------------------------------------------------------------

ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vent_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quips      ENABLE ROW LEVEL SECURITY;

-- Users: allow insert from anon, select own record via Edge Function (service role)
-- Edge Functions use service_role key, so RLS is bypassed for server calls.
-- These policies cover direct client access via anon key if needed.

CREATE POLICY "Allow anonymous user creation"
    ON users FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    TO anon
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Check-ins: users can insert/read their own
CREATE POLICY "Users can create own check-ins"
    ON check_ins FOR INSERT
    TO anon
    WITH CHECK (
        user_id IN (
            SELECT id FROM users
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

CREATE POLICY "Users can read own check-ins"
    ON check_ins FOR SELECT
    TO anon
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

-- Vent logs: users can insert their own (no read — privacy by design)
CREATE POLICY "Users can create vent logs"
    ON vent_logs FOR INSERT
    TO anon
    WITH CHECK (
        user_id IN (
            SELECT id FROM users
            WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
    );

-- Quips: anyone can read
CREATE POLICY "Quips are publicly readable"
    ON quips FOR SELECT
    TO anon
    USING (true);

-- ------------------------------------------------------------
-- 5. Database Functions (for Dashboard aggregation)
-- ------------------------------------------------------------

-- Global statistics for today
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_users',     (SELECT count(*) FROM users),
        'today_check_ins', (SELECT count(*) FROM check_ins WHERE date = CURRENT_DATE),
        'today_vents',     (SELECT count(*) FROM vent_logs WHERE created_at::date = CURRENT_DATE),
        'avg_level',       (SELECT coalesce(round(avg(level)::numeric, 1), 0) FROM check_ins WHERE date = CURRENT_DATE),
        'level_distribution', (
            SELECT json_build_object(
                '1', coalesce(sum(CASE WHEN level = 1 THEN 1 ELSE 0 END), 0),
                '2', coalesce(sum(CASE WHEN level = 2 THEN 1 ELSE 0 END), 0),
                '3', coalesce(sum(CASE WHEN level = 3 THEN 1 ELSE 0 END), 0),
                '4', coalesce(sum(CASE WHEN level = 4 THEN 1 ELSE 0 END), 0),
                '5', coalesce(sum(CASE WHEN level = 5 THEN 1 ELSE 0 END), 0)
            )
            FROM check_ins WHERE date = CURRENT_DATE
        ),
        'updated_at', now()
    ) INTO result;
    RETURN result;
END;
$$;

-- Regional statistics for today
CREATE OR REPLACE FUNCTION get_regional_stats(target_region region_enum)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'region',          target_region,
        'today_check_ins', (
            SELECT count(*) FROM check_ins ci
            JOIN users u ON u.id = ci.user_id
            WHERE ci.date = CURRENT_DATE AND u.region = target_region
        ),
        'today_vents', (
            SELECT count(*) FROM vent_logs vl
            JOIN users u ON u.id = vl.user_id
            WHERE vl.created_at::date = CURRENT_DATE AND u.region = target_region
        ),
        'avg_level', (
            SELECT coalesce(round(avg(ci.level)::numeric, 1), 0) FROM check_ins ci
            JOIN users u ON u.id = ci.user_id
            WHERE ci.date = CURRENT_DATE AND u.region = target_region
        ),
        'level_distribution', (
            SELECT json_build_object(
                '1', coalesce(sum(CASE WHEN ci.level = 1 THEN 1 ELSE 0 END), 0),
                '2', coalesce(sum(CASE WHEN ci.level = 2 THEN 1 ELSE 0 END), 0),
                '3', coalesce(sum(CASE WHEN ci.level = 3 THEN 1 ELSE 0 END), 0),
                '4', coalesce(sum(CASE WHEN ci.level = 4 THEN 1 ELSE 0 END), 0),
                '5', coalesce(sum(CASE WHEN ci.level = 5 THEN 1 ELSE 0 END), 0)
            )
            FROM check_ins ci
            JOIN users u ON u.id = ci.user_id
            WHERE ci.date = CURRENT_DATE AND u.region = target_region
        ),
        'updated_at', now()
    ) INTO result;
    RETURN result;
END;
$$;

-- All regions statistics for today
CREATE OR REPLACE FUNCTION get_all_regional_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'regions', (
            SELECT json_agg(get_regional_stats(r.region))
            FROM (SELECT unnest(enum_range(NULL::region_enum)) AS region) r
        ),
        'updated_at', now()
    ) INTO result;
    RETURN result;
END;
$$;

-- Random quip by locale
CREATE OR REPLACE FUNCTION get_random_quip(target_locale locale_enum DEFAULT 'zh-CN')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', q.id,
        'text', q.text,
        'locale', q.locale
    ) INTO result
    FROM quips q
    WHERE q.locale = target_locale
    ORDER BY random()
    LIMIT 1;
    RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- 6. Seed Data — Sample quips (共鸣语)
-- ------------------------------------------------------------

INSERT INTO quips (text, locale) VALUES
    -- zh-CN quips
    ('全球有37%的人和你一样废。你不孤单。', 'zh-CN'),
    ('你的怨念已成功投入黑洞。宇宙已读不回。', 'zh-CN'),
    ('恭喜！你刚才燃烧的卡路里约等于0.001大卡。', 'zh-CN'),
    ('据统计，此刻正有1024人和你同时在发泄。', 'zh-CN'),
    ('你的废话已化作星尘，飘向仙女座。', 'zh-CN'),
    ('黑洞表示：这点负能量，不够塞牙缝。', 'zh-CN'),
    ('销毁完成。地球还在转，你也还在。', 'zh-CN'),
    ('已阅。已焚。已忘。明天继续废。', 'zh-CN'),
    -- en-GB quips
    ('37% of humans are equally burned out right now. Solidarity.', 'en-GB'),
    ('Your grievances have been yeeted into the void. The void says cheers.', 'en-GB'),
    ('Congratulations! You just burned approximately 0.001 kcal of rage.', 'en-GB'),
    ('Right now, 1,024 people are venting alongside you. Misery loves company.', 'en-GB'),
    ('Your words have been reduced to stardust, drifting toward Andromeda.', 'en-GB'),
    ('The black hole says: "Is that all you''ve got?"', 'en-GB'),
    ('Destruction complete. Earth still spinning. You''re still here.', 'en-GB'),
    ('Read. Burned. Forgotten. See you tomorrow for round two.', 'en-GB');

-- ------------------------------------------------------------
-- 7. Supabase Realtime — enable for dashboard live updates
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE check_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE vent_logs;
