import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The price path has one job when everything upstream is down: return an old
 * value honestly labelled, or return nothing. It must never invent one, and it
 * must never hand back a value so old that "last close" stops being true.
 */

const snapshotState: { items: Record<string, unknown>; updatedAt: string } = {
  items: {},
  updatedAt: new Date().toISOString(),
};

vi.mock('@/lib/yahoo', () => ({
  fetchYahooQuote: vi.fn(async () => {
    throw new Error('fetch failed');
  }),
}));

vi.mock('@/lib/nse/daily-prices', async () => {
  const actual = await vi.importActual<typeof import('@/lib/nse/daily-prices')>(
    '@/lib/nse/daily-prices'
  );
  return {
    ...actual,
    isRedisConfigured: () => true,
    getDailyPricesSnapshot: vi.fn(async () => ({
      updatedAt: snapshotState.updatedAt,
      source: 'test',
      totalSymbols: Object.keys(snapshotState.items).length,
      succeeded: Object.keys(snapshotState.items).length,
      failed: 0,
      items: snapshotState.items,
    })),
  };
});

const DAY_MS = 24 * 60 * 60 * 1000;

function storedQuote(fetchedAt: string) {
  return {
    symbol: 'RELIANCE',
    price: 1000,
    change: 0,
    changePercent: 0,
    recentChangePercent: 0,
    volume: 1,
    previousClose: 1000,
    dayOpen: 1000,
    dayHigh: 1000,
    dayLow: 1000,
    fiftyTwoWeekHigh: 1200,
    fiftyTwoWeekLow: 900,
    quotedAt: fetchedAt,
    fetchedAt,
    exchangeTimezone: 'Asia/Kolkata',
  };
}

async function fetchWithProviderDown() {
  const { fetchNSEQuote } = await import('@/lib/nse');
  return fetchNSEQuote('RELIANCE');
}

describe('the end-of-day snapshot fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    snapshotState.updatedAt = new Date().toISOString();
    snapshotState.items = { RELIANCE: storedQuote(new Date().toISOString()) };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Each cron run merges its slice into the same record, so the snapshot's own
   * updatedAt is the time the newest symbol was captured. A symbol that keeps
   * failing keeps a quote of any age, and the window was only ever checked
   * against the snapshot, so a two-month-old close was served under a
   * three-week guarantee.
   */
  it('does not serve a symbol whose own quote is older than the window', async () => {
    // A fresh snapshot overall, but this symbol last succeeded two months ago.
    snapshotState.updatedAt = new Date().toISOString();
    snapshotState.items = { RELIANCE: storedQuote(new Date(Date.now() - 60 * DAY_MS).toISOString()) };

    const { price, provenance } = await fetchWithProviderDown();

    expect(price).toBeNull();
    expect(provenance.confidenceLevel).toBe('unavailable');
  });

  it('serves a symbol inside the window, and says it is a close rather than a live price', async () => {
    snapshotState.items = { RELIANCE: storedQuote(new Date(Date.now() - 2 * DAY_MS).toISOString()) };

    const { price } = await fetchWithProviderDown();

    expect(price).not.toBeNull();
    expect(price!.freshness.kind).toBe('daily-close');
    // The reported age is the quote's own, not the snapshot's.
    expect(price!.freshness.ageMs).toBeGreaterThan(1.5 * DAY_MS);
  });

  it('refuses a quote with no usable age rather than guessing one', async () => {
    snapshotState.items = { RELIANCE: { ...storedQuote('not-a-date') } };

    const { price } = await fetchWithProviderDown();
    expect(price).toBeNull();
  });

  it('never reports a snapshot value as live', async () => {
    const { price } = await fetchWithProviderDown();
    expect(price!.freshness.kind).not.toBe('live');
  });
});
