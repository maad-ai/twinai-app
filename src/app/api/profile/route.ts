import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { role } = body;

  if (!role || !['fan', 'creator'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('clerk_id', userId);

  if (error) {
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  return Response.json({ success: true, role });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const data = await getProfileByClerkId(supabase, userId, '*');

  if (!data) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  return Response.json(data);
}
