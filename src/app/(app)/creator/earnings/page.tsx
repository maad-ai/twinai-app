import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfileByClerkId } from '@/lib/db';
import { formatPrice, timeAgo } from '@/lib/format';
import { PayoutSetupCard } from '@/components/creator/PayoutSetupCard';
import { DollarSign, TrendingUp, Users, Clock } from 'lucide-react';

export const metadata = { title: 'Earnings' };
export const dynamic = 'force-dynamic';

interface EarningRow {
  id: string;
  period_start: string;
  period_end: string;
  net_amount_cents: number;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
}

export default async function EarningsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const profile = await getProfileByClerkId(supabase, userId, 'id');
  if (!profile) redirect('/choose-role');

  const { data: twin } = await supabase
    .from('twins')
    .select('id, total_subscribers, monthly_price_cents')
    .eq('creator_id', profile.id)
    .maybeSingle();

  // Real earnings ledger (zeros until rows exist)
  let earnings: EarningRow[] = [];
  try {
    const { data, error } = await supabase
      .from('earnings')
      .select('id, period_start, period_end, net_amount_cents, status, created_at')
      .eq('creator_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(24);
    if (!error && data) earnings = data as EarningRow[];
  } catch {
    earnings = [];
  }

  const lifetime = earnings.reduce((sum, e) => sum + (e.status !== 'failed' ? e.net_amount_cents : 0), 0);
  const pending = earnings
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.net_amount_cents, 0);

  // Estimate from current subscribers (clearly labeled as estimate)
  const subs = twin?.total_subscribers || 0;
  const price = twin?.monthly_price_cents || 1999;
  const estimatedMonthlyCents = Math.round(subs * price * 0.80);

  const STATUS_STYLES: Record<EarningRow['status'], string> = {
    paid: 'bg-[#22C55E]/10 text-[#16A34A]',
    pending: 'bg-[#FBBF24]/15 text-[#D97706]',
    failed: 'bg-red-100 text-red-600',
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-6 h-6 text-[#22C55E]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Earnings</h1>
      </div>

      {/* Stripe Connect onboarding / status */}
      <PayoutSetupCard />

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="card rounded-2xl p-6">
          <DollarSign className="w-5 h-5 text-[#22C55E] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">{formatPrice(lifetime)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">Lifetime earnings</p>
        </div>
        <div className="card rounded-2xl p-6">
          <Clock className="w-5 h-5 text-[#FBBF24] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">{formatPrice(pending)}</p>
          <p className="text-xs text-[#94A3B8] mt-1">Pending payout</p>
        </div>
        <div className="card rounded-2xl p-6">
          <Users className="w-5 h-5 text-[#00D4FF] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">{subs}</p>
          <p className="text-xs text-[#94A3B8] mt-1">Active subscribers</p>
        </div>
      </div>

      {/* Estimate */}
      <div className="card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#A855F7]" strokeWidth={2} aria-hidden="true" />
          <h2 className="font-display font-700 text-[#0F0F23]">Estimated monthly run-rate</h2>
        </div>
        <p className="font-display font-800 text-2xl text-[#0F0F23] mt-2">
          {formatPrice(estimatedMonthlyCents)}
          <span className="text-sm font-500 text-[#94A3B8]"> /month</span>
        </p>
        <p className="text-xs text-[#94A3B8] mt-1">
          {subs} subscriber{subs === 1 ? '' : 's'} × {formatPrice(price)} × 80% — an estimate, not
          a guarantee.
        </p>
      </div>

      {/* Ledger */}
      <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-3">Payout history</h2>
      {earnings.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-sm text-[#94A3B8]">
            No payouts yet. Earnings accrue as fans subscribe and are paid out monthly once your
            bank account is connected.
          </p>
        </div>
      ) : (
        <div className="card rounded-2xl divide-y divide-black/5">
          {earnings.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-600 text-[#0F0F23]">
                  {new Date(`${e.period_start}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  –{' '}
                  {new Date(`${e.period_end}T00:00:00`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-[#94A3B8]">{timeAgo(e.created_at, true)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-700 text-[#0F0F23]">
                  {formatPrice(e.net_amount_cents)}
                </span>
                <span
                  className={`text-xs font-600 uppercase tracking-wider px-2.5 py-0.5 rounded-full ${STATUS_STYLES[e.status]}`}
                >
                  {e.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="card rounded-2xl p-6 mt-8">
        <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-3">How payouts work</h2>
        <div className="space-y-3 text-sm text-[#94A3B8]">
          <p>
            You keep <span className="text-[#16A34A] font-600">80%</span> of every subscription and
            credit pack. The remaining 20% covers platform, AI, and payment processing.
          </p>
          <p>
            Payouts are processed monthly via Stripe to your connected bank account. Stripe may
            hold the first payout briefly while verifying your information.
          </p>
        </div>
      </div>
    </div>
  );
}
