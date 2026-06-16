import { z } from 'zod';
import { THEME_KEYS } from '@/lib/themes';
import { MIN_CENTS_PER_CREDIT, MIN_TIER_CENTS } from '@/lib/constants';

/** A pricing tier that can never lose the platform money. */
const profitableTier = z
  .object({
    cents: z.number().int().min(MIN_TIER_CENTS).max(99999),
    credits: z.number().int().min(10).max(5000),
    name: z.string().trim().min(1).max(20),
  })
  .refine((t) => t.cents >= t.credits * MIN_CENTS_PER_CREDIT, {
    message: `Each message must cost at least ${MIN_CENTS_PER_CREDIT}¢ — lower the message quota or raise the price`,
  });

export const sendMessageSchema = z.object({
  twinId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

export const subscribeSchema = z.object({
  twinId: z.string().uuid(),
  priceCents: z.number().int().positive().optional(),
  credits: z.number().int().positive().optional(),
});

export const createTwinSchema = z.object({
  name: z.string().trim().min(2).max(50),
  tagline: z.string().trim().max(120).optional().nullable(),
  niche: z.string().trim().min(1).max(40),
  personality: z.record(z.string(), z.number()).optional(),
  blockedTopics: z.array(z.string()).optional(),
  pricingTiers: z.array(profitableTier).min(1).max(3).optional(),
  monthlyPriceCents: z.number().int().min(MIN_TIER_CENTS).max(99999).optional(),
  creditsPerMonth: z.number().int().positive().optional(),
});

export const trainContentSchema = z.object({
  sourceType: z.enum(['upload', 'youtube', 'tiktok', 'instagram', 'text', 'questionnaire']),
  rawText: z.string().trim().max(50000).optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable(),
});

export const connectSocialSchema = z.object({
  platform: z.enum(['tiktok', 'instagram']),
  /** @handle or a profile URL — normalized server-side. */
  handle: z.string().trim().min(1).max(120),
});

export const moderateSchema = z.object({
  conversationId: z.string().uuid(),
  action: z.enum(['flag', 'unflag']),
});

export const updateProfileSchema = z.object({
  role: z.enum(['fan', 'creator']),
});

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
});

/** Social handle: letters/numbers/dot/underscore/dash, no @ or URLs. */
const socialHandle = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9._-]*$/, 'Handle only — no @ or links')
  .max(40)
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v ?? null));

export const updateTwinPublicProfileSchema = z.object({
  tagline: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null)),
  bio: z
    .string()
    .trim()
    .max(600)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null)),
  welcomeMessage: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null)),
  socials: z
    .object({
      instagram: socialHandle,
      tiktok: socialHandle,
      youtube: socialHandle,
      x: socialHandle,
      website: z
        .string()
        .trim()
        .max(200)
        .optional()
        .nullable()
        .transform((v) => (v === '' ? null : v ?? null))
        .refine((v) => v == null || /^https?:\/\/.+\..+/.test(v), {
          message: 'Website must be a full URL (https://…)',
        }),
    })
    .optional(),
  /** Background theme of the public page. */
  theme: z.enum(THEME_KEYS).optional(),
  /** Publish toggle: 'active' makes the public page live, 'draft' hides it. */
  status: z.enum(['active', 'draft']).optional(),
});

const personalityValue = z.number().int().min(0).max(100);

export const updateTwinBehaviorSchema = z.object({
  personality: z
    .object({
      tone: personalityValue.optional(),
      humor: personalityValue.optional(),
      length: personalityValue.optional(),
      emojis: personalityValue.optional(),
      energy: personalityValue.optional(),
    })
    .optional(),
  blockedTopics: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .optional(),
  /** The twin can speak one or several languages. */
  languages: z.array(z.enum(['en', 'fr', 'es'])).min(1).max(3).optional(),
  monthlyPriceCents: z.number().int().min(MIN_TIER_CENTS).max(99999).optional(),
  pricingTiers: z.array(profitableTier).min(1).max(3).optional(),
});

export const updateTwinIdentitySchema = z.object({
  /** What the creator calls their fans, e.g. "team", "fam", "les boys" */
  audienceNickname: z.string().trim().max(40).optional().nullable(),
  /** How they typically open a conversation */
  greeting: z.string().trim().max(200).optional().nullable(),
  /** Signature phrases they actually say */
  catchphrases: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  /** Strong opinions they're known for */
  opinions: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
  /** Things they would never say / do */
  neverSay: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  /** Short backstory in their own words */
  backstory: z.string().trim().max(1200).optional().nullable(),
  /** Real Q→A examples in their voice — the most powerful signal */
  voiceExamples: z
    .array(
      z.object({
        q: z.string().trim().min(3).max(300),
        a: z.string().trim().min(3).max(600),
      })
    )
    .max(5)
    .optional(),
});

// ── Posts (creator membership feed) ──────────────────────────────

/** Request a signed upload URL for a post's image/video. */
export const postUploadUrlSchema = z.object({
  mediaType: z.enum(['image', 'video']),
  contentType: z.string().trim().min(1).max(100),
});

/**
 * Create a post. A post is text-only, or text + one media item.
 * - 'text'  → no media_url
 * - 'image'/'video' → media_url required
 * Must carry at least body or media.
 */
export const createPostSchema = z
  .object({
    body: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v === '' ? null : v ?? null)),
    mediaUrl: z.string().url().max(1000).optional().nullable(),
    mediaType: z.enum(['text', 'image', 'video']).default('text'),
    visibility: z.enum(['public', 'subscribers']).default('public'),
  })
  .refine((p) => (p.mediaType === 'text' ? !p.mediaUrl : !!p.mediaUrl), {
    message: 'media_type must match whether media is attached',
  })
  .refine((p) => (p.body && p.body.length > 0) || p.mediaType !== 'text', {
    message: 'A post needs text or media',
  });

/** A fan comment on a post. */
export const addCommentSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

/**
 * Parse a request body against a schema.
 * Returns { data } on success or { error: Response } on failure.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return {
      data: null,
      error: Response.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      data: null,
      error: Response.json(
        { error: 'Validation failed', details: result.error.issues },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}
