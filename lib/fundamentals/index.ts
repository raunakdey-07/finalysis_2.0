import cache from '@/lib/cache';
import { Provenance, StockFundamentals } from '@/types';
import { describeOutage, logDetail } from '@/lib/errors';
import { fetchText } from '@/lib/utils/fetch-with-timeout';
import { isValidFundamentals } from './validate';

/**
 * Screener.in publishes a small, fixed set of "top ratio" rows per company.
 * Anything it cannot express (a loss-making P/E, an ROE on negative equity) is
 * rendered as an EMPTY <span class="number"></span> rather than a sentinel.
 * Every extraction below is therefore scoped to a single row so that an empty
 * value reports "unavailable" instead of borrowing the neighbouring metric.
 */

// Screener.in is a static page with no revision date. 30 days is a compromise:
// long enough to stay well inside the provider's tolerance of our request rate,
// short enough that a figures revision is picked up within a month.
const FUNDAMENTALS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const NUMBER_CLEAN = /[,\s₹%]/g;
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

export function parseNumber(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = value.replace(NUMBER_CLEAN, '').trim();
  if (!cleaned) return null;

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    const key = body.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];

    const numeric = /^#x?([0-9a-f]+)$/.exec(key);
    if (numeric) {
      const code = Number.parseInt(numeric[1], key.startsWith('#x') ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
    }
    return match;
  });
}

/** Visible text of a fragment: tags removed, entities resolved, whitespace collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Inner HTML of the first <span> whose class attribute contains `className` as
 * a whole token. Matching on tokens keeps `class="name-wrapper"` from being
 * mistaken for `class="name"`.
 *
 * Assumes the target span does not nest, which holds for screener.in: the name
 * and number spans are siblings inside a value wrapper, never nested in one
 * another. The first close tag therefore ends the span we asked for.
 */
function spanHtml(fragment: string, className: string): string | null {
  const openPattern = /<span\b([^>]*)>/gi;
  let open: RegExpExecArray | null;

  while ((open = openPattern.exec(fragment)) !== null) {
    const classAttr = open[1].match(/class\s*=\s*["']([^"']*)["']/i);
    if (!classAttr) continue;
    if (!classAttr[1].split(/\s+/).includes(className)) continue;

    const closeIndex = fragment.indexOf('</span>', open.index);
    if (closeIndex === -1) return null;
    return fragment.slice(open.index + open[0].length, closeIndex);
  }

  return null;
}

/** Rows are `<li>` elements. Splitting on the opening tag keeps each match row-scoped. */
function splitRows(html: string): string[] {
  return html.split(/<li\b/i).slice(1);
}

function sectionHtml(html: string, sectionId: string): string | null {
  const match = html.match(
    new RegExp(`<section[^>]*\\bid\\s*=\\s*["']${sectionId}["'][\\s\\S]*?<\\/section>`, 'i')
  );
  return match ? match[0] : null;
}

/**
 * Read one top-ratio row by its exact visible label.
 * Returns null when the row is absent AND when the row is present but empty;
 * the two cases are both "this provider gave us no number for it".
 */
export function extractMetric(html: string, label: string): number | null {
  const target = textOf(label).toLowerCase();

  for (const row of splitRows(html)) {
    const nameHtml = spanHtml(row, 'name');
    if (nameHtml === null) continue;
    if (textOf(nameHtml).toLowerCase() !== target) continue;

    const numberHtml = spanHtml(row, 'number');
    if (numberHtml === null) return null;

    return parseNumber(textOf(numberHtml));
  }

  return null;
}

/**
 * Screener.in renders two <h1> elements (mobile and desktop) that both wrap a
 * logo <span> and the company name. Stripping tags and collapsing whitespace
 * leaves the name.
 */
export function extractCompanyName(html: string): string | null {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!heading) return null;

  const name = textOf(heading[1]);
  return name.length >= 2 ? name : null;
}

/**
 * The sector link is the only element carrying a literal title="Sector"
 * attribute. "Broad Sector", "Broad Industry" and "Industry" are distinct
 * attributes and must not match.
 */
export function extractSector(html: string): string | null {
  const anchor = html.match(/<a\b[^>]*\btitle\s*=\s*["']Sector["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchor) return null;

  const sector = textOf(anchor[1]);
  return sector.length >= 2 ? sector : null;
}

export function extractIndustry(html: string): string | null {
  const anchor = html.match(/<a\b[^>]*\btitle\s*=\s*["']Industry["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchor) return null;

  const industry = textOf(anchor[1]);
  return industry.length >= 2 ? industry : null;
}

/**
 * Most recent populated value in a labelled row of a financial table.
 * Columns run oldest to newest, so scanning from the right finds the latest
 * year and tolerates blank trailing cells.
 */
function latestTableValue(html: string, sectionId: string, label: string): number | null {
  const section = sectionHtml(html, sectionId);
  if (!section) return null;

  for (const row of section.split(/<tr\b/i).slice(1)) {
    // Capture each cell's inner content rather than splitting on the tag, which
    // would leave attribute text behind.
    const cells = Array.from(row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) => cell[1]);
    if (cells.length < 2) continue;
    if (textOf(cells[0]).toLowerCase() !== label.toLowerCase()) continue;

    for (let index = cells.length - 1; index >= 1; index -= 1) {
      const value = parseNumber(textOf(cells[index]));
      if (value !== null) return value;
    }
    return null;
  }

  return null;
}

/** Latest completed fiscal year EPS, in rupees per share. */
export function extractAnnualEps(html: string): number | null {
  return latestTableValue(html, 'profit-loss', 'EPS in Rs');
}

/** Reporting date of the latest annual column, as YYYY-MM-DD. */
export function extractPeriodEnd(html: string): string | null {
  const section = sectionHtml(html, 'profit-loss');
  if (!section) return null;

  const keys = section.match(/data-date-key\s*=\s*["']([0-9]{4}-[0-9]{2}-[0-9]{2})["']/gi);
  if (!keys || keys.length === 0) return null;

  const last = keys[keys.length - 1].match(/["']([0-9]{4}-[0-9]{2}-[0-9]{2})["']/);
  return last ? last[1] : null;
}

function symbolToSlug(symbol: string): string {
  return symbol.replace(/\.NS$/i, '').toUpperCase();
}

function buildProvenance(params: {
  cacheHit: boolean;
  lastUpdated: Date;
  warnings?: string[];
  /** True when the figures come from a stored reading rather than a live one. */
  cacheAge?: boolean;
}): Provenance {
  const confidenceLevel = params.cacheAge ? 'medium' : params.warnings?.length ? 'medium' : 'high';
  return {
    source: 'Screener.in (public company page)',
    cacheTTL: '30d',
    cacheHit: params.cacheHit,
    lastUpdated: params.lastUpdated.toISOString(),
    confidenceLevel,
    warnings: params.warnings?.length ? params.warnings : undefined,
  };
}

export interface FundamentalsResult {
  fundamentals: StockFundamentals | null;
  provenance: Provenance;
}

/**
 * Turn a company page into a fundamentals record, or null when the page does
 * not actually describe a company. Exported so tests can drive it with real
 * markup instead of a network call.
 */
export function parseFundamentalsHtml(html: string, symbol: string): StockFundamentals | null {
  const companyName = extractCompanyName(html);
  const marketCap = extractMetric(html, 'Market Cap');
  const currentPrice = extractMetric(html, 'Current Price');
  const peRatio = extractMetric(html, 'Stock P/E');
  const bookValue = extractMetric(html, 'Book Value');
  const dividendYield = extractMetric(html, 'Dividend Yield');
  const roe = extractMetric(html, 'ROE');
  const roce = extractMetric(html, 'ROCE');
  const faceValue = extractMetric(html, 'Face Value');
  const eps = extractAnnualEps(html);

  // A page that publishes no figures is an error page or a redirect, not a
  // company. The heading alone is not enough: a 404 page has one too.
  const published = [
    marketCap,
    currentPrice,
    peRatio,
    bookValue,
    roe,
    roce,
    faceValue,
  ].filter((value) => value !== null).length;

  if (published < 2) {
    return null;
  }

  // P/B is only meaningful against a positive book value. Negative equity makes
  // the ratio meaningless rather than merely unattractive.
  const pbRatio =
    currentPrice !== null && bookValue !== null && bookValue > 0
      ? currentPrice / bookValue
      : null;

  return {
    symbol,
    companyName: companyName ?? `${symbolToSlug(symbol)}`,
    peRatio,
    pbRatio,
    dividendYield,
    eps,
    bookValue,
    faceValue,
    sector: extractSector(html),
    industry: extractIndustry(html),
    roe,
    roce,
    periodEnd: extractPeriodEnd(html),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalsResult> {
  const cacheKey = `fundamentals_v2_${symbol.replace(/\.NS$/i, '').toUpperCase()}`;
  const cached = cache.getEntry<StockFundamentals>(cacheKey);
  if (cached) {
    return {
      fundamentals: cached.data,
      provenance: buildProvenance({
        cacheHit: true,
        lastUpdated: new Date(cached.data.fetchedAt),
        // A cache hit can be up to 30 days old, which is not the same as a
        // figure that was just read from the source.
        warnings: [],
        cacheAge: true,
      }),
    };
  }

  const slug = symbolToSlug(symbol);
  const url = `https://www.screener.in/company/${encodeURIComponent(slug)}/`;
  const warnings: string[] = [];

  try {
    const html = await cache.dedupe(cacheKey, async () => {
      const res = await fetchText(url, { headers: { 'User-Agent': UA } }, REQUEST_TIMEOUT_MS);

      if (res.status === 404) {
        throw new Error(
          `Screener.in has no page for ${slug}. Its ticker may differ from the NSE symbol.`
        );
      }
      if (!res.ok) {
        throw new Error(`Screener.in returned HTTP ${res.status}`);
      }

      return res.text;
    });

    const fundamentals = parseFundamentalsHtml(html, slug);

    if (!fundamentals) {
      throw new Error('Screener.in page did not contain recognisable company figures');
    }
    if (!isValidFundamentals(fundamentals)) {
      throw new Error('Parsed fundamentals failed validation and were discarded');
    }

    cache.set(cacheKey, fundamentals, FUNDAMENTALS_TTL_MS);

    return {
      fundamentals,
      provenance: buildProvenance({ cacheHit: false, lastUpdated: new Date() }),
    };
  } catch (err) {
    console.warn(logDetail('fundamentals', err));
    warnings.push(describeOutage('fundamentals', err));

    // Stale-while-error: a previous reading of this company is far better than
    // nothing, provided the caller is told it is stale.
    const stale = cache.getStale<StockFundamentals>(cacheKey);
    if (stale) {
      return {
        fundamentals: stale.data,
        provenance: buildProvenance({
          cacheHit: true,
          lastUpdated: new Date(stale.data.fetchedAt),
          warnings,
        }),
      };
    }

    return {
      fundamentals: null,
      provenance: buildProvenance({ cacheHit: false, lastUpdated: new Date(), warnings }),
    };
  }
}
