'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MessageCircle } from 'lucide-react';

export default function ChooseRolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function selectRole(role: 'creator' | 'fan') {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        if (role === 'creator') {
          router.push('/creator/onboarding');
        } else {
          router.push('/explore');
        }
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0F0F23] px-6">
      <div className="max-w-lg w-full text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Twiinn AI" width={48} height={57} className="w-12 h-auto mx-auto mb-8" />

        <h1 className="font-display font-800 text-3xl text-white mb-3">
          How will you use <span className="gradient-text">Twiinn</span>?
        </h1>
        <p className="text-[#94A3B8] mb-10">
          You can always change this later in settings.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => selectRole('creator')}
            disabled={loading}
            className="card-glass rounded-2xl p-8 text-left hover:border-[#A855F7]/40 border border-white/10 transition-all group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#A855F7] flex items-center justify-center mb-5">
              <Mic className="w-7 h-7 text-white" strokeWidth={1.8} />
            </div>
            <h2 className="font-display font-700 text-xl text-white mb-2 group-hover:text-[#A855F7] transition-colors">
              I&apos;m a Creator
            </h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Create your AI twin and earn money from fan subscriptions 24/7.
            </p>
          </button>

          <button
            onClick={() => selectRole('fan')}
            disabled={loading}
            className="card-glass rounded-2xl p-8 text-left hover:border-[#00D4FF]/40 border border-white/10 transition-all group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D4FF] to-[#A855F7] flex items-center justify-center mb-5">
              <MessageCircle className="w-7 h-7 text-white" strokeWidth={1.8} />
            </div>
            <h2 className="font-display font-700 text-xl text-white mb-2 group-hover:text-[#00D4FF] transition-colors">
              I&apos;m a Fan
            </h2>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Chat with AI twins of your favorite creators anytime.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
