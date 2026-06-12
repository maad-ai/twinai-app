'use client';

import { usePathname } from 'next/navigation';
import { Compass, MessageCircle, LayoutDashboard, Sparkles, Settings, HelpCircle } from 'lucide-react';
import Link from 'next/link';

const fanLinks = [
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/subscription', icon: Sparkles, label: 'Subs' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const creatorLinks = [
  { href: '/creator', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/creator/twin', icon: Sparkles, label: 'Twin' },
  { href: '/creator/questions', icon: HelpCircle, label: 'Questions' },
  { href: '/creator/conversations', icon: MessageCircle, label: 'Convos' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  const pathname = usePathname();
  const isCreatorSection = pathname.startsWith('/creator');
  const links = isCreatorSection ? creatorLinks : fanLinks;

  // Don't show on auth pages or chat detail
  if (pathname.startsWith('/sign-') || pathname.startsWith('/choose-role')) {
    return null;
  }

  // Hide on chat detail (full screen chat)
  if (pathname.match(/^\/chat\/[a-f0-9-]+$/)) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 z-40 safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[#A855F7]' : 'text-[#94A3B8]'
              }`}
            >
              <link.icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-500">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
