import { z } from 'zod';

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
  pricingTiers: z
    .array(
      z.object({
        cents: z.number().int().positive(),
        credits: z.number().int().positive(),
        name: z.string(),
      })
    )
    .optional(),
  monthlyPriceCents: z.number().int().positive().optional(),
  creditsPerMonth: z.number().int().positive().optional(),
});

export const trainContentSchema = z.object({
  sourceType: z.enum(['upload', 'youtube', 'tiktok', 'instagram', 'text', 'questionnaire']),
  rawText: z.string().trim().max(50000).optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable(),
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
  /** Publish toggle: 'active' makes the public page live, 'draft' hides it. */
  status: z.enum(['active', 'draft']).optional(),
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
