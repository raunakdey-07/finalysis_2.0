/**
 * Regression test for the NSE quote precedence fix.
 *
 * The bug that was fixed: daily snapshot was checked BEFORE live sources,
 * making supposedly real-time quotes effectively stale during market hours.
 *
 * The intended precedence is now:
 *  1. live cache
 *  2. live fetch
 *  3. snapshot fallback
 *  4. unavailable
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNSEQuote } from '@/lib/nse';
import { fetchYahooQuote } from '@/lib/yahoo';
import { getDailyPricesSnapshot } from '@/lib/nse/daily-prices';
import cache from '@/lib/cache';

vi.mock('@/lib/yahoo', () => ({
  fetchYahooQuote: vi.fn(),
  searchYahooSymbols: vi.fn(),
}));

vi.mock('@/lib/nse/daily-prices', () => ({
  getDailyPricesSnapshot: vi.fn(),
}));

describe('fetchNSEQuote precedence regression', () => {
  const recentTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers live fetch over snapshot when live succeeds', async () => {
    const mockLivePrice = {
      symbol: 'TEST',
      price: 150,
      change: 3,
      changePercent: 2,
      daily_change_percent: 2,
      volume: 2000000,
      open: 148,
      high: 152,
      low: 147,
      previousClose: 147,
      fiftyTwoWeekHigh: 160,
      fiftyTwoWeekLow: 120,
      timestamp: new Date('2025-01-01T10:00:00Z'),
    };

    vi.mocked(fetchYahooQuote).mockResolvedValue(mockLivePrice);
    vi.mocked(getDailyPricesSnapshot).mockResolvedValue({
      updatedAt: recentTimestamp,
      source: 'Yahoo Finance close snapshot',
      totalSymbols: 1,
      succeeded: 1,
      failed: 0,
      items: {
        TEST: {
          ...mockLivePrice,
          timestamp: new Date('2025-01-01T09:00:00Z'),
        },
      },
    });

    const result = await fetchNSEQuote('TEST', { allowSnapshot: true });

    expect(result.price).not.toBeNull();
    expect(result.provenance.source).toBe('Yahoo Finance API');
    expect(result.provenance.confidenceLevel).toBe('high');
  });

  it('falls back to snapshot when live fetch fails', async () => {
    const mockSnapshotPrice = {
      symbol: 'TEST',
      price: 145,
      change: 1,
      changePercent: 0.7,
      daily_change_percent: 0.7,
      volume: 1800000,
      open: 144,
      high: 146,
      low: 143,
      previousClose: 144,
      fiftyTwoWeekHigh: 160,
      fiftyTwoWeekLow: 120,
      timestamp: new Date('2025-01-01T09:00:00Z'),
    };

    vi.mocked(fetchYahooQuote).mockRejectedValue(new Error('Yahoo down'));
    vi.mocked(getDailyPricesSnapshot).mockResolvedValue({
      updatedAt: recentTimestamp,
      source: 'Yahoo Finance close snapshot',
      totalSymbols: 1,
      succeeded: 1,
      failed: 0,
      items: {
        TEST: mockSnapshotPrice,
      },
    });

    const result = await fetchNSEQuote('TEST', { allowSnapshot: true });

    expect(result.price).not.toBeNull();
    expect(result.provenance.source).toBe('Daily close snapshot (Redis)');
    expect(result.provenance.confidenceLevel).toBe('medium');
    expect(result.provenance.warnings).toBeDefined();
  });

  it('returns unavailable when both live and snapshot fail', async () => {
    vi.mocked(fetchYahooQuote).mockRejectedValue(new Error('Yahoo down'));
    vi.mocked(getDailyPricesSnapshot).mockResolvedValue(null);

    const result = await fetchNSEQuote('TEST', { allowSnapshot: true });

    expect(result.price).toBeNull();
    expect(result.provenance.confidenceLevel).toBe('derived');
  });

  it('respects allowSnapshot=false and skips snapshot', async () => {
    vi.mocked(fetchYahooQuote).mockRejectedValue(new Error('Yahoo down'));
    vi.mocked(getDailyPricesSnapshot).mockResolvedValue({
      updatedAt: recentTimestamp,
      source: 'Yahoo Finance close snapshot',
      totalSymbols: 1,
      succeeded: 1,
      failed: 0,
      items: {
        TEST: {
          symbol: 'TEST',
          price: 145,
          change: 1,
          changePercent: 0.7,
          daily_change_percent: 0.7,
          volume: 1800000,
          open: 144,
          high: 146,
          low: 143,
          previousClose: 144,
          fiftyTwoWeekHigh: 160,
          fiftyTwoWeekLow: 120,
          timestamp: new Date('2025-01-01T09:00:00Z'),
        },
      },
    });

    const result = await fetchNSEQuote('TEST', { allowSnapshot: false });

    expect(result.price).toBeNull();
    expect(result.provenance.source).toBe('Yahoo Finance API');
  });

  it('respects allowSnapshot=false and skips snapshot', async () => {
    vi.mocked(fetchYahooQuote).mockRejectedValue(new Error('Yahoo down'));
    vi.mocked(getDailyPricesSnapshot).mockResolvedValue({
      updatedAt: recentTimestamp,
      source: 'Yahoo Finance close snapshot',
      totalSymbols: 1,
      succeeded: 1,
      failed: 0,
      items: {
        TEST: {
          symbol: 'TEST',
          price: 145,
          change: 1,
          changePercent: 0.7,
          daily_change_percent: 0.7,
          volume: 1800000,
          open: 144,
          high: 146,
          low: 143,
          previousClose: 144,
          fiftyTwoWeekHigh: 160,
          fiftyTwoWeekLow: 120,
          timestamp: new Date('2025-01-01T09:00:00Z'),
        },
      },
    });

    const result = await fetchNSEQuote('TEST', { allowSnapshot: false });

    expect(result.price).toBeNull();
    expect(result.provenance.source).toBe('Yahoo Finance API');
  });
});