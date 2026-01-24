/**
 * Simple in-memory rate limiter
 * Limits requests per IP to prevent abuse
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export type RateLimitConfig = {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetIn: number;
};

/**
 * Check if a request should be rate limited
 * @param identifier - Usually the IP address or a unique client ID
 * @param config - Rate limit configuration
 */
export function rateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;

  let entry = store.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.limit) {
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetIn,
    };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Get client identifier from request headers
 * Works with Vercel, Cloudflare, and direct connections
 */
export function getClientId(headers: Headers): string {
  // Try various headers in order of reliability
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // Fallback for local development
  return 'localhost';
}

// Default configs for different endpoints
export const RATE_LIMITS = {
  /** Quote endpoint: 60 requests per minute */
  quote: { limit: 60, windowSeconds: 60 },
  /** Metrics endpoint: 30 requests per minute */
  metrics: { limit: 30, windowSeconds: 60 },
  /** News endpoint: 30 requests per minute */
  news: { limit: 30, windowSeconds: 60 },
  /** Search endpoint: 20 requests per minute */
  search: { limit: 20, windowSeconds: 60 },
} as const;
