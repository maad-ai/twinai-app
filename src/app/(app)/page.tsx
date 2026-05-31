import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AppHome() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('clerk_id', userId)
    .single();

  // New user — no profile yet (webhook might be delayed)
  if (!profile) {
    redirect('/choose-role');
  }

  // Creator who hasn't completed onboarding
  if (profile.role === 'creator' && !profile.onboarding_completed) {
    redirect('/creator/onboarding');
  }

  // Route based on role
  if (profile.role === 'creator') {
    redirect('/creator');
  }

  redirect('/explore');
}
