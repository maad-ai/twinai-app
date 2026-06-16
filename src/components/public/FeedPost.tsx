'use client';

import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Lock,
  Film,
  Image as ImageIcon,
  Trash2,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

interface PostData {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video';
  visibility: 'public' | 'subscribers';
  created_at: string;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  profile_id: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

interface ThemeTokens {
  card: string;
  heading: string;
  body: string;
  muted: string;
}

export function FeedPost({
  post,
  locked,
  likeCount,
  likedByMe,
  commentCount,
  lockedTeaserPrice,
  timeLabel,
  twinName,
  slug,
  isAuthed,
  isOwner,
  viewerProfileId,
  theme,
}: {
  post: PostData;
  locked: boolean;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  lockedTeaserPrice: string;
  timeLabel: string;
  twinName: string;
  slug: string;
  isAuthed: boolean;
  isOwner: boolean;
  viewerProfileId: string | null;
  theme: ThemeTokens;
}) {
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [cCount, setCCount] = useState(commentCount);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [shared, setShared] = useState(false);

  function requireAuth(): boolean {
    if (!isAuthed) {
      window.location.href = '/sign-in';
      return false;
    }
    return true;
  }

  async function toggleLike() {
    if (!requireAuth()) return;
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  async function toggleComments() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && comments === null) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/comments`);
        const data = await res.json().catch(() => ({ comments: [] }));
        setComments(data.comments || []);
      } catch {
        setComments([]);
      }
      setLoadingComments(false);
    }
  }

  async function addComment() {
    if (!requireAuth()) return;
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comment) {
        setComments((c) => [...(c || []), data.comment]);
        setCCount((n) => n + 1);
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  async function removeComment(cid: string) {
    setComments((c) => (c || []).filter((x) => x.id !== cid));
    setCCount((n) => Math.max(0, n - 1));
    await fetch(`/api/posts/${post.id}/comments/${cid}`, { method: 'DELETE' }).catch(() => {});
  }

  async function share() {
    const url = `https://twiinn.ai/@${slug}`;
    const title = `${twinName} on Twiinn`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* cancelled — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  }

  // ── Locked (members-only, not subscribed) ────────────────────────
  if (locked) {
    const kind =
      post.media_type === 'video' ? 'video' : post.media_type === 'image' ? 'photo' : 'post';
    const KindIcon =
      post.media_type === 'video' ? Film : post.media_type === 'image' ? ImageIcon : Lock;
    return (
      <div className={`rounded-2xl overflow-hidden ${theme.card}`}>
        <div className="relative h-52 flex flex-col items-center justify-center gap-2 px-6 text-center bg-gradient-to-br from-[#A855F7]/20 to-[#00D4FF]/10">
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-600 text-white bg-black/30 rounded-full px-2 py-1 backdrop-blur-sm">
            <Lock className="w-3 h-3" aria-hidden="true" /> Locked
          </span>
          <div className="w-11 h-11 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-sm">
            <KindIcon className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <p className={`text-sm font-700 ${theme.heading}`}>Close Friends only</p>
          <p className={`text-xs max-w-[16rem] ${theme.muted}`}>
            Members see this {kind} the second it drops — join from {lockedTeaserPrice}/mo and it&apos;s
            yours.
          </p>
        </div>
      </div>
    );
  }

  // ── Unlocked ─────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl overflow-hidden ${theme.card}`}>
      {post.media_url && post.media_type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.media_url} alt="" className="w-full max-h-[28rem] object-cover" />
      )}
      {post.media_url && post.media_type === 'video' && (
        <video src={post.media_url} controls playsInline className="w-full max-h-[28rem] bg-black" />
      )}

      <div className="p-4">
        {post.body && (
          <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${theme.body}`}>
            {post.body}
          </p>
        )}

        <div className={`flex items-center gap-2 text-xs mt-2 ${theme.muted}`}>
          {post.visibility === 'subscribers' && (
            <span className="inline-flex items-center gap-1 text-[#A855F7] font-600">
              <Lock className="w-3 h-3" aria-hidden="true" /> Close Friends
            </span>
          )}
          <span>{timeLabel}</span>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 mt-3 -ml-2">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-600 transition-colors hover:bg-black/[0.04] ${
              liked ? 'text-[#FF4D6D]' : theme.muted
            }`}
            aria-pressed={liked}
            aria-label="Like"
          >
            <Heart className="w-[18px] h-[18px]" fill={liked ? 'currentColor' : 'none'} />
            {count > 0 && <span>{count}</span>}
          </button>

          <button
            onClick={toggleComments}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-600 transition-colors hover:bg-black/[0.04] ${theme.muted}`}
            aria-expanded={open}
            aria-label="Comments"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            {cCount > 0 && <span>{cCount}</span>}
          </button>

          <button
            onClick={share}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-600 transition-colors hover:bg-black/[0.04] ${theme.muted}`}
            aria-label="Share"
          >
            {shared ? (
              <>
                <Check className="w-[18px] h-[18px] text-[#16A34A]" /> <span>Copied</span>
              </>
            ) : (
              <Share2 className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>

        {/* Comments */}
        {open && (
          <div className="mt-3 pt-3 border-t border-black/[0.06] space-y-3">
            {loadingComments ? (
              <div className={`flex items-center gap-2 text-sm ${theme.muted}`}>
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                {(comments || []).length === 0 && (
                  <p className={`text-sm ${theme.muted}`}>Be the first to comment.</p>
                )}
                {(comments || []).map((cm) => {
                  const canDelete = isOwner || cm.profile_id === viewerProfileId;
                  return (
                    <div key={cm.id} className="flex items-start gap-2.5">
                      <Avatar
                        name={cm.profiles?.display_name || 'Fan'}
                        src={cm.profiles?.avatar_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-600 ${theme.heading}`}>
                          {cm.profiles?.display_name || 'Fan'}
                        </p>
                        <p className={`text-[14px] leading-snug ${theme.body}`}>{cm.body}</p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => removeComment(cm.id)}
                          className={`p-1 ${theme.muted} hover:text-[#FF4D6D] transition-colors`}
                          aria-label="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add a comment */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                    maxLength={500}
                    placeholder={isAuthed ? 'Add a comment…' : 'Sign in to comment'}
                    className="flex-1 text-sm px-3 py-2 rounded-full bg-black/[0.04] border border-black/[0.06] focus:outline-none focus:border-[#A855F7]/40 text-[#0F0F23] placeholder:text-[#94A3B8]"
                  />
                  <button
                    onClick={addComment}
                    disabled={posting || !draft.trim()}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-[#A855F7] to-[#00D4FF] flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                    aria-label="Send comment"
                  >
                    {posting ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
