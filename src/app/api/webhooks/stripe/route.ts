import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';

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

  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = obj.subscription as string;
      let fanId = obj.metadata?.fan_id;
      let twinId = obj.metadata?.twin_id;

      if (!fanId || !twinId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        fanId = sub.metadata?.fan_id;
        twinId = sub.metadata?.twin_id;
      }

      if (fanId && twinId) {
        await createSubscription(supabase, fanId, twinId, subscriptionId);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const subscriptionId = obj.subscription as string;

      if (obj.billing_reason === 'subscription_cycle') {
        await supabase
          .from('subscriptions')
          .update({
            credits_remaining: 300,
            status: 'active',
            current_period_start: new Date((obj.period_start ?? 0) * 1000).toISOString(),
            current_period_end: new Date((obj.period_end ?? 0) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscriptionId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', obj.id);
      break;
    }

    case 'customer.subscription.updated': {
      const status = obj.status === 'active' ? 'active' :
                     obj.status === 'past_due' ? 'past_due' :
                     obj.status === 'canceled' ? 'canceled' : 'active';

      await supabase
        .from('subscriptions')
        .update({
          status,
          current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', obj.id);
      break;
    }
  }

  return new Response('OK', { status: 200 });
}

async function createSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  fanId: string,
  twinId: string,
  stripeSubscriptionId: string
) {
  // Create subscription record
  await supabase.from('subscriptions').upsert(
    {
      fan_id: fanId,
      twin_id: twinId,
      stripe_subscription_id: stripeSubscriptionId,
      status: 'active',
      credits_remaining: 300,
      credits_total: 300,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'fan_id,twin_id' }
  );

  // Increment subscriber count
  const { data: twin } = await supabase
    .from('twins')
    .select('total_subscribers')
    .eq('id', twinId)
    .single();

  if (twin) {
    await supabase
      .from('twins')
      .update({ total_subscribers: (twin.total_subscribers || 0) + 1 })
      .eq('id', twinId);
  }
}
