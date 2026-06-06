import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserProfile } from '@clerk/nextjs';
import { Settings } from 'lucide-react';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, display_name')
    .eq('clerk_id', userId)
    .single();

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Settings</h1>
      </div>

      {/* Profile info */}
      <div className="card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-4">Account</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Name</p>
            <p className="font-500 text-[#0F0F23]">{profile?.display_name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Email</p>
            <p className="font-500 text-[#0F0F23]">{profile?.email || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Role</p>
            <p className="font-500 text-[#0F0F23] capitalize">{profile?.role || 'fan'}</p>
          </div>
        </div>
      </div>

      {/* Clerk UserProfile */}
      <div className="card rounded-2xl p-6">
        <h2 className="font-display font-700 text-lg text-[#0F0F23] mb-4">Manage Account</h2>
        <UserProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-0 p-0',
            },
          }}
        />
      </div>
    </div>
  );
}
