-- Fans can cancel anytime; access continues until period end.
-- Run this in Supabase SQL Editor before deploying the cancel feature.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
