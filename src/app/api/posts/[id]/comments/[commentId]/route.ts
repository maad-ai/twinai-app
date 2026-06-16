import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Delete a comment — allowed for the comment's author or the post's creator. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: comment } = await supabase
    .from('post_comments')
    .select('id, profile_id, post_id')
    .eq('id', commentId)
    .maybeSingle();

  if (!comment || comment.post_id !== id) {
    return Response.json({ error: 'Comment not found' }, { status: 404 });
  }

  let allowed = comment.profile_id === profile.id; // author
  if (!allowed) {
    // The twin's creator can moderate comments on their posts.
    const { data: post } = await supabase
      .from('posts')
      .select('twin_id')
      .eq('id', comment.post_id)
      .maybeSingle();
    if (post) {
      const { data: twin } = await supabase
        .from('twins')
        .select('creator_id')
        .eq('id', post.twin_id)
        .maybeSingle();
      allowed = twin?.creator_id === profile.id;
    }
  }

  if (!allowed) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('post_comments').delete().eq('id', commentId);
  return Response.json({ success: true });
}
