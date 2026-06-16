import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKET = 'twin-posts';

/** Delete one of the creator's own posts (and its media). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  // Ownership check: the post must belong to this creator's twin.
  const { data: post } = await supabase
    .from('posts')
    .select('id, media_url')
    .eq('id', id)
    .eq('twin_id', twin.id)
    .maybeSingle();

  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  // Best-effort media cleanup (path is everything after `/twin-posts/`).
  if (post.media_url) {
    const marker = `/${BUCKET}/`;
    const idx = post.media_url.indexOf(marker);
    if (idx !== -1) {
      const path = post.media_url.slice(idx + marker.length).split('?')[0];
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    }
  }

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('twin_id', twin.id);

  if (deleteError) {
    console.error('Post delete failed:', deleteError);
    return Response.json({ error: 'Could not delete post' }, { status: 500 });
  }

  return Response.json({ success: true });
}
