import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The snapshot job fans out to every covered ticker, so it is the one endpoint
 * where an open door is expensive. These tests pin the authentication and the
 * bounds that keep a single request from turning into thousands of upstream
 * calls.
 */

const REPOUND_CALLS = { count: 0 };

vi.mock('@/lib/nse', () => ({
  fetchNSEQuote: vi.fn(async () => {
    REPOUND_CALLS.count += 1;
    return {
      price: {
        symbol: 'TEST',
        price: 100,
        change: 1,
        changePercent: 1,
        volume: 10,
        previousClose: 99,
        dayOpen: 99,
        dayHigh: 101,
        dayLow: 98,
        fiftyTwoWeekHigh: 120,
        fiftyTwoWeekLow: 80,
        quotedAt: '2026-09-28T10:00:00.000Z',
        fetchedAt: '2026-09-28T10:00:05.000Z',
        exchangeTimezone: 'Asia/Kolkata',
        freshness: { kind: 'live' as const, ageMs: 5000 },
      },
      provenance: {
        source: 'Yahoo Finance',
        cacheTTL: '10m',
        cacheHit: false,
        lastUpdated: '2026-09-28T10:00:00.000Z',
        confidenceLevel: 'high' as const,
      },
    };
  }),
  normalizeSymbol: (value: string) => value.toUpperCase(),
}));

vi.mock('@/lib/nse/daily-prices', () => ({
  isRedisConfigured: () => Boolean(process.env.KV_REDIS_URL),
  getDailyPricesSnapshot: vi.fn(async () => null),
  setDailyPricesSnapshot: vi.fn(async () => undefined),
}));

async function callCron(query: string, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/cron/update-prices/route');
  const request = new NextRequest(`http://localhost/api/cron/update-prices${query}`, { headers });
  const response = await GET(request);
  return { status: response.status, body: await response.json() };
}

describe('cron authentication', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'a-long-random-secret';
    process.env.KV_REDIS_URL = 'redis://localhost:6379';
    REPOUND_CALLS.count = 0;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.KV_REDIS_URL;
    vi.resetModules();
  });

  /**
   * The route used to accept a plain `x-vercel-cron: 1` request header as proof
   * of a scheduled run. That header is supplied by the client, so anyone could
   * set it and skip the secret. The header is now ignored entirely, so a
   * request carrying it still has to present the bearer token.
   */
  it('ignores a forged cron header instead of treating it as authentication', async () => {
    const { status, body } = await callCron('?limit=1', { 'x-vercel-cron': '1' });
    expect(status).toBe(401);
    expect(body.errorCode).toBe('UNAUTHORIZED');
    expect(REPOUND_CALLS.count).toBe(0);
  });

  it('rejects a request with no credentials', async () => {
    const { status } = await callCron('?limit=1');
    expect(status).toBe(401);
    expect(REPOUND_CALLS.count).toBe(0);
  });

  it('rejects a wrong bearer token', async () => {
    const { status } = await callCron('?limit=1', { authorization: 'Bearer wrong' });
    expect(status).toBe(401);
  });

  /** An unset secret must close the route, not open it. */
  it('fails closed when no secret is configured', async () => {
    delete process.env.CRON_SECRET;
    const { status, body } = await callCron('?limit=1');
    expect(status).toBe(503);
    expect(body.errorCode).toBe('CRON_NOT_CONFIGURED');
  });

  it('still rejects a bad token when the secret is set, before touching Redis', async () => {
    delete process.env.KV_REDIS_URL;
    const { status } = await callCron('?limit=50', { authorization: 'Bearer wrong' });
    expect(status).toBe(401);
    expect(REPOUND_CALLS.count).toBe(0);
  });

  it('refuses to fan out when Redis is missing, before spending any requests', async () => {
    delete process.env.KV_REDIS_URL;
    const { status, body } = await callCron('?limit=50', {
      authorization: 'Bearer a-long-random-secret',
    });
    expect(status).toBe(503);
    expect(body.errorCode).toBe('REDIS_NOT_CONFIGURED');
    expect(REPOUND_CALLS.count).toBe(0);
  });

  it('accepts a correctly authenticated request', async () => {
    const { status } = await callCron('?limit=2', {
      authorization: 'Bearer a-long-random-secret',
    });
    expect(status).toBe(200);
  });
});

describe('cron bounds', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'a-long-random-secret';
    process.env.KV_REDIS_URL = 'redis://localhost:6379';
    REPOUND_CALLS.count = 0;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.KV_REDIS_URL;
    vi.resetModules();
  });

  /** `concurrency` was previously unbounded, so one request could fan out unboundedly. */
  it('clamps a caller-supplied batch size to its ceiling', async () => {
    const { body } = await callCron('?limit=999999', {
      authorization: 'Bearer a-long-random-secret',
    });

    expect(body.requested).toBeLessThanOrEqual(600);
    expect(REPOUND_CALLS.count).toBe(body.requested);
  });

  it('completes a slice of the universe rather than all of it', async () => {
    const { body } = await callCron('', { authorization: 'Bearer a-long-random-secret' });
    expect(body.covered).toBeGreaterThan(2000);
    expect(body.requested).toBeLessThan(body.covered);
  });

  it('falls back to the default for a non-numeric bound', async () => {
    const { body } = await callCron('?limit=abc&concurrency=xyz', {
      authorization: 'Bearer a-long-random-secret',
    });
    expect(body.requested).toBe(300);
  });
});
