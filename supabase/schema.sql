-- Single user ID constant
-- All rows use user_id = 'emmanuel'

-- Progress table (solved, starred, notes, spaced repetition)
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER NOT NULL,
  solved BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  review_count INTEGER DEFAULT 0,
  next_review DATE,
  last_reviewed DATE,
  status TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Activity log (daily activity count for heatmap)
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Solved log (daily solved count for heatmap coloring)
CREATE TABLE IF NOT EXISTS solved_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Flashcard visited (array of question IDs visited)
CREATE TABLE IF NOT EXISTS fc_visited (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_ids INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Behavioral visited
CREATE TABLE IF NOT EXISTS behavioral_visited (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_ids INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Gems visited
CREATE TABLE IF NOT EXISTS gems_visited (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  card_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Pattern flashcard visited
CREATE TABLE IF NOT EXISTS pattern_fc_visited (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_ids INTEGER[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Study plan
CREATE TABLE IF NOT EXISTS study_plan (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  start_date DATE NOT NULL,
  per_day INTEGER DEFAULT 3,
  question_order INTEGER[] NOT NULL,
  lock_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Daily target
CREATE TABLE IF NOT EXISTS daily_target (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  target INTEGER DEFAULT 0,
  lock_code TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Practice sessions (saved code per question)
CREATE TABLE IF NOT EXISTS practice_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER NOT NULL,
  language TEXT DEFAULT 'python',
  code TEXT DEFAULT '',
  last_result JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id, language)
);

-- Time tracking (seconds spent per question)
CREATE TABLE IF NOT EXISTS time_tracking (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER NOT NULL,
  seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Mock interview sessions
CREATE TABLE IF NOT EXISTS mock_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  question_id INTEGER NOT NULL,
  duration_minutes INTEGER,
  outcome TEXT, -- 'solved' | 'gave_up' | 'timeout'
  code TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview date (for countdown)
CREATE TABLE IF NOT EXISTS interview_date (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  target_date DATE,
  company TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- FC daily log (flashcards viewed per day)
CREATE TABLE IF NOT EXISTS fc_daily_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'emmanuel',
  date DATE NOT NULL,
  question_ids INTEGER[] DEFAULT '{}',
  UNIQUE(user_id, date)
);
