'use client';

import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Compass, MessageCircle, LayoutDashboard, Users, DollarSign, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';

const fanLinks = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/chat', label: 'Messages', icon: MessageCircle },
  { href: '/subscription', label: 'Subscriptions', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const creatorLinks = [
  { href: '/creator', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/creator/twin', label: 'My Twin', icon: Sparkles },
  { href: '/creator/subscribers', label: 'Subscribers', icon: Users },
  { href: '/creator/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/creator/conversations', label: 'Conversations', icon: MessageCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isCreatorSection = pathname.startsWith('/creator');

  // Show creator nav if on creator pages, fan nav otherwise
  const links = isCreatorSection ? creatorLinks : fanLinks;
  const otherMode = isCreatorSection
    ? { href: '/explore', label: 'Switch to Fan', icon: Compass }
    : { href: '/creator', label: 'Creator Dashboard', icon: LayoutDashboard };

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
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 transition-all ${
                isActive
                  ? 'bg-[#A855F7]/10 text-[#A855F7]'
                  : 'text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0F0F23]'
              }`}
            >
              <link.icon className="w-5 h-5" strokeWidth={1.8} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Switch mode */}
      <Link
        href={otherMode.href}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0F0F23] transition-all mb-4 border border-dashed border-black/10"
      >
        <otherMode.icon className="w-5 h-5" strokeWidth={1.8} />
        {otherMode.label}
      </Link>

      {/* User button */}
      <div className="flex items-center gap-3 px-3 py-2 border-t border-black/5 pt-4">
        <UserButton afterSignOutUrl="/sign-in" />
        <span className="text-sm text-[#94A3B8] truncate">Account</span>
      </div>
    </aside>
  );
}
