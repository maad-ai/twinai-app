import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, createPostSchema } from '@/lib/validators';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const POST_COLUMNS = 'id, body, media_url, media_type, visibility, created_at';

/** Create a post on the creator's own twin. */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, createPostSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }
  const twin = await getCreatorTwin(supabase, profile.id, 'id');
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  const { data: post, error: insertError } = await supabase
    .from('posts')
    .insert({
      twin_id: twin.id,
      body: body.body,
      media_url: body.mediaUrl ?? null,
      media_type: body.mediaType,
      visibility: body.visibility,
    })
    .select(POST_COLUMNS)
    .single();

  if (insertError) {
    console.error('Post insert failed:', insertError);
    return Response.json({ error: 'Could not publish post' }, { status: 500 });
  }

  return Response.json({ post });
}

/** List the creator's own posts (for the composer). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }
  const twin = await getCreatorTwin(supabase, profile.id, 'id');
  if (!twin) {
    return Response.json({ posts: [] });
  }

  const { data: posts } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('twin_id', twin.id)
    .order('created_at', { ascending: false });

  return Response.json({ posts: posts || [] });
}
