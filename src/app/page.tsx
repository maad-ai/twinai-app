import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  // TODO: Check user role and redirect accordingly
  // For now, redirect to explore (fan default)
  redirect('/explore');
}
