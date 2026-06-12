import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, updateTwinBehaviorSchema } from '@/lib/validators';
import { buildSystemPrompt } from '@/lib/twin-prompt';

export const dynamic = 'force-dynamic';

/**
 * Update the twin's behavior: personality sliders, blocked topics, bot
 * language, and pricing. Regenerates the system prompt so changes take
 * effect on the next fan message.
 */
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

  const twin = await getCreatorTwin(
    supabase,
    profile.id,
    'id, name, niche, tagline, personality, settings, monthly_price_cents'
  );
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const { data: body, error: validationError } = await parseBody(req, updateTwinBehaviorSchema);
  if (validationError) return validationError;

  // Merge new values over current ones
  const personality: Record<string, number> = {
    ...(twin.personality || {}),
    ...(body.personality || {}),
  };
  const settings = { ...(twin.settings || {}) };
  if (body.blockedTopics !== undefined) settings.blocked_topics = body.blockedTopics;
  if (body.language !== undefined) settings.language = body.language;
  if (body.pricingTiers !== undefined) settings.pricing_tiers = body.pricingTiers;

  const systemPrompt = buildSystemPrompt({
    name: twin.name,
    niche: twin.niche,
    tagline: twin.tagline,
    personality,
    blockedTopics: settings.blocked_topics || [],
    language: settings.language,
  });

  const update: Record<string, unknown> = {
    personality,
    settings,
    system_prompt: systemPrompt,
    updated_at: new Date().toISOString(),
  };
  if (body.monthlyPriceCents !== undefined) update.monthly_price_cents = body.monthlyPriceCents;

  const { data: updated, error } = await supabase
    .from('twins')
    .update(update)
    .eq('id', twin.id)
    .select('id, name, slug, niche, personality, settings, monthly_price_cents')
    .maybeSingle();

  if (error || !updated) {
    console.error('Twin behavior update error:', error);
    return Response.json({ error: 'Failed to update twin' }, { status: 500 });
  }

  return Response.json({ twin: updated });
}
