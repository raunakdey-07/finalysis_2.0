import { StockPrice } from '@/types';
import { fetchJson } from '@/lib/utils/fetch-with-timeout';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Plausibility band for an NSE share price in rupees.
 *
 * This is a unit-error guard, not a business rule. It catches provider glitches
 * that hand back a fraction of a rupee or a misplaced decimal, and it rejects
 * loudly rather than displaying the number.
 */
const MIN_PLAUSIBLE_PRICE = 0.01;
const MAX_PLAUSIBLE_PRICE = 100_000;

/** An NSE equity is quoted in rupees. Anything else is a different instrument. */
const EXPECTED_CURRENCY = 'INR';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * A quote as the provider reports it, before Finalysis decides how fresh it is.
 * The freshness label is added one layer up, where the retrieval path is known.
 */
export type YahooQuote = Omit<StockPrice, 'freshness'>;

type YahooSeries = {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
};

export interface YahooChartMeta {
  symbol?: string;
  longName?: string;
  shortName?: string;
  currency?: string;
  exchangeName?: string;
  exchangeTimezoneName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  fulldayChange?: number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketTime?: number;
}

export interface YahooChartResult {
  meta?: YahooChartMeta;
  indicators?: { quote?: YahooSeries[] };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { code?: string; description?: string } | null;
  };
}

export class QuoteRejected extends Error {
  constructor(public readonly symbol: string, public readonly reason: string) {
    super(reason);
    this.name = 'QuoteRejected';
  }
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function atLastIndex(series: (number | null)[] | undefined): number | null {
  if (!series || series.length === 0) return null;
  const value = series[series.length - 1];
  return isPositiveNumber(value) ? value : null;
}

/**
 * Close of the session before the one being quoted.
 *
 * Yahoo leaves the current session's close null while the session is live, and
 * fills it in once the market closes. So the last populated bar is the previous
 * session while trading, and today's bar once the market has closed, where we
 * need to step one further back.
 */
function previousSessionClose(series: (number | null)[] | undefined): number | null {
  if (!series || series.length === 0) return null;

  const populated: { index: number; value: number }[] = [];
  series.forEach((value, index) => {
    if (isPositiveNumber(value)) populated.push({ index, value });
  });

  if (populated.length === 0) return null;

  const last = populated[populated.length - 1];
  if (last.index < series.length - 1) return last.value;
  return populated.length >= 2 ? populated[populated.length - 2].value : null;
}

/** Convert a provider percentage against `price` into the absolute move. */
function absoluteFromPercent(price: number, percent: number): number {
  const denominator = 100 + percent;
  if (denominator === 0) return 0;
  return (price * percent) / denominator;
}

/**
 * Turn a Yahoo chart result into a quote, or reject it.
 *
 * Exported so the parsing rules can be tested against captured provider
 * payloads without a network call.
 */
export function parseYahooChartResult(
  result: YahooChartResult,
  requested: string
): YahooQuote {
  const meta = result.meta;
  const price = meta?.regularMarketPrice;

  if (!isPositiveNumber(price)) {
    throw new QuoteRejected(requested, 'Provider returned no usable price');
  }

  if (meta?.currency !== EXPECTED_CURRENCY) {
    throw new QuoteRejected(
      requested,
      `Provider quoted this instrument in ${meta?.currency ?? 'an unknown currency'}, not ${EXPECTED_CURRENCY}`
    );
  }

  if (price < MIN_PLAUSIBLE_PRICE || price > MAX_PLAUSIBLE_PRICE) {
    throw new QuoteRejected(
      requested,
      `Provider returned a price outside the plausible range for an NSE share`
    );
  }

  const series = result.indicators?.quote?.[0];
  const previousClose = previousSessionClose(series?.close);

  // Prefer the provider's own session change. It is the only value Yahoo
  // computes against the right baseline in both live and closed markets.
  let change: number | null = null;
  let changePercent: number | null = null;

  if (Number.isFinite(meta?.regularMarketChangePercent)) {
    changePercent = meta!.regularMarketChangePercent as number;
    change = absoluteFromPercent(price, changePercent);
  } else if (Number.isFinite(meta?.fulldayChange)) {
    change = meta!.fulldayChange as number;
    if (previousClose) changePercent = (change / previousClose) * 100;
  } else if (previousClose) {
    change = price - previousClose;
    changePercent = (change / previousClose) * 100;
  }

  const quotedAtSeconds = meta?.regularMarketTime;

  return {
    symbol: meta?.symbol ?? requested,
    price,
    change,
    changePercent,
    volume: isPositiveNumber(meta?.regularMarketVolume) ? meta.regularMarketVolume : null,
    previousClose,
    dayOpen: isPositiveNumber(meta?.regularMarketOpen)
      ? meta.regularMarketOpen
      : atLastIndex(series?.open),
    dayHigh: isPositiveNumber(meta?.regularMarketDayHigh) ? meta.regularMarketDayHigh : null,
    dayLow: isPositiveNumber(meta?.regularMarketDayLow) ? meta.regularMarketDayLow : null,
    fiftyTwoWeekHigh: isPositiveNumber(meta?.fiftyTwoWeekHigh) ? meta.fiftyTwoWeekHigh : null,
    fiftyTwoWeekLow: isPositiveNumber(meta?.fiftyTwoWeekLow) ? meta.fiftyTwoWeekLow : null,
    quotedAt: Number.isFinite(quotedAtSeconds)
      ? new Date((quotedAtSeconds as number) * 1000).toISOString()
      : null,
    fetchedAt: new Date().toISOString(),
    exchangeTimezone: meta?.exchangeTimezoneName ?? null,
  };
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResult | null> {
  const response = await fetchJson<YahooChartResponse>(
    `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: YAHOO_HEADERS },
    REQUEST_TIMEOUT_MS
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Yahoo Finance chart error: ${response.status}`);
  }

  return response.data.chart?.result?.[0] ?? null;
}

/**
 * Candidate Yahoo symbols for an NSE ticker, most specific first.
 *
 * The NSE listing is authoritative. We deliberately do not consult Yahoo's
 * fuzzy search to guess a ticker, because that search happily returns an
 * unrelated company whose symbol merely resembles the query, and a price from
 * one company paired with fundamentals from another is worse than no price.
 */
function buildQuoteCandidates(symbol: string): string[] {
  const normalized = symbol.toUpperCase().trim();

  if (normalized.includes('.')) return [normalized];

  return [`${normalized}.NS`, `${normalized}.BO`, normalized];
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const candidates = buildQuoteCandidates(symbol);
  let rejection: Error | null = null;
  let rejected = 0;

  for (const candidate of candidates) {
    try {
      const result = await fetchYahooChart(candidate);
      if (result) return parseYahooChartResult(result, symbol);
    } catch (error) {
      rejection = error instanceof Error ? error : new Error('Yahoo Finance quote fetch failed');
      rejected += 1;
    }
  }

  // A candidate that returned nothing was a 404, which is a real answer. If any
  // candidate instead failed outright, that failure is the useful one to report,
  // otherwise a dead connection reads downstream as "no such ticker".
  if (rejection && rejected > 0) throw rejection;

  throw new Error(`No NSE quote available for ${symbol}`);
}
