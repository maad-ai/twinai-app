import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, createTwinSchema, updateTwinPublicProfileSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get profile
  const profile = await getProfileByClerkId(supabase, userId, 'id, role');

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: body, error: validationError } = await parseBody(req, createTwinSchema);
  if (validationError) return validationError;

  const { name, tagline, niche, personality, blockedTopics, monthlyPriceCents, creditsPerMonth } = body;

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
    .maybeSingle();

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
    .maybeSingle();

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

  const profile = await getProfileByClerkId(supabase, userId);

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id, '*');

  return Response.json({ twin: twin || null });
}

/** Update the creator's public page (tagline, bio, socials, welcome message, publish toggle). */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id, 'id, settings, status');
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const { data: body, error: validationError } = await parseBody(req, updateTwinPublicProfileSchema);
  if (validationError) return validationError;

  const settings = { ...(twin.settings || {}) };
  if (body.welcomeMessage !== undefined) settings.welcome_message = body.welcomeMessage;
  if (body.bio !== undefined || body.socials !== undefined) {
    settings.public_profile = {
      ...(settings.public_profile || {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.socials !== undefined ? { socials: body.socials } : {}),
    };
  }

  const update: Record<string, unknown> = {
    settings,
    updated_at: new Date().toISOString(),
  };
  if (body.tagline !== undefined) update.tagline = body.tagline;
  // Publish toggle — never overrides 'training'/'paused' transitions implicitly.
  if (body.status && ['active', 'draft'].includes(body.status)) update.status = body.status;

  const { data: updated, error } = await supabase
    .from('twins')
    .update(update)
    .eq('id', twin.id)
    .select('id, name, slug, tagline, niche, status, settings')
    .maybeSingle();

  if (error || !updated) {
    console.error('Twin update error:', error);
    return Response.json({ error: 'Failed to update twin' }, { status: 500 });
  }

  return Response.json({ twin: updated });
}
