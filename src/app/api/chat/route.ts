import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { streamChat } from '@/lib/ai/provider';

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
      content: Buffer.from(m.content_encrypted).toString('utf-8'),
    }));

  // Add current message
  history.push({ role: 'user', content: message.trim() });

  // Save user message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content_encrypted: Buffer.from(message.trim()),
    content_iv: Buffer.from('0'.repeat(32), 'hex'), // placeholder IV
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
        await supabase.from('messages').insert({
          conversation_id: conversation!.id,
          role: 'assistant',
          content_encrypted: Buffer.from(fullResponse),
          content_iv: Buffer.from('0'.repeat(32), 'hex'),
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
