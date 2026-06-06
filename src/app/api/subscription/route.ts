import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

// POST: create Stripe Checkout for subscribing to a twin
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await req.json();
  const { twinId } = body;

  if (!twinId) {
    return Response.json({ error: 'Twin ID required' }, { status: 400 });
  }

  // Get twin
  const { data: twin } = await supabase
    .from('twins')
    .select('id, name, monthly_price_cents, stripe_price_id, stripe_product_id, creator_id')
    .eq('id', twinId)
    .single();

  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }

  // Check if already subscribed
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('fan_id', profile.id)
    .eq('twin_id', twinId)
    .eq('status', 'active')
    .single();

  if (existingSub) {
    return Response.json({ error: 'Already subscribed' }, { status: 400 });
  }

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

  // Get or create Stripe product + price for this twin
  let priceId = twin.stripe_price_id;

  if (!priceId) {
    // Create product
    const product = await stripe.products.create({
      name: `Chat with ${twin.name}`,
      metadata: { twin_id: twin.id },
    });

    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: twin.monthly_price_cents,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    priceId = price.id;

    // Save to twin
    await supabase
      .from('twins')
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      })
      .eq('id', twin.id);
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai'}/chat?subscribed=${twinId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai'}/explore/${twin.name.toLowerCase().replace(/\s+/g, '-')}`,
    subscription_data: {
      metadata: {
        fan_id: profile.id,
        twin_id: twin.id,
      },
      application_fee_percent: 15, // Marc takes 15%
    },
  });

  return Response.json({ url: session.url });
}

// GET: list fan's active subscriptions
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

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
