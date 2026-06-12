-- Stripe Connect Express account per creator (payouts).
-- Run this in the Supabase SQL Editor; app code degrades gracefully
-- while this column doesn't exist.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
