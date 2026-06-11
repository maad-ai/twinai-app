import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
import { parseBody, subscribeSchema } from '@/lib/validators';
import { validateTier, APP_URL } from '@/lib/constants';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// POST: create Stripe Checkout for subscribing to a twin
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, subscribeSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();

  const profile = await getProfileByClerkId(supabase, userId, 'id, email, stripe_customer_id');

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Get twin
  const { data: twin } = await supabase
    .from('twins')
    .select('id, name, slug, monthly_price_cents, stripe_product_id, creator_id, settings')
    .eq('id', body.twinId)
    .maybeSingle();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  // SECURITY: validate the requested price against real tiers (prevents price manipulation)
  const tier = validateTier(body.priceCents, twin.settings, twin.monthly_price_cents);
  if (!tier) {
    return Response.json(
      { error: 'Invalid pricing tier', code: 'INVALID_TIER' },
      { status: 400 }
    );
  }

  // Check if already subscribed
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('fan_id', profile.id)
    .eq('twin_id', body.twinId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingSub) {
    return Response.json({ error: 'Already subscribed', code: 'ALREADY_SUBSCRIBED' }, { status: 400 });
  }

  try {
    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { clerk_id: userId, profile_id: profile.id },
      });
      customerId = customer.id;
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
    }

    // Create product + price for the validated tier
    const product = await stripe.products.create({
      name: `Chat with ${twin.name} — ${tier.name}`,
      metadata: { twin_id: twin.id, tier: tier.name },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.cents,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    await supabase
      .from('twins')
      .update({ stripe_product_id: product.id })
      .eq('id', twin.id);

    // Create Checkout Session — credits stored in metadata for webhook
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${APP_URL}/chat?subscribed=${twin.id}`,
      cancel_url: `${APP_URL}/explore/${twin.slug}`,
      metadata: {
        fan_id: profile.id,
        twin_id: twin.id,
        credits: String(tier.credits),
      },
      subscription_data: {
        metadata: {
          fan_id: profile.id,
          twin_id: twin.id,
          credits: String(tier.credits),
        },
      },
    });

    if (!session.url) {
      return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return Response.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 });
  }
}

// GET: list fan's active subscriptions
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const profile = await getProfileByClerkId(supabase, userId);

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      credits_remaining,
      credits_total,
      current_period_end,
      twins (
        id,
        name,
        slug,
        niche,
        monthly_price_cents
      )
    `)
    .eq('fan_id', profile.id)
    .order('created_at', { ascending: false });

  return Response.json({ subscriptions: subscriptions || [] });
}
