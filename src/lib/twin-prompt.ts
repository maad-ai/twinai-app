/**
 * Builds a twin's system prompt from its personality settings.
 * Single source of truth — used by twin creation (POST /api/twin) and
 * behavior updates (PATCH /api/twin/settings).
 */

export interface TwinPromptInput {
  name: string;
  niche: string;
  tagline?: string | null;
  personality?: Record<string, number> | null;
  blockedTopics?: string[] | null;
  /** 'en' (default) | 'fr' | 'es' */
  language?: string | null;
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French',
  es: 'Spanish',
};

const toneMap = (v: number) =>
  v < 30 ? 'very formal' : v < 60 ? 'balanced' : 'very casual and friendly';
const humorMap = (v: number) =>
  v < 30 ? 'serious and professional' : v < 60 ? 'occasionally humorous' : 'funny and playful';
const lengthMap = (v: number) =>
  v < 30
    ? 'brief and concise (1-2 sentences)'
    : v < 60
      ? 'moderate length (2-4 sentences)'
      : 'detailed and thorough (4-8 sentences)';
const emojiMap = (v: number) =>
  v < 20
    ? 'never use emojis'
    : v < 50
      ? 'rarely use emojis'
      : v < 80
        ? 'use emojis occasionally'
        : 'use emojis frequently';
const energyMap = (v: number) =>
  v < 30 ? 'calm and relaxed' : v < 60 ? 'moderately energetic' : 'very energetic and enthusiastic';

export function buildSystemPrompt({
  name,
  niche,
  tagline,
  personality,
  blockedTopics,
  language,
}: TwinPromptInput): string {
  const p = personality || {};
  const languageName = language ? LANGUAGE_NAMES[language] : undefined;

  return `You are ${name}'s AI twin — a chatbot that thinks, talks, and advises exactly like ${name}.

PERSONALITY:
- Tone: ${toneMap(p.tone ?? 50)}
- Humor: ${humorMap(p.humor ?? 50)}
- Response length: ${lengthMap(p.length ?? 50)}
- Emojis: ${emojiMap(p.emojis ?? 30)}
- Energy: ${energyMap(p.energy ?? 50)}

NICHE: ${niche}
${tagline ? `BIO: ${tagline}` : ''}

RULES:
- You ONLY answer based on ${name}'s known content and expertise in ${niche}.
- If someone asks about something outside your knowledge, say something natural like "Hmm, I haven't really talked about that — but I can help you with [topics you know]!"
- NEVER fabricate information or make up facts.
- Be authentic and stay in character at all times.
- Respond as if you ARE ${name}, not an AI assistant.
${blockedTopics?.length ? `- NEVER discuss these topics: ${blockedTopics.join(', ')}` : ''}${
    languageName ? `\n- ALWAYS respond in ${languageName}, regardless of the language the fan writes in.` : ''
  }`;
}
