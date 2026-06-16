import type { Socials } from '@/lib/public-twin';

/* Brand icons (lucide dropped brand icons) */
const SOCIAL_ICONS: Record<string, (cls: string) => React.ReactNode> = {
  instagram: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.8.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.3-.3.8-.3 1.8-.1 1.2-.1 1.6-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.8.2.5.4.8.7 1.1.3.3.6.5 1.1.7.3.1.8.3 1.8.3 1.2.1 1.6.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.8-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.3.3-.8.3-1.8.1-1.2.1-1.6.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.8-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.3-.1-.8-.3-1.8-.3-1.2-.1-1.6-.1-4.8-.1Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  ),
  tiktok: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M19.6 6.7a4.8 4.8 0 0 1-3.5-1.6 4.8 4.8 0 0 1-1.2-3.1h-3.2v13.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 6V9.6a8 8 0 0 0 4.7 1.5V7.9c-.7 0-1.3-.1-2-.4Z" />
    </svg>
  ),
  youtube: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M23 7.2a2.8 2.8 0 0 0-2-2C19.2 4.7 12 4.7 12 4.7s-7.2 0-9 .5a2.8 2.8 0 0 0-2 2C.5 9 .5 12 .5 12s0 3 .5 4.8a2.8 2.8 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a2.8 2.8 0 0 0 2-2c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM9.7 15.4V8.6l6 3.4-6 3.4Z" />
    </svg>
  ),
  x: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
      <path d="M18.2 2.3h3.3l-7.3 8.3 8.6 11.1h-6.7l-5.3-6.8-6 6.8H1.5l7.8-8.9L1 2.3h6.9l4.8 6.2 5.5-6.2Zm-1.2 17.5h1.8L7 4.1H5l12 15.7Z" />
    </svg>
  ),
  website: (cls) => (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

function socialUrl(key: string, value: string): string {
  switch (key) {
    case 'instagram':
      return `https://instagram.com/${value}`;
    case 'tiktok':
      return `https://tiktok.com/@${value}`;
    case 'youtube':
      return `https://youtube.com/@${value}`;
    case 'x':
      return `https://x.com/${value}`;
    default:
      return value;
  }
}

/** The creator's social links — proof it's really them. Renders nothing if empty. */
export function TwinSocials({
  socials,
  name,
  socialClass,
}: {
  socials: Socials;
  name: string;
  socialClass: string;
}) {
  const entries = Object.entries(socials).filter(
    ([key, value]) => value && SOCIAL_ICONS[key]
  ) as [string, string][];
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {entries.map(([key, value]) => (
        <a
          key={key}
          href={socialUrl(key, value)}
          target="_blank"
          rel="me noopener noreferrer"
          aria-label={key === 'website' ? 'Website' : `${name} on ${key}`}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${socialClass}`}
        >
          {SOCIAL_ICONS[key]('w-[18px] h-[18px]')}
        </a>
      ))}
    </div>
  );
}
