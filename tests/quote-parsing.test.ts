import { describe, expect, it } from 'vitest';
import { parseYahooChartResult, QuoteRejected } from '@/lib/yahoo';
import {
  YAHOO_FOREIGN_EQUITY,
  YAHOO_IDEA_LIVE,
  YAHOO_INFY_LIVE,
  YAHOO_MARKET_CLOSED,
  YAHOO_UNIT_ERROR,
} from './fixtures/yahoo';

describe('session change', () => {
  /**
   * The defect: the app used `chartPreviousClose`, which on a five-day request
   * is the close at the start of the window. INFY was up 0.30% on the day and
   * the app reported minus 2.55%.
   */
  it('uses the provider session change, not the five-day window change', () => {
    const quote = parseYahooChartResult(YAHOO_INFY_LIVE, 'INFY');
    expect(quote.changePercent).toBeCloseTo(0.3, 6);
    expect(quote.changePercent).toBeGreaterThan(0);
  });

  it('derives the absolute move from the percentage and the last price', () => {
    const quote = parseYahooChartResult(YAHOO_IDEA_LIVE, 'IDEA');
    expect(quote.price).toBe(13.47);
    expect(quote.changePercent).toBeCloseTo(-5.54, 6);
    expect(quote.change).toBeCloseTo(-0.79, 4);
  });

  /**
   * While the market is live the last bar has a null close, so the previous
   * session is the last populated bar. Once the market has closed that bar is
   * today, and the previous session is one further back.
   */
  it('identifies the previous session correctly while the market is live', () => {
    expect(parseYahooChartResult(YAHOO_IDEA_LIVE, 'IDEA').previousClose).toBeCloseTo(14.26, 6);
  });

  it('identifies the previous session correctly once the market has closed', () => {
    expect(parseYahooChartResult(YAHOO_MARKET_CLOSED, 'TCS').previousClose).toBeCloseTo(2082, 6);
  });

  it('leaves the change absent rather than zero when nothing can be derived', () => {
    const noSeries = {
      meta: { currency: 'INR', regularMarketPrice: 100, regularMarketTime: 1790588700 },
    };
    const quote = parseYahooChartResult(noSeries, 'TEST');
    expect(quote.changePercent).toBeNull();
    expect(quote.change).toBeNull();
  });
});

describe('fields the provider did not send', () => {
  it('does not invent an open price from the current price', () => {
    // regularMarketOpen is absent from the provider payload; the last bar's
    // open is the real one.
    expect(parseYahooChartResult(YAHOO_IDEA_LIVE, 'IDEA').dayOpen).toBeCloseTo(14.22, 6);
  });

  it('leaves missing series fields null instead of zero', () => {
    const sparse = {
      meta: { currency: 'INR', regularMarketPrice: 100, regularMarketTime: 1790588700 },
    };
    const quote = parseYahooChartResult(sparse, 'TEST');
    expect(quote.dayHigh).toBeNull();
    expect(quote.dayLow).toBeNull();
    expect(quote.fiftyTwoWeekHigh).toBeNull();
    expect(quote.fiftyTwoWeekLow).toBeNull();
  });
});

describe('freshness fields', () => {
  it('carries the exchange quote time rather than the fetch time', () => {
    const quote = parseYahooChartResult(YAHOO_IDEA_LIVE, 'IDEA');
    expect(quote.quotedAt).toBe(new Date(1790588700 * 1000).toISOString());
    expect(Date.parse(quote.fetchedAt)).toBeGreaterThanOrEqual(Date.parse(quote.quotedAt!));
  });

  it('records the exchange timezone so the page can render IST', () => {
    expect(parseYahooChartResult(YAHOO_IDEA_LIVE, 'IDEA').exchangeTimezone).toBe('Asia/Kolkata');
  });

  it('leaves the quote time null when the provider omits it', () => {
    const noTime = { meta: { currency: 'INR', regularMarketPrice: 100 } };
    expect(parseYahooChartResult(noTime, 'TEST').quotedAt).toBeNull();
  });
});

describe('rejection rules', () => {
  /** Guards against a price of the wrong company's instrument reaching the page. */
  it('rejects an instrument quoted in another currency', () => {
    expect(() => parseYahooChartResult(YAHOO_FOREIGN_EQUITY, 'IDEA')).toThrow(QuoteRejected);
  });

  it('rejects a price outside the plausible range for an NSE share', () => {
    expect(() => parseYahooChartResult(YAHOO_UNIT_ERROR, 'IDEA')).toThrow(QuoteRejected);
  });

  it('rejects a payload with no usable price', () => {
    expect(() => parseYahooChartResult({ meta: { currency: 'INR' } }, 'TEST')).toThrow(QuoteRejected);
  });

  it('accepts a very cheap but plausible share', () => {
    const cheap = {
      meta: { currency: 'INR', regularMarketPrice: 0.42, regularMarketTime: 1790588700 },
    };
    expect(parseYahooChartResult(cheap, 'PENNY').price).toBe(0.42);
  });
});
