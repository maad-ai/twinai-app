'use client';

import { useState, useEffect } from 'react';
import { Landmark, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

type PayoutState =
  | { loading: true }
  | { loading: false; connected: false }
  | { loading: false; connected: true; payoutsEnabled: boolean; detailsSubmitted: boolean };

/**
 * Stripe Connect onboarding card — connect a bank account, finish setup,
 * or show the active state. Status only; never moves money.
 */
export function PayoutSetupCard() {
  const [state, setState] = useState<PayoutState>({ loading: true });
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/payouts');
        if (res.ok) {
          const data = await res.json();
          setState({ loading: false, ...data });
          return;
        }
      } catch {
        /* fall through */
      }
      setState({ loading: false, connected: false });
    }
    load();
  }, []);

  async function startOnboarding() {
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch('/api/payouts', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Could not start payout setup — try again.');
    } catch {
      setError('Could not start payout setup — check your connection.');
    }
    setRedirecting(false);
  }

  if (state.loading) {
    return (
      <div className="card rounded-2xl p-6 mb-8 animate-pulse">
        <div className="h-5 bg-[#F1F5F9] rounded w-1/3 mb-3" />
        <div className="h-4 bg-[#F1F5F9] rounded w-2/3" />
      </div>
    );
  }

  const active = state.connected && state.payoutsEnabled;
  const inProgress = state.connected && !state.payoutsEnabled;

  return (
    <div className="card rounded-2xl p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {active ? (
            <CheckCircle2 className="w-6 h-6 text-[#22C55E] flex-shrink-0" strokeWidth={1.8} />
          ) : (
            <Landmark className="w-6 h-6 text-[#A855F7] flex-shrink-0" strokeWidth={1.8} />
          )}
          <div>
            <h2 className="font-display font-700 text-[#0F0F23]">
              {active
                ? 'Payouts active'
                : inProgress
                  ? 'Finish your payout setup'
                  : 'Set up payouts'}
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-md">
              {active
                ? 'Your bank account is connected — earnings are paid out monthly.'
                : inProgress
                  ? 'Stripe needs a bit more information before payouts can start.'
                  : 'You keep 85% of every subscription. Connect your bank through Stripe to receive monthly payouts.'}
            </p>
          </div>
        </div>

        {!active && (
          <button
            onClick={startOnboarding}
            disabled={redirecting}
            className="gradient-btn text-white text-sm font-600 px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {redirecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
              </>
            ) : (
              <>
                {inProgress ? 'Finish setup' : 'Set up payouts'}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
