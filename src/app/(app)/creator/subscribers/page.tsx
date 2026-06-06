import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Users } from 'lucide-react';

export const metadata = { title: 'Subscribers' };

export default async function SubscribersPage() {
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
    .select('id')
    .eq('creator_id', profile.id)
    .single();

  if (!twin) redirect('/creator/onboarding');

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      credits_remaining,
      credits_total,
      created_at,
      profiles!subscriptions_fan_id_fkey (
        display_name,
        avatar_url
      )
    `)
    .eq('twin_id', twin.id)
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-[#00D4FF]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Subscribers</h1>
        <span className="ml-auto text-sm text-[#94A3B8]">{subscriptions?.length || 0} total</span>
      </div>

      {!subscriptions?.length ? (
        <div className="card rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-[#94A3B8]/30 mx-auto mb-4" />
          <p className="font-display font-700 text-lg text-[#0F0F23] mb-2">No subscribers yet</p>
          <p className="text-sm text-[#94A3B8]">Share your twin link to get your first fans!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => {
            const fan = sub.profiles as unknown as { display_name: string; avatar_url: string | null } | null;
            return (
              <div key={sub.id} className="card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-700 text-[#94A3B8]">{fan?.display_name?.charAt(0) || '?'}</span>
                </div>
                <div className="flex-1">
                  <p className="font-600 text-sm text-[#0F0F23]">{fan?.display_name || 'Anonymous'}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {sub.credits_remaining}/{sub.credits_total} credits remaining
                  </p>
                </div>
                <span className={`text-xs font-600 uppercase px-2 py-1 rounded-full ${
                  sub.status === 'active' ? 'bg-[#84FF57]/20 text-[#22C55E]' : 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                }`}>
                  {sub.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
