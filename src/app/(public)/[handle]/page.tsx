import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { CertifiedBadge } from '@/components/ui/CertifiedBadge';
import { TwinSocials } from '@/components/public/TwinSocials';
import { formatPrice } from '@/lib/format';
import type { PricingTier } from '@/types';
import {
  getTwin,
  parseHandle,
  getPublicTheme,
  DEFAULT_TIERS,
  type Socials,
} from '@/lib/public-twin';
import { MessageCircle, Users, Sparkles, Check, ArrowRight, Newspaper } from 'lucide-react';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

/** "Close Friends" membership framing — we sell access, never a message counter. */
const MEMBERSHIP_BENEFITS = [
  'Talk to me anytime — a real back-and-forth, just you and me. No comment-section roulette.',
  'The vault: locked posts, photos and video I keep off the main feed — stuff only my Close Friends see.',
  'First in line on everything new, before it goes public.',
  'One membership, everything I make — nothing held back behind a second paywall.',
  'It gets better the more we talk — I get to know you, you watch me learn your style.',
];

const SAMPLE_QUESTIONS: Record<string, string[]> = {
  fitness: ['How do I break my bench plateau?', 'Build me a 3-day split', 'What should I eat post-workout?'],
  finance: ['Lump sum or DCA my savings?', 'How do I start investing?', 'Review my budget strategy'],
  beauty: ['Fix my oily T-zone routine', 'Best retinol for beginners?', 'Morning routine in 5 minutes'],
  gaming: ['How do I rank up faster?', 'Best settings for my setup?', 'Review my gameplay habits'],
  cooking: ['15-minute dinner ideas?', 'How do I meal prep for a week?', 'Fix my bland pasta sauce'],
  tech: ['Which laptop should I buy?', 'Is this gadget worth it?', 'Help me pick my setup'],
  lifestyle: ['Help me build better habits', 'How do you stay consistent?', 'Plan my morning routine'],
  other: ['Can I ask you anything?', 'What do you recommend for me?', 'Help me get started'],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const slug = parseHandle(handle);
  if (!slug) return {};
  const twin = await getTwin(slug);
  if (!twin) return {};

  const title = `${twin.name} — chat with my AI twin`;
  const description =
    twin.tagline ||
    `Subscribe to chat with ${twin.name}'s AI twin. Personalized answers, anytime — from ${formatPrice(twin.monthly_price_cents)}/mo.`;
  const ogUrl = `${APP_URL}/api/og/twin/${twin.slug}`;

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/@${twin.slug}` },
    openGraph: {
      title,
      description,
      url: `${APP_URL}/@${twin.slug}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  };
}

export default async function PublicTwinPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const slug = parseHandle(handle);
  if (!slug) notFound();

  const twin = await getTwin(slug);
  if (!twin) notFound();

  const tiers: PricingTier[] = twin.settings?.pricing_tiers?.length
    ? twin.settings.pricing_tiers
    : DEFAULT_TIERS;
  const cheapest = tiers.reduce((a, b) => (a.cents < b.cents ? a : b));
  const questions = SAMPLE_QUESTIONS[twin.niche?.toLowerCase?.() ?? 'other'] || SAMPLE_QUESTIONS.other;
  const welcome =
    twin.settings?.welcome_message ||
    `Hey! I'm ${twin.name}'s AI twin — trained on everything they know. Ask me anything!`;
  const publicProfile = twin.settings?.public_profile || {};
  const bio: string | null = publicProfile.bio || null;
  const socials: Socials = publicProfile.socials || {};

  const { background, c } = getPublicTheme(publicProfile.theme);

  return (
    <div className="min-h-[100dvh]" style={{ background }}>
      <main className="max-w-md mx-auto px-5 py-10">
        {/* Header */}
        <div className="text-center mb-7">
          <Avatar
            name={twin.name}
            src={twin.photo_url}
            size="xl"
            className={`mx-auto mb-4 ring-4 shadow-lg ${c.avatarRing}`}
          />
          <h1
            className={`font-display font-800 text-3xl mb-1.5 flex items-center justify-center gap-2 ${c.heading}`}
          >
            {twin.name}
            {twin.certified ? <CertifiedBadge size="lg" /> : null}
          </h1>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1 rounded-full ${c.accentPill}`}
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" /> AI Twin
            </span>
            {twin.niche && (
              <span className={`text-xs font-600 px-2.5 py-1 rounded-full capitalize ${c.pill}`}>
                {twin.niche}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-600 text-[#22C55E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" /> Online
            </span>
          </div>
          {twin.tagline && (
            <p className={`text-[15px] max-w-xs mx-auto ${c.body}`}>{twin.tagline}</p>
          )}

          <TwinSocials socials={socials} name={twin.name} socialClass={c.social} />
        </div>

        {/* Close Friends membership — sell the world, never a message counter */}
        <div className={`rounded-2xl p-5 mb-5 ${c.card}`}>
          <h2 className={`font-display font-800 text-xl leading-tight mb-1.5 ${c.heading}`}>
            Get on {twin.name}&apos;s Close Friends list
          </h2>
          <p className={`text-sm leading-relaxed mb-4 ${c.body}`}>
            Skip the comments. Become a member and you talk to me straight — anytime — plus
            everything I keep off the main feed: the locked posts, the early drops, the stuff only
            my people get.
          </p>
          <ul className="space-y-2.5 mb-5">
            {MEMBERSHIP_BENEFITS.map((b) => (
              <li
                key={b}
                className={`flex items-start gap-2.5 text-[14px] leading-snug ${c.body}`}
              >
                <Check className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/explore/${twin.slug}`}
            className="w-full gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2"
          >
            Get on the list
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <p className={`text-xs text-center mt-2.5 ${c.muted}`}>
            From {formatPrice(cheapest.cents)}/mo &bull; Cancel anytime
          </p>
        </div>

        {/* See the feed */}
        <Link
          href={`/c/${twin.slug}`}
          className={`flex items-center justify-center gap-2 text-sm font-600 py-3 rounded-xl mb-7 ${c.card} ${c.heading}`}
        >
          <Newspaper className="w-4 h-4 text-[#A855F7]" aria-hidden="true" />
          See {twin.name}&apos;s feed
        </Link>

        {/* Bio */}
        {bio && (
          <div className={`rounded-2xl p-5 mb-7 ${c.card}`}>
            <p className={`text-xs font-600 uppercase tracking-wider mb-2 ${c.muted}`}>About</p>
            <p className={`text-[15px] leading-relaxed whitespace-pre-line ${c.body}`}>{bio}</p>
          </div>
        )}

        {/* Stats — only shown once they're real */}
        {(twin.total_subscribers > 0 || twin.total_messages > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className={`rounded-xl p-4 text-center ${c.card}`}>
              <Users className="w-5 h-5 text-[#00D4FF] mx-auto mb-1" strokeWidth={1.8} aria-hidden="true" />
              <p className={`font-display font-700 text-lg ${c.heading}`}>{twin.total_subscribers}</p>
              <p className={`text-xs ${c.muted}`}>Subscribers</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${c.card}`}>
              <MessageCircle className="w-5 h-5 text-[#FF6B6B] mx-auto mb-1" strokeWidth={1.8} aria-hidden="true" />
              <p className={`font-display font-700 text-lg ${c.heading}`}>{twin.total_messages}</p>
              <p className={`text-xs ${c.muted}`}>Messages answered</p>
            </div>
          </div>
        )}

        {/* Welcome message preview */}
        <div className={`rounded-2xl p-4 mb-7 ${c.card}`}>
          <div className="flex gap-2.5">
            <Avatar name={twin.name} src={twin.photo_url} size="sm" className="mt-0.5" />
            <div className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-snug ${c.bubble}`}>
              {welcome}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3 pl-9">
            {questions.map((q) => (
              <span key={q} className={`text-xs font-500 rounded-full px-2.5 py-1 ${c.chip}`}>
                {q}
              </span>
            ))}
          </div>
        </div>

        {/* Pricing — pick a spot, not a message pack */}
        <div className="mb-6">
          <p className={`text-sm font-600 mb-3 text-center ${c.heading}`}>Choose your spot</p>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className={`rounded-xl p-4 flex items-center justify-between ${c.card}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-700 uppercase tracking-wider text-[#A855F7]">
                      {tier.name}
                    </span>
                    {i === 1 && (
                      <span className={`text-[10px] font-600 uppercase ${c.muted}`}>
                        Where most people sit
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 flex items-center gap-1.5 ${c.muted}`}>
                    <Check className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" aria-hidden="true" />
                    Full access — chat, the vault &amp; every perk
                  </p>
                </div>
                <span className={`font-display font-800 text-xl whitespace-nowrap ${c.heading}`}>
                  {formatPrice(tier.cents)}
                  <span className={`text-xs font-600 ${c.muted}`}>/mo</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA → auth flow takes over */}
        <Link
          href={`/explore/${twin.slug}`}
          className="w-full gradient-btn text-white font-600 py-4 rounded-xl flex items-center justify-center gap-2 text-lg"
        >
          Become a member
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </Link>
        <p className={`text-xs text-center mt-3 ${c.muted}`}>
          From {formatPrice(cheapest.cents)}/mo &bull; Cancel anytime
        </p>

        {/* Viral footer */}
        <div className={`mt-10 pt-6 border-t text-center ${c.divider}`}>
          <a href="https://twiinn.ai" className={`text-sm transition-colors ${c.footerLink}`}>
            Powered by <span className="font-700 text-[#A855F7]">Twiinn</span> — create your own AI
            twin →
          </a>
        </div>
      </main>
    </div>
  );
}
