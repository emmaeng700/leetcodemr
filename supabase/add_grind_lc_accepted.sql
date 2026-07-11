-- Cross-device cache of latest accepted LeetCode solutions for Grind offline use.
-- Run in Supabase SQL Editor once.

CREATE TABLE IF NOT EXISTS grind_lc_accepted (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER     NOT NULL,
  lang        TEXT        NOT NULL,
  code        TEXT        NOT NULL DEFAULT '',
  empty       BOOLEAN     NOT NULL DEFAULT FALSE,
  fetched_at  TIMESTAMPTZ          DEFAULT NOW(),
  UNIQUE (user_id, question_id, lang)
);

CREATE INDEX IF NOT EXISTS grind_lc_accepted_user_idx
  ON grind_lc_accepted (user_id);

ALTER TABLE grind_lc_accepted ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grind_lc_accepted;
CREATE POLICY "owner only" ON grind_lc_accepted
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');
