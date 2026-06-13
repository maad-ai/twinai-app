'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Video, Loader2, Check, Trash2, AlertCircle, AtSign } from 'lucide-react';

type ContentItem = {
  id: string;
  source_type: string;
  raw_text?: string;
  source_url?: string;
  status: string;
  created_at: string;
};

type Tab = 'text' | 'youtube' | 'social';

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [platform, setPlatform] = useState<'tiktok' | 'instagram'>('tiktok');
  const [handle, setHandle] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchItems();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-poll while anything is still processing (social imports resolve
  // server-side on each GET).
  useEffect(() => {
    const anyProcessing = items.some((i) => i.status === 'processing');
    if (anyProcessing && !pollRef.current) {
      pollRef.current = setInterval(fetchItems, 5000);
    } else if (!anyProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [items]);

  async function fetchItems() {
    try {
      const res = await fetch('/api/twin/train');
      if (res.ok) {
        const data = await res.json();
        setItems(data.content || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    let endpoint = '/api/twin/train';
    let body: Record<string, unknown>;
    if (activeTab === 'text') {
      body = { sourceType: 'text', rawText: textContent };
    } else if (activeTab === 'youtube') {
      body = { sourceType: 'youtube', sourceUrl: urlContent };
    } else {
      endpoint = '/api/twin/connect-social';
      body = { platform, handle };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setTextContent('');
        setUrlContent('');
        setHandle('');
        setConsent(false);
        fetchItems();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add content');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/twin/train?id=${id}`, { method: 'DELETE' });
    fetchItems();
  }

  const submitDisabled =
    loading ||
    (activeTab === 'text'
      ? !textContent.trim()
      : activeTab === 'youtube'
        ? !urlContent.trim()
        : !handle.trim() || !consent);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'embedded': return <Check className="w-4 h-4 text-[#22C55E]" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-[#A855F7] animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />;
      default: return <Loader2 className="w-4 h-4 text-[#94A3B8]" />;
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'text', label: 'Paste Text', icon: FileText },
    { key: 'youtube', label: 'YouTube', icon: Video },
    { key: 'social', label: 'TikTok / Instagram', icon: AtSign },
  ];

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="font-display font-800 text-2xl text-[#0F0F23] mb-2">
        Train Your Twin
      </h1>
      <p className="text-[#94A3B8] mb-8">
        Add content to make your twin smarter. The more content, the better it mimics you.
      </p>

      {/* Tab selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-500 transition-all ${
              activeTab === t.key
                ? 'bg-[#A855F7]/10 text-[#A855F7]'
                : 'text-[#94A3B8] hover:bg-[#F1F5F9]'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="card rounded-2xl p-6 mb-6">
        {activeTab === 'text' && (
          <div>
            <label className="block text-sm font-500 text-[#0F0F23] mb-2">
              Paste your content
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste blog posts, social media captions, FAQ answers, advice you give often, your bio, or anything that represents how you think and talk..."
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-black/5 text-[#0F0F23] placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-[#A855F7]/40 transition-all resize-none text-sm"
            />
            <p className="text-xs text-[#94A3B8] mt-2">
              {textContent.length} characters
              {textContent.length > 0 && ` — ~${Math.ceil(textContent.length / 4)} tokens`}
            </p>
          </div>
        )}

        {activeTab === 'youtube' && (
          <div>
            <label className="block text-sm font-500 text-[#0F0F23] mb-2">
              YouTube video URL
            </label>
            <input
              type="url"
              value={urlContent}
              onChange={(e) => setUrlContent(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-black/5 text-[#0F0F23] placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-[#A855F7]/40 transition-all text-sm"
            />
            <p className="text-xs text-[#94A3B8] mt-2">
              We pull the transcript automatically — works with any public video that has captions.
            </p>
          </div>
        )}

        {activeTab === 'social' && (
          <div>
            <label className="block text-sm font-500 text-[#0F0F23] mb-2">
              Import from your social account
            </label>
            {/* Platform toggle */}
            <div className="flex gap-2 mb-3">
              {(['tiktok', 'instagram'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`text-sm font-600 px-4 py-2 rounded-full border transition-colors capitalize ${
                    platform === p
                      ? 'bg-[#A855F7] border-[#A855F7] text-white'
                      : 'bg-white border-black/10 text-[#475569] hover:border-[#A855F7]/40'
                  }`}
                >
                  {p === 'tiktok' ? 'TikTok' : 'Instagram'}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-xl bg-[#F8FAFC] border border-black/5 focus-within:border-[#A855F7]/40 transition-all">
              <span className="pl-4 text-[#94A3B8]">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))}
                placeholder="yourhandle"
                className="flex-1 px-2 py-3 bg-transparent text-[#0F0F23] placeholder:text-[#94A3B8]/60 focus:outline-none text-sm"
              />
            </div>
            <p className="text-xs text-[#94A3B8] mt-2">
              We import the captions from your latest public posts to learn your voice. Takes a
              minute or two.
            </p>
            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 accent-[#A855F7]"
              />
              <span className="text-xs text-[#64748B]">
                This is my own account and I have the right to train my twin on this content.
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-[#FF6B6B] mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full gradient-btn text-white font-600 py-3 rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {activeTab === 'social' ? 'Starting import...' : 'Processing...'}</>
          ) : (
            <><Upload className="w-4 h-4" /> {activeTab === 'social' ? 'Import my posts' : 'Add Content'}</>
          )}
        </button>
      </div>

      {/* Content list */}
      <div>
        <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-4">
          Training Content ({items.length})
        </h2>

        {loadingItems ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-[#F1F5F9] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card rounded-xl p-8 text-center">
            <FileText className="w-8 h-8 text-[#94A3B8]/40 mx-auto mb-3" />
            <p className="text-[#94A3B8] text-sm">No training content yet. Add some above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card rounded-xl p-4 flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-600 uppercase tracking-wider text-[#94A3B8]">
                      {item.source_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'embedded' ? 'bg-[#84FF57]/20 text-[#22C55E]' :
                      item.status === 'error' ? 'bg-[#FF6B6B]/20 text-[#FF6B6B]' :
                      'bg-[#A855F7]/10 text-[#A855F7]'
                    }`}>
                      {item.status === 'processing' ? 'importing…' : item.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#0F0F23] truncate">
                    {item.raw_text
                      ? item.raw_text.substring(0, 120) + (item.raw_text.length > 120 ? '...' : '')
                      : item.source_url || 'Content'}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-[#94A3B8] hover:text-[#FF6B6B] transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
