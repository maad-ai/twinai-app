'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';

/**
 * "Message" on a creator's feed page: find-or-create the conversation with THIS
 * twin and open it — rather than dropping the fan on the generic /chat list.
 * Mirrors the subscription page's startChat flow.
 */
export function MessageTwinButton({ twinId }: { twinId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const find = async () => {
        const res = await fetch('/api/chat');
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        return data.conversations?.find((c: { twin_id: string }) => c.twin_id === twinId) || null;
      };

      let conv = await find();
      if (!conv) {
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twinId, message: 'Hey!' }),
        });
        conv = await find();
      }
      router.push(conv ? `/chat/${conv.id}` : '/chat');
    } catch {
      router.push('/chat');
    }
    setBusy(false);
  }

  return (
    <button
      onClick={open}
      disabled={busy}
      className="gradient-btn text-white text-sm font-600 px-4 py-2 rounded-full inline-flex items-center gap-1.5 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
      )}
      Message
    </button>
  );
}
