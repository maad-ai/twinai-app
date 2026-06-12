import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, createTwinSchema, updateTwinPublicProfileSchema } from '@/lib/validators';
import { buildSystemPrompt } from '@/lib/twin-prompt';

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

  // Build system prompt from personality (shared builder — also used by
  // PATCH /api/twin/settings when the creator tunes behavior later).
  const p = personality || {};
  const systemPrompt = buildSystemPrompt({
    name,
    niche,
    tagline,
    personality: p,
    blockedTopics,
  });

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
  if (body.bio !== undefined || body.socials !== undefined || body.theme !== undefined) {
    settings.public_profile = {
      ...(settings.public_profile || {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.socials !== undefined ? { socials: body.socials } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
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
