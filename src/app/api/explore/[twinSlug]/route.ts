import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ twinSlug: string }> }
) {
  const { twinSlug } = await params;
  const supabase = createAdminClient();

  const { data: twin } = await supabase
    .from('twins')
    .select('id, name, slug, tagline, niche, monthly_price_cents, total_subscribers, total_messages, settings, status')
    .eq('slug', twinSlug)
    .single();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  return Response.json({ twin });
}
