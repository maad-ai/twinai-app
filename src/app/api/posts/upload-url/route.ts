import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';
import { parseBody, postUploadUrlSchema } from '@/lib/validators';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BUCKET = 'twin-posts';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB — well past Vercel's ~4.5MB route limit

// Whitelisted content types → file extension.
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * Issue a Supabase signed upload URL so the client uploads media DIRECTLY to
 * storage (bypassing the ~4.5MB serverless body limit — required for video).
 * Returns the path + token (use `uploadToSignedUrl`) and the final public URL.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, postUploadUrlSchema);
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

  const extMap = body.mediaType === 'image' ? IMAGE_EXT : VIDEO_EXT;
  const ext = extMap[body.contentType];
  if (!ext) {
    return Response.json(
      { error: `Unsupported ${body.mediaType} format` },
      { status: 400 }
    );
  }

  const path = `${twin.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const sign = () => supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  let { data, error: signErr } = await sign();
  // Create the (public) bucket on first use so there's no manual setup step.
  if (signErr && /bucket.*not.*found/i.test(signErr.message)) {
    await supabase.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_VIDEO_BYTES })
      .catch(() => {});
    ({ data, error: signErr } = await sign());
  }

  if (signErr || !data) {
    console.error('createSignedUploadUrl failed:', signErr);
    return Response.json({ error: 'Could not start upload — try again.' }, { status: 502 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return Response.json({
    bucket: BUCKET,
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
  });
}
