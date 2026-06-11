import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: twin } = await supabase
    .from('twins')
    .select('name, slug, tagline, niche, monthly_price_cents, status')
    .eq('slug', slug)
    .in('status', ['active', 'training'])
    .maybeSingle();

  if (!twin) {
    return new Response('Not found', { status: 404 });
  }

  const price = `$${(twin.monthly_price_cents / 100).toFixed(2)}/mo`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0F0F23 0%, #1A1A3E 60%, #0F0F23 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '140px',
            height: '140px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #A855F7, #00D4FF)',
            color: 'white',
            fontSize: '64px',
            fontWeight: 800,
            marginBottom: '28px',
          }}
        >
          {twin.name.charAt(0)}
        </div>

        <div style={{ display: 'flex', color: 'white', fontSize: '58px', fontWeight: 800 }}>
          {twin.name}
        </div>
        <div style={{ display: 'flex', color: '#94A3B8', fontSize: '30px', marginTop: '10px' }}>
          Chat with my AI twin — anytime, about anything
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '36px' }}>
          {[
            twin.niche ? twin.niche.charAt(0).toUpperCase() + twin.niche.slice(1) : 'Creator',
            `From ${price}`,
            'Online 24/7',
          ].map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                color: '#E2E8F0',
                fontSize: '24px',
                padding: '10px 22px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#64748B',
            fontSize: '26px',
            marginTop: '48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #FF6B6B, #A855F7)',
            }}
          />
          {`twiinn.ai/@${twin.slug}`}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
