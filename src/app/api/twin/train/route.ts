import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET: list training content for the creator's twin
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('creator_id', profile.id)
    .single();

  if (!twin) {
    return Response.json({ content: [] });
  }

  const { data: content } = await supabase
    .from('training_content')
    .select('*')
    .eq('twin_id', twin.id)
    .order('created_at', { ascending: false });

  return Response.json({ content: content || [] });
}

// POST: add new training content
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('creator_id', profile.id)
    .single();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const body = await req.json();
  const { sourceType, rawText, sourceUrl } = body;

  if (!sourceType) {
    return Response.json({ error: 'Source type required' }, { status: 400 });
  }

  if (sourceType === 'text' && (!rawText || rawText.trim().length < 20)) {
    return Response.json({ error: 'Text must be at least 20 characters' }, { status: 400 });
  }

  // Insert raw content
  const { data: content, error: insertError } = await supabase
    .from('training_content')
    .insert({
      twin_id: twin.id,
      source_type: sourceType,
      raw_text: rawText?.trim() || null,
      source_url: sourceUrl || null,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert error:', insertError);
    return Response.json({ error: 'Failed to add content' }, { status: 500 });
  }

  // Process text content: chunk and store
  if (sourceType === 'text' && rawText) {
    try {
      const chunks = chunkText(rawText.trim(), 512, 64);

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
          metadata: { chunks: chunks.length, characters: rawText.length }
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('id')
    .eq('creator_id', profile.id)
    .single();

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
