'use client';

import { useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';

const PRESETS = [500, 1000, 2000]; // $5 / $10 / $20

/** "Send a tip" — one-time pourboire to the creator. Login required. */
export function TipButton({
  twinId,
  twinName,
  isAuthed,
  theme,
}: {
  twinId: string;
  twinName: string;
  isAuthed: boolean;
  theme: { card: string; heading: string; muted: string };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tip(amountCents: number) {
    if (!isAuthed) {
      window.location.href = '/sign-in';
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tips/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twinId, amountCents }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Could not start the tip — try again.');
    } catch {
      setError('Could not start the tip — try again.');
    }
    setBusy(false);
  }

  return (
    <div className={`rounded-2xl p-4 ${theme.card}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 text-sm font-600 ${theme.heading}`}
        aria-expanded={open}
      >
        <Gift className="w-4 h-4 text-[#FF6B6B]" aria-hidden="true" />
        Send {twinName} a tip
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((a) => (
              <button
                key={a}
                onClick={() => tip(a)}
                disabled={busy}
                className="flex-1 min-w-[72px] gradient-btn text-white text-sm font-700 py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${a / 100}`}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <p className={`text-[11px] mt-2 ${theme.muted}`}>
            100% one-time — goes straight to {twinName} (minus the platform fee).
          </p>
        </div>
      )}
    </div>
  );
}
