/**
 * Builds a twin's system prompt — the single source of truth for how a twin
 * "is" its creator. Used by twin creation and every settings/identity update.
 *
 * Three layers make a twin feel like the real person:
 *  1. IDENTITY  — who they are (questionnaire: nickname, catchphrases,
 *                 opinions, never-say, backstory)   → prompt sections below
 *  2. VOICE     — how they talk (real Q→A examples) → few-shot pairs below
 *  3. KNOWLEDGE — what they know (training_content) → RAG context appended
 *                 at chat time by lib/ai/provider.ts
 */

export interface VoiceExample {
  q: string;
  a: string;
}

export interface TwinIdentity {
  audience_nickname?: string | null;
  greeting?: string | null;
  catchphrases?: string[];
  opinions?: string[];
  never_say?: string[];
  backstory?: string | null;
  voice_examples?: VoiceExample[];
}

export interface TwinPromptInput {
  name: string;
  niche: string;
  tagline?: string | null;
  personality?: Record<string, number> | null;
  blockedTopics?: string[] | null;
  /** Languages the twin can speak: ['en'] | ['fr','en'] … (legacy: single string) */
  languages?: string[] | null;
  identity?: TwinIdentity | null;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
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

function languageRule(languages?: string[] | null): string {
  const langs = (languages || []).filter((l) => LANGUAGE_NAMES[l]);
  if (langs.length === 0) return '';
  if (langs.length === 1) {
    return `\n- ALWAYS respond in ${LANGUAGE_NAMES[langs[0]]}, regardless of the language the fan writes in.`;
  }
  const names = langs.map((l) => LANGUAGE_NAMES[l]);
  return `\n- You speak ${names.join(', ')}. Reply in the language the fan writes in when it's one of these; otherwise default to ${names[0]}.`;
}

function identitySections(identity?: TwinIdentity | null): string {
  if (!identity) return '';
  const parts: string[] = [];

  const traits: string[] = [];
  if (identity.audience_nickname) {
    traits.push(`- You call your fans "${identity.audience_nickname}".`);
  }
  if (identity.greeting) {
    traits.push(`- A typical way you open a conversation: "${identity.greeting}"`);
  }
  if (identity.catchphrases?.length) {
    traits.push(
      `- Signature phrases you naturally use (sprinkle them in, don't force them): ${identity.catchphrases.map((c) => `"${c}"`).join(', ')}`
    );
  }
  if (identity.opinions?.length) {
    traits.push(`- Strong opinions you're known for:\n${identity.opinions.map((o) => `  • ${o}`).join('\n')}`);
  }
  if (identity.never_say?.length) {
    traits.push(`- You would NEVER say or do: ${identity.never_say.join('; ')}`);
  }
  if (identity.backstory) {
    traits.push(`- Your story, in your own words: ${identity.backstory}`);
  }
  if (traits.length) {
    parts.push(`\nIDENTITY:\n${traits.join('\n')}`);
  }

  if (identity.voice_examples?.length) {
    const examples = identity.voice_examples
      .map((ex) => `Fan: ${ex.q}\nYou: ${ex.a}`)
      .join('\n\n');
    parts.push(
      `\nVOICE — these are REAL answers written by the creator. Match this exact style, rhythm and vocabulary:\n${examples}`
    );
  }

  return parts.join('\n');
}

export function buildSystemPrompt({
  name,
  niche,
  tagline,
  personality,
  blockedTopics,
  languages,
  identity,
}: TwinPromptInput): string {
  const p = personality || {};

  return `You are ${name}'s AI twin — a chatbot that thinks, talks, and advises exactly like ${name}.

PERSONALITY:
- Tone: ${toneMap(p.tone ?? 50)}
- Humor: ${humorMap(p.humor ?? 50)}
- Response length: ${lengthMap(p.length ?? 50)}
- Emojis: ${emojiMap(p.emojis ?? 30)}
- Energy: ${energyMap(p.energy ?? 50)}

NICHE: ${niche}
${tagline ? `BIO: ${tagline}` : ''}${identitySections(identity)}

RULES:
- You ONLY answer based on ${name}'s known content and expertise in ${niche}.
- If someone asks about something outside your knowledge, say something natural like "Hmm, I haven't really talked about that — but I can help you with [topics you know]!"
- NEVER fabricate information or make up facts.
- Be authentic and stay in character at all times.
- Respond as if you ARE ${name}, not an AI assistant.
${blockedTopics?.length ? `- NEVER discuss these topics: ${blockedTopics.join(', ')}` : ''}${languageRule(languages)}`;
}

/**
 * Rebuild a twin's prompt from its current DB row (+ optional overrides).
 * Reads settings.languages (or legacy settings.language), blocked_topics and
 * identity so every update endpoint regenerates with ALL layers intact.
 */
export function buildPromptFromTwin(twin: {
  name: string;
  niche: string;
  tagline?: string | null;
  personality?: Record<string, number> | null;
  settings?: {
    blocked_topics?: string[];
    languages?: string[];
    language?: string;
    identity?: TwinIdentity;
  } | null;
}): string {
  const s = twin.settings || {};
  const languages = s.languages?.length ? s.languages : s.language ? [s.language] : undefined;
  return buildSystemPrompt({
    name: twin.name,
    niche: twin.niche,
    tagline: twin.tagline,
    personality: twin.personality,
    blockedTopics: s.blocked_topics || [],
    languages,
    identity: s.identity || null,
  });
}
