import { PublicNav } from '@/components/public/PublicNav';

/**
 * Public, unauthenticated pages (creator pages like /@slug and /c/slug).
 * A slim top bar gives a way back into the app / into Twiinn; each page owns
 * its own creator-selected themed background below it.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
