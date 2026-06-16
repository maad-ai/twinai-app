import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTheme } from '@/lib/themes';
import type { PricingTier } from '@/types';

export const TWIN_COLUMNS =
  'id, name, slug, tagline, niche, monthly_price_cents, total_subscribers, total_messages, settings, status, photo_url, creator_id';

/** "Close Friends" membership ladder — default tiers when a twin has none. */
export const DEFAULT_TIERS: PricingTier[] = [
  { cents: 999, credits: 80, name: 'On the List' },
  { cents: 1999, credits: 150, name: 'Close Friends' },
  { cents: 4999, credits: 400, name: 'Front Row' },
];

export interface Socials {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  x?: string | null;
  website?: string | null;
}

export interface PublicTwin {
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

export interface Post {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video';
  visibility: 'public' | 'subscribers';
  created_at: string;
}

export interface PostWithSocial extends Post {
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

/** Fetch a public (active/training) twin by slug. Never 500s. */
export async function getTwin(slug: string): Promise<PublicTwin | null> {
  const supabase = createAdminClient();
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

/** Parse a `/@handle` segment → lowercase slug, or null if malformed. */
export function parseHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith('@')) return null;
  const slug = decoded.slice(1).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}

/** Validate a bare `/c/[slug]` segment. */
export function parseSlug(raw: string): string | null {
  const slug = decodeURIComponent(raw).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}

/** Compact relative time, e.g. "3d", "5h", "just now". */
export function timeAgo(iso: string): string {
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

/**
 * A twin's posts (newest first) with like/comment aggregates.
 * Degrades to [] / zeros if the posts/social tables aren't there yet
 * (migrations 007 / 008).
 */
export async function getPostsWithSocial(
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
export async function getViewerProfileId(): Promise<string | null> {
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
export async function isActiveSubscriber(profileId: string, twinId: string): Promise<boolean> {
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

export interface ThemeTokens {
  heading: string;
  body: string;
  muted: string;
  card: string;
  pill: string;
  accentPill: string;
  bubble: string;
  chip: string;
  social: string;
  footerLink: string;
  divider: string;
  avatarRing: string;
}

/** Resolve the creator-selected background + light/dark token set for a page. */
export function getPublicTheme(themeKey?: string): {
  background: string;
  dark: boolean;
  c: ThemeTokens;
} {
  const theme = getTheme(themeKey);
  const c: ThemeTokens = theme.dark
    ? {
        heading: 'text-white',
        body: 'text-[#CBD5E1]',
        muted: 'text-[#94A3B8]',
        card: 'bg-white/[0.06] border border-white/10',
        pill: 'bg-white/10 text-[#CBD5E1]',
        accentPill: 'bg-white/10 text-[#C4B5FD]',
        bubble: 'bg-white/10 text-white/90',
        chip: 'text-[#C4B5FD] bg-white/[0.06] border border-white/10',
        social:
          'bg-white/10 border border-white/10 text-[#CBD5E1] hover:text-white hover:border-white/30',
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
        social:
          'bg-white border border-black/[0.08] shadow-sm text-[#475569] hover:text-[#A855F7] hover:border-[#A855F7]/30',
        footerLink: 'text-[#64748B] hover:text-[#0F0F23]',
        divider: 'border-black/[0.06]',
        avatarRing: 'ring-white',
      };
  return { background: theme.background, dark: theme.dark, c };
}
