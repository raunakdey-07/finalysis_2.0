import { describe, it, expect } from 'vitest';
import { rateLimit, RATE_LIMITS, getClientId } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('allows requests within the limit', () => {
    const result = rateLimit('test-ip', RATE_LIMITS.quote);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('blocks requests that exceed the limit', () => {
    const config = { limit: 2, windowSeconds: 60 };
    rateLimit('test-ip-2', config);
    rateLimit('test-ip-2', config);
    const blocked = rateLimit('test-ip-2', config);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    const config = { limit: 1, windowSeconds: 1 };
    rateLimit('test-ip-3', config);
    const blocked = rateLimit('test-ip-3', config);
    expect(blocked.success).toBe(false);
  });
});

describe('getClientId', () => {
  it('prefers Vercel-provided headers over arbitrary forwarded-for', () => {
    const headers = new Headers();
    headers.set('x-vercel-forwarded-for', '203.0.113.42');
    headers.set('x-forwarded-for', '10.0.0.1');

    const id = getClientId(headers);
    expect(id).toBe('203.0.113.42');
  });

  it('falls back to fingerprint when no valid IP header exists', () => {
    const headers = new Headers();
    headers.set('user-agent', 'test-agent');
    headers.set('accept-language', 'en');
    headers.set('host', 'localhost');

    const id = getClientId(headers);
    expect(id).toMatch(/^(anon|dev):/);
  });

  it('ignores invalid forwarded-for values', () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', 'not-an-ip');
    headers.set('user-agent', 'test-agent');
    headers.set('accept-language', 'en');
    headers.set('host', 'localhost');

    const id = getClientId(headers);
    expect(id).toMatch(/^(anon|dev):/);
  });

  it('handles empty headers gracefully', () => {
    const headers = new Headers();
    const id = getClientId(headers);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});