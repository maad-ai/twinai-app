import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { canAccessPost } from '@/lib/public-twin';
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

  // The post must exist and be visible to this viewer (no liking content you can't see).
  const access = await canAccessPost(id, profile.id);
  if (!access.exists) return Response.json({ error: 'Post not found' }, { status: 404 });
  if (!access.ok) return Response.json({ error: 'Members only' }, { status: 403 });

  const { data: existing, error: selError } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', id)
    .eq('profile_id', profile.id)
    .maybeSingle();
  // post_likes table absent (migration 008 not applied) → feature off, don't 500.
  if (selError) return Response.json({ liked: false, count: 0 });

  let liked: boolean;
  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: id, profile_id: profile.id });
    // duplicate (raced double-tap) = already liked; FK violation (post deleted) = gone.
    if (error && /foreign key|23503/i.test(error.message)) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (error && !/duplicate key|23505/i.test(error.message)) {
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
