import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { canAccessPost, getViewerProfileId } from '@/lib/public-twin';
import { parseBody, addCommentSchema } from '@/lib/validators';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SELECT = 'id, body, created_at, profile_id, profiles ( display_name, avatar_url )';

/** List a post's comments — public posts to anyone, members-only to members. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Don't leak the thread (or commenters' names) of a members-only post.
  const viewerProfileId = await getViewerProfileId();
  const access = await canAccessPost(id, viewerProfileId);
  if (!access.ok) return Response.json({ comments: [] });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('post_comments')
    .select(SELECT)
    .eq('post_id', id)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return Response.json({ comments: [] }); // table may not exist yet (migration 008)
  return Response.json({ comments: data || [] });
}

/** Add a comment (login required). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Sign in to comment', code: 'NOT_AUTHED' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, addCommentSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id, display_name, avatar_url');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Can't comment on a post you can't see (or one that doesn't exist).
  const access = await canAccessPost(id, profile.id);
  if (!access.exists) return Response.json({ error: 'Post not found' }, { status: 404 });
  if (!access.ok) return Response.json({ error: 'Members only' }, { status: 403 });

  const { data: comment, error: insertError } = await supabase
    .from('post_comments')
    .insert({ post_id: id, profile_id: profile.id, body: body.body })
    .select('id, body, created_at, profile_id')
    .single();

  if (insertError) {
    console.error('Comment failed:', insertError);
    return Response.json({ error: 'Could not post comment' }, { status: 500 });
  }

  return Response.json({
    comment: {
      ...comment,
      profiles: { display_name: profile.display_name, avatar_url: profile.avatar_url },
    },
  });
}
