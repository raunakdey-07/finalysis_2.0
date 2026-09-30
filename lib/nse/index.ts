import { ConfidenceLevel, Provenance, StockPrice } from '@/types';
import cache from '@/lib/cache';
import { describeOutage, isWorthRetrying, logDetail } from '@/lib/errors';
import { getDailyPricesSnapshot, MAX_SNAPSHOT_AGE_MS, StoredQuote } from '@/lib/nse/daily-prices';
import { fetchYahooQuote } from '@/lib/yahoo';

const QUOTE_TTL_MS = 10 * 60 * 1000;
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
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.openedAt = null;
  circuit.state = 'closed';
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
  if (cached) {
    const ageMs = Date.now() - new Date(cached.timestamp).getTime();
    return {
      price: toPrice(cached.data, { kind: 'cached', ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: '10m',
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
    const quote = await cache.dedupe(key, () => withRetries(() => fetchYahooQuote(normalized)));
    cache.set(key, quote, QUOTE_TTL_MS);

    const ageMs = ageOf(quote.quotedAt);

    return {
      price: toPrice(quote, { kind: 'live', ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: '10m',
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
  }

  if (!allowFallbacks) {
    return {
      price: null,
      provenance: buildProvenance({
        source: 'Yahoo Finance',
        cacheTTL: '10m',
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
  const snapshotQuote =
    snapshot && snapshotAge !== null && snapshotAge <= MAX_SNAPSHOT_AGE_MS
      ? snapshot.items[normalized]
      : undefined;

  if (stale && (!snapshotQuote || snapshotAge === null || stale.ageMs < snapshotAge)) {
    return {
      price: toPrice(stale.data, { kind: 'stale-cache', ageMs: stale.ageMs }),
      provenance: buildProvenance({
        source: 'Yahoo Finance (cached)',
        cacheTTL: '10m',
        cacheHit: true,
        lastUpdated: stale.data.quotedAt ?? stale.data.fetchedAt,
        confidenceLevel: 'low',
        warnings: [`Live price unavailable (${liveError}). Showing the last price we retrieved.`],
      }),
    };
  }

  if (snapshotQuote) {
    const ageMs = snapshotAge ?? 0;
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
      cacheTTL: '10m',
      cacheHit: false,
      lastUpdated: null,
      confidenceLevel: 'unavailable',
      warnings: [liveError ?? 'Live pricing could not be retrieved.'],
    }),
  };
}
