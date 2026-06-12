'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sliders, Loader2, Check, X, Plus } from 'lucide-react';

interface PricingTier {
  cents: number;
  credits: number;
  name: string;
}

interface TwinData {
  id: string;
  name: string;
  personality: Record<string, number> | null;
  monthly_price_cents: number;
  settings: {
    blocked_topics?: string[];
    language?: string;
    pricing_tiers?: PricingTier[];
  };
}

const SLIDERS: { key: string; label: string; low: string; high: string }[] = [
  { key: 'tone', label: 'Tone', low: 'Formal', high: 'Casual' },
  { key: 'humor', label: 'Humor', low: 'Serious', high: 'Playful' },
  { key: 'length', label: 'Response length', low: 'Brief', high: 'Detailed' },
  { key: 'emojis', label: 'Emojis', low: 'Never', high: 'Lots' },
  { key: 'energy', label: 'Energy', low: 'Calm', high: 'Hype' },
];

const LANGUAGES = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'Français' },
  { key: 'es', label: 'Español' },
];

const DEFAULT_TIERS: PricingTier[] = [
  { cents: 999, credits: 100, name: 'Basic' },
  { cents: 1999, credits: 300, name: 'Standard' },
  { cents: 4999, credits: 800, name: 'Premium' },
];

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-white border border-black/10 text-[#0F0F23] text-sm placeholder:text-[#94A3B8]/70 focus:outline-none focus:border-[#A855F7]/50 transition-all';

export default function TwinSettingsPage() {
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personality, setPersonality] = useState<Record<string, number>>({});
  const [language, setLanguage] = useState('en');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [tiers, setTiers] = useState<PricingTier[]>(DEFAULT_TIERS);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/twin');
      if (res.ok) {
        const data = await res.json();
        const t: TwinData | null = data.twin;
        if (t) {
          setTwin(t);
          setPersonality({
            tone: 50,
            humor: 50,
            length: 50,
            emojis: 30,
            energy: 50,
            ...(t.personality || {}),
          });
          setLanguage(t.settings?.language || 'en');
          setTopics(t.settings?.blocked_topics || []);
          setTiers(t.settings?.pricing_tiers || DEFAULT_TIERS);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  function addTopic() {
    const v = topicInput.trim();
    if (!v || topics.length >= 20 || topics.includes(v)) return;
    setTopics([...topics, v]);
    setTopicInput('');
  }

  function updateTier(i: number, patch: Partial<PricingTier>) {
    setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    // Client-side sanity on tiers before hitting the API
    for (const t of tiers) {
      if (t.cents < 299 || t.cents > 99999) {
        setError('Tier prices must be between $2.99 and $999.99.');
        setSaving(false);
        return;
      }
      if (t.credits < 10 || t.credits > 5000) {
        setError('Messages per month must be between 10 and 5,000.');
        setSaving(false);
        return;
      }
      if (!t.name.trim()) {
        setError('Every tier needs a name.');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/twin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality,
          blockedTopics: topics,
          language,
          monthlyPriceCents: tiers[1]?.cents ?? tiers[0]?.cents,
          pricingTiers: tiers,
        }),
      });
      if (res.ok) {
        setSaved(true);
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

  if (loading) {
    return (
      <div className="p-8 max-w-2xl animate-pulse space-y-4">
        <div className="h-8 bg-[#F1F5F9] rounded w-1/3" />
        <div className="h-64 bg-[#F1F5F9] rounded-2xl" />
        <div className="h-40 bg-[#F1F5F9] rounded-2xl" />
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
        <Sliders className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Behavior &amp; pricing</h1>
      </div>
      <p className="text-sm text-[#94A3B8] mb-8">
        Tune how {twin.name} talks and what fans pay. Changes apply to the next message.
      </p>

      {/* Personality */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-5">Personality</h2>
        <div className="space-y-5">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={`slider-${s.key}`} className="text-sm font-600 text-[#0F0F23]">
                  {s.label}
                </label>
                <span className="text-xs font-600 text-[#A855F7]">
                  {personality[s.key] ?? 50}
                </span>
              </div>
              <input
                id={`slider-${s.key}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={personality[s.key] ?? 50}
                onChange={(e) =>
                  setPersonality({ ...personality, [s.key]: parseInt(e.target.value, 10) })
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-black/[0.08] accent-[#A855F7]"
              />
              <div className="flex justify-between text-xs text-[#94A3B8] mt-1">
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Bot language</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Your twin always answers in this language.
        </p>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.key}
              onClick={() => setLanguage(l.key)}
              aria-pressed={language === l.key}
              className={`text-sm font-600 px-4 py-2 rounded-full border transition-colors ${
                language === l.key
                  ? 'bg-[#A855F7] border-[#A855F7] text-white'
                  : 'bg-white border-black/10 text-[#475569] hover:border-[#A855F7]/40'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blocked topics */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Blocked topics</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Your twin will refuse to discuss these. ({topics.length}/20)
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTopic();
              }
            }}
            maxLength={60}
            placeholder="e.g. politics, my family, medical advice"
            className={inputClass}
          />
          <button
            onClick={addTopic}
            aria-label="Add blocked topic"
            className="gradient-btn text-white px-4 rounded-xl flex items-center justify-center flex-shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-sm font-500 text-[#0F0F23] bg-[#F8FAFC] border border-black/[0.08] rounded-full pl-3 pr-1.5 py-1"
              >
                {t}
                <button
                  onClick={() => setTopics(topics.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                  className="w-5 h-5 rounded-full bg-black/[0.06] hover:bg-black/[0.12] flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-[#0F0F23] mb-1">Pricing</h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Each plan includes a monthly message quota — fans can top up with credit packs.
        </p>
        <div className="space-y-3">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px] gap-2 items-center"
            >
              <div>
                <label className="sr-only" htmlFor={`tier-name-${i}`}>Tier name</label>
                <input
                  id={`tier-name-${i}`}
                  type="text"
                  value={tier.name}
                  maxLength={20}
                  onChange={(e) => updateTier(i, { name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <label className="sr-only" htmlFor={`tier-price-${i}`}>Price (USD/month)</label>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                <input
                  id={`tier-price-${i}`}
                  type="number"
                  min={2.99}
                  max={999.99}
                  step={1}
                  value={(tier.cents / 100).toFixed(2)}
                  onChange={(e) =>
                    updateTier(i, { cents: Math.round(parseFloat(e.target.value || '0') * 100) })
                  }
                  className={`${inputClass} pl-7`}
                />
              </div>
              <div className="relative">
                <label className="sr-only" htmlFor={`tier-credits-${i}`}>Messages per month</label>
                <input
                  id={`tier-credits-${i}`}
                  type="number"
                  min={10}
                  max={5000}
                  step={10}
                  value={tier.credits}
                  onChange={(e) =>
                    updateTier(i, { credits: parseInt(e.target.value || '0', 10) })
                  }
                  className={inputClass}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#94A3B8] pointer-events-none">
                  msgs/mo
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#94A3B8] mt-3">
          You keep 85% of every subscription. The middle tier is shown as your headline price.
        </p>
      </div>

      {/* Save */}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        onClick={save}
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
