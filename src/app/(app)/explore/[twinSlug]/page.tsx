'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MessageCircle, Users, Sparkles, Check } from 'lucide-react';
import type { Twin } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { formatPrice } from '@/lib/format';

const DEFAULT_TIERS = [
  { cents: 999, credits: 100, name: 'Basic' },
  { cents: 1999, credits: 300, name: 'Standard' },
  { cents: 4999, credits: 800, name: 'Premium' },
];

export default function TwinProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [twin, setTwin] = useState<Twin | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedTier, setSelectedTier] = useState(1); // default: Standard

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/explore/${params.twinSlug}`);
      if (res.ok) {
        const data = await res.json();
        setTwin(data.twin);
      }
      setLoading(false);
    }
    load();
  }, [params.twinSlug]);

  const tiers = twin?.settings?.pricing_tiers || DEFAULT_TIERS;

  async function handleSubscribe() {
    if (!twin) return;
    setStarting(true);

    const tier = tiers[selectedTier];

    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twinId: twin.id,
          priceCents: tier.cents,
          credits: tier.credits,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'Already subscribed') {
        // Go to chat
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twinId: twin.id, message: 'Hey!' }),
        });
        if (chatRes.ok) {
          const convRes = await fetch('/api/chat');
          if (convRes.ok) {
            const convData = await convRes.json();
            const conv = convData.conversations?.find((c: { twin_id: string }) => c.twin_id === twin.id);
            if (conv) {
              router.push(`/chat/${conv.id}`);
              return;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    setStarting(false);
  }

  if (loading) {
    return (
      <div className="p-8 max-w-lg mx-auto animate-pulse">
        <div className="w-20 h-20 rounded-full bg-[#F1F5F9] mx-auto mb-4" />
        <div className="h-6 bg-[#F1F5F9] rounded w-1/2 mx-auto mb-2" />
        <div className="h-4 bg-[#F1F5F9] rounded w-3/4 mx-auto" />
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#94A3B8]">Twin not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      {/* Profile header */}
      <div className="text-center mb-8">
        <Avatar name={twin.name} size="xl" className="mx-auto mb-4" />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23] mb-1">{twin.name}</h1>
        <p className="text-sm text-[#A855F7] font-500 mb-2">{twin.niche}</p>
        {twin.tagline && (
          <p className="text-[#94A3B8] text-sm max-w-xs mx-auto">{twin.tagline}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="card rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-[#00D4FF] mx-auto mb-1" strokeWidth={1.8} />
          <p className="font-display font-700 text-lg text-[#0F0F23]">{twin.total_subscribers}</p>
          <p className="text-xs text-[#94A3B8]">Subscribers</p>
        </div>
        <div className="card rounded-xl p-4 text-center">
          <MessageCircle className="w-5 h-5 text-[#FF6B6B] mx-auto mb-1" strokeWidth={1.8} />
          <p className="font-display font-700 text-lg text-[#0F0F23]">{twin.total_messages}</p>
          <p className="text-xs text-[#94A3B8]">Messages</p>
        </div>
      </div>

      {/* Pricing tiers */}
      <div className="mb-6">
        <p className="text-sm font-600 text-[#0F0F23] mb-3 text-center">Choose your plan</p>
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <button
              key={i}
              onClick={() => setSelectedTier(i)}
              className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                selectedTier === i
                  ? 'border-[#A855F7] bg-[#A855F7]/5'
                  : 'border-black/5 hover:border-black/10'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-700 uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    i === 0 ? 'bg-[#00D4FF]/10 text-[#00D4FF]' :
                    i === 1 ? 'bg-[#A855F7]/10 text-[#A855F7]' :
                    'bg-[#FF6B6B]/10 text-[#FF6B6B]'
                  }`}>
                    {tier.name}
                  </span>
                  {i === 1 && (
                    <span className="text-[10px] font-600 text-[#A855F7] uppercase">Popular</span>
                  )}
                </div>
                <p className="text-sm text-[#94A3B8] mt-1">{tier.credits} messages/month</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-800 text-xl text-[#0F0F23]">
                  {formatPrice(tier.cents)}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedTier === i ? 'border-[#A855F7] bg-[#A855F7]' : 'border-black/10'
                }`}>
                  {selectedTier === i && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Subscribe button */}
      <button
        onClick={handleSubscribe}
        disabled={starting}
        className="w-full gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {starting ? (
          'Redirecting to checkout...'
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Subscribe — {formatPrice(tiers[selectedTier].cents)}/mo
          </>
        )}
      </button>

      <p className="text-xs text-[#94A3B8] text-center mt-3">
        Cancel anytime. Extra message packs available.
      </p>
    </div>
  );
}
