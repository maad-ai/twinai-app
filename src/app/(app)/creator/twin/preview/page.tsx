'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Send, ArrowLeft, Eye } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { Avatar } from '@/components/ui/Avatar';

interface PreviewTwin {
  id: string;
  name: string;
  photo_url?: string | null;
}

/**
 * Creator-facing preview: chat with your OWN twin for free to test it.
 * The chat API allows the creator (isCreator) to chat without a subscription.
 */
export default function TwinPreviewPage() {
  const [twin, setTwin] = useState<PreviewTwin | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/twin');
        if (res.ok) {
          const data = await res.json();
          if (data.twin) {
            setTwin({ id: data.twin.id, name: data.twin.name, photo_url: data.twin.photo_url });
          }
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!input.trim() || sending || !twin) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    setError('');
    setMessages((p) => [
      ...p,
      { role: 'user', content: msg },
      { role: 'assistant', content: '', streaming: true },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twinId: twin.id, message: msg }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({}));
        setMessages((p) => p.slice(0, -1));
        setError(e.error || 'Something went wrong — try again.');
        setSending(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((p) => {
          const u = [...p];
          const last = u[u.length - 1];
          u[u.length - 1] = { ...last, content: last.content + chunk };
          return u;
        });
      }
      setMessages((p) => {
        const u = [...p];
        u[u.length - 1] = { ...u[u.length - 1], streaming: false };
        return u;
      });
    } catch {
      setMessages((p) => {
        const u = [...p];
        u[u.length - 1] = { role: 'assistant', content: 'Connection error. Please try again.' };
        return u;
      });
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-[#F1F5F9] rounded w-1/3" />
        <div className="h-64 bg-[#F1F5F9] rounded-2xl" />
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
    <div className="flex flex-col h-[100dvh] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-white">
        <Link
          href="/creator/twin"
          className="text-[#94A3B8] hover:text-[#0F0F23] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Avatar name={twin.name} src={twin.photo_url} size="md" />
        <div className="flex-1">
          <p className="font-display font-700 text-sm text-[#0F0F23]">{twin.name}</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#A855F7] font-600">
            <Eye className="w-3 h-3" /> Preview — your own twin, free
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-[#A855F7]/[0.08] border-b border-[#A855F7]/20 text-center">
          <p className="text-sm text-[#7C3AED] font-500">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A855F7]/20 to-[#00D4FF]/20 flex items-center justify-center mb-4">
              <span className="text-2xl font-800 gradient-text">{twin.name.charAt(0)}</span>
            </div>
            <p className="font-display font-700 text-lg text-[#0F0F23] mb-1">{twin.name}</p>
            <p className="text-sm text-[#94A3B8] text-center max-w-xs mb-5">
              Test how your twin answers. Try a real fan question.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {['Introduce yourself', 'Are you a real person?', 'Give me a quick tip'].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="text-sm font-500 px-3 py-1.5 rounded-full border border-[#A855F7]/20 text-[#A855F7] bg-[#A855F7]/[0.06] hover:bg-[#A855F7]/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <Avatar name={twin.name} src={twin.photo_url} size="sm" className="mr-2 mt-1" />
            )}
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#A855F7] to-[#00D4FF] text-white rounded-br-sm'
                  : 'bg-[#F1F5F9] text-[#0F0F23] rounded-bl-sm'
              }`}
            >
              {msg.content || (
                <div className="flex gap-1.5 py-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-2 h-2 rounded-full bg-[#94A3B8]/40 animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-black/5 bg-white">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Message ${twin.name}…`}
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl bg-[#F8FAFC] border border-black/5 text-[#0F0F23] placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-[#A855F7]/30 transition-all resize-none text-sm"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#A855F7] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
            aria-label="Send"
          >
            <Send className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-[11px] text-[#94A3B8] text-center mt-2">
          ✦ Preview of your AI twin — this is what your fans experience.
        </p>
      </div>
    </div>
  );
}
