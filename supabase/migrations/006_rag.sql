-- ============================================================
-- Twiinn AI — RAG: real vector search over twin training content
-- Run this in the Supabase SQL Editor. App code degrades gracefully
-- (falls back to raw_text top-K) until this is applied + VOYAGE_API_KEY set.
-- ============================================================

-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per embedded chunk of a twin's training content.
CREATE TABLE IF NOT EXISTS twin_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id     UUID NOT NULL REFERENCES twins(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES training_content(id) ON DELETE CASCADE,
  chunk_text  TEXT NOT NULL,
  embedding   vector(1024) NOT NULL,  -- Voyage voyage-3.5-lite
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twin_chunks_twin ON twin_chunks (twin_id);

-- Cosine-distance HNSW index for fast similarity search.
CREATE INDEX IF NOT EXISTS idx_twin_chunks_embedding
  ON twin_chunks USING hnsw (embedding vector_cosine_ops);

-- Top-N most similar chunks for a twin to a query embedding.
-- Called via the service-role client.
CREATE OR REPLACE FUNCTION match_twin_chunks(
  p_twin_id     UUID,
  query_embedding vector(1024),
  match_count   INT DEFAULT 8
)
RETURNS TABLE (
  id          UUID,
  content_id  UUID,
  chunk_text  TEXT,
  similarity  FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.content_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM twin_chunks c
  WHERE c.twin_id = p_twin_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
