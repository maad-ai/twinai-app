import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId, getCreatorTwin } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKET = 'twin-photos';
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — stays under Vercel's ~4.5MB body limit
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Merge a cover URL into twins.settings.public_profile.cover. */
async function setCover(twinId: string, settings: Record<string, any> | null, cover: string | null) {
  const supabase = createAdminClient();
  const next = {
    ...(settings || {}),
    public_profile: { ...((settings || {}).public_profile || {}), cover },
  };
  await supabase
    .from('twins')
    .update({ settings: next, updated_at: new Date().toISOString() })
    .eq('id', twinId);
}

/** Upload the creator's cover banner (multipart form, field "cover"). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

  const twin = await getCreatorTwin(supabase, profile.id, 'id, settings');
  if (!twin) return Response.json({ error: 'Twin not found' }, { status: 404 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get('cover');
    if (entry instanceof File) file = entry;
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  if (!file) return Response.json({ error: 'No cover provided' }, { status: 400 });

  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: 'Use a JPEG, PNG or WebP image' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'Cover must be under 4MB' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const path = `${twin.id}-cover.${ext}`;

  let uploadError = (
    await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true })
  ).error;
  if (uploadError && /bucket.*not.*found/i.test(uploadError.message)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES }).catch(() => {});
    uploadError = (
      await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true })
    ).error;
  }
  if (uploadError) {
    console.error('Cover upload failed:', uploadError);
    return Response.json({ error: 'Upload failed — try again.' }, { status: 502 });
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await setCover(twin.id, twin.settings as Record<string, any> | null, url);

  return Response.json({ url });
}

/** Remove the cover banner. */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

  const twin = await getCreatorTwin(supabase, profile.id, 'id, settings');
  if (!twin) return Response.json({ error: 'Twin not found' }, { status: 404 });

  await setCover(twin.id, twin.settings as Record<string, any> | null, null);
  return Response.json({ success: true });
}
