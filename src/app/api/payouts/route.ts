import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

/**
 * GET — payout account status for the current creator.
 * Onboarding + status only: no transfers are ever created here.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id, stripe_account_id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const accountId = (profile as { stripe_account_id?: string | null }).stripe_account_id;
  if (!accountId) {
    return Response.json({ connected: false });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    return Response.json({
      connected: true,
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    });
  } catch (err) {
    console.error('Stripe account retrieve failed:', err);
    return Response.json({ connected: true, payoutsEnabled: false, detailsSubmitted: false });
  }
}

/**
 * POST — create (if needed) the creator's Stripe Express account and
 * return an onboarding link.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id, stripe_account_id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  let accountId = (profile as { stripe_account_id?: string | null }).stripe_account_id ?? null;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'CA',
        metadata: { profile_id: profile.id },
      });
      accountId = account.id;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) {
        // Column likely missing (migration 005 not applied) — don't strand
        // a Stripe account we can't reference later.
        console.error('Failed to persist stripe_account_id:', updateError);
        return Response.json(
          { error: 'Payouts are not provisioned yet — try again later.' },
          { status: 503 }
        );
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/creator/earnings`,
      return_url: `${APP_URL}/creator/earnings?connected=1`,
      type: 'account_onboarding',
    });

    return Response.json({ url: link.url });
  } catch (err) {
    console.error('Stripe Connect onboarding failed:', err);
    const msg = err instanceof Error ? err.message : '';
    // Platform-side issue (Stripe Connect not activated on the dashboard)
    if (/signed up for Connect/i.test(msg)) {
      return Response.json(
        { error: 'Payouts aren\'t open yet — the platform is finishing its Stripe setup. Check back soon!' },
        { status: 503 }
      );
    }
    return Response.json(
      { error: 'Could not start payout setup — try again in a minute.' },
      { status: 502 }
    );
  }
}
