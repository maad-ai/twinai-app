import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

export const metadata = { title: 'Earnings' };

export default async function EarningsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (!profile) redirect('/choose-role');

  const { data: twin } = await supabase
    .from('twins')
    .select('id, total_subscribers, monthly_price_cents')
    .eq('creator_id', profile.id)
    .single();

  // Calculate estimated monthly revenue
  const subs = twin?.total_subscribers || 0;
  const price = twin?.monthly_price_cents || 1999;
  const estimatedRevenue = (subs * price * 0.85) / 100; // 85% after platform fee

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-6 h-6 text-[#84FF57]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Earnings</h1>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="card rounded-2xl p-6">
          <DollarSign className="w-5 h-5 text-[#84FF57] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">
            ${estimatedRevenue.toFixed(2)}
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">Est. monthly revenue</p>
        </div>
        <div className="card rounded-2xl p-6">
          <Users className="w-5 h-5 text-[#00D4FF] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">{subs}</p>
          <p className="text-xs text-[#94A3B8] mt-1">Active subscribers</p>
        </div>
        <div className="card rounded-2xl p-6">
          <TrendingUp className="w-5 h-5 text-[#A855F7] mb-2" strokeWidth={1.8} />
          <p className="font-display font-800 text-3xl text-[#0F0F23]">85%</p>
          <p className="text-xs text-[#94A3B8] mt-1">Your revenue share</p>
        </div>
      </div>

      {/* Info */}
      <div className="card rounded-2xl p-6">
        <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-3">How payouts work</h2>
        <div className="space-y-3 text-sm text-[#94A3B8]">
          <p>Payouts are processed monthly via Stripe Connect. Once you connect your bank account, earnings are automatically transferred.</p>
          <p>You keep <span className="text-[#84FF57] font-600">85%</span> of every subscription. The remaining 15% covers platform fees, AI costs, and payment processing.</p>
          <p className="text-xs italic">Stripe Connect integration coming soon. Your earnings are being tracked.</p>
        </div>
      </div>
    </div>
  );
}
