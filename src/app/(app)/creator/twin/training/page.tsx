'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Link2, Loader2, Check, Trash2, AlertCircle } from 'lucide-react';

type ContentItem = {
  id: string;
  source_type: string;
  raw_text?: string;
  source_url?: string;
  status: string;
  created_at: string;
};

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<'text' | 'url'>('text');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

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

    const body = activeTab === 'text'
      ? { sourceType: 'text', rawText: textContent }
      : { sourceType: 'youtube', sourceUrl: urlContent };

    try {
      const res = await fetch('/api/twin/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setTextContent('');
        setUrlContent('');
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'embedded': return <Check className="w-4 h-4 text-[#22C55E]" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-[#A855F7] animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />;
      default: return <Loader2 className="w-4 h-4 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="font-display font-800 text-2xl text-[#0F0F23] mb-2">
        Train Your Twin
      </h1>
      <p className="text-[#94A3B8] mb-8">
        Add content to make your twin smarter. The more content, the better it mimics you.
      </p>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-500 transition-all ${
            activeTab === 'text'
              ? 'bg-[#A855F7]/10 text-[#A855F7]'
              : 'text-[#94A3B8] hover:bg-[#F1F5F9]'
          }`}
        >
          <FileText className="w-4 h-4" /> Paste Text
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-500 transition-all ${
            activeTab === 'url'
              ? 'bg-[#A855F7]/10 text-[#A855F7]'
              : 'text-[#94A3B8] hover:bg-[#F1F5F9]'
          }`}
        >
          <Link2 className="w-4 h-4" /> Add URL
        </button>
      </div>

      {/* Input area */}
      <div className="card rounded-2xl p-6 mb-6">
        {activeTab === 'text' ? (
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
        ) : (
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
              We pull the transcript automatically — works with any public video that has
              captions. TikTok/Instagram coming next.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-[#FF6B6B] mt-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || (activeTab === 'text' ? !textContent.trim() : !urlContent.trim())}
          className="w-full gradient-btn text-white font-600 py-3 rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <><Upload className="w-4 h-4" /> Add Content</>
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
                      {item.status}
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
