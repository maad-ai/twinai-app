import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { LayoutDashboard, Users, MessageCircle, DollarSign, Settings, Eye, BadgeCheck, Newspaper, Sparkles, HelpCircle, CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { formatPrice, timeAgo } from '@/lib/format';
import { ShareTwinLink } from '@/components/creator/ShareTwinLink';

export const metadata = { title: 'Creator Dashboard' };

export default async function CreatorDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('clerk_id', userId)
    .single();

  if (!profile?.onboarding_completed) {
    redirect('/creator/onboarding');
  }

  const { data: twin } = await supabase
    .from('twins')
    .select('*')
    .eq('creator_id', profile.id)
    .single();

  // Lifetime net earnings from the ledger (zeros until rows exist)
  let lifetimeCents = 0;
  try {
    const { data: earningRows, error } = await supabase
      .from('earnings')
      .select('net_amount_cents, status')
      .eq('creator_id', profile.id);
    if (!error && earningRows) {
      lifetimeCents = earningRows
        .filter((e) => e.status !== 'failed')
        .reduce((sum, e) => sum + (e.net_amount_cents || 0), 0);
    }
  } catch {
    lifetimeCents = 0;
  }

  // Creator-tooling stats (graceful if a table/migration isn't applied yet).
  let trainedCount = 0;
  let postsCount = 0;
  let unansweredCount = 0;
  let lastPostAt: string | null = null;
  if (twin) {
    const [trained, postsRes, unanswered] = await Promise.all([
      supabase
        .from('training_content')
        .select('id', { count: 'exact', head: true })
        .eq('twin_id', twin.id)
        .eq('status', 'embedded'),
      supabase
        .from('posts')
        .select('created_at')
        .eq('twin_id', twin.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('unanswered_questions')
        .select('id', { count: 'exact', head: true })
        .eq('twin_id', twin.id),
    ]);
    trainedCount = trained.error ? 0 : trained.count ?? 0;
    unansweredCount = unanswered.error ? 0 : unanswered.count ?? 0;
    if (!postsRes.error && postsRes.data) {
      postsCount = postsRes.data.length;
      lastPostAt = (postsRes.data[0] as { created_at?: string })?.created_at ?? null;
    }
  }

  const pub =
    (twin?.settings?.public_profile as { bio?: string; cover?: string } | undefined) || {};
  const checklist = twin
    ? [
        { label: 'Photo de profil', done: !!twin.photo_url, href: '/creator/twin/profile' },
        { label: 'Bannière de couverture', done: !!pub.cover, href: '/creator/twin/profile' },
        { label: 'Bio', done: !!pub.bio, href: '/creator/twin/profile' },
        { label: '5 sources entraînées', done: trainedCount >= 5, href: '/creator/twin/training' },
        { label: '3 posts publiés', done: postsCount >= 3, href: '/creator/twin/posts' },
        { label: 'Page publiée', done: twin.status === 'active', href: '/creator/twin/profile' },
      ]
    : [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
          <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Creator Dashboard</h1>
        </div>
        {twin && (
          <span
            className={`text-xs font-600 uppercase tracking-wider px-3 py-1 rounded-full ${
              twin.status === 'active'
                ? 'bg-[#84FF57]/20 text-[#22C55E]'
                : 'bg-[#FBBF24]/20 text-[#D97706]'
            }`}
          >
            {twin.status}
          </span>
        )}
      </div>

      {/* Shareable link — the bio-link moment */}
      {twin && <ShareTwinLink slug={twin.slug} name={twin.name} />}

      {/* Setup checklist — drives creators to complete their page (the supply bottleneck) */}
      {twin && pct < 100 && (
        <div className="card rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-700 text-lg text-[#0F0F23]">Termine ta page</h2>
            <span className="text-sm font-700 text-[#A855F7]">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-[#A855F7] to-[#00D4FF] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className={`flex items-center gap-2 text-sm ${
                    c.done ? 'text-[#94A3B8]' : 'text-[#0F0F23] hover:text-[#A855F7]'
                  }`}
                >
                  {c.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#CBD5E1] flex-shrink-0" />
                  )}
                  <span className={c.done ? 'line-through' : 'font-500'}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Subscribers', value: twin?.total_subscribers ?? 0, icon: Users, color: '#00D4FF' },
          { label: 'Messages', value: twin?.total_messages ?? 0, icon: MessageCircle, color: '#FF6B6B' },
          { label: 'Revenue', value: formatPrice(lifetimeCents), icon: DollarSign, color: '#84FF57' },
        ].map((stat) => (
          <div key={stat.label} className="card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} strokeWidth={1.8} />
              <p className="text-sm text-[#94A3B8]">{stat.label}</p>
            </div>
            <p className="font-display font-800 text-3xl text-[#0F0F23]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Twin info */}
      {twin && (
        <div className="card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg text-[#0F0F23]">Your Twin</h2>
            <Link
              href="/creator/twin"
              className="text-sm text-[#A855F7] font-500 hover:underline flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" /> Edit
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Name</p>
              <p className="font-600 text-[#0F0F23]">{twin.name}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Niche</p>
              <p className="font-600 text-[#0F0F23]">{twin.niche}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Price</p>
              <p className="font-600 text-[#0F0F23]">{formatPrice(twin.monthly_price_cents)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Public page</p>
              <a
                href={`/@${twin.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-500 text-[#A855F7] hover:underline"
              >
                twiinn.ai/@{twin.slug}
              </a>
            </div>
          </div>

          {twin.tagline && (
            <div className="mt-4 pt-4 border-t border-black/5">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Tagline</p>
              <p className="text-[#0F0F23]">{twin.tagline}</p>
            </div>
          )}
        </div>
      )}

      {/* Twin health — keeps creators training + posting (fresh content = fan retention) */}
      {twin && (
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-4">Santé de ton twin</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/creator/twin/training" className="block group">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[#A855F7]" strokeWidth={1.8} />
                <p className="text-xs text-[#94A3B8]">Sources entraînées</p>
              </div>
              <p className="font-display font-800 text-2xl text-[#0F0F23] group-hover:text-[#A855F7] transition-colors">
                {trainedCount}
              </p>
              {trainedCount < 5 && (
                <p className="text-xs text-[#D97706] mt-0.5">Vise 5+ pour un twin plus fidèle</p>
              )}
            </Link>
            <Link href="/creator/twin/posts" className="block group">
              <div className="flex items-center gap-2 mb-1">
                <Newspaper className="w-4 h-4 text-[#22C55E]" strokeWidth={1.8} />
                <p className="text-xs text-[#94A3B8]">Posts</p>
              </div>
              <p className="font-display font-800 text-2xl text-[#0F0F23] group-hover:text-[#22C55E] transition-colors">
                {postsCount}
              </p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {lastPostAt
                  ? `Dernier post il y a ${timeAgo(lastPostAt)}`
                  : 'Aucun post — publie pour retenir tes fans'}
              </p>
            </Link>
            <Link href="/creator/questions" className="block group">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="w-4 h-4 text-[#FF6B6B]" strokeWidth={1.8} />
                <p className="text-xs text-[#94A3B8]">Questions sans réponse</p>
              </div>
              <p className="font-display font-800 text-2xl text-[#0F0F23] group-hover:text-[#FF6B6B] transition-colors">
                {unansweredCount}
              </p>
              {unansweredCount > 0 && (
                <p className="text-xs text-[#D97706] mt-0.5">À combler pour améliorer le twin</p>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Twiinn Certified — badge status / application teaser */}
      {twin && (
        <div className="card rounded-2xl p-5 mb-6">
          {twin.certified ? (
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-6 h-6 text-[#A855F7] flex-shrink-0" strokeWidth={1.8} />
              <div>
                <h2 className="font-display font-700 text-[#0F0F23]">Twiinn Certified</h2>
                <p className="text-sm text-[#94A3B8]">
                  You&apos;re certified — your twin gets featured in Explore.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-6 h-6 text-[#94A3B8] flex-shrink-0" strokeWidth={1.8} />
                <div>
                  <h2 className="font-display font-700 text-[#0F0F23]">Twiinn Certified</h2>
                  <p className="text-sm text-[#94A3B8]">
                    25+ active subscribers for 2 consecutive months
                  </p>
                </div>
              </div>
              <a
                href={`mailto:contact@twiinn.ai?subject=${encodeURIComponent(`Certification application — ${twin.slug}`)}`}
                className="gradient-btn text-white text-sm font-600 px-4 py-2 rounded-xl"
              >
                Apply for certification
              </a>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/creator/twin/training"
          className="card rounded-2xl p-6 hover:border-[#A855F7]/30 transition-all group"
        >
          <h3 className="font-display font-700 text-[#0F0F23] mb-1 group-hover:text-[#A855F7] transition-colors">
            Train Your Twin
          </h3>
          <p className="text-sm text-[#94A3B8]">
            Upload content to make your twin smarter and more accurate.
          </p>
        </Link>

        <Link
          href="/creator/twin/preview"
          className="card rounded-2xl p-6 hover:border-[#00D4FF]/30 transition-all group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-4 h-4 text-[#00D4FF]" strokeWidth={1.8} />
            <h3 className="font-display font-700 text-[#0F0F23] group-hover:text-[#00D4FF] transition-colors">
              Preview Twin
            </h3>
          </div>
          <p className="text-sm text-[#94A3B8]">
            Test how your twin responds before going live.
          </p>
        </Link>
      </div>
    </div>
  );
}
