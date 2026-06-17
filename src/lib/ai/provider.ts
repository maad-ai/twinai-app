import Anthropic from '@anthropic-ai/sdk';
import { CHAT_MODEL, MAX_RESPONSE_TOKENS } from '@/lib/constants';
import { TWIN_SAFETY_PROMPT } from '@/lib/twin-prompt';

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('ANTHROPIC_API_KEY is missing! Check env vars');
    throw new Error('Missing ANTHROPIC_API_KEY');
  }
  return new Anthropic({ apiKey: key });
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  trainingContext: string[]
): AsyncGenerator<string> {
  // Build the full system prompt: a non-negotiable safety/honesty preamble
  // (AI disclosure + crisis handling — SB 243/FTC) prepended to EVERY twin,
  // then the twin's own prompt, then RAG context.
  let fullSystem = `${TWIN_SAFETY_PROMPT}\n\n${systemPrompt}`;

  if (trainingContext.length > 0) {
    fullSystem += `\n\nRELEVANT CONTENT FROM YOUR TRAINING:\n${trainingContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`;
    fullSystem += `\n\nUse the above content to inform your answers. Stay in character.`;
  }

  const stream = getClient().messages.stream({
    model: CHAT_MODEL,
    max_tokens: MAX_RESPONSE_TOKENS,
    // Prompt caching: the system prompt is identical across messages for a twin,
    // so cache it to cut input costs (~90% on cached reads)
    system: [
      {
        type: 'text',
        text: fullSystem,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

/**
 * Maintain a short running memory of durable facts about a fan, so the twin
 * remembers them across sessions. Cheap (Haiku), best-effort — returns null on
 * any error so the caller can no-op. Capped to keep the prompt small.
 */
export async function summarizeFanMemory(
  existingMemory: string | null,
  fanMessage: string,
  twinReply: string,
  fanName?: string | null
): Promise<string | null> {
  try {
    const res = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system:
        'You maintain a concise running memory of a fan for a creator\'s AI twin, so it can remember them across chats. Output ONLY the updated memory as terse bullet-style notes (max ~80 words): durable facts the fan shared (name, goals, preferences, situation, what they care about). Merge new facts into the existing memory, drop nothing important, keep no chit-chat or one-off pleasantries. If there is nothing durable to add, return the existing memory unchanged. No preamble, no explanation — just the notes.',
      messages: [
        {
          role: 'user',
          content: `EXISTING MEMORY:\n${existingMemory || '(none yet)'}\n\nLATEST EXCHANGE:\nFan${fanName ? ` (${fanName})` : ''}: ${fanMessage}\nTwin: ${twinReply}\n\nUpdated memory:`,
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) return null;
    return text.slice(0, 1500);
  } catch (err) {
    console.error('Fan memory update failed (non-fatal):', err);
    return null;
  }
}
