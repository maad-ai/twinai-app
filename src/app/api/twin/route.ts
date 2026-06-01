import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await req.json();
  const { name, tagline, niche, personality, blockedTopics, monthlyPriceCents, creditsPerMonth } = body;

  if (!name || !niche) {
    return Response.json({ error: 'Name and niche are required' }, { status: 400 });
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('twins')
    .select('id')
    .eq('slug', slug)
    .single();

  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  // Build system prompt from personality
  const toneMap = (v: number) => v < 30 ? 'very formal' : v < 60 ? 'balanced' : 'very casual and friendly';
  const humorMap = (v: number) => v < 30 ? 'serious and professional' : v < 60 ? 'occasionally humorous' : 'funny and playful';
  const lengthMap = (v: number) => v < 30 ? 'brief and concise (1-2 sentences)' : v < 60 ? 'moderate length (2-4 sentences)' : 'detailed and thorough (4-8 sentences)';
  const emojiMap = (v: number) => v < 20 ? 'never use emojis' : v < 50 ? 'rarely use emojis' : v < 80 ? 'use emojis occasionally' : 'use emojis frequently';
  const energyMap = (v: number) => v < 30 ? 'calm and relaxed' : v < 60 ? 'moderately energetic' : 'very energetic and enthusiastic';

  const p = personality || {};
  const systemPrompt = `You are ${name}'s AI twin — a chatbot that thinks, talks, and advises exactly like ${name}.

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
${blockedTopics?.length ? `- NEVER discuss these topics: ${blockedTopics.join(', ')}` : ''}`;

  // Create twin
  const { data: twin, error } = await supabase
    .from('twins')
    .insert({
      creator_id: profile.id,
      slug: finalSlug,
      name,
      tagline: tagline || null,
      niche,
      system_prompt: systemPrompt,
      personality: personality || {},
      settings: {
        auto_moderation: false,
        blocked_topics: blockedTopics || [],
        welcome_message: `Hey! I'm ${name}'s AI twin. Ask me anything about ${niche.toLowerCase()}!`,
        response_style: (p.tone ?? 50) > 60 ? 'casual' : 'professional',
      },
      monthly_price_cents: monthlyPriceCents || 1999,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Twin creation error:', error);
    return Response.json({ error: 'Failed to create twin' }, { status: 500 });
  }

  // Mark onboarding as completed
  await supabase
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  return Response.json({ twin });
}

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
    .select('*')
    .eq('creator_id', profile.id)
    .single();

  return Response.json({ twin: twin || null });
}
