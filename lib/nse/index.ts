import { ConfidenceLevel, Provenance, StockPrice } from '@/types';
import cache from '@/lib/cache';
import { describeOutage, isWorthRetrying, logDetail } from '@/lib/errors';
import { getDailyPricesSnapshot, MAX_SNAPSHOT_AGE_MS, StoredQuote } from '@/lib/nse/daily-prices';
import { fetchYahooQuote } from '@/lib/yahoo';
import { increment, setGauge } from '@/lib/observability/metrics';
import '@/lib/observability/definitions';

/**
 * How long a fetched quote is reused.
 *
 * Thirty minutes, up from ten. The exchange data itself is already around
 * fifteen minutes behind, so a shorter window mostly bought extra requests
 * against a provider that rate limits, and the page states the quote's own
 * timestamp rather than the age of the copy, so a longer window costs the
 * reader nothing they can see. The snapshot fallback and the stale-cache path
 * behind it are what a longer outage falls back to.
 */
const QUOTE_TTL_MS = 30 * 60 * 1000;
/** The same window in the units the reader sees, derived so it cannot drift. */
const QUOTE_TTL_LABEL = `${QUOTE_TTL_MS / 60_000}m`;
const CIRCUIT_BREAKER_THRESHOLD = 4;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;
const RETRY_DELAYS_MS = [400, 800];

type CircuitState = { failures: number; openedAt: number | null; state: 'closed' | 'open' };

const circuit: CircuitState = { failures: 0, openedAt: null, state: 'closed' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Canonical form of an NSE ticker, used for every cache key and provider call. */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.NS$/i, '');
}

const quoteCacheKey = (symbol: string) => `quote_v2_${normalizeSymbol(symbol)}`;

function canRequest(): boolean {
  if (circuit.state === 'closed') return true;
  if (circuit.openedAt && Date.now() - circuit.openedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    circuit.failures = 0;
    circuit.openedAt = null;
    circuit.state = 'closed';
    return true;
  }
  return false;
}

function recordFailure(): void {
  circuit.failures += 1;
  if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuit.state = 'open';
    circuit.openedAt = Date.now();
  }
  setGauge('finalysis_circuit_breaker_open', { provider: 'price' }, circuit.state === 'open' ? 1 : 0);
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.openedAt = null;
  circuit.state = 'closed';
  setGauge('finalysis_circuit_breaker_open', { provider: 'price' }, 0);
}

async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      if (!isWorthRetrying(error)) break;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await sleep(delay);
    }
  }

  recordFailure();
  throw lastError instanceof Error ? lastError : new Error('Price provider request failed');
}

function buildProvenance(params: {
  source: string;
  cacheTTL: string;
  cacheHit: boolean;
  /** Timestamp of the underlying data, never of this response. */
  lastUpdated: string | null;
  confidenceLevel: ConfidenceLevel;
  warnings?: string[];
}): Provenance {
  return {
    source: params.source,
    cacheTTL: params.cacheTTL,
    cacheHit: params.cacheHit,
    lastUpdated: params.lastUpdated,
    confidenceLevel: params.confidenceLevel,
    warnings: params.warnings?.length ? params.warnings : undefined,
  };
}

export interface QuoteResult {
  price: StockPrice | null;
  provenance: Provenance;
}

function toPrice(quote: StoredQuote, freshness: StockPrice['freshness']): StockPrice {
  // One counter for the whole reliability story: how the price was obtained.
  increment('finalysis_price_freshness_total', {
    kind: freshness.kind === 'daily-close' ? 'daily_close' : freshness.kind,
  });
  return { ...quote, freshness };
}

function ageOf(isoTimestamp: string | null): number | null {
  if (!isoTimestamp) return null;
  const parsed = Date.parse(isoTimestamp);
  return Number.isNaN(parsed) ? null : Date.now() - parsed;
}

export type QuoteFetchOptions = {
  /** Set false for the snapshot job, which must record live prices only. */
  allowFallbacks?: boolean;
};

/**
 * Resolve a price for `symbol`, and say honestly how it was obtained.
 *
 * Order of preference: a fresh cached quote, a live fetch, then whichever of
 * the stale cache and the daily close is more recent. The result is always
 * labelled with its own age so the UI can distinguish a live price from a
 * cached one from an end-of-day close.
 */
export async function fetchNSEQuote(
  symbol: string,
  options: QuoteFetchOptions = {}
): Promise<QuoteResult> {
  const allowFallbacks = options.allowFallbacks !== false;
  const normalized = normalizeSymbol(symbol);
  const key = quoteCacheKey(normalized);

  const cached = cache.getEntry<StoredQuote>(key);
  increment('finalysis_cache_events_total', { cache: 'quote', event: cached ? 'hit' : 'miss' });
  if (cached) {
    const ageMs = Date.now() - new Date(cached.timestamp).getTime();
    return {
      price: toPrice(cached.data, { kind: 'cached', ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: QUOTE_TTL_LABEL,
        cacheHit: true,
        lastUpdated: cached.data.quotedAt ?? cached.data.fetchedAt,
        confidenceLevel: ageMs > 5 * 60 * 1000 ? 'medium' : 'high',
      }),
    };
  }

  let liveError: string | null = null;

  try {
    if (!canRequest()) {
      throw new Error('Price provider is temporarily unavailable');
    }

    // Collapse a burst of concurrent misses into a single upstream request.
    const startedAt = Date.now();
    const quote = await cache.dedupe(key, () => withRetries(() => fetchYahooQuote(normalized)));
    increment('finalysis_upstream_requests_total', { provider: 'price', result: 'success' });
    increment('finalysis_upstream_duration_seconds_sum', { provider: 'price' }, Date.now() - startedAt);
    cache.set(key, quote, QUOTE_TTL_MS);

    const ageMs = ageOf(quote.quotedAt);

    return {
      price: toPrice(quote, { kind: 'live', ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: QUOTE_TTL_LABEL,
        cacheHit: false,
        lastUpdated: quote.quotedAt ?? quote.fetchedAt,
        // A quote from a session the exchange has already closed is still a
        // provider quote, but it is not a current price.
        confidenceLevel: ageMs !== null && ageMs > 20 * 60 * 60 * 1000 ? 'medium' : 'high',
      }),
    };
  } catch (error) {
    console.warn(logDetail('price', error));
    liveError = describeOutage('price', error);
    increment('finalysis_upstream_requests_total', {
      provider: 'price',
      result: error instanceof Error && error.name === 'RateLimited' ? 'rate_limited' : 'error',
    });
  }

  if (!allowFallbacks) {
    return {
      price: null,
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: QUOTE_TTL_LABEL,
        cacheHit: false,
        lastUpdated: null,
        confidenceLevel: 'unavailable',
        warnings: [liveError ?? 'Live pricing could not be retrieved.'],
      }),
    };
  }

  // Both fallbacks are old. Offer whichever is more recent rather than letting
  // an arbitrary one win.
  const stale = cache.getStale<StoredQuote>(key);
  const snapshot = await getDailyPricesSnapshot().catch(() => null);
  const snapshotAge = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : null;
  const snapshotItem =
    snapshot && snapshotAge !== null && snapshotAge <= MAX_SNAPSHOT_AGE_MS
      ? snapshot.items[normalized]
      : undefined;

  // The window is enforced per symbol, not only on the snapshot as a whole.
  // Each run merges its slice into the same record, so the snapshot's updatedAt
  // is the time the *newest* symbol was captured. A symbol that keeps failing
  // would otherwise keep serving a quote far older than the window claims, and
  // a month-old "last close" would read like a recent one.
  const snapshotQuoteAge = snapshotItem ? ageOf(snapshotItem.fetchedAt) : null;
  const snapshotQuote =
    snapshotItem && snapshotQuoteAge !== null && snapshotQuoteAge <= MAX_SNAPSHOT_AGE_MS
      ? snapshotItem
      : undefined;

  if (stale && (!snapshotQuote || snapshotAge === null || stale.ageMs < snapshotAge)) {
    // Served successfully, but from a fallback. A reader sees an old price and
    // the page says so; this counter is how that is noticed from outside.
    increment('finalysis_cache_events_total', { cache: 'quote', event: 'stale_fallback' });
    increment('finalysis_degraded_responses_total', { reason: 'price_fallback' });
    return {
      price: toPrice(stale.data, { kind: 'stale-cache', ageMs: stale.ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance (cached)',
        cacheTTL: QUOTE_TTL_LABEL,
        cacheHit: true,
        lastUpdated: stale.data.quotedAt ?? stale.data.fetchedAt,
        confidenceLevel: 'low',
        warnings: [`Live price unavailable (${liveError}). Showing the last price we retrieved.`],
      }),
    };
  }

  if (snapshotQuote) {
    const ageMs = snapshotQuoteAge ?? 0;
    increment('finalysis_degraded_responses_total', { reason: 'price_fallback' });
    return {
      price: toPrice(snapshotQuote, { kind: 'daily-close', ageMs }),
      provenance: buildProvenance({
        source: 'Daily close snapshot',
        // Derived from the same constant the reader-facing window uses, so the
        // number on the page cannot drift from the number the code enforces.
        cacheTTL: `${Math.round(MAX_SNAPSHOT_AGE_MS / 86_400_000)}d`,
        cacheHit: true,
        lastUpdated: snapshot?.updatedAt ?? null,
        confidenceLevel: 'low',
        warnings: [
          `Live price unavailable (${liveError}). Showing the most recent end-of-day close.`,
        ],
      }),
    };
  }

  return {
    price: null,
    provenance: buildProvenance({
      source: 'Yahoo Finance',
      cacheTTL: QUOTE_TTL_LABEL,
      cacheHit: false,
      lastUpdated: null,
      confidenceLevel: 'unavailable',
      warnings: [liveError ?? 'Live pricing could not be retrieved.'],
    }),
  };
}
