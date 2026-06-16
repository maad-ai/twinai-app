import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Toggle the current fan's like on a post. Returns the new state + count. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Sign in to like', code: 'NOT_AUTHED' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: id, profile_id: profile.id });
    if (error && !/duplicate key/i.test(error.message)) {
      console.error('Like failed:', error);
      return Response.json({ error: 'Could not like — try again.' }, { status: 500 });
    }
    liked = true;
  }

  const { count } = await supabase
    .from('post_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', id);

  return Response.json({ liked, count: count ?? 0 });
}
