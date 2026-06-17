import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { streamChat, summarizeFanMemory } from '@/lib/ai/provider';
import { encrypt, decodeMessage } from '@/lib/encryption';
import { parseBody, sendMessageSchema } from '@/lib/validators';
import { chatRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { CHAT_HISTORY_LIMIT, RAG_TOP_K } from '@/lib/constants';
import { embedQuery } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Matches the twin's canonical "I can't answer that" phrasings (see the
 * RULES block in lib/twin-prompt.ts). Used to surface unanswered questions
 * to the creator — kept tight to avoid false positives.
 */
const DEFLECTION_RE =
  /haven['’]?t (really )?(talked|spoken) about|haven['’]?t covered|not something I(?:['’]ve| have)? (talk|cover|discuss)|can['’]?t (really )?help (you )?with that|outside (of )?my (knowledge|expertise|lane)|don['’]?t have (much )?(info|information|knowledge) (on|about)/i;

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

  const profile = await getProfileByClerkId(supabase, userId, 'id, display_name');

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
    .select('*')
    .eq('fan_id', profile.id)
    .eq('twin_id', body.twinId)
    .maybeSingle();

  if (!conversation) {
    const { data: newConvo } = await supabase
      .from('conversations')
      .insert({ fan_id: profile.id, twin_id: body.twinId })
      .select('*')
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

  // RAG context: real vector search over the twin's chunks. Falls back to a
  // top-K raw_text dump when embeddings/pgvector aren't available, so chat
  // never breaks before VOYAGE_API_KEY + migration 006 are in place.
  let context: string[] = [];
  const queryVec = await embedQuery(body.message);
  if (queryVec) {
    const { data: matches, error: matchError } = await supabase.rpc('match_twin_chunks', {
      p_twin_id: body.twinId,
      query_embedding: JSON.stringify(queryVec),
      match_count: RAG_TOP_K,
    });
    if (!matchError && matches) {
      context = (matches as { chunk_text: string }[]).map((m) => m.chunk_text).filter(Boolean);
    } else if (matchError) {
      console.error('match_twin_chunks failed (run migration 006?):', matchError.message);
    }
  }
  if (context.length === 0) {
    // Fallback: legacy raw_text dump
    const { data: trainingContent } = await supabase
      .from('training_content')
      .select('raw_text')
      .eq('twin_id', body.twinId)
      .eq('status', 'embedded')
      .limit(RAG_TOP_K);
    context = (trainingContent || []).map((c) => c.raw_text).filter(Boolean) as string[];
  }

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

  // Persistent fan memory: tell the twin who it's talking to so it remembers
  // them across sessions (the differentiator vs session-only clones).
  const fanName: string | null = profile.display_name ?? null;
  const fanMemory: string | null = conversation.memory ?? null;
  let fanContext = '';
  if (!isCreator && (fanName || fanMemory)) {
    fanContext =
      `\n\nABOUT THE FAN YOU'RE TALKING TO:` +
      (fanName ? `\n- Their name is ${fanName} — use it naturally now and then.` : '') +
      (fanMemory ? `\n- What you remember about them from past chats:\n${fanMemory}` : '');
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(twin.system_prompt + fanContext, history, context)) {
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

        // Fire-and-forget: refresh the persistent fan memory (skip creators testing).
        if (!isCreator) {
          summarizeFanMemory(fanMemory, body.message, fullResponse, fanName).then(
            (mem) => {
              if (mem && mem !== fanMemory) {
                supabase.from('conversations').update({ memory: mem }).eq('id', convId).then(
                  () => {},
                  () => {}
                );
              }
            },
            () => {}
          );
        }

        await supabase
          .from('twins')
          .update({ total_messages: (twin.total_messages || 0) + 2 })
          .eq('id', body.twinId);

        // Surface unanswered questions to the creator. Fire-and-forget:
        // the table may not exist yet (migration 004) and this must NEVER
        // affect the chat response. Question stored in plain text (it was
        // captured before encryption).
        if (DEFLECTION_RE.test(fullResponse)) {
          const normalized = body.message.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 200);
          supabase
            .from('unanswered_questions')
            .insert({
              twin_id: body.twinId,
              question: body.message.slice(0, 1000),
              normalized,
            })
            .then(
              () => {},
              () => {}
            );
        }

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

  const profile = await getProfileByClerkId(supabase, userId);

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
