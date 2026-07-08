-- Per-question "reset to starter" counts for Grind (synced across devices).
CREATE TABLE IF NOT EXISTS grind_reset_counts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE grind_reset_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner only" ON grind_reset_counts;
CREATE POLICY "owner only" ON grind_reset_counts
  FOR ALL USING (user_id = 'emmanuel') WITH CHECK (user_id = 'emmanuel');
