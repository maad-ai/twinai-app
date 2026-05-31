import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return new Response('Missing webhook secret', { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: { type: string; data: Record<string, unknown> };

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createAdminClient();

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data as {
      id: string;
      email_addresses: { email_address: string }[];
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
    };

    const email = email_addresses?.[0]?.email_address ?? '';
    const displayName = [first_name, last_name].filter(Boolean).join(' ') || email.split('@')[0];

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          clerk_id: id,
          email,
          display_name: displayName,
          avatar_url: image_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clerk_id' }
      );

    if (error) {
      console.error('Supabase upsert error:', error);
      return new Response('DB error', { status: 500 });
    }
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data as { id: string };

    await supabase
      .from('profiles')
      .update({ role: 'fan' }) // Soft delete: keep profile for fan history
      .eq('clerk_id', id);
  }

  return new Response('OK', { status: 200 });
}
