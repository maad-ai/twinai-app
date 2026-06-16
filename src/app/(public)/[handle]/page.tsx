import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Avatar } from '@/components/ui/Avatar';
import { CertifiedBadge } from '@/components/ui/CertifiedBadge';
import { formatPrice } from '@/lib/format';
import { getTheme } from '@/lib/themes';
import type { PricingTier } from '@/types';
import { MessageCircle, Users, Sparkles, Check, ArrowRight } from 'lucide-react';
import { FeedPost } from '@/components/public/FeedPost';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

const DEFAULT_TIERS: PricingTier[] = [
  { cents: 999, credits: 80, name: 'On the List' },
  { cents: 1999, credits: 150, name: 'Close Friends' },
  { cents: 4999, credits: 400, name: 'Front Row' },
];

/**
 * "Close Friends" membership framing — we sell access to the creator's world,
 * never a message counter. (chat is one perk among several; the message quota
 * lives under the hood as quiet fair-use — see the chat UI for the soft label.)
 */
const MEMBERSHIP_BENEFITS = [
  'Talk to me anytime — a real back-and-forth, just you and me. No comment-section roulette.',
  'The vault: locked posts, photos and video I keep off the main feed — stuff only my Close Friends see.',
  'First in line on everything new, before it goes public.',
  'One membership, everything I make — nothing held back behind a second paywall.',
  'It gets better the more we talk — I get to know you, you watch me learn your style.',
];

interface Socials {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  x?: string | null;
  website?: string | null;
}

/* Brand icons (lucide dropped brand icons) */
const SOCIAL_ICONS: Record<string, (cls: string) => React.ReactNode> = {
  instagram: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.8.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.3-.3.8-.3 1.8-.1 1.2-.1 1.6-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.8.2.5.4.8.7 1.1.3.3.6.5 1.1.7.3.1.8.3 1.8.3 1.2.1 1.6.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.8-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.3.3-.8.3-1.8.1-1.2.1-1.6.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.8-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.3-.1-.8-.3-1.8-.3-1.2-.1-1.6-.1-4.8-.1Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  ),
  tiktok: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M19.6 6.7a4.8 4.8 0 0 1-3.5-1.6 4.8 4.8 0 0 1-1.2-3.1h-3.2v13.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 6V9.6a8 8 0 0 0 4.7 1.5V7.9c-.7 0-1.3-.1-2-.4Z" />
    </svg>
  ),
  youtube: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M23 7.2a2.8 2.8 0 0 0-2-2C19.2 4.7 12 4.7 12 4.7s-7.2 0-9 .5a2.8 2.8 0 0 0-2 2C.5 9 .5 12 .5 12s0 3 .5 4.8a2.8 2.8 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a2.8 2.8 0 0 0 2-2c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM9.7 15.4V8.6l6 3.4-6 3.4Z" />
    </svg>
  ),
  x: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M18.2 2.3h3.3l-7.3 8.3 8.6 11.1h-6.7l-5.3-6.8-6 6.8H1.5l7.8-8.9L1 2.3h6.9l4.8 6.2 5.5-6.2Zm-1.2 17.5h1.8L7 4.1H5l12 15.7Z" />
    </svg>
  ),
  website: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

function socialUrl(key: string, value: string): string {
  switch (key) {
    case 'instagram':
      return `https://instagram.com/${value}`;
    case 'tiktok':
      return `https://tiktok.com/@${value}`;
    case 'youtube':
      return `https://youtube.com/@${value}`;
    case 'x':
      return `https://x.com/${value}`;
    default:
      return value;
  }
}

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

const TWIN_COLUMNS =
  'id, name, slug, tagline, niche, monthly_price_cents, total_subscribers, total_messages, settings, status, photo_url, creator_id';

interface PublicTwin {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  niche: string | null;
  monthly_price_cents: number;
  total_subscribers: number;
  total_messages: number;
  settings: Record<string, any> | null;
  status: string;
  photo_url: string | null;
  creator_id: string;
  /** Optional: the DB column may not exist yet (migration 003). */
  certified?: boolean;
}

async function getTwin(slug: string): Promise<PublicTwin | null> {
  const supabase = createAdminClient();
  // Prefer `certified`, but the column may not exist yet (migration 003) —
  // fall back to the base column list so this page never 500s.
  const { data: twin, error } = await supabase
    .from('twins')
    .select(`${TWIN_COLUMNS}, certified`)
    .eq('slug', slug)
    .in('status', ['active', 'training'])
    .maybeSingle();
  if (!error) return twin as PublicTwin | null;

  const { data: fallback } = await supabase
    .from('twins')
    .select(TWIN_COLUMNS)
    .eq('slug', slug)
    .in('status', ['active', 'training'])
    .maybeSingle();
  return fallback as PublicTwin | null;
}

interface Post {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video';
  visibility: 'public' | 'subscribers';
  created_at: string;
}

interface PostWithSocial extends Post {
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

/**
 * A twin's posts (newest first) with like/comment aggregates.
 * Degrades to [] / zeros if the posts/social tables aren't there yet
 * (migrations 007 / 008).
 */
async function getPostsWithSocial(
  twinId: string,
  viewerProfileId: string | null
): Promise<PostWithSocial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id, body, media_url, media_type, visibility, created_at')
    .eq('twin_id', twinId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data || data.length === 0) return [];

  const posts = data as Post[];
  const ids = posts.map((p) => p.id);

  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('post_likes').select('post_id, profile_id').in('post_id', ids),
    supabase.from('post_comments').select('post_id').in('post_id', ids),
  ]);

  const likeCount: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  const commentCount: Record<string, number> = {};
  ((likes as { post_id: string; profile_id: string }[] | null) || []).forEach((l) => {
    likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
    if (viewerProfileId && l.profile_id === viewerProfileId) likedByMe[l.post_id] = true;
  });
  ((comments as { post_id: string }[] | null) || []).forEach((cm) => {
    commentCount[cm.post_id] = (commentCount[cm.post_id] || 0) + 1;
  });

  return posts.map((p) => ({
    ...p,
    likeCount: likeCount[p.id] || 0,
    likedByMe: !!likedByMe[p.id],
    commentCount: commentCount[p.id] || 0,
  }));
}

/** The viewer's app profile id (null if anonymous / no profile). Never throws. */
async function getViewerProfileId(): Promise<string | null> {
  let userId: string | null = null;
  try {
    ({ userId } = await auth());
  } catch {
    return null;
  }
  if (!userId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Does this profile have an active subscription to the twin? */
async function isActiveSubscriber(profileId: string, twinId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('fan_id', profileId)
    .eq('twin_id', twinId)
    .eq('status', 'active')
    .maybeSingle();
  return !!data;
}

/** Compact relative time, e.g. "3d", "5h", "just now". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const viewerProfileId = await getViewerProfileId();
  const isOwner = !!viewerProfileId && viewerProfileId === twin.creator_id;
  const [posts, subscribed] = await Promise.all([
    getPostsWithSocial(twin.id, viewerProfileId),
    viewerProfileId ? isActiveSubscriber(viewerProfileId, twin.id) : Promise.resolve(false),
  ]);
  const isSubscriber = subscribed;
  const canSeeMembers = isSubscriber || isOwner;

  const tiers: PricingTier[] = twin.settings?.pricing_tiers || DEFAULT_TIERS;
  const cheapest = tiers.reduce((a, b) => (a.cents < b.cents ? a : b));
  const questions = SAMPLE_QUESTIONS[twin.niche?.toLowerCase?.() ?? 'other'] || SAMPLE_QUESTIONS.other;
  const welcome =
    twin.settings?.welcome_message ||
    `Hey! I'm ${twin.name}'s AI twin — trained on everything they know. Ask me anything!`;
  const publicProfile = twin.settings?.public_profile || {};
  const bio: string | null = publicProfile.bio || null;
  const socials: Socials = publicProfile.socials || {};
  const socialEntries = Object.entries(socials).filter(
    ([key, value]) => value && SOCIAL_ICONS[key]
  ) as [string, string][];
  const cover: string | null = publicProfile.cover || null;
  const postCount = posts.length;
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);

  /* Theme tokens — light/dark variants for every surface on this page */
  const theme = getTheme(publicProfile.theme);
  const c = theme.dark
    ? {
        heading: 'text-white',
        body: 'text-[#CBD5E1]',
        muted: 'text-[#94A3B8]',
        card: 'bg-white/[0.06] border border-white/10',
        pill: 'bg-white/10 text-[#CBD5E1]',
        accentPill: 'bg-white/10 text-[#C4B5FD]',
        bubble: 'bg-white/10 text-white/90',
        chip: 'text-[#C4B5FD] bg-white/[0.06] border border-white/10',
        social: 'bg-white/10 border border-white/10 text-[#CBD5E1] hover:text-white hover:border-white/30',
        footerLink: 'text-[#94A3B8] hover:text-white',
        divider: 'border-white/10',
        avatarRing: 'ring-white/15',
      }
    : {
        heading: 'text-[#0F0F23]',
        body: 'text-[#475569]',
        muted: 'text-[#94A3B8]',
        card: 'bg-white border border-black/[0.06] shadow-sm',
        pill: 'bg-black/[0.05] text-[#64748B]',
        accentPill: 'bg-[#A855F7]/10 text-[#A855F7]',
        bubble: 'bg-[#F1F5F9] text-[#0F0F23]',
        chip: 'text-[#A855F7] bg-[#A855F7]/[0.07] border border-[#A855F7]/15',
        social: 'bg-white border border-black/[0.08] shadow-sm text-[#475569] hover:text-[#A855F7] hover:border-[#A855F7]/30',
        footerLink: 'text-[#64748B] hover:text-[#0F0F23]',
        divider: 'border-black/[0.06]',
        avatarRing: 'ring-white',
      };

  return (
    <div className="min-h-[100dvh]" style={{ background: theme.background }}>
      <main className="max-w-md mx-auto px-5 py-10">
        {/* Cover banner */}
        <div className="-mx-5 -mt-10 mb-0 h-36 sm:h-44 overflow-hidden relative">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: 'linear-gradient(135deg, #A855F7 0%, #00D4FF 100%)' }}
            />
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-7 -mt-12">
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

          {/* Profile stats */}
          {postCount > 0 && (
            <div className="flex items-center justify-center gap-4 text-[13px] mt-3">
              <span className={c.body}>
                <span className={`font-700 ${c.heading}`}>{postCount}</span> posts
              </span>
              <span className={c.body}>
                <span className={`font-700 ${c.heading}`}>{totalLikes}</span> likes
              </span>
            </div>
          )}

          {/* Social links — proof it's really them */}
          {socialEntries.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {socialEntries.map(([key, value]) => (
                <a
                  key={key}
                  href={socialUrl(key, value)}
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label={key === 'website' ? 'Website' : `${twin.name} on ${key}`}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${c.social}`}
                >
                  {SOCIAL_ICONS[key]('w-[18px] h-[18px]')}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Close Friends membership — sell the world, never a message counter */}
        <div className={`rounded-2xl p-5 mb-7 ${c.card}`}>
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

        {/* Feed — the creator's posts, front and center (profile feed) */}
        {posts.length > 0 && (
          <div className="mb-7">
            <p className={`text-sm font-600 mb-3 ${c.heading}`}>Latest from {twin.name}</p>
            <div className="space-y-3">
              {posts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  locked={post.visibility === 'subscribers' && !canSeeMembers}
                  likeCount={post.likeCount}
                  likedByMe={post.likedByMe}
                  commentCount={post.commentCount}
                  lockedTeaserPrice={formatPrice(cheapest.cents)}
                  timeLabel={timeAgo(post.created_at)}
                  twinName={twin.name}
                  slug={twin.slug}
                  isAuthed={!!viewerProfileId}
                  isOwner={isOwner}
                  viewerProfileId={viewerProfileId}
                  theme={{ card: c.card, heading: c.heading, body: c.body, muted: c.muted }}
                />
              ))}
            </div>
          </div>
        )}

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
