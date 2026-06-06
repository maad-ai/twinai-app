'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MessageCircle, Users, Sparkles } from 'lucide-react';

type Twin = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  niche: string;
  monthly_price_cents: number;
  total_subscribers: number;
  total_messages: number;
  settings: {
    welcome_message?: string;
  };
};

export default function TwinProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [twin, setTwin] = useState<Twin | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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

  async function handleSubscribe() {
    if (!twin) return;
    setStarting(true);

    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twinId: twin.id }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.error === 'Already subscribed') {
        // Already subscribed — go to chat directly
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
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#A855F7] to-[#00D4FF] flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-3xl font-800">{twin.name.charAt(0)}</span>
        </div>
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

      {/* Price + CTA */}
      <div className="card rounded-2xl p-6 text-center">
        <p className="text-sm text-[#94A3B8] mb-1">Monthly subscription</p>
        <p className="font-display font-800 text-3xl text-[#0F0F23] mb-4">
          ${(twin.monthly_price_cents / 100).toFixed(2)}
          <span className="text-sm font-400 text-[#94A3B8]">/mo</span>
        </p>

        <button
          onClick={handleSubscribe}
          disabled={starting}
          className="w-full gradient-btn text-white font-600 py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {starting ? (
            'Starting...'
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Start Chatting
            </>
          )}
        </button>

        <p className="text-xs text-[#94A3B8] mt-3">
          Free preview — subscription required for full access
        </p>
      </div>
    </div>
  );
}
