import type { YahooChartResult } from '@/lib/yahoo';

/**
 * Yahoo chart payloads captured from live responses.
 *
 * The important detail in each of these is that the last bar's close is null
 * while the market is live, and that `chartPreviousClose` equals the close at
 * index 0, the start of the requested window. Reading either as the previous
 * session is the bug these fixtures exist to prevent.
 */

function chart(meta: YahooChartResult['meta'], series: {
  open: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}): YahooChartResult {
  return {
    meta,
    indicators: { quote: [{ ...series, high: series.open, low: series.open }] },
  };
}

/** INFY: up 0.30% on the day, but down 2.55% across the five-day window. */
export const YAHOO_INFY_LIVE: YahooChartResult = chart(
  {
    symbol: 'INFY.NS',
    currency: 'INR',
    exchangeName: 'NSI',
    exchangeTimezoneName: 'Asia/Kolkata',
    regularMarketPrice: 1003.2,
    regularMarketChangePercent: 0.3,
    regularMarketVolume: 8565153,
    regularMarketDayHigh: 1009.5,
    regularMarketDayLow: 986.6,
    fiftyTwoWeekHigh: 1728,
    fiftyTwoWeekLow: 982.4,
    regularMarketTime: 1790588700,
  },
  {
    open: [1037.7, 1021.8, 1015, 999.5, 1002],
    close: [1029.4, 1020.5, 1014.5, 1000.2, null],
    volume: [9341109, 5108734, 6891893, 10240700, 8565153],
  }
);

/** IDEA: down 5.54% on the day against a 14.26 previous close. */
export const YAHOO_IDEA_LIVE: YahooChartResult = chart(
  {
    symbol: 'IDEA.NS',
    currency: 'INR',
    exchangeName: 'NSI',
    exchangeTimezoneName: 'Asia/Kolkata',
    regularMarketPrice: 13.47,
    regularMarketChangePercent: -5.54,
    regularMarketVolume: 500210548,
    regularMarketDayHigh: 14.23,
    regularMarketDayLow: 13.43,
    fiftyTwoWeekHigh: 15.79,
    fiftyTwoWeekLow: 8.02,
    regularMarketTime: 1790588700,
  },
  {
    open: [13.89, 14.26, 14.42, 14.15, 14.22],
    close: [14.27, 14.52, 14.12, 14.26, null],
    volume: [527812273, 272140999, 364050771, 309260435, 500210548],
  }
);

/** Timestamps are exposed for tests that assert freshness rendering. */

/** A US listing that happens to share the ticker "IDEA". */
export const YAHOO_FOREIGN_EQUITY: YahooChartResult = chart(
  {
    symbol: 'IDEA',
    currency: 'USD',
    exchangeName: 'OID',
    regularMarketPrice: 1.7,
    regularMarketTime: 1790588700,
  },
  { open: [1.6], close: [1.7], volume: [1000] }
);

/** A provider glitch handing back a fraction of a rupee instead of the real price. */
export const YAHOO_UNIT_ERROR: YahooChartResult = chart(
  {
    symbol: 'IDEA.NS',
    currency: 'INR',
    regularMarketPrice: 0.0017,
    regularMarketTime: 1790588700,
  },
  { open: [0.0017], close: [0.0017], volume: [1000] }
);

/** Market closed: the last bar has a close, so the previous session is one back. */
export const YAHOO_MARKET_CLOSED: YahooChartResult = chart(
  {
    symbol: 'TCS.NS',
    currency: 'INR',
    exchangeTimezoneName: 'Asia/Kolkata',
    regularMarketPrice: 2070.7,
    regularMarketChangePercent: -1.1,
    regularMarketVolume: 2000000,
    regularMarketTime: 1790588700,
  },
  {
    open: [2080, 2085, 2075, 2069, 2070.7],
    close: [2075, 2080, 2071, 2082, 2070.7],
    volume: [1, 1, 1, 1, 2000000],
  }
);
