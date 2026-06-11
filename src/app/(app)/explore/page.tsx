import { Compass } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { formatPrice } from '@/lib/format';

export const metadata = { title: 'Explore' };

export default async function ExplorePage() {
  const supabase = createAdminClient();

  const { data: twins } = await supabase
    .from('twins')
    .select(`
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
      profiles!twins_creator_id_fkey (
        display_name,
        avatar_url
      )
    `)
    .in('status', ['active', 'draft'])
    .order('total_subscribers', { ascending: false });

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Compass className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Explore Twins</h1>
      </div>
      <p className="text-[#94A3B8] mb-8">Discover AI twins of your favorite creators.</p>

      {!twins || twins.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center max-w-md mx-auto">
          <Compass className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No twins yet</p>
          <p className="text-sm text-[#94A3B8]">
            Be the first creator to launch a twin!
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {twins.map((twin) => (
            <Link
              key={twin.id}
              href={`/explore/${twin.slug}`}
              className="card rounded-2xl p-6 hover:border-[#A855F7]/20 transition-all block group"
            >
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={twin.name} size="lg" />
                <div className="min-w-0">
                  <p className="font-display font-700 text-[#0F0F23] truncate group-hover:text-[#A855F7] transition-colors">
                    {twin.name}
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
                <span className="text-xs text-[#94A3B8]">
                  {twin.total_subscribers} subscribers
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
