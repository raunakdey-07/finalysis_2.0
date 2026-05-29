import { Provenance, StockPrice } from '@/types';
import cache from '@/lib/cache';
import { getDailyPricesSnapshot } from '@/lib/nse/daily-prices';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const NSE_BASE_URL = 'https://www.nseindia.com';
const NSE_HOME_URL = 'https://www.nseindia.com/';
const NSE_COOKIE_CACHE_KEY = 'nse_cookie_header';
const NSE_COOKIE_TTL_MS = 2 * 60 * 1000;
const QUOTE_TTL_MS = 10 * 60 * 1000; // 5–15m window; choose 10m middle
const SEARCH_TTL_MS = 10 * 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 4;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;

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

const getHeaders = (cookie?: string | null) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.nseindia.com/',
  'X-Requested-With': 'XMLHttpRequest',
  ...(cookie ? { Cookie: cookie } : {}),
});

type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };

function extractCookiePairs(setCookieHeader: string): string[] {
  const pairs: string[] = [];
  const regex = /(?:^|,)\s*([^=;,]+=[^;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(setCookieHeader)) !== null) {
    pairs.push(match[1]);
  }
  return pairs;
}

async function getNseCookieHeader(): Promise<string | null> {
  const cached = cache.getEntry<string>(NSE_COOKIE_CACHE_KEY);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetchWithTimeout(
      NSE_HOME_URL,
      {
        headers: {
          ...getHeaders(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      10_000
    );

    if (!response.ok) {
      throw new Error(`NSE homepage error: ${response.status}`);
    }

    const headers = response.headers as HeadersWithSetCookie;
    const setCookieHeader = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie().join(', ')
      : headers.get('set-cookie');

    if (!setCookieHeader) {
      return null;
    }

    const pairs = extractCookiePairs(setCookieHeader);
    if (pairs.length === 0) {
      return null;
    }

    const cookieHeader = pairs.join('; ');
    cache.set(NSE_COOKIE_CACHE_KEY, cookieHeader, NSE_COOKIE_TTL_MS);
    return cookieHeader;
  } catch {
    return null;
  }
}

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
        source: 'NSE public endpoints',
        ttlLabel: '10m',
        cacheHit: true,
        lastUpdated: new Date(cached.timestamp),
        confidence: 'high',
      }),
    };
  }

  try {
    const data = await withRetries('quote', async () => {
      const cookieHeader = await getNseCookieHeader();
      const response = await fetchWithTimeout(`${NSE_BASE_URL}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
        headers: getHeaders(cookieHeader),
      }, 10_000);

      if (!response.ok) {
        throw new Error(`NSE API error: ${response.status}`);
      }

      return response.json();
    });

    const lastPrice = data?.priceInfo?.lastPrice;
    if (typeof lastPrice !== 'number' || !Number.isFinite(lastPrice) || lastPrice <= 0) {
      throw new Error('quote-not-found');
    }

    const previousClose = data?.priceInfo?.previousClose;

    const stockPrice: StockPrice = {
      symbol,
      price: lastPrice,
      change: data.priceInfo?.change ?? 0,
      changePercent: data.priceInfo?.pChange ?? 0,
      volume: data.preOpenMarket?.totalTradedVolume ?? 0,
      open: data.priceInfo?.open ?? lastPrice,
      high: data.priceInfo?.intraDayHighLow?.max ?? undefined,
      low: data.priceInfo?.intraDayHighLow?.min ?? undefined,
      previousClose: previousClose ?? undefined,
      fiftyTwoWeekHigh: data.priceInfo?.weekHighLow?.max ?? undefined,
      fiftyTwoWeekLow: data.priceInfo?.weekHighLow?.min ?? undefined,
      timestamp: new Date(),
      // Backend canonical: daily_change_percent = ((current_price - previous_close) / previous_close) * 100
      daily_change_percent: 
        previousClose && previousClose > 0
          ? ((lastPrice - previousClose) / previousClose) * 100
          : 0,
    };

    cache.set(cacheKey, stockPrice, QUOTE_TTL_MS);

    return {
      price: stockPrice,
      provenance: buildProvenance({
        source: 'NSE public endpoints',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(),
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
          source: 'NSE public endpoints',
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
        source: 'NSE public endpoints',
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
        source: 'NSE search',
        ttlLabel: '10m',
        cacheHit: true,
        lastUpdated: new Date(cached.timestamp),
        confidence: 'medium',
      }),
    };
  }

  try {
    const data = await withRetries('search', async () => {
      const cookieHeader = await getNseCookieHeader();
      const response = await fetchWithTimeout(`${NSE_BASE_URL}/api/search/autocomplete?q=${encodeURIComponent(query)}`, {
        headers: getHeaders(cookieHeader),
      }, 10_000);

      if (!response.ok) {
        throw new Error(`NSE search error: ${response.status}`);
      }

      return response.json();
    });

    const symbols = data.symbols || [];
    cache.set(cacheKey, symbols, SEARCH_TTL_MS);

    return {
      symbols,
      provenance: buildProvenance({
        source: 'NSE search',
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
          source: 'NSE search',
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
        source: 'NSE search',
        ttlLabel: '10m',
        cacheHit: false,
        lastUpdated: new Date(),
        confidence: 'derived',
        warnings,
      }),
    };
  }
}
