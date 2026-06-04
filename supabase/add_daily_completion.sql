-- Daily completion is separate from Learn "solved" progress.
ALTER TABLE progress ADD COLUMN IF NOT EXISTS last_daily_done DATE;

CREATE TABLE IF NOT EXISTS daily_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
