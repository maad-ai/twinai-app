import Link from 'next/link';
import { Compass, MessageCircle } from 'lucide-react';
import { getViewerProfileId } from '@/lib/public-twin';

/**
 * Slim top bar shown on public creator pages (/@slug, /c/slug) so visitors
 * never feel trapped — logged-in users get back to the app, anonymous ones
 * get a way into Twiinn.
 */
export async function PublicNav() {
  const authed = !!(await getViewerProfileId());

  return (
    <header className="sticky top-0 z-50 bg-[#0F0F23]/85 backdrop-blur-md border-b border-white/10">
      <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
        <Link href={authed ? '/explore' : '/'} className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Twiinn AI" width={22} height={26} className="w-[22px] h-auto" />
          <span className="font-display font-800 text-[15px] text-white">
            twiinn<span className="gradient-text">.ai</span>
          </span>
        </Link>

        {authed ? (
          <nav className="flex items-center gap-1">
            <Link
              href="/explore"
              className="text-white/75 hover:text-white p-2 rounded-lg transition-colors"
              aria-label="Explore"
            >
              <Compass className="w-5 h-5" strokeWidth={1.8} />
            </Link>
            <Link
              href="/chat"
              className="text-white/75 hover:text-white p-2 rounded-lg transition-colors"
              aria-label="Messages"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={1.8} />
            </Link>
          </nav>
        ) : (
          <Link
            href="/sign-up"
            className="text-sm font-600 text-white bg-white/10 hover:bg-white/15 px-3.5 py-1.5 rounded-full transition-colors"
          >
            Join Twiinn
          </Link>
        )}
      </div>
    </header>
  );
}
