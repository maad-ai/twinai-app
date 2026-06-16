// Pricing tiers (minimum prices enforced server-side)
// Default credits respect the 12¢/message floor: floor(price / 12).
export const MIN_TIER_PRICES = [999, 1999, 4999]; // cents
export const DEFAULT_TIER_CREDITS = [80, 150, 400];
// "Close Friends" membership ladder — we sell access tiers, not message packs.
export const TIER_NAMES = ['On the List', 'Close Friends', 'Front Row'];

export const DEFAULT_TIERS = MIN_TIER_PRICES.map((cents, i) => ({
  cents,
  credits: DEFAULT_TIER_CREDITS[i],
  name: TIER_NAMES[i],
}));

// Platform commission (matches OnlyFans/Fansly standard; covers AI inference)
export const PLATFORM_FEE_PERCENT = 20;
export const CREATOR_SHARE_PERCENT = 80;

/**
 * Unit-economics floor: every message a fan buys must cost at least this
 * many cents so the platform's 20% always covers inference + processing.
 * At 12¢: 20% = 2.4¢/msg ≥ ~1.5¢ Claude inference. ($4.99 → 41 msgs/mo;
 * $19.99 → 166; $49.99 → 416.)
 */
export const MIN_CENTS_PER_CREDIT = 12;
/** Cheapest allowed subscription tier (cents). */
export const MIN_TIER_CENTS = 499;

// Chat
export const MAX_RESPONSE_TOKENS = 1024;
export const CHAT_HISTORY_LIMIT = 10; // recent messages kept in context
export const RAG_CHUNK_TOKENS = 512;
export const RAG_CHUNK_OVERLAP = 64;
export const RAG_TOP_K = 8;

// AI model (update when new models ship)
export const CHAT_MODEL = 'claude-sonnet-4-6';

// Embeddings (Voyage AI — recommended pairing with Claude)
export const EMBEDDING_MODEL = 'voyage-3.5-lite';
export const EMBEDDING_DIM = 1024;

// App URL
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.twiinn.ai';

export type PricingTier = { cents: number; credits: number; name: string };

/**
 * Validate that a requested price matches a real tier configured on a twin.
 * Returns the matched tier or null. Prevents price manipulation.
 */
export function validateTier(
  requestedCents: number | undefined,
  twinSettings: { pricing_tiers?: PricingTier[] } | null,
  twinMonthlyPriceCents: number
): PricingTier | null {
  const tiers: PricingTier[] = twinSettings?.pricing_tiers?.length
    ? twinSettings.pricing_tiers
    : DEFAULT_TIERS;

  // No price requested → default to the twin's standard price tier
  if (requestedCents == null) {
    const standard = tiers.find((t) => t.cents === twinMonthlyPriceCents) ?? tiers[1] ?? tiers[0];
    return standard ?? null;
  }

  // Requested price must match a real tier exactly
  const matched = tiers.find((t) => t.cents === requestedCents);
  return matched ?? null;
}
