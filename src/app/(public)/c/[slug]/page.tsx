import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { CertifiedBadge } from '@/components/ui/CertifiedBadge';
import { TwinSocials } from '@/components/public/TwinSocials';
import { FeedPost } from '@/components/public/FeedPost';
import { MessageTwinButton } from '@/components/public/MessageTwinButton';
import { TipButton } from '@/components/public/TipButton';
import { formatPrice } from '@/lib/format';
import type { PricingTier } from '@/types';
import {
  getTwin,
  parseSlug,
  getPublicTheme,
  getPostsWithSocial,
  getViewerProfileId,
  isActiveSubscriber,
  timeAgo,
  DEFAULT_TIERS,
  type Socials,
} from '@/lib/public-twin';
import { Sparkles, ArrowRight, MessageCircle, Pencil, Plus, Newspaper } from 'lucide-react';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = parseSlug(raw);
  if (!slug) return {};
  const twin = await getTwin(slug);
  if (!twin) return {};

  const title = `${twin.name} — feed`;
  const description = twin.tagline || `${twin.name}'s posts, drops and Close Friends feed on Twiinn.`;
  const ogUrl = `${APP_URL}/api/og/twin/${twin.slug}`;

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/c/${twin.slug}` },
    openGraph: {
      title,
      description,
      url: `${APP_URL}/c/${twin.slug}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  };
}

export default async function CreatorFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = parseSlug(raw);
  if (!slug) notFound();

  const twin = await getTwin(slug);
  if (!twin) notFound();

  const viewerProfileId = await getViewerProfileId();
  const isOwner = !!viewerProfileId && viewerProfileId === twin.creator_id;
  const subscribed = viewerProfileId ? await isActiveSubscriber(viewerProfileId, twin.id) : false;
  const canSeeMembers = subscribed || isOwner;
  // canSeeMembers is computed BEFORE fetching posts so locked rows get their
  // body/media stripped server-side (no paywall bypass via the RSC payload).
  const posts = await getPostsWithSocial(twin.id, viewerProfileId, canSeeMembers);

  const tiers: PricingTier[] = twin.settings?.pricing_tiers?.length
    ? twin.settings.pricing_tiers
    : DEFAULT_TIERS;
  const cheapest = tiers.reduce((a, b) => (a.cents < b.cents ? a : b));
  const publicProfile = twin.settings?.public_profile || {};
  const socials: Socials = publicProfile.socials || {};
  const cover: string | null = publicProfile.cover || null;
  const bio: string | null = publicProfile.bio || null;
  const postCount = posts.length;
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);

  const { background, c, dark } = getPublicTheme(publicProfile.theme);

  return (
    <div className="min-h-[100dvh]" style={{ background }}>
      <main className="max-w-md mx-auto px-5 pb-16">
        {/* Cover banner */}
        <div className="-mx-5 h-40 sm:h-48 overflow-hidden relative">
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

        {/* Profile header */}
        <div className="relative z-10 -mt-12 mb-6">
          <div className="flex items-end justify-between gap-3">
            <Avatar
              name={twin.name}
              src={twin.photo_url}
              size="xl"
              className={`ring-4 shadow-lg ${c.avatarRing}`}
            />
            <div className="mb-1">
              {isOwner ? (
                <Link
                  href="/creator/twin/posts"
                  className="gradient-btn text-white text-sm font-600 px-4 py-2 rounded-full inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> Add post
                </Link>
              ) : subscribed ? (
                <MessageTwinButton twinId={twin.id} />
              ) : (
                <Link
                  href={`/explore/${twin.slug}`}
                  className="gradient-btn text-white text-sm font-600 px-4 py-2 rounded-full inline-flex items-center gap-1.5"
                >
                  Become a member
                </Link>
              )}
            </div>
          </div>

          <h1
            className={`font-display font-800 text-2xl mt-3 mb-1 flex items-center gap-2 ${c.heading}`}
          >
            {twin.name}
            {twin.certified ? <CertifiedBadge size="lg" /> : null}
          </h1>

          <div className="flex items-center gap-2 mb-2">
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
          </div>

          {twin.tagline && <p className={`text-[15px] ${c.body}`}>{twin.tagline}</p>}

          {/* Stats */}
          <div className="flex items-center gap-4 text-[13px] mt-3">
            <span className={c.body}>
              <span className={`font-700 ${c.heading}`}>{postCount}</span> posts
            </span>
            <span className={c.body}>
              <span className={`font-700 ${c.heading}`}>{totalLikes}</span> likes
            </span>
            {twin.total_subscribers > 0 && (
              <span className={c.body}>
                <span className={`font-700 ${c.heading}`}>{twin.total_subscribers}</span> members
              </span>
            )}
          </div>

          <div className="flex justify-start">
            <TwinSocials socials={socials} name={twin.name} socialClass={c.social} />
          </div>

          {bio && (
            <p className={`text-[14px] leading-relaxed whitespace-pre-line mt-4 ${c.body}`}>{bio}</p>
          )}
        </div>

        {/* Owner: manage page + test the twin */}
        {isOwner && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Link
              href="/creator/twin/profile"
              className={`flex items-center justify-center gap-2 text-sm font-600 py-3 rounded-xl ${c.card} ${c.heading}`}
            >
              <Pencil className="w-4 h-4 text-[#A855F7]" aria-hidden="true" /> Edit page
            </Link>
            <Link
              href="/creator/twin/preview"
              className={`flex items-center justify-center gap-2 text-sm font-600 py-3 rounded-xl ${c.card} ${c.heading}`}
            >
              <MessageCircle className="w-4 h-4 text-[#00D4FF]" aria-hidden="true" /> Preview chat
            </Link>
          </div>
        )}

        {/* Non-subscriber subscribe bar */}
        {!subscribed && !isOwner && (
          <Link
            href={`/explore/${twin.slug}`}
            className="w-full gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2 mb-6"
          >
            Become a member — from {formatPrice(cheapest.cents)}/mo
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}

        {/* Tip — extra ARPU lever, open to everyone but the owner */}
        {!isOwner && (
          <div className="mb-6">
            <TipButton
              twinId={twin.id}
              twinName={twin.name}
              isAuthed={!!viewerProfileId}
              theme={{ card: c.card, heading: c.heading, muted: c.muted }}
            />
          </div>
        )}

        {/* Feed */}
        {postCount === 0 ? (
          <div className={`rounded-2xl p-10 text-center ${c.card}`}>
            <Newspaper className={`w-9 h-9 mx-auto mb-3 opacity-40 ${c.muted}`} strokeWidth={1.5} />
            <p className={`text-sm ${c.muted}`}>
              {isOwner ? 'No posts yet — share your first one.' : 'No posts yet.'}
            </p>
          </div>
        ) : (
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
                theme={{ card: c.card, heading: c.heading, body: c.body, muted: c.muted, dark }}
              />
            ))}
          </div>
        )}

        {/* Footer → pitch */}
        <div className={`mt-10 pt-6 border-t text-center ${c.divider}`}>
          <Link href={`/@${twin.slug}`} className={`text-sm font-600 ${c.footerLink}`}>
            About {twin.name} &amp; membership →
          </Link>
        </div>
      </main>
    </div>
  );
}
