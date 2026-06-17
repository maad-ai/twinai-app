import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORM_FEE_PERCENT } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature', { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const subscriptionId = obj.subscription as string;
        let fanId = obj.metadata?.fan_id;
        let twinId = obj.metadata?.twin_id;
        let credits = parseInt(obj.metadata?.credits ?? '0', 10);

        if (!fanId || !twinId || !credits) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          fanId = fanId || sub.metadata?.fan_id;
          twinId = twinId || sub.metadata?.twin_id;
          credits = credits || parseInt(sub.metadata?.credits ?? '300', 10);
        }

        if (fanId && twinId) {
          await createSubscription(supabase, fanId, twinId, subscriptionId, credits || 300);
          // Record the creator's earning for the first payment (renewals are
          // handled in invoice.payment_succeeded to avoid double-counting).
          if (obj.amount_total) await recordEarning(supabase, twinId, obj.amount_total);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const subscriptionId = obj.subscription as string;
        if (obj.billing_reason === 'subscription_cycle') {
          // Reset credits to the subscription's tier total (not hardcoded)
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('credits_total, twin_id')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();

          const resetTo = sub?.credits_total ?? 300;

          // Record the creator's earning for this renewal payment.
          if (sub?.twin_id && obj.amount_paid) {
            await recordEarning(supabase, sub.twin_id, obj.amount_paid);
          }

          const { error } = await supabase
            .from('subscriptions')
            .update({
              credits_remaining: resetTo,
              status: 'active',
              current_period_start: new Date((obj.period_start ?? 0) * 1000).toISOString(),
              current_period_end: new Date((obj.period_end ?? 0) * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);

          if (error) {
            console.error('Credit reset failed:', error);
            return new Response('DB error', { status: 500 });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', obj.id);
        if (error) {
          console.error('Sub cancel failed:', error);
          return new Response('DB error', { status: 500 });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const status =
          obj.status === 'past_due' ? 'past_due' :
          obj.status === 'canceled' ? 'canceled' : 'active';

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status,
            cancel_at_period_end: obj.cancel_at_period_end ?? false,
            current_period_end: new Date((obj.current_period_end ?? 0) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', obj.id);
        if (error) {
          console.error('Sub update failed:', error);
          return new Response('DB error', { status: 500 });
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error (${event.type}):`, err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

/**
 * Record a creator earning (net = 80%) for a payment we already collected.
 * Feeds the earnings ledger that the dashboard + earnings page read.
 * Best-effort: logs and continues on error.
 */
async function recordEarning(
  supabase: ReturnType<typeof createAdminClient>,
  twinId: string,
  grossCents: number
) {
  if (!grossCents || grossCents <= 0) return;
  const { data: twin } = await supabase
    .from('twins')
    .select('creator_id')
    .eq('id', twinId)
    .maybeSingle();
  if (!twin?.creator_id) return;

  const fee = Math.round(grossCents * (PLATFORM_FEE_PERCENT / 100));
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from('earnings').insert({
    creator_id: twin.creator_id,
    twin_id: twinId,
    period_start: today,
    period_end: today,
    gross_amount_cents: grossCents,
    platform_fee_cents: fee,
    net_amount_cents: grossCents - fee,
    status: 'pending',
  });
  if (error) console.error('Earning record failed (non-fatal):', error);
}

async function createSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  fanId: string,
  twinId: string,
  stripeSubscriptionId: string,
  credits: number
) {
  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      fan_id: fanId,
      twin_id: twinId,
      stripe_subscription_id: stripeSubscriptionId,
      status: 'active',
      credits_remaining: credits,
      credits_total: credits,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'fan_id,twin_id' }
  );

  if (subError) {
    console.error('Subscription upsert failed:', subError);
    throw subError;
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('total_subscribers')
    .eq('id', twinId)
    .maybeSingle();

  if (twin) {
    await supabase
      .from('twins')
      .update({ total_subscribers: (twin.total_subscribers || 0) + 1 })
      .eq('id', twinId);
  }
}
