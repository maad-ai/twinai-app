'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Fingerprint, Loader2, Check, X, Plus, MessageCircle } from 'lucide-react';

interface VoiceExample {
  q: string;
  a: string;
}

interface Identity {
  audience_nickname?: string | null;
  greeting?: string | null;
  catchphrases?: string[];
  opinions?: string[];
  never_say?: string[];
  backstory?: string | null;
  voice_examples?: VoiceExample[];
}

interface TwinData {
  id: string;
  name: string;
  settings: { identity?: Identity };
}

const inputClass =
  'w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-[#0F0F23] text-sm placeholder:text-[#94A3B8]/70 focus:outline-none focus:border-[#A855F7]/50 transition-all';

/** Simple chip-list editor (add with Enter, remove with ×). */
function ChipList({
  label,
  hint,
  items,
  setItems,
  placeholder,
  max,
}: {
  label: string;
  hint: string;
  items: string[];
  setItems: (v: string[]) => void;
  placeholder: string;
  max: number;
}) {
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim();
    if (!v || items.length >= max || items.includes(v)) return;
    setItems([...items, v]);
    setInput('');
  }

  return (
    <div className="card rounded-2xl p-6 mb-6">
      <h2 className="font-display font-700 text-[#0F0F23] mb-1">{label}</h2>
      <p className="text-xs text-[#94A3B8] mb-4">
        {hint} ({items.length}/{max})
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          maxLength={200}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          onClick={add}
          aria-label={`Add to ${label}`}
          className="gradient-btn text-white px-4 rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 text-sm font-500 text-[#0F0F23] bg-[#F8FAFC] border border-black/[0.08] rounded-full pl-3 pr-1.5 py-1"
            >
              <span className="max-w-[280px] truncate">{t}</span>
              <button
                onClick={() => setItems(items.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="w-5 h-5 rounded-full bg-black/[0.06] hover:bg-black/[0.12] flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TwinIdentityPage() {
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [greeting, setGreeting] = useState('');
  const [catchphrases, setCatchphrases] = useState<string[]>([]);
  const [opinions, setOpinions] = useState<string[]>([]);
  const [neverSay, setNeverSay] = useState<string[]>([]);
  const [backstory, setBackstory] = useState('');
  const [examples, setExamples] = useState<VoiceExample[]>([{ q: '', a: '' }]);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/twin');
      if (res.ok) {
        const data = await res.json();
        const t: TwinData | null = data.twin;
        if (t) {
          setTwin(t);
          const id = t.settings?.identity || {};
          setNickname(id.audience_nickname || '');
          setGreeting(id.greeting || '');
          setCatchphrases(id.catchphrases || []);
          setOpinions(id.opinions || []);
          setNeverSay(id.never_say || []);
          setBackstory(id.backstory || '');
          setExamples(id.voice_examples?.length ? id.voice_examples : [{ q: '', a: '' }]);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const voiceExamples = examples.filter((e) => e.q.trim().length >= 3 && e.a.trim().length >= 3);

    try {
      const res = await fetch('/api/twin/identity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceNickname: nickname,
          greeting,
          catchphrases,
          opinions,
          neverSay,
          backstory,
          voiceExamples,
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
        <div className="h-48 bg-[#F1F5F9] rounded-2xl" />
        <div className="h-48 bg-[#F1F5F9] rounded-2xl" />
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
        <Fingerprint className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Make it sound like you</h1>
      </div>
      <p className="text-sm text-[#94A3B8] mb-8">
        No tech skills needed — just answer like you&apos;re telling a friend. Every answer makes{' '}
        {twin.name} more <em>you</em>.
      </p>

      {/* Basics */}
      <div className="card rounded-2xl p-6 mb-6 space-y-5">
        <div>
          <label htmlFor="nickname" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            What do you call your fans?
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={40}
            placeholder='e.g. "team", "fam", "les boys"'
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="greeting" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            How do you usually say hi?
          </label>
          <input
            id="greeting"
            type="text"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={200}
            placeholder='e.g. "Yo yo! What&apos;s good?"'
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="backstory" className="block text-sm font-600 text-[#0F0F23] mb-1.5">
            Your story, in your own words
          </label>
          <textarea
            id="backstory"
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            maxLength={1200}
            rows={4}
            placeholder="Where you come from, how you got here, what you stand for…"
            className={`${inputClass} resize-none`}
          />
          <p className="text-xs text-[#94A3B8] mt-1 text-right">{backstory.length}/1200</p>
        </div>
      </div>

      <ChipList
        label="Your signature phrases"
        hint="Things you actually say all the time — your twin will sprinkle them in naturally."
        items={catchphrases}
        setItems={setCatchphrases}
        placeholder='e.g. "Let&apos;s get it!", "Trust the process"'
        max={8}
      />

      <ChipList
        label="Strong opinions you're known for"
        hint="The takes your audience expects from you."
        items={opinions}
        setItems={setOpinions}
        placeholder='e.g. "Cardio is overrated for fat loss"'
        max={6}
      />

      <ChipList
        label="Things you'd never say"
        hint="Words, vibes or claims that are NOT you."
        items={neverSay}
        setItems={setNeverSay}
        placeholder='e.g. "guaranteed results", corporate buzzwords'
        max={8}
      />

      {/* Voice examples — the most powerful part */}
      <div className="card rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-[#A855F7]" strokeWidth={2} aria-hidden="true" />
          <h2 className="font-display font-700 text-[#0F0F23]">Answer like you would</h2>
        </div>
        <p className="text-xs text-[#94A3B8] mb-4">
          The single most powerful step: write a real fan question and YOUR exact answer — your
          twin copies this style. ({examples.length}/5)
        </p>
        <div className="space-y-4">
          {examples.map((ex, i) => (
            <div key={i} className="bg-[#F8FAFC] rounded-xl p-4 space-y-2 relative">
              {examples.length > 1 && (
                <button
                  onClick={() => setExamples(examples.filter((_, j) => j !== i))}
                  aria-label="Remove example"
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/[0.06] hover:bg-black/[0.12] flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              )}
              <div>
                <label className="block text-xs font-600 text-[#64748B] mb-1">A fan asks…</label>
                <input
                  type="text"
                  value={ex.q}
                  maxLength={300}
                  onChange={(e) =>
                    setExamples(examples.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                  }
                  placeholder='e.g. "How do I stay motivated when I see no results?"'
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-[#64748B] mb-1">
                  You&apos;d answer… (your exact words)
                </label>
                <textarea
                  value={ex.a}
                  maxLength={600}
                  rows={3}
                  onChange={(e) =>
                    setExamples(examples.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                  }
                  placeholder="Write it exactly how you'd type it in your DMs."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          ))}
        </div>
        {examples.length < 5 && (
          <button
            onClick={() => setExamples([...examples, { q: '', a: '' }])}
            className="mt-3 text-sm font-600 text-[#A855F7] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add another example
          </button>
        )}
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
            <Check className="w-4 h-4" /> Saved — your twin just got more you!
          </>
        ) : (
          'Save my identity'
        )}
      </button>
    </div>
  );
}
