'use client';

import { useState } from 'react';
import { Check, Copy, Share2, Link2 } from 'lucide-react';

/**
 * The creator's shareable link — the "put this in your bio" moment.
 * Shown prominently on the creator dashboard.
 */
export function ShareTwinLink({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://twiinn.ai/@${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Chat with ${name}'s AI twin`, url });
        return;
      }
    } catch {
      /* user cancelled */
    }
    copy();
  }

  return (
    <div
      className="rounded-2xl p-6 mb-6 text-white"
      style={{ background: 'linear-gradient(135deg, #1A1A3E 0%, #0F0F23 100%)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-4 h-4 text-[#A855F7]" strokeWidth={2} aria-hidden="true" />
        <h2 className="font-display font-700 text-lg">Your twin link</h2>
      </div>
      <p className="text-sm text-[#94A3B8] mb-4">
        Put it in your bio, stories, and pinned comments — this is how fans find your twin.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 font-500 text-[15px] truncate select-all">
          twiinn.ai/<span className="text-[#00D4FF]">@{slug}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="gradient-btn text-white font-600 px-5 py-3 rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" /> Copy
              </>
            )}
          </button>
          <button
            onClick={share}
            aria-label="Share your twin link"
            className="bg-white/[0.08] border border-white/10 hover:bg-white/[0.14] transition-colors text-white font-600 px-4 py-3 rounded-xl flex items-center justify-center"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
