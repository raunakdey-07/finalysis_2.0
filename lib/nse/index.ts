import { Provenance, StockPrice } from '@/types';
import cache from '@/lib/cache';
import { getDailyPricesSnapshot } from '@/lib/nse/daily-prices';
import { fetchYahooQuote, searchYahooSymbols } from '@/lib/yahoo';
const QUOTE_TTL_MS = 10 * 60 * 1000; // 5–15m window; choose 10m middle
const SEARCH_TTL_MS = 10 * 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 4;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;

const normalizeSymbol = (value: string) => value.toUpperCase().trim().replace(/\.NS$/i, '');

type CircuitState = {
  failures: number;
  openedAt: number | null;
  state: 'closed' | 'open';
};

const circuit: Record<'quote' | 'search', CircuitState> = {
  quote: { failures: 0, openedAt: null, state: 'closed' },
  search: { failures: 0, openedAt: null, state: 'closed' },
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


function canRequest(key: keyof typeof circuit) {
  const c = circuit[key];
  if (c.state === 'closed') return true;
  if (c.openedAt && Date.now() - c.openedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
    c.state = 'closed';
    c.failures = 0;
    c.openedAt = null;
    return true;
  }
  return false;
}

function recordFailure(key: keyof typeof circuit) {
  const c = circuit[key];
  c.failures += 1;
  if (c.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    c.state = 'open';
    c.openedAt = Date.now();
  }
}

function recordSuccess(key: keyof typeof circuit) {
  const c = circuit[key];
  c.failures = 0;
  c.state = 'closed';
  c.openedAt = null;
}

async function withRetries<T>(service: keyof typeof circuit, fn: () => Promise<T>): Promise<T> {
  if (!canRequest(service)) {
    throw new Error('circuit-open');
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fn();
      recordSuccess(service);
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        await delay(Math.pow(2, attempt) * 500); // 0.5s, 1s
      }
    }
  }

  recordFailure(service);
  throw lastErr instanceof Error ? lastErr : new Error('request-failed');
}

function buildProvenance(params: {
  source: string;
  ttlLabel: string;
  cacheHit: boolean;
  lastUpdated: Date;
  confidence: Provenance['confidenceLevel'];
  warnings?: string[];
}): Provenance {
  return {
    source: params.source,
    cacheTTL: params.ttlLabel,
    cacheHit: params.cacheHit,
    lastUpdated: params.lastUpdated.toISOString(),
    confidenceLevel: params.confidence,
    warnings: params.warnings,
  };
}

export interface QuoteResult {
  price: StockPrice | null;
  provenance: Provenance;
}

export type QuoteFetchOptions = {
  allowSnapshot?: boolean;
};

export async function fetchNSEQuote(symbol: string, options: QuoteFetchOptions = {}): Promise<QuoteResult> {
  const allowSnapshot = options.allowSnapshot !== false;
  const cacheKey = `nse_quote_${symbol}`;
  const snapshotCacheKey = `nse_quote_snapshot_${symbol}`;

  if (allowSnapshot) {
    const cachedSnapshot = cache.getEntry<StockPrice>(snapshotCacheKey);
    const cachedSnapshotTime = cachedSnapshot ? new Date(cachedSnapshot.data.timestamp).getTime() : NaN;
    const cachedSnapshotAgeHours = cachedSnapshot ? (Date.now() - cachedSnapshotTime) / (1000 * 60 * 60) : Infinity;
    const freshCachedSnapshot = cachedSnapshot && Number.isFinite(cachedSnapshotAgeHours) && cachedSnapshotAgeHours <= 48;

    if (freshCachedSnapshot) {
      return {
        price: cachedSnapshot.data,
        provenance: buildProvenance({
          source: 'Daily close snapshot (Redis)',
          ttlLabel: '1d',
          cacheHit: true,
          lastUpdated: new Date(cachedSnapshot.data.timestamp),
          confidence: 'medium',
          warnings: ['Daily snapshot used; prices update after market close.'],
        }),
      };
    }

    const snapshot = await getDailyPricesSnapshot();
    if (snapshot && snapshot.items?.[symbol]) {
      const snapshotPrice = snapshot.items[symbol];
      const snapshotUpdatedAt = new Date(snapshot.updatedAt);
      const snapshotAgeHours = (Date.now() - snapshotUpdatedAt.getTime()) / (1000 * 60 * 60);
      const staleSnapshot = !Number.isFinite(snapshotAgeHours) || snapshotAgeHours > 48;

      if (staleSnapshot) {
        // Skip stale snapshots so live fetch can recover data if cron has stalled.
      } else {
        const normalizedPrice: StockPrice = {
          ...snapshotPrice,
          timestamp: snapshotPrice.timestamp instanceof Date
            ? snapshotPrice.timestamp
            : new Date(snapshotPrice.timestamp),
        };

        cache.set(snapshotCacheKey, normalizedPrice, QUOTE_TTL_MS);
        return {
          price: normalizedPrice,
          provenance: buildProvenance({
            source: 'Daily close snapshot (Redis)',
            ttlLabel: '1d',
            cacheHit: true,
            lastUpdated: new Date(snapshot.updatedAt),
            confidence: 'medium',
            warnings: ['Daily snapshot used; prices update after market close.'],
          }),
        };
      }
    }
  }

  const cached = cache.getEntry<StockPrice>(cacheKey);

  if (cached) {
    return {
      price: cached.data,
      provenance: buildProvenance({
        source: 'Yahoo Finance API',
        ttlLabel: '10m',
        cacheHit: true,
        lastUpdated: new Date(cached.timestamp),
        confidence: 'high',
      }),
    };
  }

  try {
    const stockPrice = await withRetries('quote', async () => fetchYahooQuote(symbol));

    cache.set(cacheKey, stockPrice, QUOTE_TTL_MS);

    return {
      price: stockPrice,
      provenance: buildProvenance({
        source: 'Yahoo Finance API',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(stockPrice.timestamp),
        confidence: 'high',
      }),
    };
  } catch (error) {
    const warnings = [
      'Live fetch failed; serving stale cache if available.',
      error instanceof Error ? error.message : 'Unknown error',
    ];

    // Re-fetch to avoid TS narrowing after early return
    const stale = cache.getEntry<StockPrice>(cacheKey);
    if (stale) {
      return {
        price: stale.data,
        provenance: buildProvenance({
          source: 'Yahoo Finance API',
          ttlLabel: '10m',
          cacheHit: true,
          lastUpdated: new Date(stale.timestamp),
          confidence: 'medium',
          warnings,
        }),
      };
    }

    return {
      price: null,
      provenance: buildProvenance({
        source: 'Yahoo Finance API',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(),
        confidence: 'derived',
        warnings,
      }),
    };
  }
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const promises = symbols.map((symbol) => fetchNSEQuote(symbol));
  const results = await Promise.all(promises);
  return results;
}

export interface SearchResult {
  symbols: string[];
  provenance: Provenance;
}

export async function searchStocks(query: string): Promise<SearchResult> {
  const cacheKey = `nse_search_${query}`;
  const cached = cache.getEntry<string[]>(cacheKey);

  if (cached) {
    return {
      symbols: cached.data,
      provenance: buildProvenance({
        source: 'Yahoo Finance search',
        ttlLabel: '10m',
        cacheHit: true,
        lastUpdated: new Date(cached.timestamp),
        confidence: 'medium',
      }),
    };
  }

  try {
    const symbols = await withRetries('search', async () => searchYahooSymbols(query));
    const normalizedSymbols = symbols.map(normalizeSymbol).filter(Boolean);
    cache.set(cacheKey, normalizedSymbols, SEARCH_TTL_MS);

    return {
      symbols: normalizedSymbols,
      provenance: buildProvenance({
        source: 'Yahoo Finance search',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(),
        confidence: 'medium',
      }),
    };
  } catch (error) {
    const warnings = [
      'Search live fetch failed; serving stale cache if available.',
      error instanceof Error ? error.message : 'Unknown error',
    ];

    // Re-fetch to avoid TS narrowing after early return
    const stale = cache.getEntry<string[]>(cacheKey);
    if (stale) {
      return {
        symbols: stale.data,
        provenance: buildProvenance({
          source: 'Yahoo Finance search',
          ttlLabel: '10m',
          cacheHit: true,
          lastUpdated: new Date(stale.timestamp),
          confidence: 'derived',
          warnings,
        }),
      };
    }

    return {
      symbols: [],
      provenance: buildProvenance({
        source: 'Yahoo Finance search',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(),
        confidence: 'derived',
        warnings,
      }),
    };
  }
}
