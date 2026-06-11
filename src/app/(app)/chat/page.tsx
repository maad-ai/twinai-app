'use client';

import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { ConversationSummary } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { timeAgo } from '@/lib/format';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Messages</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#F1F5F9]" />
                <div className="flex-1">
                  <div className="h-4 bg-[#F1F5F9] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <MessageCircle className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No conversations yet</p>
          <p className="text-sm text-[#94A3B8] mb-6">Find a twin to chat with!</p>
          <Link
            href="/explore"
            className="inline-block gradient-btn text-white font-600 px-6 py-2.5 rounded-xl text-sm"
          >
            Explore Twins
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/chat/${conv.id}`}
              className="card rounded-xl p-4 flex items-center gap-3 hover:border-[#A855F7]/20 transition-all block"
            >
              <Avatar name={conv.twins?.name || '?'} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-700 text-[#0F0F23]">{conv.twins?.name || 'Twin'}</p>
                <p className="text-xs text-[#94A3B8]">{conv.twins?.niche} — {conv.message_count} messages</p>
              </div>
              <span className="text-xs text-[#94A3B8] flex-shrink-0">{timeAgo(conv.last_message_at, true)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
