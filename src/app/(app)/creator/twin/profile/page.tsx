'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe,
  Loader2,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Copy,
  Camera,
  X,
} from 'lucide-react';
import { PUBLIC_THEMES } from '@/lib/themes';
import { Avatar } from '@/components/ui/Avatar';

interface Socials {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  x?: string | null;
  website?: string | null;
}

interface TwinData {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  niche: string;
  status: string;
  photo_url?: string | null;
  settings: {
    welcome_message?: string;
    public_profile?: { bio?: string | null; socials?: Socials; theme?: string; cover?: string | null };
  };
}

const SOCIAL_FIELDS: { key: keyof Socials; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'yourhandle' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'yourhandle' },
  { key: 'youtube', label: 'YouTube', placeholder: 'yourchannel' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'yourhandle' },
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
];

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-[#0F0F23] placeholder:text-[#94A3B8]/70 focus:outline-none focus:border-[#A855F7]/50 transition-all text-sm';

export default function PublicPageEditorPage() {
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [welcome, setWelcome] = useState('');
  const [socials, setSocials] = useState<Socials>({});
  const [theme, setTheme] = useState('clean');
  const [isLive, setIsLive] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/twin');
      if (res.ok) {
        const data = await res.json();
        const t: TwinData | null = data.twin;
        if (t) {
          setTwin(t);
          setTagline(t.tagline || '');
          setBio(t.settings?.public_profile?.bio || '');
          setWelcome(t.settings?.welcome_message || '');
          setSocials(t.settings?.public_profile?.socials || {});
          setTheme(t.settings?.public_profile?.theme || 'clean');
          setIsLive(t.status === 'active');
          setPhotoUrl(t.photo_url || null);
          setCoverUrl(t.settings?.public_profile?.cover || null);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save(statusOverride?: 'active' | 'draft') {
    if (!twin) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const nextStatus = statusOverride ?? (isLive ? 'active' : 'draft');

    try {
      const res = await fetch('/api/twin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline,
          bio,
          welcomeMessage: welcome,
          socials,
          theme,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        setSaved(true);
        if (statusOverride) setIsLive(statusOverride === 'active');
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.details?.[0]?.message || data.error || 'Save failed — try again.');
      }
    } catch {
      setError('Save failed — check your connection.');
    }
    setSaving(false);
  }

  async function copyLink() {
    if (!twin) return;
    try {
      await navigator.clipboard.writeText(`https://twiinn.ai/@${twin.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function uploadPhoto(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image must be under 2MB.');
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch('/api/twin/photo', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setPhotoUrl(data.url);
      } else {
        setPhotoError(data.error || 'Upload failed — try again.');
      }
    } catch {
      setPhotoError('Upload failed — check your connection.');
    }
    setPhotoBusy(false);
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const res = await fetch('/api/twin/photo', { method: 'DELETE' });
      if (res.ok) setPhotoUrl(null);
    } catch {
      /* ignore */
    }
    setPhotoBusy(false);
  }

  async function uploadCover(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setCoverError('Cover must be under 4MB.');
      return;
    }
    setCoverBusy(true);
    setCoverError(null);
    try {
      const form = new FormData();
      form.append('cover', file);
      const res = await fetch('/api/twin/cover', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setCoverUrl(data.url);
      } else {
        setCoverError(data.error || 'Upload failed — try again.');
      }
    } catch {
      setCoverError('Upload failed — check your connection.');
    }
    setCoverBusy(false);
  }

  async function removeCover() {
    setCoverBusy(true);
    setCoverError(null);
    try {
      const res = await fetch('/api/twin/cover', { method: 'DELETE' });
      if (res.ok) setCoverUrl(null);
    } catch {
      /* ignore */
    }
    setCoverBusy(false);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl animate-pulse space-y-4">
        <div className="h-8 bg-[#F1F5F9] rounded w-1/3" />
        <div className="h-40 bg-[#F1F5F9] rounded-2xl" />
        <div className="h-64 bg-[#F1F5F9] rounded-2xl" />
      </div>
    );
  }

  if (!twin) {
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
        <Globe className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Public page</h1>
      </div>
      <p className="text-sm text-[#94A3B8] mb-8">
        This is what fans see when they tap your link in bio.
      </p>

      {/* Link + publish state */}
      <div className="card rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Link2 className="w-4 h-4 text-[#A855F7] flex-shrink-0" strokeWidth={2} />
            <span className="font-500 text-[15px] text-[#0F0F23] truncate">
              twiinn.ai/<span className="text-[#A855F7]">@{twin.slug}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="text-sm font-600 px-3.5 py-2 rounded-lg border border-black/10 hover:border-black/20 transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </button>
            <a
              href={`/@${twin.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-600 px-3.5 py-2 rounded-lg border border-black/10 hover:border-black/20 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5">
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <Eye className="w-4 h-4 text-[#22C55E]" strokeWidth={2} />
                <span className="text-sm font-600 text-[#16A34A]">Live — fans can see your page</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-[#94A3B8]" strokeWidth={2} />
                <span className="text-sm font-600 text-[#64748B]">
                  Hidden — your page shows 404
                </span>
              </>
            )}
          </div>
          <button
            onClick={() => save(isLive ? 'draft' : 'active')}
            disabled={saving}
            className={`text-sm font-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isLive
                ? 'border border-black/10 text-[#64748B] hover:border-black/20'
                : 'gradient-btn text-white'
            }`}
          >
            {isLive ? 'Unpublish' : 'Publish page'}
          </button>
        </div>
      </div>

      {/* Cover banner */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Cover banner</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          The wide image across the top of your page. JPEG/PNG/WebP, max 4MB.
        </p>
        <div className="relative h-32 rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-[#A855F7] to-[#00D4FF] flex items-center justify-center">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white/80 text-sm font-600">No cover yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="gradient-btn text-white text-sm font-600 px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer">
            {coverBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" aria-hidden="true" />
            )}
            {coverUrl ? 'Change cover' : 'Upload cover'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={coverBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
                e.target.value = '';
              }}
            />
          </label>
          {coverUrl && (
            <button
              onClick={removeCover}
              disabled={coverBusy}
              className="text-sm font-600 px-3.5 py-2.5 rounded-xl border border-black/10 text-[#64748B] hover:border-black/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove
            </button>
          )}
        </div>
        {coverError && <p className="text-sm text-red-600 mt-3">{coverError}</p>}
      </div>

      {/* Photo */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Profile photo</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Shown on your public page, in Explore, and on your share card. JPEG/PNG/WebP, max 2MB.
        </p>
        <div className="flex items-center gap-4">
          <Avatar name={twin.name} src={photoUrl} size="xl" />
          <div className="flex items-center gap-2">
            <label className="gradient-btn text-white text-sm font-600 px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer">
              {photoBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" aria-hidden="true" />
              )}
              {photoUrl ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={photoBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.target.value = '';
                }}
              />
            </label>
            {photoUrl && (
              <button
                onClick={removePhoto}
                disabled={photoBusy}
                className="text-sm font-600 px-3.5 py-2.5 rounded-xl border border-black/10 text-[#64748B] hover:border-black/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove
              </button>
            )}
          </div>
        </div>
        {photoError && <p className="text-sm text-red-600 mt-3">{photoError}</p>}
      </div>

      {/* Profile fields */}
      <div className="card rounded-2xl p-6 mb-6 space-y-5">
        <div>
          <label htmlFor="tagline" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            Tagline
          </label>
          <input
            id="tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={120}
            placeholder="One line that hooks your fans"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder="Tell fans who you are, what you talk about, and what your twin can help them with."
            className={`${inputClass} resize-none`}
          />
          <p className="text-xs text-[#94A3B8] mt-1 text-right">{bio.length}/600</p>
        </div>

        <div>
          <label htmlFor="welcome" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            Welcome message
          </label>
          <textarea
            id="welcome"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="The first message fans see in the chat preview"
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* Background theme */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Background</h2>
        <p className="text-xs text-[#94A3B8] mb-4">Pick the vibe of your public page.</p>
        <div className="grid grid-cols-4 gap-3">
          {Object.values(PUBLIC_THEMES).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              aria-pressed={theme === t.key}
              className={`rounded-xl overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] ${
                theme === t.key
                  ? 'border-[#A855F7] shadow-md'
                  : 'border-black/[0.08] hover:border-black/20'
              }`}
            >
              <div className="h-12 w-full" style={{ background: t.background }} />
              <p
                className={`text-[11px] font-600 py-1.5 ${
                  theme === t.key ? 'text-[#A855F7]' : 'text-[#64748B]'
                }`}
              >
                {t.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Socials */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Your other socials</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Shown on your public page so fans know it&apos;s really you.
        </p>
        <div className="space-y-3">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-sm font-500 text-[#64748B] w-24 flex-shrink-0">{f.label}</span>
              {f.key === 'website' ? (
                <input
                  type="url"
                  value={socials[f.key] || ''}
                  onChange={(e) => setSocials({ ...socials, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
              ) : (
                <div className="flex items-center flex-1">
                  <span className="text-sm text-[#94A3B8] px-3 py-3 bg-[#F8FAFC] border border-r-0 border-black/10 rounded-l-xl">
                    @
                  </span>
                  <input
                    type="text"
                    value={socials[f.key] || ''}
                    onChange={(e) =>
                      setSocials({ ...socials, [f.key]: e.target.value.replace(/^@/, '') })
                    }
                    placeholder={f.placeholder}
                    className={`${inputClass} rounded-l-none`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        onClick={() => save()}
        disabled={saving}
        className="gradient-btn text-white font-600 px-8 py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" /> Saved!
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </div>
  );
}
