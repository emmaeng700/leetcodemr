-- Add lc_lists column to store created LeetCode Favorite Lists per filter
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lc_lists TEXT DEFAULT NULL;
