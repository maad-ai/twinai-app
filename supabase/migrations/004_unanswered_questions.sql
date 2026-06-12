-- Questions the twin couldn't answer, surfaced to the creator (most
-- recurring first). Inserted fire-and-forget from the chat route.
-- Run this in the Supabase SQL Editor; app code degrades gracefully
-- (silently skips logging) while this table doesn't exist.
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id     UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  normalized  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unanswered_twin_norm
  ON unanswered_questions (twin_id, normalized);

CREATE INDEX IF NOT EXISTS idx_unanswered_twin_created
  ON unanswered_questions (twin_id, created_at DESC);
