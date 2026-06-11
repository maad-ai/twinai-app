import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Look up the app profile for a Clerk user id. Returns null if not found. */
export async function getProfileByClerkId(
  supabase: AdminClient,
  clerkId: string,
  columns = 'id'
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('profiles')
    .select(columns)
    .eq('clerk_id', clerkId)
    .maybeSingle();
  return data as Record<string, any> | null;
}

/** Look up the twin owned by a creator profile. Returns null if none. */
export async function getCreatorTwin(
  supabase: AdminClient,
  profileId: string,
  columns = 'id'
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('twins')
    .select(columns)
    .eq('creator_id', profileId)
    .maybeSingle();
  return data as Record<string, any> | null;
}
