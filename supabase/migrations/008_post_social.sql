-- ============================================================
-- Twiinn AI — migration 008: social on posts (likes + comments)
-- Run in the Supabase SQL Editor. App degrades gracefully: without
-- these tables, posts show 0 likes / no comments and the buttons no-op.
-- (Cover image lives in twins.settings.public_profile.cover — no migration.)
-- ============================================================

-- One like per (post, fan).
create table if not exists post_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (post_id, profile_id)
);
create index if not exists idx_post_likes_post on post_likes (post_id);

-- Comments on a post.
create table if not exists post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_post_comments_post on post_comments (post_id, created_at);
