import { Compass, Flame, MessageCircle, Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { CertifiedBadge } from '@/components/ui/CertifiedBadge';
import { formatPrice } from '@/lib/format';

export const metadata = { title: 'Explore' };
export const dynamic = 'force-dynamic';

const EXPLORE_COLUMNS = `
  id,
  name,
  slug,
  tagline,
  niche,
  monthly_price_cents,
  total_subscribers,
  total_messages,
  status,
  creator_id,
  created_at,
  photo_url,
  profiles!twins_creator_id_fkey (
    display_name,
    avatar_url
  )
`;

interface ExploreTwin {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  niche: string | null;
  monthly_price_cents: number;
  total_subscribers: number;
  total_messages: number;
  status: string;
  creator_id: string;
  created_at: string;
  photo_url: string | null;
  /** Optional: the DB column may not exist yet (migration 003). */
  certified?: boolean;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

/** certified > subscribers > messages. */
function rank(a: ExploreTwin, b: ExploreTwin): number {
  const cert = Number(Boolean(b.certified)) - Number(Boolean(a.certified));
  if (cert !== 0) return cert;
  if (b.total_subscribers !== a.total_subscribers)
    return b.total_subscribers - a.total_subscribers;
  return b.total_messages - a.total_messages;
}

function StatLine({ twin }: { twin: ExploreTwin }) {
  if (twin.total_subscribers > 0) {
    return (
      <span className="text-xs text-[#94A3B8] flex items-center gap-1">
        <Users className="w-3.5 h-3.5" aria-hidden="true" />
        {twin.total_subscribers} subscriber{twin.total_subscribers > 1 ? 's' : ''}
      </span>
    );
  }
  if (twin.total_messages > 0) {
    return (
      <span className="text-xs text-[#94A3B8] flex items-center gap-1">
        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
        {twin.total_messages} messages
      </span>
    );
  }
  return <span className="text-xs text-[#94A3B8]">New</span>;
}

function FeaturedCard({ twin }: { twin: ExploreTwin }) {
  return (
    <Link
      href={`/explore/${twin.slug}`}
      className="card rounded-2xl p-6 block group relative overflow-hidden hover:border-[#A855F7]/40 transition-all"
    >
      {/* soft violet glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(70% 50% at 50% 0%, rgba(168,85,247,0.07), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex flex-col items-center text-center">
          <span className="rounded-full p-[3px] mb-3" style={{ background: 'linear-gradient(135deg, #FF6B6B, #A855F7, #00D4FF)' }}>
            <span className="block rounded-full ring-2 ring-white">
              <Avatar name={twin.name} src={twin.photo_url} size="xl" />
            </span>
          </span>
          <p className="font-display font-800 text-lg text-[#0F0F23] group-hover:text-[#A855F7] transition-colors flex items-center gap-1.5">
            <span className="truncate max-w-[180px]">{twin.name}</span>
            {twin.certified ? <CertifiedBadge /> : null}
          </p>
          {twin.niche && (
            <span className="text-xs font-600 text-[#A855F7] bg-[#A855F7]/10 px-2.5 py-0.5 rounded-full mt-1 capitalize">
              {twin.niche}
            </span>
          )}
          {twin.tagline && (
            <p className="text-sm text-[#94A3B8] mt-3 line-clamp-2">{twin.tagline}</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-black/5">
          <StatLine twin={twin} />
          <span className="text-sm font-700 text-[#0F0F23]">
            {formatPrice(twin.monthly_price_cents)}/mo
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function ExplorePage() {
  const supabase = createAdminClient();

  // Prefer `certified`, but the column may not exist yet (migration 003) —
  // fall back to the base column list so this page never 500s.
  const { data, error } = await supabase
    .from('twins')
    .select(`certified, ${EXPLORE_COLUMNS}`)
    .in('status', ['active', 'training']);
  let twins = data as unknown as ExploreTwin[] | null;
  if (error) {
    const { data: fallback } = await supabase
      .from('twins')
      .select(EXPLORE_COLUMNS)
      .in('status', ['active', 'training']);
    twins = fallback as unknown as ExploreTwin[] | null;
  }

  const all = (twins || []).slice();

  // Cold start: when nobody has subscribers yet, don't fake popularity —
  // show the newest twins instead.
  const coldStart = all.every((t) => t.total_subscribers === 0);
  if (coldStart) {
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    all.sort(rank);
  }

  const featured = all.slice(0, 3);
  const rest = all.slice(3);

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-2">
        <Compass className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Explore Twins</h1>
      </div>
      <p className="text-[#94A3B8] mb-8">Discover AI twins of your favorite creators.</p>

      {all.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center max-w-md mx-auto">
          <Compass className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No twins yet</p>
          <p className="text-sm text-[#94A3B8]">Be the first creator to launch a twin!</p>
        </div>
      ) : (
        <>
          {/* Featured — the best twins, for real */}
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[#FF6B6B]" strokeWidth={2} aria-hidden="true" />
            <h2 className="font-display font-700 text-lg text-[#0F0F23]">
              {coldStart ? 'New twins' : 'Featured'}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {featured.map((twin) => (
              <FeaturedCard key={twin.id} twin={twin} />
            ))}
          </div>

          {/* The rest */}
          {rest.length > 0 && (
            <>
              <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-4">All twins</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map((twin) => (
                  <Link
                    key={twin.id}
                    href={`/explore/${twin.slug}`}
                    className="card rounded-2xl p-6 hover:border-[#A855F7]/20 transition-all block group"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={twin.name} src={twin.photo_url} size="lg" />
                      <div className="min-w-0">
                        <p className="font-display font-700 text-[#0F0F23] group-hover:text-[#A855F7] transition-colors flex items-center gap-1.5">
                          <span className="truncate">{twin.name}</span>
                          {twin.certified ? <CertifiedBadge size="sm" /> : null}
                        </p>
                        <p className="text-xs text-[#94A3B8]">{twin.niche}</p>
                      </div>
                    </div>

                    {twin.tagline && (
                      <p className="text-sm text-[#94A3B8] mb-4 line-clamp-2">{twin.tagline}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-black/5">
                      <span className="text-sm font-600 text-[#0F0F23]">
                        {formatPrice(twin.monthly_price_cents)}/mo
                      </span>
                      <StatLine twin={twin} />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
