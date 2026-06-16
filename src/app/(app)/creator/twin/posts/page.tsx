'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Newspaper,
  Loader2,
  Trash2,
  Lock,
  Globe,
  X,
  ImagePlus,
  Film,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Post {
  id: string;
  body: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video';
  visibility: 'public' | 'subscribers';
  created_at: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-[#0F0F23] placeholder:text-[#94A3B8]/70 focus:outline-none focus:border-[#A855F7]/50 transition-all text-sm';

export default function PostsPage() {
  const [loading, setLoading] = useState(true);
  const [hasTwin, setHasTwin] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  // Composer state
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'subscribers'>('public');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      } else if (res.status === 404) {
        setHasTwin(false);
      }
      // Slug → "View my page" link to the live feed.
      const twinRes = await fetch('/api/twin');
      if (twinRes.ok) {
        const t = await twinRes.json().catch(() => ({}));
        setSlug(t.twin?.slug || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Revoke object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(f: File) {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setError('Attach an image or a video.');
      return;
    }
    if (isImage && f.size > MAX_IMAGE_BYTES) {
      setError('Image must be under 10MB.');
      return;
    }
    if (isVideo && f.size > MAX_VIDEO_BYTES) {
      setError('Video must be under 100MB.');
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function publish() {
    if (!body.trim() && !file) {
      setError('Write something or attach media.');
      return;
    }
    setPublishing(true);
    setError(null);

    try {
      let mediaUrl: string | null = null;
      let mediaType: 'text' | 'image' | 'video' = 'text';

      if (file) {
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';

        // 1) Ask for a signed upload URL (direct-to-storage — bypasses the
        //    ~4.5MB serverless body limit, required for video).
        const urlRes = await fetch('/api/posts/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaType, contentType: file.type }),
        });
        const urlData = await urlRes.json().catch(() => ({}));
        if (!urlRes.ok) {
          throw new Error(urlData.error || 'Could not start upload.');
        }

        // 2) Upload straight to Supabase Storage with the signed token.
        const supabase = createClient();
        const { error: uploadErr } = await supabase.storage
          .from(urlData.bucket)
          .uploadToSignedUrl(urlData.path, urlData.token, file, {
            contentType: file.type,
          });
        if (uploadErr) {
          throw new Error('Upload failed — try again.');
        }
        mediaUrl = urlData.publicUrl;
      }

      // 3) Create the post row.
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim() || null,
          mediaUrl,
          mediaType,
          visibility,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.details?.[0]?.message || data.error || 'Could not publish.');
      }

      setPosts((prev) => [data.post, ...prev]);
      setBody('');
      setVisibility('public');
      clearFile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish.');
    }
    setPublishing(false);
  }

  async function deletePost(id: string) {
    const prev = posts;
    setPosts((p) => p.filter((x) => x.id !== id)); // optimistic
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setPosts(prev); // revert
      setError('Could not delete that post.');
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl animate-pulse space-y-4">
        <div className="h-8 bg-[#F1F5F9] rounded w-1/3" />
        <div className="h-40 bg-[#F1F5F9] rounded-2xl" />
        <div className="h-32 bg-[#F1F5F9] rounded-2xl" />
      </div>
    );
  }

  if (!hasTwin) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#94A3B8] mb-4">You don&apos;t have a twin yet.</p>
        <Link href="/creator/onboarding" className="text-[#A855F7] font-600 hover:underline">
          Create your twin →
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Newspaper className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Posts</h1>
        {slug && (
          <a
            href={`/@${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-600 text-[#A855F7] hover:underline flex items-center gap-1"
          >
            View my page <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="text-sm text-[#94A3B8] mb-8">
        Share updates with your fans. Public posts pull people in; members-only posts give them a
        reason to subscribe. Everything you post shows on your page at{' '}
        <span className="font-600 text-[#64748B]">twiinn.ai/@{slug || 'you'}</span>.
      </p>

      {/* Composer */}
      <div className="card rounded-2xl p-5 mb-8">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="What's on your mind?"
          className={`${inputClass} resize-none mb-3`}
        />

        {/* Media preview */}
        {previewUrl && file && (
          <div className="relative mb-3 rounded-xl overflow-hidden border border-black/10 bg-black/[0.02]">
            {file.type.startsWith('video/') ? (
              <video src={previewUrl} controls className="w-full max-h-80 object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain" />
            )}
            <button
              onClick={clearFile}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
              aria-label="Remove media"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {/* Attach */}
          <label className="text-sm font-600 px-3.5 py-2 rounded-lg border border-black/10 hover:border-[#A855F7]/40 transition-colors flex items-center gap-1.5 cursor-pointer">
            <ImagePlus className="w-4 h-4 text-[#A855F7]" aria-hidden="true" />
            {file ? 'Change media' : 'Photo / video'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="sr-only"
              disabled={publishing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
          </label>

          {/* Visibility toggle */}
          <div className="flex items-center rounded-lg border border-black/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`text-sm font-600 px-3 py-2 flex items-center gap-1.5 transition-colors ${
                visibility === 'public'
                  ? 'bg-[#A855F7]/10 text-[#A855F7]'
                  : 'text-[#94A3B8] hover:text-[#0F0F23]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Public
            </button>
            <button
              type="button"
              onClick={() => setVisibility('subscribers')}
              className={`text-sm font-600 px-3 py-2 flex items-center gap-1.5 transition-colors border-l border-black/10 ${
                visibility === 'subscribers'
                  ? 'bg-[#A855F7]/10 text-[#A855F7]'
                  : 'text-[#94A3B8] hover:text-[#0F0F23]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Members
            </button>
          </div>

          <button
            onClick={publish}
            disabled={publishing}
            className="gradient-btn text-white font-600 px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50 ml-auto"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Publishing…
              </>
            ) : (
              'Publish'
            )}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {/* Existing posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12 text-[#94A3B8]">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
          <p className="text-sm">No posts yet. Your first post will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-600 uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 ${
                    post.visibility === 'subscribers'
                      ? 'bg-[#A855F7]/10 text-[#A855F7]'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  {post.visibility === 'subscribers' ? (
                    <>
                      <Lock className="w-3 h-3" /> Members
                    </>
                  ) : (
                    <>
                      <Globe className="w-3 h-3" /> Public
                    </>
                  )}
                </span>
                <button
                  onClick={() => deletePost(post.id)}
                  className="text-[#94A3B8] hover:text-red-600 transition-colors p-1"
                  aria-label="Delete post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {post.body && (
                <p className="text-[15px] text-[#0F0F23] whitespace-pre-wrap leading-relaxed mb-3">
                  {post.body}
                </p>
              )}

              {post.media_url && post.media_type === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.media_url}
                  alt=""
                  className="w-full rounded-xl border border-black/5"
                />
              )}
              {post.media_url && post.media_type === 'video' && (
                <video
                  src={post.media_url}
                  controls
                  className="w-full rounded-xl border border-black/5"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
