import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { streamChat } from '@/lib/ai/provider';
import { encrypt, decodeMessage } from '@/lib/encryption';
import { parseBody, sendMessageSchema } from '@/lib/validators';
import { chatRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { CHAT_HISTORY_LIMIT, RAG_TOP_K } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 20 messages/min per user
  const blocked = await checkRateLimit(chatRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, sendMessageSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .maybeSingle();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('*')
    .eq('id', body.twinId)
    .maybeSingle();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  // Creators can chat with their own twin for free (testing)
  const isCreator = twin.creator_id === profile.id;

  let activeSubscription: { id: string; credits_remaining: number } | null = null;

  if (!isCreator) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, credits_remaining, status')
      .eq('fan_id', profile.id)
      .eq('twin_id', body.twinId)
      .eq('status', 'active')
      .maybeSingle();

    if (!subscription) {
      return Response.json(
        { error: 'Not subscribed', code: 'NOT_SUBSCRIBED', message: 'You need to subscribe to chat with this twin.' },
        { status: 403 }
      );
    }

    if (subscription.credits_remaining <= 0) {
      return Response.json(
        { error: 'No credits', code: 'NO_CREDITS', message: 'You\'ve used all your messages this month. Buy a credit pack to continue.', credits_remaining: 0 },
        { status: 403 }
      );
    }

    activeSubscription = subscription;
  }

  // Get or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, message_count')
    .eq('fan_id', profile.id)
    .eq('twin_id', body.twinId)
    .maybeSingle();

  if (!conversation) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ fan_id: profile.id, twin_id: body.twinId })
      .select('id, message_count')
      .maybeSingle();
    conversation = newConvo;
  }

  if (!conversation) {
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }

  // Deduct 1 credit AFTER we know the message will be processed (not for creators)
  if (activeSubscription) {
    await supabase
      .from('subscriptions')
      .update({ credits_remaining: activeSubscription.credits_remaining - 1, updated_at: new Date().toISOString() })
      .eq('id', activeSubscription.id);

    await supabase.from('credit_transactions').insert({
      subscription_id: activeSubscription.id,
      type: 'message_sent',
      amount: -1,
      balance_after: activeSubscription.credits_remaining - 1,
    });
  }

  // RAG context (TODO Vague 3: vector search; for now top-K raw chunks)
  const { data: trainingContent } = await supabase
    .from('training_content')
    .select('raw_text')
    .eq('twin_id', body.twinId)
    .eq('status', 'embedded')
    .limit(RAG_TOP_K);

  const context = (trainingContent || []).map((c) => c.raw_text).filter(Boolean) as string[];

  // Recent message history (decrypt)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content_encrypted, content_iv')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  const history = (recentMessages || [])
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: decodeMessage(m.content_encrypted, m.content_iv),
    }));

  history.push({ role: 'user', content: body.message });

  // Save user message (encrypted)
  const userEnc = encrypt(body.message);
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content_encrypted: userEnc.encrypted,
    content_iv: userEnc.iv,
  });

  const encoder = new TextEncoder();
  let fullResponse = '';
  const convId = conversation.id;
  const convCount = conversation.message_count || 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(twin.system_prompt, history, context)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        // Save assistant response (encrypted)
        const asstEnc = encrypt(fullResponse);
        await supabase.from('messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content_encrypted: asstEnc.encrypted,
          content_iv: asstEnc.iv,
        });

        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString(), message_count: convCount + 2 })
          .eq('id', convId);

        await supabase
          .from('twins')
          .update({ total_messages: (twin.total_messages || 0) + 2 })
          .eq('id', body.twinId);

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
    .maybeSingle();

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
