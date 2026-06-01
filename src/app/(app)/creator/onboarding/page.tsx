'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Sparkles, Check } from 'lucide-react';

const NICHES = [
  'Fitness', 'Finance', 'Beauty', 'Gaming', 'Cooking',
  'Tech', 'Lifestyle', 'Music', 'Education', 'Comedy',
  'Fashion', 'Travel', 'Health', 'Business', 'Art',
];

const PRICE_TIERS = [
  { cents: 999, label: '$9.99/mo', desc: '100 messages included', credits: 100 },
  { cents: 1999, label: '$19.99/mo', desc: '300 messages included', credits: 300, popular: true },
  { cents: 4999, label: '$49.99/mo', desc: 'Unlimited messages', credits: 9999 },
];

type PersonalitySlider = {
  key: string;
  label: string;
  left: string;
  right: string;
  value: number;
};

const DEFAULT_SLIDERS: PersonalitySlider[] = [
  { key: 'tone', label: 'Tone', left: 'Formal', right: 'Casual', value: 70 },
  { key: 'humor', label: 'Humor', left: 'Serious', right: 'Funny', value: 50 },
  { key: 'length', label: 'Response Length', left: 'Short', right: 'Detailed', value: 60 },
  { key: 'emojis', label: 'Emojis', left: 'Never', right: 'A lot', value: 30 },
  { key: 'energy', label: 'Energy', left: 'Chill', right: 'Hype', value: 50 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [niche, setNiche] = useState('');

  // Step 2: Personality
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [blockedTopics, setBlockedTopics] = useState('');

  // Step 3: Pricing
  const [selectedPrice, setSelectedPrice] = useState(1); // index

  function updateSlider(key: string, value: number) {
    setSliders((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
  }

  async function handleFinish() {
    setLoading(true);

    const personality = Object.fromEntries(
      sliders.map((s) => [s.key, s.value])
    );

    const tier = PRICE_TIERS[selectedPrice];

    try {
      const res = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline,
          niche,
          personality,
          blockedTopics: blockedTopics
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          monthlyPriceCents: tier.cents,
          creditsPerMonth: tier.credits,
        }),
      });

      if (res.ok) {
        router.push('/creator');
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0F0F23] px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-gradient-to-r from-[#FF6B6B] to-[#A855F7]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="animate-[fadeSlideIn_0.3s_ease]">
            <h1 className="font-display font-800 text-3xl text-white mb-2">
              Create your <span className="gradient-text">Twin</span>
            </h1>
            <p className="text-[#94A3B8] mb-8">
              Tell us about yourself. This is what fans will see.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-500 text-white mb-2">Twin Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Coach Mike, Sarah Glow"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-500 text-white mb-2">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Fitness coach helping you get shredded"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-500 text-white mb-3">Your Niche</label>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      onClick={() => setNiche(n)}
                      className={`px-4 py-2 rounded-full text-sm font-500 border transition-all ${
                        niche === n
                          ? 'bg-[#A855F7] border-[#A855F7] text-white'
                          : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name || !niche}
              className="w-full gradient-btn text-white font-600 py-3.5 rounded-xl mt-8 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Personality */}
        {step === 2 && (
          <div className="animate-[fadeSlideIn_0.3s_ease]">
            <h1 className="font-display font-800 text-3xl text-white mb-2">
              Set your <span className="gradient-text">personality</span>
            </h1>
            <p className="text-[#94A3B8] mb-8">
              How should your twin talk? Adjust the sliders to match your vibe.
            </p>

            <div className="space-y-6">
              {sliders.map((slider) => (
                <div key={slider.key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">{slider.left}</span>
                    <span className="text-white font-500">{slider.label}</span>
                    <span className="text-white/60">{slider.right}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={slider.value}
                    onChange={(e) => updateSlider(slider.key, Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #A855F7 ${slider.value}%, rgba(255,255,255,0.1) ${slider.value}%)`,
                    }}
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-500 text-white mb-2">
                  Topics to avoid <span className="text-white/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={blockedTopics}
                  onChange={(e) => setBlockedTopics(e.target.value)}
                  placeholder="e.g. politics, religion, personal life"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 rounded-xl border border-white/10 text-white font-500 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div className="animate-[fadeSlideIn_0.3s_ease]">
            <h1 className="font-display font-800 text-3xl text-white mb-2">
              Set your <span className="gradient-text">price</span>
            </h1>
            <p className="text-[#94A3B8] mb-8">
              Choose how much fans pay monthly to chat with your twin. You keep 85-90%.
            </p>

            <div className="space-y-3">
              {PRICE_TIERS.map((tier, i) => (
                <button
                  key={tier.cents}
                  onClick={() => setSelectedPrice(i)}
                  className={`w-full p-5 rounded-xl border text-left transition-all relative ${
                    selectedPrice === i
                      ? 'border-[#A855F7] bg-[#A855F7]/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {tier.popular && (
                    <span className="absolute -top-2.5 right-4 text-[10px] font-700 uppercase tracking-wider bg-[#A855F7] text-white px-3 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-700 text-xl text-white">{tier.label}</p>
                      <p className="text-sm text-[#94A3B8] mt-0.5">{tier.desc}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedPrice === i
                          ? 'border-[#A855F7] bg-[#A855F7]'
                          : 'border-white/20'
                      }`}
                    >
                      {selectedPrice === i && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <p className="text-xs text-[#84FF57] mt-2 font-500">
                    You earn ~${((tier.cents * 0.85) / 100).toFixed(2)}/subscriber
                  </p>
                </button>
              ))}
            </div>

            <p className="text-xs text-[#94A3B8] text-center mt-4">
              You can change your price anytime. Fans can also buy extra message packs.
            </p>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3.5 rounded-xl border border-white/10 text-white font-500 hover:bg-white/5 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  'Creating...'
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Launch My Twin
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
