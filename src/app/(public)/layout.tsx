/**
 * Public, unauthenticated pages (creator share links like /@slug).
 * No sidebar/app chrome — these pages are what fans hit from Instagram bios.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // Background is owned by each page (creator-selected theme).
  return <>{children}</>;
}
