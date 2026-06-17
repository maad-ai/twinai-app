-- ============================================================
-- Twiinn AI — migration 010: tips (one-time pourboires)
-- 2nd ARPU lever after subscriptions; captures whales. One-time Stripe
-- Checkout (platform-collect), recorded here + fed into the earnings ledger
-- (80% net) by the webhook, exactly like subscription payments.
-- Run in the Supabase SQL Editor. App degrades gracefully without it
-- (the tip row is best-effort; the earning is still recorded via metadata).
-- ============================================================

create table if not exists tips (
  id                uuid primary key default gen_random_uuid(),
  twin_id           uuid not null references twins(id) on delete cascade,
  fan_id            uuid references profiles(id) on delete set null,
  amount_cents      int not null,
  message           text,
  stripe_session_id text,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed')),
  created_at        timestamptz default now()
);
create index if not exists idx_tips_twin on tips (twin_id, created_at desc);
