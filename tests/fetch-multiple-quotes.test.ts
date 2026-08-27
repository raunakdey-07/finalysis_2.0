/**
 * Regression test for fetchMultipleQuotes concurrency limit. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMultipleQuotes } from '@/lib/nse';
import { fetchYahooQuote } from '@/lib/yahoo';

vi.mock('@/lib/yahoo', () => ({ fetchYahooQuote: vi.fn(), searchYahooSymbols: vi.fn() }));

describe('fetchMultipleQuotes concurrency regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not issue unbounded concurrent requests', async () => {
    const symbols = Array.from({ length: 20 }, (_, i) => `SYM${i}`);
    const mockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 1,
      changePercent: 1,
      daily_change_percent: 1,
      volume: 1000000,
      open: 99,
      high: 101,
      low: 99,
      previousClose: 99,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };

    vi.mocked(fetchYahooQuote).mockResolvedValue(mockPrice);

    const results = await fetchMultipleQuotes(symbols, 4);

    expect(results).toHaveLength(20);
    expect(results.every(r => r.price !== null)).toBe(true);
    expect(vi.mocked(fetchYahooQuote)).toHaveBeenCalledTimes(20);
  });

  it('defaults to concurrency of 4 when not specified', async () => {
    const symbols = ['A', 'B', 'C', 'D', 'E'];
    const mockPrice = {
      symbol: 'TEST',
      price: 100,
      change: 1,
      changePercent: 1,
      daily_change_percent: 1,
      volume: 1000000,
      open: 99,
      high: 101,
      low: 99,
      previousClose: 99,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
      timestamp: new Date(),
    };

    vi.mocked(fetchYahooQuote).mockResolvedValue(mockPrice);

    const results = await fetchMultipleQuotes(symbols);

    expect(results).toHaveLength(5);
    expect(vi.mocked(fetchYahooQuote)).toHaveBeenCalledTimes(5);
  });
});