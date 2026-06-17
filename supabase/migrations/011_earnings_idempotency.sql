-- ============================================================
-- Twiinn AI — migration 011: earnings idempotency
-- Stripe webhooks are at-least-once; without a dedup key a retried event can
-- double-count an earning. source_id = the Stripe session/invoice id; the
-- unique index makes recordEarning() upserts a no-op on retry.
-- Run in the Supabase SQL Editor. Code falls back to a plain insert if absent.
-- ============================================================

alter table earnings add column if not exists source_id text;
create unique index if not exists idx_earnings_source
  on earnings (source_id)
  where source_id is not null;
