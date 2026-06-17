-- ============================================================
-- Twiinn AI — migration 009: persistent per-fan memory
-- A running, condensed memory of durable facts about each fan, so the twin
-- "remembers" across sessions (the differentiator vs session-only clones).
-- Run in the Supabase SQL Editor. App degrades gracefully without it
-- (the column is read via select('*') and writes are fire-and-forget).
-- ============================================================

alter table conversations add column if not exists memory text;
