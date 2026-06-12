import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ twinSlug: string }> }
) {
  const { twinSlug } = await params;
  const supabase = createAdminClient();

  const TWIN_COLUMNS =
    'id, name, slug, tagline, niche, monthly_price_cents, total_subscribers, total_messages, settings, status, photo_url';

  // Prefer `certified`, but the column may not exist yet (migration 003) —
  // fall back to the base column list so this route never 500s.
  let { data: twin, error } = await supabase
    .from('twins')
    .select(`${TWIN_COLUMNS}, certified`)
    .eq('slug', twinSlug)
    .maybeSingle();
  if (error) {
    ({ data: twin } = await supabase
      .from('twins')
      .select(TWIN_COLUMNS)
      .eq('slug', twinSlug)
      .maybeSingle());
  }

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  return Response.json({ twin });
}
