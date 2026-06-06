import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { streamChat } from '@/lib/ai/provider';

function decodeContent(data: unknown): string {
  // Handle JSON Buffer: {"type":"Buffer","data":[72,101,...]}
  if (data && typeof data === 'object' && 'type' in (data as Record<string, unknown>) && (data as Record<string, unknown>).type === 'Buffer') {
    const arr = (data as { data: number[] }).data;
    return Buffer.from(arr).toString('utf-8');
  }
  // Handle hex string from Supabase: \x48656c6c6f
  if (typeof data === 'string') {
    if (data.startsWith('\\x')) {
      return Buffer.from(data.slice(2), 'hex').toString('utf-8');
    }
    // Try parsing as JSON Buffer
    try {
      const parsed = JSON.parse(data);
      if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) {
        return Buffer.from(parsed.data).toString('utf-8');
      }
    } catch { /* not JSON */ }
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }
  return String(data);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get fan profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await req.json();
  const { twinId, message } = body;

  if (!twinId || !message?.trim()) {
    return Response.json({ error: 'Twin ID and message required' }, { status: 400 });
  }

  // Get twin
  const { data: twin } = await supabase
    .from('twins')
    .select('*')
    .eq('id', twinId)
    .single();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  // Get or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, message_count')
    .eq('fan_id', profile.id)
    .eq('twin_id', twinId)
    .single();

  if (!conversation) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({
        fan_id: profile.id,
        twin_id: twinId,
      })
      .select()
      .single();
    conversation = newConvo;
  }

  if (!conversation) {
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }

  // Get training content for RAG context
  const { data: trainingContent } = await supabase
    .from('training_content')
    .select('raw_text')
    .eq('twin_id', twinId)
    .eq('status', 'embedded')
    .limit(5);

  const context = (trainingContent || [])
    .map((c) => c.raw_text)
    .filter(Boolean) as string[];

  // Get recent message history (last 10 messages)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content_encrypted')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Build message history (messages are stored as plain text for now, encryption in next step)
  const history = (recentMessages || [])
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: decodeContent(m.content_encrypted),
    }));

  // Add current message
  history.push({ role: 'user', content: message.trim() });

  // Save user message (store as hex-encoded text in BYTEA)
  const userHex = '\\x' + Buffer.from(message.trim(), 'utf-8').toString('hex');
  const placeholderIv = '\\x' + '0'.repeat(32);
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content_encrypted: userHex,
    content_iv: placeholderIv,
  });

  // Stream response
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(twin.system_prompt, history, context)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        // Save assistant response
        const assistantHex = '\\x' + Buffer.from(fullResponse, 'utf-8').toString('hex');
        await supabase.from('messages').insert({
          conversation_id: conversation!.id,
          role: 'assistant',
          content_encrypted: assistantHex,
          content_iv: placeholderIv,
        });

        // Update conversation
        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            message_count: (conversation!.message_count || 0) + 2,
          })
          .eq('id', conversation!.id);

        // Update twin message count
        await supabase
          .from('twins')
          .update({ total_messages: twin.total_messages + 2 })
          .eq('id', twinId);

        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.enqueue(encoder.encode('\n[Error generating response]'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  });
}

// GET: list conversations for the current user
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

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id,
      last_message_at,
      message_count,
      twin_id,
      twins (
        name,
        slug,
        niche,
        avatar_url,
        photo_url
      )
    `)
    .eq('fan_id', profile.id)
    .order('last_message_at', { ascending: false });

  return Response.json({ conversations: conversations || [] });
}
