-- Run this in your Supabase dashboard → SQL Editor
-- https://supabase.com/dashboard/project/azrokoorufejfoeddzrw/sql

CREATE TABLE IF NOT EXISTS best_solutions (
  user_id     TEXT        NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER     NOT NULL,
  language    TEXT        NOT NULL DEFAULT 'python3',
  code        TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ          DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- Optional: RLS (matches the other tables in this single-user app)
ALTER TABLE best_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emmanuel only" ON best_solutions
  FOR ALL USING (user_id = 'emmanuel');
