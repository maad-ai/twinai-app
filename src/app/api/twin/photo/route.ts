import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKET = 'twin-photos';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Upload the twin's profile photo (multipart form, field "photo"). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const twin = await getCreatorTwin(supabase, profile.id, 'id, slug');
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get('photo');
    if (entry instanceof File) file = entry;
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'No photo provided' }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return Response.json({ error: 'Use a JPEG, PNG or WebP image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'Image must be under 2MB' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const path = `${twin.id}.${ext}`;

  // Upload — create the (public) bucket on first use so there's no manual
  // storage setup step.
  let uploadError = (
    await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    })
  ).error;

  if (uploadError && /bucket.*not.*found/i.test(uploadError.message)) {
    await supabase.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
      .catch(() => {});
    uploadError = (
      await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      })
    ).error;
  }

  if (uploadError) {
    console.error('Twin photo upload failed:', uploadError);
    return Response.json({ error: 'Upload failed — try again.' }, { status: 502 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Version query busts CDN/browser caches on re-upload.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('twins')
    .update({ photo_url: url, updated_at: new Date().toISOString() })
    .eq('id', twin.id);

  if (updateError) {
    console.error('Twin photo_url update failed:', updateError);
    return Response.json({ error: 'Could not save the photo' }, { status: 500 });
  }

  return Response.json({ url });
}

/** Remove the twin's photo (falls back to initials avatar). */
export async function DELETE() {
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

  await supabase
    .from('twins')
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', twin.id);

  return Response.json({ success: true });
}
