import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, updateTwinIdentitySchema } from '@/lib/validators';
import { buildPromptFromTwin } from '@/lib/twin-prompt';

export const dynamic = 'force-dynamic';

/**
 * Save the twin's identity (the "Make it sound like you" questionnaire) and
 * regenerate the system prompt with all layers (identity + behavior).
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
    'id, name, niche, tagline, personality, settings'
  );
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const { data: body, error: validationError } = await parseBody(req, updateTwinIdentitySchema);
  if (validationError) return validationError;

  const settings = { ...(twin.settings || {}) };
  const identity = { ...(settings.identity || {}) };
  if (body.audienceNickname !== undefined) identity.audience_nickname = body.audienceNickname;
  if (body.greeting !== undefined) identity.greeting = body.greeting;
  if (body.catchphrases !== undefined) identity.catchphrases = body.catchphrases;
  if (body.opinions !== undefined) identity.opinions = body.opinions;
  if (body.neverSay !== undefined) identity.never_say = body.neverSay;
  if (body.backstory !== undefined) identity.backstory = body.backstory;
  if (body.voiceExamples !== undefined) identity.voice_examples = body.voiceExamples;
  settings.identity = identity;

  const systemPrompt = buildPromptFromTwin({
    name: twin.name,
    niche: twin.niche,
    tagline: twin.tagline,
    personality: twin.personality,
    settings,
  });

  const { data: updated, error } = await supabase
    .from('twins')
    .update({
      settings,
      system_prompt: systemPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', twin.id)
    .select('id, settings')
    .maybeSingle();

  if (error || !updated) {
    console.error('Twin identity update error:', error);
    return Response.json({ error: 'Failed to save identity' }, { status: 500 });
  }

  return Response.json({ identity: updated.settings?.identity || {} });
}
