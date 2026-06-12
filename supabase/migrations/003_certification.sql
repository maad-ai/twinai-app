-- Twiinn Certified: badge highlighting serious creators (granted manually for now).
-- Run this in Supabase SQL Editor before relying on the certified flag.
-- All app code degrades gracefully while this column doesn't exist yet.
ALTER TABLE twins
  ADD COLUMN IF NOT EXISTS certified BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only certified twins are indexed (fast "featured" lookups).
CREATE INDEX IF NOT EXISTS idx_twins_certified ON twins (certified) WHERE certified;
