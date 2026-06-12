'use client';

import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Compass, MessageCircle, LayoutDashboard, Users, DollarSign, Settings, Sparkles, HelpCircle } from 'lucide-react';
import Link from 'next/link';

const fanLinks = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/chat', label: 'Messages', icon: MessageCircle },
  { href: '/subscription', label: 'Subscriptions', icon: Sparkles },
];

const creatorLinks = [
  { href: '/creator', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/creator/twin', label: 'My Twin', icon: Sparkles },
  { href: '/creator/questions', label: 'Questions', icon: HelpCircle },
  { href: '/creator/subscribers', label: 'Subscribers', icon: Users },
  { href: '/creator/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/creator/conversations', label: 'Conversations', icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const isCreatorSection = pathname.startsWith('/creator');
  const links = isCreatorSection ? creatorLinks : fanLinks;

  function isActive(href: string) {
    if (href === '/creator') {
      // Only exact match for /creator dashboard (not /creator/twin, etc.)
      return pathname === '/creator';
    }
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-black/5 p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-3 py-2 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Twiinn AI" width={28} height={33} className="w-7 h-auto" />
        <span className="font-display font-800 text-lg text-[#0F0F23]">
          twiinn<span className="gradient-text">.ai</span>
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 transition-all ${
              isActive(link.href)
                ? 'bg-[#A855F7]/10 text-[#A855F7]'
                : 'text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0F0F23]'
            }`}
          >
            <link.icon className="w-5 h-5" strokeWidth={1.8} />
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Bottom: Settings + Account */}
      <div className="border-t border-black/5 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <UserButton signInUrl="/sign-in" />
            <span className="text-sm text-[#94A3B8] truncate">Account</span>
          </div>
          <Link
            href="/settings"
            className={`p-2 rounded-lg transition-all ${
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-[#A855F7]/10 text-[#A855F7]'
                : 'text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0F0F23]'
            }`}
            title="Settings"
          >
            <Settings className="w-5 h-5" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
