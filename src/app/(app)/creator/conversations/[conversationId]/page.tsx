'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Flag, Shield } from 'lucide-react';
import Link from 'next/link';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export default function ConversationDetailPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/creator/moderate?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
      setLoading(false);
    }
    load();
  }, [conversationId]);

  async function handleFlag() {
    setFlagging(true);
    await fetch('/api/creator/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, action: 'flag' }),
    });
    setFlagging(false);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/creator/conversations" className="text-[#94A3B8] hover:text-[#0F0F23] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Shield className="w-5 h-5 text-[#A855F7]" strokeWidth={1.8} />
          <h1 className="font-display font-700 text-lg text-[#0F0F23]">Review Conversation</h1>
        </div>
        <button
          onClick={handleFlag}
          disabled={flagging}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FF6B6B]/30 text-[#FF6B6B] text-sm font-500 hover:bg-[#FF6B6B]/5 transition-all disabled:opacity-50"
        >
          <Flag className="w-3.5 h-3.5" />
          {flagging ? 'Flagging...' : 'Flag Conversation'}
        </button>
      </div>

      {/* Messages */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
              <div className="card rounded-xl p-3 w-3/4 animate-pulse">
                <div className="h-3 bg-[#F1F5F9] rounded w-full mb-2" />
                <div className="h-3 bg-[#F1F5F9] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="card rounded-xl p-8 text-center">
          <p className="text-[#94A3B8]">No messages in this conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : ''}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[#F1F5F9] text-[#0F0F23] rounded-br-sm'
                  : 'bg-[#A855F7]/10 text-[#0F0F23] rounded-bl-sm'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-600 uppercase text-[#94A3B8]">
                    {msg.role === 'user' ? 'Fan' : 'Your Twin'}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">{formatTime(msg.created_at)}</span>
                </div>
                <p className="leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
