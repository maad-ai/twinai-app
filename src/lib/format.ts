/**
 * Shared display formatting helpers.
 */

/**
 * Relative time label: "just now" / "5m" / "3h" / "2d".
 * Pass `withSuffix: true` to get "5m ago" / "3h ago" / "2d ago" instead.
 */
export function timeAgo(dateStr: string, withSuffix = false): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  const suffix = withSuffix ? ' ago' : '';
  if (mins < 60) return `${mins}m${suffix}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h${suffix}`;
  return `${Math.floor(hrs / 24)}d${suffix}`;
}

/** Formats a price in cents as a dollar string, e.g. 1999 -> "$19.99". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
