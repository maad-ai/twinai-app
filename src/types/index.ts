/**
 * Shared domain types matching the API response shapes consumed by (app) pages.
 */

/** A pricing tier stored in `twins.settings.pricing_tiers`. */
export interface PricingTier {
  cents: number;
  credits: number;
  name: string;
}

/** Full twin profile as returned by GET /api/explore/[twinSlug]. */
export interface Twin {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  niche: string;
  monthly_price_cents: number;
  total_subscribers: number;
  total_messages: number;
  photo_url?: string | null;
  /** Twiinn Certified badge — optional: the DB column may not exist yet. */
  certified?: boolean;
  settings: {
    welcome_message?: string;
    pricing_tiers?: PricingTier[];
  };
}

/** Compact twin shape embedded in subscription/conversation responses. */
export interface TwinSummary {
  id: string;
  name: string;
  slug: string;
  niche: string;
  monthly_price_cents: number;
}

/** A fan subscription as returned by GET /api/subscription. */
export interface Subscription {
  id: string;
  status: string;
  credits_remaining: number;
  credits_total: number;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  twins: TwinSummary;
}

/** A conversation list item as returned by GET /api/chat. */
export interface ConversationSummary {
  id: string;
  last_message_at: string;
  message_count: number;
  twin_id: string;
  twins: Pick<TwinSummary, 'name' | 'slug' | 'niche'>;
}

/** A single chat message (persisted or streaming) in the chat UI. */
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}
