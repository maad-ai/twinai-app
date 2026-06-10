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
