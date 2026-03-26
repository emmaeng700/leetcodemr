-- ============================================================
-- LeetMastery Supabase Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  role text default 'user',
  resume_text text,
  behavioral_generated boolean default false,
  behavioral_regen_count integer default 0,
  leetcode_session text,
  leetcode_csrf text,
  notification_email text,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- 2. behavioral_answers table
create table if not exists behavioral_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  question_index integer not null,
  story_index integer not null,
  situation text,
  task_text text,
  action text,
  result text,
  created_at timestamptz default now()
);

alter table behavioral_answers enable row level security;
create policy "Users can manage own behavioral answers" on behavioral_answers
  for all using (auth.uid() = user_id);

-- 3. Update RLS on existing tables (if not already done)
alter table progress enable row level security;
create policy "Users can manage own progress" on progress
  for all using (auth.uid()::text = user_id);

alter table study_plan enable row level security;
create policy "Users can manage own study plan" on study_plan
  for all using (auth.uid()::text = user_id);

alter table solved_log enable row level security;
create policy "Users can manage own solved log" on solved_log
  for all using (auth.uid()::text = user_id);

-- 4. Migration script
-- After Emmanuel signs up, replace PASTE-YOUR-UUID with his real UUID from Supabase Auth dashboard.
-- Then run these UPDATE statements:
--
-- UPDATE progress SET user_id = 'PASTE-YOUR-UUID' WHERE user_id = 'emmanuel';
-- UPDATE study_plan SET user_id = 'PASTE-YOUR-UUID' WHERE user_id = 'emmanuel';
-- UPDATE solved_log SET user_id = 'PASTE-YOUR-UUID' WHERE user_id = 'emmanuel';
-- UPDATE daily_target SET user_id = 'PASTE-YOUR-UUID' WHERE user_id = 'emmanuel';
-- INSERT INTO profiles (id, role, notification_email) VALUES ('PASTE-YOUR-UUID', 'admin', 'emmanuelopponga07@gmail.com');
