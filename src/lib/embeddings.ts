/**
 * Text embeddings via Voyage AI (Anthropic-recommended pairing with Claude).
 * Used for real RAG: chunks are embedded at ingestion, the fan's message is
 * embedded at query time, and pgvector finds the most relevant chunks.
 *
 * Degrades gracefully: without VOYAGE_API_KEY every call returns null so
 * callers fall back to the legacy raw_text dump — chat never breaks.
 */
import { EMBEDDING_MODEL } from '@/lib/constants';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MAX_BATCH = 128; // Voyage per-request input cap

export function hasEmbeddings(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

/**
 * Embed an array of texts. `inputType` improves retrieval: 'document' for
 * stored chunks, 'query' for the fan's message. Returns one vector per input
 * (order preserved), or null if embeddings are unavailable / fail.
 */
export async function embed(
  texts: string[],
  inputType: 'document' | 'query'
): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;

  const clean = texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (clean.length === 0) return null;

  try {
    const out: number[][] = [];
    for (let i = 0; i < clean.length; i += MAX_BATCH) {
      const batch = clean.slice(i, i + MAX_BATCH);
      const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
          input_type: inputType,
        }),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('Voyage embeddings failed:', res.status, await res.text().catch(() => ''));
        return null;
      }
      const data = (await res.json()) as { data?: { embedding: number[] }[] };
      if (!data.data || data.data.length !== batch.length) return null;
      for (const d of data.data) out.push(d.embedding);
    }
    return out;
  } catch (err) {
    console.error('Voyage embeddings error:', err);
    return null;
  }
}

/** Convenience: embed a single query string → one vector (or null). */
export async function embedQuery(text: string): Promise<number[] | null> {
  const vecs = await embed([text], 'query');
  return vecs?.[0] ?? null;
}
