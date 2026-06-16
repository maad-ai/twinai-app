import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Sparkles, Upload, Eye, Globe, Sliders, Fingerprint, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';

export const metadata = { title: 'My Twin' };

export default async function TwinPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) redirect('/choose-role');

  const { data: twin } = await supabase
    .from('twins')
    .select('*')
    .eq('creator_id', profile.id)
    .single();

  if (!twin) redirect('/creator/onboarding');

  const { data: contentCount } = await supabase
    .from('training_content')
    .select('id', { count: 'exact' })
    .eq('twin_id', twin.id)
    .eq('status', 'embedded');

  const personality = twin.personality as Record<string, number> || {};

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">My Twin</h1>
        <span className={`ml-auto text-xs font-600 uppercase tracking-wider px-3 py-1 rounded-full ${
          twin.status === 'active'
            ? 'bg-[#84FF57]/20 text-[#22C55E]'
            : 'bg-[#FBBF24]/20 text-[#D97706]'
        }`}>
          {twin.status}
        </span>
      </div>

      {/* Twin info card */}
      <div className="card rounded-2xl p-6 mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Name</p>
            <p className="font-600 text-[#0F0F23] text-lg">{twin.name}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Niche</p>
            <p className="font-600 text-[#0F0F23] text-lg">{twin.niche}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Price</p>
            <p className="font-600 text-[#0F0F23] text-lg">{formatPrice(twin.monthly_price_cents)}/mo</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Training Content</p>
            <p className="font-600 text-[#0F0F23] text-lg">{contentCount?.length ?? 0} items</p>
          </div>
        </div>

        {twin.tagline && (
          <div className="mt-4 pt-4 border-t border-black/5">
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Tagline</p>
            <p className="text-[#0F0F23]">{twin.tagline}</p>
          </div>
        )}

        {/* Personality summary */}
        <div className="mt-4 pt-4 border-t border-black/5">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-3">Personality</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(personality).map(([key, value]) => (
              <span key={key} className="text-xs px-3 py-1 rounded-full bg-[#F8FAFC] text-[#0F0F23] font-500">
                {key}: {value}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/creator/twin/training" className="card rounded-xl p-5 hover:border-[#A855F7]/30 transition-all group">
          <Upload className="w-5 h-5 text-[#A855F7] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#A855F7] transition-colors">Train</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Add content</p>
        </Link>

        <Link href="/creator/twin/preview" className="card rounded-xl p-5 hover:border-[#00D4FF]/30 transition-all group">
          <Eye className="w-5 h-5 text-[#00D4FF] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#00D4FF] transition-colors">Preview</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Test your twin</p>
        </Link>

        <Link href="/creator/twin/posts" className="card rounded-xl p-5 hover:border-[#22C55E]/30 transition-all group">
          <Newspaper className="w-5 h-5 text-[#22C55E] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#22C55E] transition-colors">Posts</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Share with your fans</p>
        </Link>

        <Link href="/creator/twin/profile" className="card rounded-xl p-5 hover:border-[#FBBF24]/30 transition-all group">
          <Globe className="w-5 h-5 text-[#FBBF24] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#FBBF24] transition-colors">Public page</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Bio, socials &amp; publish</p>
        </Link>

        <Link href="/creator/twin/settings" className="card rounded-xl p-5 hover:border-[#A855F7]/30 transition-all group">
          <Sliders className="w-5 h-5 text-[#A855F7] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#A855F7] transition-colors">Behavior</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Personality, language &amp; pricing</p>
        </Link>

        <Link href="/creator/twin/identity" className="card rounded-xl p-5 hover:border-[#FF6B6B]/30 transition-all group">
          <Fingerprint className="w-5 h-5 text-[#FF6B6B] mb-2" strokeWidth={1.8} />
          <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#FF6B6B] transition-colors">Identity</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Make it sound like you</p>
        </Link>
      </div>
    </div>
  );
}
