/**
 * Provider politeness.
 *
 * The app depends on two public providers that will refuse an address that
 * asks too often. These pin the two rules that keep it a good citizen: a rate
 * limit is an answer rather than a fault, and its cooldown is parsed and
 * carried rather than thrown away.
 */
import { describe, expect, it } from 'vitest';
import { isWorthRetrying, parseRetryAfter, RateLimited } from '@/lib/errors';

describe('rate limiting', () => {
  it('is not worth retrying, unlike a transport failure', () => {
    expect(isWorthRetrying(new RateLimited(1000))).toBe(false);
    expect(isWorthRetrying(new Error('fetch failed'))).toBe(true);
    expect(isWorthRetrying(new Error('Yahoo Finance chart error: 503'))).toBe(true);
  });

  it('carries a cooldown so the caller can wait instead of hammering', () => {
    expect(new RateLimited(45000).retryAfterMs).toBe(45000);
  });
});

describe('parseRetryAfter', () => {
  it('reads a delay in seconds', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('reads an HTTP date', () => {
    const inSixtySeconds = new Date(Date.now() + 60_000).toUTCString();
    const parsed = parseRetryAfter(inSixtySeconds);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeGreaterThan(50_000);
    expect(parsed!).toBeLessThanOrEqual(70_000);
  });

  it('caps a hostile or mistaken header so the app cannot park for minutes', () => {
    expect(parseRetryAfter('99999')).toBe(120_000);
  });

  it('returns null when the header is absent or unreadable', () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });

  it('never returns a negative cooldown for a date in the past', () => {
    const longAgo = new Date(Date.now() - 600_000).toUTCString();
    expect(parseRetryAfter(longAgo)).toBe(0);
  });
});
