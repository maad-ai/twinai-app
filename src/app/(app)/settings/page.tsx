'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, User, Palette, ArrowRight } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState('fan');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setRole(data.role || 'fan');
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function switchRole(newRole: string) {
    setRole(newRole);
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    if (newRole === 'creator') {
      router.push('/creator');
    } else {
      router.push('/explore');
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-2xl">
        <div className="h-8 bg-[#F1F5F9] rounded w-1/3 mb-8 animate-pulse" />
        <div className="card rounded-2xl p-6 animate-pulse">
          <div className="h-5 bg-[#F1F5F9] rounded w-1/4 mb-4" />
          <div className="h-10 bg-[#F1F5F9] rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-[#A855F7]" strokeWidth={1.8} />
        <h1 className="font-display font-800 text-2xl text-[#0F0F23]">Settings</h1>
      </div>

      {/* General */}
      <div className="card rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.8} />
          <h2 className="font-display font-700 text-sm uppercase tracking-wider text-[#94A3B8]">General</h2>
        </div>

        {/* Role switch */}
        <div className="flex items-center justify-between py-3 border-b border-black/5">
          <div>
            <p className="font-500 text-sm text-[#0F0F23]">Account Mode</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Switch between Creator and Fan</p>
          </div>
          <div className="flex bg-[#F1F5F9] rounded-lg p-0.5">
            <button
              onClick={() => switchRole('fan')}
              className={`px-4 py-2 rounded-md text-sm font-500 transition-all ${
                role === 'fan'
                  ? 'bg-white text-[#0F0F23] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#0F0F23]'
              }`}
            >
              Fan
            </button>
            <button
              onClick={() => switchRole('creator')}
              className={`px-4 py-2 rounded-md text-sm font-500 transition-all ${
                role === 'creator'
                  ? 'bg-white text-[#0F0F23] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#0F0F23]'
              }`}
            >
              Creator
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-500 text-sm text-[#0F0F23]">Theme</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Choose light or dark mode</p>
          </div>
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#94A3B8]" />
            <span className="text-sm text-[#94A3B8]">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Account management */}
      <div className="card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-[#94A3B8]" strokeWidth={1.8} />
          <h2 className="font-display font-700 text-sm uppercase tracking-wider text-[#94A3B8]">Account</h2>
        </div>

        <button
          onClick={() => {
            // Open Clerk user profile modal
            const btn = document.querySelector('.cl-userButtonTrigger') as HTMLElement;
            if (btn) btn.click();
          }}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-[#F8FAFC] -mx-2 px-2 rounded-lg transition-all"
        >
          <div>
            <p className="font-500 text-sm text-[#0F0F23]">Manage Account</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">Update profile, email, password, connected accounts</p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#94A3B8]" />
        </button>
      </div>
    </div>
  );
}
