/**
 * Simple in-memory rate limiter
 * Limits requests per IP to prevent abuse
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = 20_000;

function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}

function enforceStoreBounds(now: number): void {
  cleanupExpiredEntries(now);

  if (store.size < MAX_RATE_LIMIT_ENTRIES) {
    return;
  }

  // Reserve one free slot for the next insertion.
  const overflow = store.size - MAX_RATE_LIMIT_ENTRIES + 1;
  const entries = Array.from(store.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt);

  for (let i = 0; i < overflow; i += 1) {
    store.delete(entries[i][0]);
  }
}

function isValidIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function isLikelyIPv6(value: string): boolean {
  return value.includes(':') && /^[0-9a-f:]+$/i.test(value);
}

function normalizeIpCandidate(value: string): string {
  let candidate = value.trim().replace(/^for=/i, '').replace(/^"|"$/g, '');

  if (candidate.startsWith('[')) {
    const closingBracket = candidate.indexOf(']');
    if (closingBracket > 0) {
      candidate = candidate.slice(1, closingBracket);
    }
  }

  if (candidate.includes('.') && candidate.includes(':')) {
    candidate = candidate.split(':')[0];
  }

  return candidate;
}

function isValidIpAddress(value: string): boolean {
  return isValidIPv4(value) || isLikelyIPv6(value);
}

function getFirstValidForwardedIp(forwardedFor: string): string | null {
  const candidates = forwardedFor.split(',').map((part) => normalizeIpCandidate(part));
  const firstValid = candidates.find((candidate) => isValidIpAddress(candidate));
  return firstValid ?? null;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Clean up old entries every 5 minutes
const cleanupTimer = setInterval(() => {
  cleanupExpiredEntries(Date.now());
}, CLEANUP_INTERVAL_MS);

if (typeof cleanupTimer === 'object' && cleanupTimer !== null && 'unref' in cleanupTimer) {
  const maybeTimer = cleanupTimer as { unref?: () => void };
  maybeTimer.unref?.();
}

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
    enforceStoreBounds(now);

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
  // Prefer infra-provided direct client IP headers when present.
  const directHeaders = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-vercel-forwarded-for'),
  ];

  for (const candidate of directHeaders) {
    if (!candidate) continue;
    const normalized = normalizeIpCandidate(candidate);
    if (isValidIpAddress(normalized)) {
      return normalized;
    }
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = getFirstValidForwardedIp(forwardedFor);
    if (ip) return ip;
  }

  // Fallback to a stable anonymous fingerprint when no valid IP header exists.
  const userAgent = headers.get('user-agent') || 'unknown-agent';
  const acceptLanguage = headers.get('accept-language') || 'unknown-language';
  const host = headers.get('host') || 'unknown-host';
  const fingerprint = stableHash(`${userAgent}|${acceptLanguage}|${host}`);
  const prefix = process.env.NODE_ENV === 'production' ? 'anon' : 'dev';

  return `${prefix}:${fingerprint}`;
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
