'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, MessageCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Subscription } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { formatPrice } from '@/lib/format';

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  async function loadSubs() {
    const res = await fetch('/api/subscription');
    if (res.ok) {
      const data = await res.json();
      setSubs(data.subscriptions || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSubs();
  }, []);

  async function startChat(twinId: string) {
    // Check if conversation already exists
    const res = await fetch('/api/chat');
    if (res.ok) {
      const data = await res.json();
      const existing = data.conversations?.find((c: { twin_id: string }) => c.twin_id === twinId);
      if (existing) {
        router.push(`/chat/${existing.id}`);
        return;
      }
    }

    // Create new conversation by sending first message
    const chatRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twinId, message: 'Hey!' }),
    });

    if (chatRes.ok) {
      const convRes = await fetch('/api/chat');
      if (convRes.ok) {
        const convData = await convRes.json();
        const conv = convData.conversations?.find((c: { twin_id: string }) => c.twin_id === twinId);
        if (conv) {
          router.push(`/chat/${conv.id}`);
        }
      }
    }
  }

  async function cancelSubscription(sub: Subscription) {
    const confirmed = window.confirm(
      `Cancel your subscription to ${sub.twins?.name}?\n\nYou'll keep access until the end of your billing period, and your conversation history stays forever.`
    );
    if (!confirmed) return;

    setCancelingId(sub.id);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      if (res.ok) {
        await loadSubs();
      }
    } finally {
      setCancelingId(null);
    }
  }

  function endDate(dateStr: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Subscriptions</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-[#F1F5F9] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No subscriptions yet</p>
          <p className="text-sm text-[#94A3B8] mb-6">Subscribe to a twin to start chatting!</p>
          <Link
            href="/explore"
            className="inline-block gradient-btn text-white font-600 px-6 py-2.5 rounded-xl text-sm"
          >
            Explore Twins
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((sub) => (
            <div key={sub.id} className="card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={sub.twins?.name || ''}
                    size="md"
                    href={sub.twins?.slug ? `/@${sub.twins.slug}` : undefined}
                  />
                  <div>
                    {sub.twins?.slug ? (
                      <Link
                        href={`/@${sub.twins.slug}`}
                        className="font-display font-700 text-[#0F0F23] hover:text-[#A855F7] transition-colors"
                      >
                        {sub.twins?.name}
                      </Link>
                    ) : (
                      <p className="font-display font-700 text-[#0F0F23]">{sub.twins?.name}</p>
                    )}
                    <p className="text-xs text-[#94A3B8]">{sub.twins?.niche}</p>
                  </div>
                </div>
                {sub.cancel_at_period_end && sub.status === 'active' ? (
                  <span className="text-xs font-600 uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#FBBF24]/20 text-[#D97706]">
                    Ends {endDate(sub.current_period_end)}
                  </span>
                ) : (
                  <span className={`text-xs font-600 uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    sub.status === 'active' ? 'bg-[#84FF57]/20 text-[#22C55E]' : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                  }`}>
                    {sub.status}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span
                    className="text-[#94A3B8]"
                    title={`${sub.credits_remaining}/${sub.credits_total} chats this month`}
                  >
                    Our time this month
                  </span>
                  <span className="text-[#94A3B8]">
                    {formatPrice(sub.twins?.monthly_price_cents)}/mo
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {sub.status === 'active' && !sub.cancel_at_period_end && (
                    <button
                      onClick={() => cancelSubscription(sub)}
                      disabled={cancelingId === sub.id}
                      className="text-[#94A3B8] hover:text-[#FF6B6B] font-500 flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {cancelingId === sub.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Cancel
                    </button>
                  )}
                  {sub.status === 'active' && (
                    <button
                      onClick={() => startChat(sub.twins?.id)}
                      className="text-[#A855F7] font-500 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </button>
                  )}
                  {sub.status === 'canceled' && (
                    <Link
                      href="/chat"
                      className="text-[#94A3B8] font-500 hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> View messages
                    </Link>
                  )}
                </div>
              </div>

              {sub.status === 'canceled' && (
                <p className="text-xs text-[#94A3B8] mt-3 pt-3 border-t border-black/5">
                  Subscription ended — your conversation history is saved. Re-subscribe anytime to keep chatting.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
