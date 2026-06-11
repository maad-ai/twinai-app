import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
import { parseBody, cancelSubscriptionSchema } from '@/lib/validators';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST: cancel a subscription at period end.
 * The fan keeps chat access until the end of the paid period, and keeps
 * their conversation history forever (messages are never deleted —
 * /api/chat/history only checks ownership, not subscription status).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, cancelSubscriptionSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();

  const profile = await getProfileByClerkId(supabase, userId);
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Ownership check: the subscription must belong to this fan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status, stripe_subscription_id, current_period_end, cancel_at_period_end')
    .eq('id', body.subscriptionId)
    .eq('fan_id', profile.id)
    .maybeSingle();

  if (!subscription) {
    return Response.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (subscription.status !== 'active') {
    return Response.json({ error: 'Subscription is not active' }, { status: 400 });
  }

  if (subscription.cancel_at_period_end) {
    return Response.json({
      success: true,
      already_canceled: true,
      access_until: subscription.current_period_end,
    });
  }

  // Cancel in Stripe at period end (fan keeps what they paid for).
  // Subscriptions created manually (tests) have no stripe id — cancel locally only.
  if (subscription.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error('Stripe cancel failed:', err);
      return Response.json({ error: 'Payment provider error. Try again.' }, { status: 502 });
    }
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', subscription.id);

  if (updateError) {
    console.error('Cancel flag update failed:', updateError);
    return Response.json({ error: 'Failed to update subscription' }, { status: 500 });
  }

  return Response.json({
    success: true,
    access_until: subscription.current_period_end,
  });
}
