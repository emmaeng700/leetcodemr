-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security) — Single-user app (user_id = 'emmanuel')
--
-- INSTRUCTIONS:
--   1. Open your Supabase project dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. The security warning in your email will go away within 24h
--
-- WHY THIS WORKS:
--   This app uses the public anon key with a hardcoded user_id.
--   RLS ensures that every query—even from the anon key—can only
--   touch rows where user_id = 'emmanuel'. No other data leaks.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── progress ──────────────────────────────────────────────────────────────────
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON progress;
CREATE POLICY "owner only" ON progress
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── activity_log ──────────────────────────────────────────────────────────────
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON activity_log;
CREATE POLICY "owner only" ON activity_log
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── solved_log ────────────────────────────────────────────────────────────────
ALTER TABLE solved_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON solved_log;
CREATE POLICY "owner only" ON solved_log
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── fc_visited ────────────────────────────────────────────────────────────────
ALTER TABLE fc_visited ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fc_visited;
CREATE POLICY "owner only" ON fc_visited
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── behavioral_visited ────────────────────────────────────────────────────────
ALTER TABLE behavioral_visited ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON behavioral_visited;
CREATE POLICY "owner only" ON behavioral_visited
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── gems_visited ──────────────────────────────────────────────────────────────
ALTER TABLE gems_visited ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON gems_visited;
CREATE POLICY "owner only" ON gems_visited
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── pattern_fc_visited ────────────────────────────────────────────────────────
ALTER TABLE pattern_fc_visited ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON pattern_fc_visited;
CREATE POLICY "owner only" ON pattern_fc_visited
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── study_plan ────────────────────────────────────────────────────────────────
ALTER TABLE study_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON study_plan;
CREATE POLICY "owner only" ON study_plan
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── daily_target ──────────────────────────────────────────────────────────────
ALTER TABLE daily_target ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON daily_target;
CREATE POLICY "owner only" ON daily_target
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── practice_sessions ─────────────────────────────────────────────────────────
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON practice_sessions;
CREATE POLICY "owner only" ON practice_sessions
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── time_tracking ─────────────────────────────────────────────────────────────
ALTER TABLE time_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON time_tracking;
CREATE POLICY "owner only" ON time_tracking
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── mock_sessions ─────────────────────────────────────────────────────────────
ALTER TABLE mock_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON mock_sessions;
CREATE POLICY "owner only" ON mock_sessions
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── interview_date ────────────────────────────────────────────────────────────
ALTER TABLE interview_date ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON interview_date;
CREATE POLICY "owner only" ON interview_date
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── user_settings ─────────────────────────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON user_settings;
CREATE POLICY "owner only" ON user_settings
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');

-- ── fc_daily_log ──────────────────────────────────────────────────────────────
ALTER TABLE fc_daily_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON fc_daily_log;
CREATE POLICY "owner only" ON fc_daily_log
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');
