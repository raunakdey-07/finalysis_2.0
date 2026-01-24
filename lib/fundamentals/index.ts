import cache from '@/lib/cache';
import { Provenance, StockFundamentals } from '@/types';

const FUNDAMENTALS_TTL_MS = 60 * 24 * 60 * 60 * 1000; // ~60 days within 30–90d window
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const NUMBER_CLEAN = /[,\s₹%]/g;

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(NUMBER_CLEAN, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extract metric value from Screener.in HTML.
 * Structure: <li ...><span class="name">Label</span><span class="value">...<span class="number">VALUE</span>...</span></li>
 */
function extractMetric(html: string, label: string): number | null {
  // Match: <span class="name">\s*Label\s*</span>...<span class="number">VALUE</span>
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<span[^>]*class="name"[^>]*>\\s*${escapedLabel}\\s*</span>[\\s\\S]*?<span[^>]*class="number"[^>]*>([^<]+)</span>`,
    'i'
  );
  const match = html.match(regex);
  return parseNumber(match?.[1]);
}

function extractCompanyName(html: string): string | null {
  // <h1 class="...">Company Name</h1>
  const match = html.match(/<h1[^>]*>([^<]+)</i);
  return match?.[1]?.trim() || null;
}

function extractIndustry(html: string): string | null {
  // Usually in a link like <a href="/screens/...">Industry Name</a> near top
  const match = html.match(/Sector[^<]*<[^>]*>([^<]+)</i);
  return match?.[1]?.trim() || null;
}

function symbolToSlug(symbol: string): string {
  return symbol.replace(/\.NS$/i, '').toUpperCase();
}

function buildProvenance(params: {
  cacheHit: boolean;
  lastUpdated: Date;
  warnings?: string[];
}): Provenance {
  return {
    source: 'Screener.in HTML (public)',
    cacheTTL: '60d',
    cacheHit: params.cacheHit,
    lastUpdated: params.lastUpdated.toISOString(),
    confidenceLevel: params.warnings && params.warnings.length > 0 ? 'medium' : 'high',
    warnings: params.warnings,
  };
}

export interface FundamentalsResult {
  fundamentals: StockFundamentals | null;
  provenance: Provenance;
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalsResult> {
  const cacheKey = `fundamentals_${symbol}`;
  const cached = cache.getEntry<StockFundamentals>(cacheKey);
  if (cached) {
    return {
      fundamentals: cached.data,
      provenance: buildProvenance({ cacheHit: true, lastUpdated: new Date(cached.timestamp) }),
    };
  }

  const slug = symbolToSlug(symbol);
  const url = `https://www.screener.in/company/${slug}/`;
  const warnings: string[] = [];

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();

    const marketCap = extractMetric(html, 'Market Cap');
    const peRatio = extractMetric(html, 'Stock P/E');
    const pbRatio = extractMetric(html, 'Book Value');  // This is actually Book Value per share
    const dividendYield = extractMetric(html, 'Dividend Yield');
    const faceValue = extractMetric(html, 'Face Value') ?? 1;
    const bookValue = extractMetric(html, 'Book Value');
    const roe = extractMetric(html, 'ROE');
    const roce = extractMetric(html, 'ROCE');
    const debtToEquity = extractMetric(html, 'Debt to equity');
    const epsTtm = extractMetric(html, 'EPS');
    const companyName = extractCompanyName(html) || `${slug} Limited`;
    const industry = extractIndustry(html) || 'Unknown';

    // Get P/B from price / book value if we have both
    const currentPrice = extractMetric(html, 'Current Price');
    const calculatedPB = (currentPrice && bookValue && bookValue > 0) ? currentPrice / bookValue : null;

    if (marketCap === null && peRatio === null && pbRatio === null) {
      throw new Error('Missing key metrics');
    }

    const fundamentals: StockFundamentals = {
      symbol,
      companyName,
      marketCap: marketCap ?? 0,
      peRatio,
      pbRatio: calculatedPB,
      dividendYield,
      epsLast4Quarters: epsTtm,
      bookValue,
      faceValue: faceValue || 1,
      industry,
      roe,
      roce,
      debtToEquity,
      revenueGrowth: null,
      lastUpdated: new Date(),
    };

    cache.set(cacheKey, fundamentals, FUNDAMENTALS_TTL_MS);

    return {
      fundamentals,
      provenance: buildProvenance({ cacheHit: false, lastUpdated: new Date() }),
    };
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : 'Unknown fetch error');

    // Re-check cache for stale-while-error; the original `cached` is narrowed to never after early return.
    const stale = cache.getEntry<StockFundamentals>(cacheKey);
    if (stale) {
      return {
        fundamentals: stale.data,
        provenance: buildProvenance({ cacheHit: true, lastUpdated: new Date(stale.timestamp), warnings }),
      };
    }

    return {
      fundamentals: null,
      provenance: buildProvenance({ cacheHit: false, lastUpdated: new Date(), warnings }),
    };
  }
}
