'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ChatMessage } from '@/types';
import { Avatar } from '@/components/ui/Avatar';

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [twinId, setTwinId] = useState('');
  const [twinName, setTwinName] = useState('');
  const [twinSlug, setTwinSlug] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState<number | null>(null);
  const [chatError, setChatError] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/chat/history?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }

      // Get conversation details + credits
      const convRes = await fetch('/api/chat');
      if (convRes.ok) {
        const convData = await convRes.json();
        const conv = convData.conversations?.find((c: { id: string }) => c.id === conversationId);
        if (conv) {
          setTwinId(conv.twin_id);
          setTwinName((conv.twins as { name: string })?.name || 'Twin');
          setTwinSlug((conv.twins as { slug?: string })?.slug || '');

          // Fetch credits for this twin
          const subRes = await fetch('/api/subscription');
          if (subRes.ok) {
            const subData = await subRes.json();
            const sub = subData.subscriptions?.find((s: { twins: { id: string } }) => s.twins?.id === conv.twin_id);
            if (sub) {
              setCredits(sub.credits_remaining);
              setCreditsTotal(sub.credits_total ?? null);
            }
          }
        }
      }
    }
    load();
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading || !twinId) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setChatError('');

    // Add user message immediately
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twinId, message: userMessage }),
      });

      if (!res.ok) {
        // Check for credit/subscription errors
        const errData = await res.json().catch(() => ({}));

        // Remove the empty streaming message
        setMessages((prev) => prev.slice(0, -1));

        if (errData.code === 'NO_CREDITS') {
          setChatError('We\'ve been talking a lot this month — love that. Your chats refill next billing cycle.');
        } else if (errData.code === 'NOT_SUBSCRIBED') {
          setChatError('You need to subscribe to chat with this twin.');
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Sorry, something went wrong. Try again.' },
          ]);
        }
        setLoading(false);
        return;
      }

      if (!res.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, something went wrong. Try again.',
          };
          return updated;
        });
        setLoading(false);
        return;
      }

      // Deduct credit in UI
      if (credits !== null) {
        setCredits((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + chunk,
          };
          return updated;
        });
      }

      // Mark streaming as done
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          streaming: false,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Connection error. Please try again.',
        };
        return updated;
      });
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 bg-white">
        <Link href="/chat" className="text-[#94A3B8] hover:text-[#0F0F23] transition-colors md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Avatar name={twinName} size="md" href={twinSlug ? `/c/${twinSlug}` : undefined} />
        <div className="flex-1 min-w-0">
          {twinSlug ? (
            <Link
              href={`/c/${twinSlug}`}
              className="font-display font-700 text-sm text-[#0F0F23] hover:text-[#A855F7] transition-colors"
            >
              {twinName}
            </Link>
          ) : (
            <p className="font-display font-700 text-sm text-[#0F0F23]">{twinName}</p>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#84FF57]" />
            <span className="text-[11px] text-[#94A3B8]">AI Twin</span>
          </div>
        </div>
        {/* Ambient, non-numeric: silent at rest, a soft warm nudge only when winding down.
            We sell a membership, not a message counter — the raw number is on hover only. */}
        {credits !== null &&
          creditsTotal !== null &&
          credits <= Math.max(8, Math.ceil(creditsTotal * 0.2)) && (
            <span
              className="text-[11px] font-500 text-[#94A3B8] whitespace-nowrap"
              title={`${credits} chats left this month`}
            >
              {credits > 0 ? 'Winding down this month' : 'Refills next cycle'}
            </span>
          )}
      </div>

      {/* Credit error banner */}
      {chatError && (
        <div className="px-4 py-3 bg-[#A855F7]/[0.08] border-b border-[#A855F7]/20 text-center">
          <p className="text-sm text-[#7C3AED] font-500">{chatError}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#A855F7]/20 to-[#00D4FF]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-800 gradient-text">{twinName.charAt(0)}</span>
              </div>
              <p className="font-display font-700 text-lg text-[#0F0F23] mb-1">Chat with {twinName}</p>
              <p className="text-sm text-[#94A3B8]">Send a message to start the conversation</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <Avatar name={twinName} size="sm" className="mr-2 mt-1" />
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
              {msg.streaming && msg.content && (
                <span className="inline-block w-1.5 h-4 bg-[#A855F7] animate-pulse ml-0.5 align-text-bottom" />
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
            onKeyDown={handleKeyDown}
            placeholder={`Message ${twinName}...`}
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl bg-[#F8FAFC] border border-black/5 text-[#0F0F23] placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-[#A855F7]/30 transition-all resize-none text-sm"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#A855F7] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
