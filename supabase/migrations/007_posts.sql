-- ============================================================
-- Twiinn AI — Creator posts (membership feed)
-- Run this in the Supabase SQL Editor. App code degrades gracefully:
-- without this table the public feed is simply empty — nothing breaks.
-- ============================================================

-- One row per post on a creator's page. A post is either text-only,
-- or text + a single media item (image/video). Visibility decides
-- whether non-subscribers see it in full or as a locked teaser.
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id     UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  body        TEXT,
  media_url   TEXT,
  media_type  TEXT NOT NULL DEFAULT 'text'
              CHECK (media_type IN ('text', 'image', 'video')),
  visibility  TEXT NOT NULL DEFAULT 'public'
              CHECK (visibility IN ('public', 'subscribers')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Feed query: a twin's posts, newest first.
CREATE INDEX IF NOT EXISTS idx_posts_twin_created
  ON posts (twin_id, created_at DESC);

-- The media bucket `twin-posts` (public) is created on first upload by the
-- API, mirroring the `twin-photos` pattern — no manual storage setup needed.
