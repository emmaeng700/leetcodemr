-- Per-question daily rep counts (Chicago calendar day), synced across devices.
ALTER TABLE progress ADD COLUMN IF NOT EXISTS daily_rep_count INTEGER DEFAULT 0;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS daily_rep_date DATE;
