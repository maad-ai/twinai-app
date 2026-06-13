import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, trainContentSchema } from '@/lib/validators';
import { uploadRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { extractVideoId, fetchYouTubeTranscript } from '@/lib/youtube';
import { getRunStatus, collectScrapedText, type SocialPlatform } from '@/lib/apify';

export const dynamic = 'force-dynamic';

// GET: list training content for the creator's twin
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const profile = await getProfileByClerkId(supabase, userId);

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id);

  if (!twin) {
    return Response.json({ content: [] });
  }

  const { data: content } = await supabase
    .from('training_content')
    .select('*')
    .eq('twin_id', twin.id)
    .order('created_at', { ascending: false });

  // Lazily resolve any social imports still running on Apify. Bounded
  // (few rows) and fully guarded so a flaky scrape never breaks the list.
  const pending = (content || []).filter(
    (c) => c.status === 'processing' && c.metadata?.apify_run_id
  );
  if (pending.length > 0) {
    await Promise.all(
      pending.map(async (row) => {
        try {
          const status = await getRunStatus(row.metadata.apify_run_id as string);
          if (status === 'RUNNING') return;
          if (status === 'FAILED') {
            await supabase
              .from('training_content')
              .update({ status: 'error' })
              .eq('id', row.id);
            row.status = 'error';
            return;
          }
          // SUCCEEDED → pull captions
          const platform = (row.metadata.platform as SocialPlatform) || 'tiktok';
          const { text, count } = await collectScrapedText(
            platform,
            row.metadata.apify_dataset_id as string
          );
          if (!text || count === 0) {
            await supabase
              .from('training_content')
              .update({
                status: 'error',
                metadata: { ...row.metadata, error: 'No public posts found' },
              })
              .eq('id', row.id);
            row.status = 'error';
            return;
          }
          const chunks = chunkText(text, 512, 64);
          await supabase
            .from('training_content')
            .update({
              status: 'embedded',
              raw_text: text,
              metadata: { ...row.metadata, posts: count, chunks: chunks.length, characters: text.length },
            })
            .eq('id', row.id);
          row.status = 'embedded';
          row.raw_text = text;
        } catch (err) {
          console.error('Apify resolve error:', err);
        }
      })
    );
  }

  return Response.json({ content: content || [] });
}

// POST: add new training content
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(uploadRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, trainContentSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();

  const profile = await getProfileByClerkId(supabase, userId);

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id);

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const { sourceType, rawText, sourceUrl } = body;
  let finalText = rawText?.trim() || null;
  let metadata: Record<string, unknown> = {};

  if (sourceType === 'text' && (!finalText || finalText.length < 20)) {
    return Response.json({ error: 'Text must be at least 20 characters' }, { status: 400 });
  }

  // YouTube: the creator just pastes a link — we fetch the transcript.
  if (sourceType === 'youtube') {
    if (!sourceUrl) {
      return Response.json({ error: 'Paste a YouTube video link' }, { status: 400 });
    }
    const videoId = extractVideoId(sourceUrl);
    if (!videoId) {
      return Response.json({ error: 'That doesn\'t look like a YouTube video link' }, { status: 400 });
    }
    try {
      const { title, text } = await fetchYouTubeTranscript(videoId);
      finalText = text;
      metadata = { youtube_title: title, video_id: videoId };
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'Could not fetch this video\'s captions' },
        { status: 422 }
      );
    }
  }

  // Insert raw content
  const { data: content, error: insertError } = await supabase
    .from('training_content')
    .insert({
      twin_id: twin.id,
      source_type: sourceType,
      raw_text: finalText,
      source_url: sourceUrl || null,
      status: 'pending',
      metadata,
    })
    .select()
    .maybeSingle();

  if (insertError) {
    console.error('Insert error:', insertError);
    return Response.json({ error: 'Failed to add content' }, { status: 500 });
  }

  // Process text content (typed or fetched from YouTube): chunk and store
  if (finalText) {
    try {
      const chunks = chunkText(finalText, 512, 64);

      // Store chunks as simple text (embeddings will be added when AI API is configured)
      for (const chunk of chunks) {
        await supabase
          .from('training_content')
          .update({ status: 'embedded' })
          .eq('id', content.id);
      }

      // Mark as embedded (for now without actual vector embeddings)
      await supabase
        .from('training_content')
        .update({
          status: 'embedded',
          metadata: { ...metadata, chunks: chunks.length, characters: finalText.length },
        })
        .eq('id', content.id);

    } catch (err) {
      console.error('Processing error:', err);
      await supabase
        .from('training_content')
        .update({ status: 'error' })
        .eq('id', content.id);
    }
  }

  return Response.json({ content });
}

// DELETE: remove training content
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'ID required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify ownership
  const profile = await getProfileByClerkId(supabase, userId);

  if (!profile) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const twin = await getCreatorTwin(supabase, profile.id);

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  await supabase
    .from('training_content')
    .delete()
    .eq('id', id)
    .eq('twin_id', twin.id);

  return Response.json({ success: true });
}

// ─── Text chunking utility ────────────────────────
function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  const wordsPerChunk = Math.floor(maxTokens * 0.75); // ~0.75 words per token estimate
  const overlapWords = Math.floor(overlap * 0.75);

  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
    i += wordsPerChunk - overlapWords;
  }

  return chunks;
}
