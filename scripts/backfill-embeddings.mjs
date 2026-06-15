/**
 * Backfill twin_chunks for training_content that was marked 'embedded' before
 * real RAG existed (or any content missing chunks). Idempotent: skips content
 * that already has chunks.
 *
 * Prereqs: migration 006 applied + env vars set. Run from app/:
 *   node --env-file=.env.local scripts/backfill-embeddings.mjs
 *
 * Self-contained (raw PostgREST + Voyage fetch) so it doesn't depend on the
 * Next build or path aliases.
 */

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;

const EMBEDDING_MODEL = 'voyage-3.5-lite';
const CHUNK_TOKENS = 512;
const CHUNK_OVERLAP = 64;
const VOYAGE_BATCH = 128;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!VOYAGE_KEY) {
  console.error('Missing VOYAGE_API_KEY — set it before backfilling.');
  process.exit(1);
}

const sb = (path, init = {}) =>
  fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

function chunkText(text, maxTokens, overlap) {
  const words = text.split(/\s+/);
  const chunks = [];
  const wordsPerChunk = Math.floor(maxTokens * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ').trim();
    if (chunk) chunks.push(chunk);
    i += wordsPerChunk - overlapWords;
  }
  return chunks;
}

async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH) {
    const batch = texts.slice(i, i + VOYAGE_BATCH);
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VOYAGE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch, input_type: 'document' }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const d of data.data) out.push(d.embedding);
  }
  return out;
}

async function main() {
  const res = await sb('training_content?select=id,twin_id,raw_text,status&status=eq.embedded&raw_text=not.is.null');
  if (!res.ok) {
    console.error('Failed to fetch training_content:', res.status, await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  console.log(`Found ${rows.length} embedded content rows.`);

  let done = 0, skipped = 0, totalChunks = 0;
  for (const row of rows) {
    // Idempotent: skip if chunks already exist
    const existing = await sb(`twin_chunks?content_id=eq.${row.id}&select=id&limit=1`);
    const has = existing.ok ? await existing.json() : [];
    if (has.length > 0) { skipped++; continue; }

    const chunks = chunkText(row.raw_text, CHUNK_TOKENS, CHUNK_OVERLAP);
    if (chunks.length === 0) { skipped++; continue; }

    const vectors = await embed(chunks);
    const payload = chunks.map((chunk_text, i) => ({
      twin_id: row.twin_id,
      content_id: row.id,
      chunk_text,
      embedding: JSON.stringify(vectors[i]),
    }));

    for (let i = 0; i < payload.length; i += 100) {
      const ins = await sb('twin_chunks', { method: 'POST', body: JSON.stringify(payload.slice(i, i + 100)) });
      if (!ins.ok) {
        console.error(`  insert failed for content ${row.id}:`, ins.status, await ins.text());
        break;
      }
    }
    done++;
    totalChunks += chunks.length;
    console.log(`  ✓ content ${row.id} → ${chunks.length} chunks`);
  }

  console.log(`\nDone. Embedded ${done} content rows (${totalChunks} chunks), skipped ${skipped}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
