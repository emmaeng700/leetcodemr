-- Tracks reviews rolled forward from a missed day (exempt from daily SR cap).
ALTER TABLE progress ADD COLUMN IF NOT EXISTS review_carry_date DATE;
