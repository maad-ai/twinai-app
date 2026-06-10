import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Single Redis instance from env (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
const redis = Redis.fromEnv();

// Chat: 20 messages per minute per user
export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:chat',
  analytics: true,
});

// General API: 100 requests per minute per user
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'rl:api',
});

// Upload/train: 10 per 10 minutes per user
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'rl:upload',
});

/**
 * Check a rate limit. Returns null if allowed, or a 429 Response if blocked.
 * Usage: const blocked = await checkRateLimit(chatRateLimit, userId); if (blocked) return blocked;
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<Response | null> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    if (!success) {
      return Response.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      );
    }
    return null;
  } catch (err) {
    // If Redis is down, fail open (allow the request) but log it
    console.error('Rate limit check failed (failing open):', err);
    return null;
  }
}
