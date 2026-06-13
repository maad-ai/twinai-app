import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, connectSocialSchema } from '@/lib/validators';
import { uploadRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { hasApify, normalizeHandle, startProfileScrape } from '@/lib/apify';

export const dynamic = 'force-dynamic';

/**
 * Connect a social profile (TikTok/Instagram): launch an Apify scrape of the
 * creator's own public posts. Returns immediately with a 'processing' row;
 * the train GET route resolves the run lazily once it finishes.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(uploadRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, connectSocialSchema);
  if (validationError) return validationError;

  if (!hasApify()) {
    return Response.json(
      { error: 'Social import isn\'t enabled yet — paste your captions as text for now.' },
      { status: 503 }
    );
  }

  const handle = normalizeHandle(body.handle);
  if (!handle) {
    return Response.json(
      { error: 'That doesn\'t look like a valid handle — try just your username.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id, 'id');
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  let runId: string;
  let datasetId: string;
  try {
    ({ runId, datasetId } = await startProfileScrape(body.platform, handle));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Could not start the import' },
      { status: 502 }
    );
  }

  const { data: content, error: insertError } = await supabase
    .from('training_content')
    .insert({
      twin_id: twin.id,
      source_type: body.platform,
      source_url: `@${handle}`,
      status: 'processing',
      metadata: { apify_run_id: runId, apify_dataset_id: datasetId, platform: body.platform, handle },
    })
    .select()
    .maybeSingle();

  if (insertError) {
    console.error('connect-social insert error:', insertError);
    return Response.json({ error: 'Failed to start import' }, { status: 500 });
  }

  return Response.json({ content, status: 'processing' });
}
