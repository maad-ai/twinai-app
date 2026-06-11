/**
 * Public, unauthenticated pages (creator share links like /@slug).
 * No sidebar/app chrome — these pages are what fans hit from Instagram bios.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#F8FAFC]">{children}</div>;
}
