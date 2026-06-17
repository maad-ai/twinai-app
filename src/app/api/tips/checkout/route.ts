import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { stripe } from '@/lib/stripe/client';
import { parseBody, tipCheckoutSchema } from '@/lib/validators';
import { APP_URL } from '@/lib/constants';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Start a one-time tip checkout (platform-collect; earning recorded by webhook). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Sign in to tip', code: 'NOT_AUTHED' }, { status: 401 });
  }

  const blocked = await checkRateLimit(apiRateLimit, userId);
  if (blocked) return blocked;

  const { data: body, error: validationError } = await parseBody(req, tipCheckoutSchema);
  if (validationError) return validationError;

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id, email, stripe_customer_id');
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('id, name, slug, creator_id')
    .eq('id', body.twinId)
    .maybeSingle();
  if (!twin) {
    return Response.json({ error: 'Twin not found' }, { status: 404 });
  }
  if (twin.creator_id === profile.id) {
    return Response.json({ error: "You can't tip your own twin" }, { status: 400 });
  }

  try {
    // Pending tip row (best-effort — works even before migration 010).
    const { data: tip } = await supabase
      .from('tips')
      .insert({
        twin_id: twin.id,
        fan_id: profile.id,
        amount_cents: body.amountCents,
        message: body.message ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

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

    const metadata = {
      type: 'tip',
      tip_id: tip?.id ?? '',
      twin_id: twin.id,
      fan_id: profile.id,
      amount_cents: String(body.amountCents),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: body.amountCents,
            product_data: { name: `Tip for ${twin.name}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/c/${twin.slug}?tipped=1`,
      cancel_url: `${APP_URL}/c/${twin.slug}`,
      metadata,
      payment_intent_data: { metadata },
    });

    if (!session.url) {
      return Response.json({ error: 'Failed to start checkout' }, { status: 500 });
    }
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('Tip checkout error:', err);
    return Response.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 });
  }
}
