import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Avatar } from '@/components/ui/Avatar';
import { formatPrice } from '@/lib/format';
import type { PricingTier } from '@/types';
import { MessageCircle, Users, Sparkles, Check, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

const DEFAULT_TIERS: PricingTier[] = [
  { cents: 999, credits: 100, name: 'Basic' },
  { cents: 1999, credits: 300, name: 'Standard' },
  { cents: 4999, credits: 800, name: 'Premium' },
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

async function getTwin(slug: string) {
  const supabase = createAdminClient();
  const { data: twin } = await supabase
    .from('twins')
    .select(
      'id, name, slug, tagline, niche, monthly_price_cents, total_subscribers, total_messages, settings, status'
    )
    .eq('slug', slug)
    .in('status', ['active', 'training'])
    .maybeSingle();
  return twin;
}

function parseHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith('@')) return null;
  const slug = decoded.slice(1).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}

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

  const tiers: PricingTier[] = twin.settings?.pricing_tiers || DEFAULT_TIERS;
  const cheapest = tiers.reduce((a, b) => (a.cents < b.cents ? a : b));
  const questions = SAMPLE_QUESTIONS[twin.niche?.toLowerCase?.()] || SAMPLE_QUESTIONS.other;
  const welcome =
    twin.settings?.welcome_message ||
    `Hey! I'm ${twin.name}'s AI twin — trained on everything they know. Ask me anything!`;

  return (
    <main className="max-w-md mx-auto px-5 py-10">
      {/* Header */}
      <div className="text-center mb-7">
        <Avatar name={twin.name} size="xl" className="mx-auto mb-4 ring-4 ring-white shadow-lg" />
        <h1 className="font-display font-800 text-3xl text-[#0F0F23] mb-1.5">{twin.name}</h1>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-600 text-[#A855F7] bg-[#A855F7]/10 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" aria-hidden="true" /> AI Twin
          </span>
          {twin.niche && (
            <span className="text-xs font-600 text-[#64748B] bg-black/[0.05] px-2.5 py-1 rounded-full capitalize">
              {twin.niche}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-600 text-[#16A34A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" /> Online
          </span>
        </div>
        {twin.tagline && <p className="text-[15px] text-[#475569] max-w-xs mx-auto">{twin.tagline}</p>}
      </div>

      {/* Stats — only shown once they're real */}
      {(twin.total_subscribers > 0 || twin.total_messages > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-7">
          <div className="card rounded-xl p-4 text-center">
            <Users className="w-5 h-5 text-[#00D4FF] mx-auto mb-1" strokeWidth={1.8} aria-hidden="true" />
            <p className="font-display font-700 text-lg text-[#0F0F23]">{twin.total_subscribers}</p>
            <p className="text-xs text-[#94A3B8]">Subscribers</p>
          </div>
          <div className="card rounded-xl p-4 text-center">
            <MessageCircle className="w-5 h-5 text-[#FF6B6B] mx-auto mb-1" strokeWidth={1.8} aria-hidden="true" />
            <p className="font-display font-700 text-lg text-[#0F0F23]">{twin.total_messages}</p>
            <p className="text-xs text-[#94A3B8]">Messages answered</p>
          </div>
        </div>
      )}

      {/* Welcome message preview */}
      <div className="card rounded-2xl p-4 mb-7">
        <div className="flex gap-2.5">
          <Avatar name={twin.name} size="sm" className="mt-0.5" />
          <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-[#0F0F23] leading-snug">
            {welcome}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 pl-9">
          {questions.map((q) => (
            <span
              key={q}
              className="text-xs font-500 text-[#A855F7] bg-[#A855F7]/[0.07] border border-[#A855F7]/15 rounded-full px-2.5 py-1"
            >
              {q}
            </span>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <p className="text-sm font-600 text-[#0F0F23] mb-3 text-center">Monthly plans</p>
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className="card rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-700 uppercase tracking-wider text-[#A855F7]">
                    {tier.name}
                  </span>
                  {i === 1 && (
                    <span className="text-[10px] font-600 text-[#64748B] uppercase">Popular</span>
                  )}
                </div>
                <p className="text-sm text-[#94A3B8] mt-0.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
                  {tier.credits} messages/month
                </p>
              </div>
              <span className="font-display font-800 text-xl text-[#0F0F23]">
                {formatPrice(tier.cents)}
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
        Subscribe &amp; start chatting
        <ArrowRight className="w-5 h-5" aria-hidden="true" />
      </Link>
      <p className="text-xs text-[#94A3B8] text-center mt-3">
        From {formatPrice(cheapest.cents)}/mo &bull; Cancel anytime &bull; Keep your messages
      </p>

      {/* Viral footer */}
      <div className="mt-10 pt-6 border-t border-black/[0.06] text-center">
        <a
          href="https://twiinn.ai"
          className="text-sm text-[#64748B] hover:text-[#0F0F23] transition-colors"
        >
          Powered by <span className="font-700 text-[#A855F7]">Twiinn</span> — create your own AI
          twin →
        </a>
      </div>
    </main>
  );
}
