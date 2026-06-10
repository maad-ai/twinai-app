import Anthropic from '@anthropic-ai/sdk';

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('ANTHROPIC_API_KEY is missing! Check .env.local');
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
  // Build the full system prompt with RAG context
  let fullSystem = systemPrompt;

  if (trainingContext.length > 0) {
    fullSystem += `\n\nRELEVANT CONTENT FROM YOUR TRAINING:\n${trainingContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`;
    fullSystem += `\n\nUse the above content to inform your answers. Stay in character.`;
  }

  const stream = getClient().messages.stream({
    model: 'claude-sonnet-4-latest',
    max_tokens: 1024,
    system: fullSystem,
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
