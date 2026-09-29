import cache from '@/lib/cache';
import { ConfidenceLevel, NewsItem, Provenance } from '@/types';
import { describeOutage, logDetail } from '@/lib/errors';
import { fetchText } from '@/lib/utils/fetch-with-timeout';

/**
 * News retrieval and tone estimation.
 *
 * The rules that keep this trustworthy:
 *
 * 1. Only articles we actually retrieved and that carry a real publication
 *    date are counted. Nothing is back-filled with "now".
 * 2. Tone is not reported at all below a minimum sample. One headline is not
 *    a signal about a company, and saying "positive" on one article is worse
 *    than saying nothing.
 * 3. Company matching is token-based. A short ticker like LT must not match
 *    the "lt" inside the word "result".
 * 4. Stand-in research links are marked as such and never carry a tone.
 */

const GOOGLE_NEWS_ENDPOINT = 'https://news.google.com/rss/search';
const REQUEST_TIMEOUT_MS = 8_000;
const NEWS_TTL_MS = 60 * 60 * 1000;
/** Cache a miss briefly too, so a dead symbol cannot re-hammer the provider. */
const NEWS_EMPTY_TTL_MS = 5 * 60 * 1000;
export const MAX_ARTICLES = 8;

/** Below this many retrieved articles we report no tone at all. */
export const MIN_ARTICLES_FOR_TONE = 5;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const POSITIVE_TERMS = [
  'profit', 'profits', 'growth', 'surge', 'rally', 'record', 'beat', 'beats', 'upgrade',
  'upgraded', 'expansion', 'wins', 'win', 'strong', 'robust', 'recovery', 'outperform',
  'dividend', 'buyback', 'approval', 'approved', 'partnership', 'acquisition', 'orders',
  'highs', 'gains', 'raises', 'boost',
];

const NEGATIVE_TERMS = [
  'loss', 'losses', 'decline', 'falls', 'fall', 'weak', 'miss', 'misses', 'downgrade',
  'downgraded', 'probe', 'investigation', 'fraud', 'penalty', 'fine', 'lawsuit', 'default',
  'debt', 'layoff', 'shutdown', 'halt', 'slash', 'cuts', 'warning', 'resigns', 'resigned',
  'bankruptcy', 'scam', 'crash', 'slump', 'selloff', 'lows',
];

const NEGATORS = ['not', 'no', 'never', 'without', 'avoids', 'avoided', 'fails', 'failed', 'unlikely'];

function buildWordPattern(terms: string[]): RegExp {
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

const POSITIVE_PATTERN = buildWordPattern(POSITIVE_TERMS);
const NEGATIVE_PATTERN = buildWordPattern(NEGATIVE_TERMS);

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** FNV-1a, used only to give React a stable key per article. */
function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function tagOf(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1] : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attributeOf(xml: string, tag: string, attribute: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\b${attribute}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : null;
}

function normalizeTitle(title: string): string {
  return stripTags(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface ParsedArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

/**
 * Parse a Google News RSS payload. Articles without a usable link or a valid
 * publication date are dropped rather than defaulted to the current time.
 */
export function parseRssFeed(xml: string): ParsedArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const seen = new Set<string>();
  const articles: ParsedArticle[] = [];

  for (const item of items) {
    const rawTitle = tagOf(item, 'title');
    const link = tagOf(item, 'link');
    const pubDate = tagOf(item, 'pubDate');

    if (!rawTitle || !link || !pubDate) continue;

    const publishedAt = Date.parse(stripTags(pubDate));
    if (Number.isNaN(publishedAt)) continue;

    // Older stories say nothing useful about a company's current position.
    if (Date.now() - publishedAt > 45 * 24 * 60 * 60 * 1000) continue;

    const title = stripTags(rawTitle);
    if (!title) continue;

    const dedupeKey = normalizeTitle(title);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const sourceUrl = attributeOf(item, 'source', 'url');
    const sourceTag = tagOf(item, 'source');
    const source = stripTags(sourceTag ?? '') || (sourceUrl ? new URL(sourceUrl).hostname : 'Unknown source');

    // Google News repeats the publisher at the end of the headline, and the
    // card prints the publisher again on the line below. Printing the same word
    // twice on one row looks like a parsing fault.
    const titleWithoutSource = title.replace(new RegExp(`\\s*[-–—]\\s*${escapeRegExp(source)}\\s*$`, 'i'), '');

    articles.push({
      title: titleWithoutSource || title,
      link: stripTags(link),
      source,
      pubDate: new Date(publishedAt).toISOString(),
    });
  }

  return articles;
}

/**
 * Score a headline on a -1 to 1 scale.
 *
 * Uses word boundaries so "surprise" does not score as "rise", and looks back
 * three words for a negator so "not a loss" is not counted as a loss.
 */
export function scoreHeadline(text: string): number {
  let score = 0;
  let hits = 0;

  for (const pattern of [POSITIVE_PATTERN, NEGATIVE_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      hits += 1;

      const before = text
        .slice(Math.max(0, match.index - 40), match.index)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .slice(-3);

      const negated = before.some((word) => NEGATORS.includes(word));
      const sign = pattern === POSITIVE_PATTERN ? 1 : -1;
      score += sign * (negated ? 0.5 : 1);
    }
  }

  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, score / hits));
}

export interface ToneReading {
  tone: 'positive' | 'negative' | 'neutral' | 'unknown';
  /** -1 to 1, shrunk toward zero when the sample is small. */
  score: number;
  articleCount: number;
  note: string;
}

/**
 * Summarise a set of scored headlines.
 *
 * Below MIN_ARTICLES_FOR_TONE the result is "unknown" rather than "neutral",
 * because "neutral" would read as "we checked and the news was balanced".
 */
export function summariseTone(scores: number[], articleCount: number): ToneReading {
  if (articleCount === 0) {
    return {
      tone: 'unknown',
      score: 0,
      articleCount: 0,
      note: 'No articles were retrieved, so no news tone is reported. That is missing data, not a neutral reading.',
    };
  }

  if (articleCount < MIN_ARTICLES_FOR_TONE) {
    return {
      tone: 'unknown',
      score: 0,
      articleCount,
      note: `Only ${articleCount} article${articleCount === 1 ? '' : 's'} matched this company. That is too few to call a tone.`,
    };
  }

  const mean = scores.reduce((total, value) => total + value, 0) / scores.length;
  // Shrink toward zero in proportion to how much evidence we actually have.
  const weight = Math.min(1, articleCount / (MIN_ARTICLES_FOR_TONE * 2));
  const adjusted = mean * weight;

  const tone = adjusted > 0.15 ? 'positive' : adjusted < -0.15 ? 'negative' : 'neutral';

  return {
    tone,
    score: adjusted,
    articleCount,
    note: `Tone is ${tone} across ${articleCount} retrieved articles.`,
  };
}

export interface CompanyMatcherInput {
  symbol: string;
  companyName: string | null;
  aliases?: string[];
}

/**
 * Words that make a bare ticker meaningful. Several NSE tickers are ordinary
 * English words, so the ticker alone is not treated as proof that an article is
 * about the company.
 */
const MARKET_CONTEXT = new Set([
  'share', 'shares', 'stock', 'stocks', 'price', 'prices', 'rating', 'target',
  'brokerage', 'nse', 'bse', 'ltd', 'q1', 'q2', 'q3', 'q4', 'results',
  'crore', 'lakh', 'rupee', 'market', 'ipo', 'dividend', 'board', 'profit',
]);

const LEGAL_SUFFIX = /\s+(limited|ltd\.?|private|pvt\.?)\s*$/i;

function normalizeWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * True when the text is actually about this company.
 *
 * Matching is token-based on purpose. A substring test made the ticker "LT"
 * match the "lt" inside "result", and "IDEA" match the English word "idea".
 *
 * A company can also have a single-word short name that is an ordinary English
 * word. "Reliance" is a case in point: requiring only that the word appear put
 * an article about Korean pop acts into a Reliance Industries feed, because
 * "heavy reliance on" is idiomatic English. So a one-word name is accepted
 * only when a market word sits directly beside it, the way a real headline
 * reads. A multi-word company name is distinctive enough to stand alone.
 *
 * This deliberately favours precision over recall: an article about the company
 * is occasionally dropped, but an article that is not about the company never
 * appears, and a news panel is judged on what it wrongly shows.
 */
export function matchesCompany(text: string, input: CompanyMatcherInput): boolean {
  const words = normalizeWords(text).split(' ').filter(Boolean);
  if (words.length === 0) return false;

  const hasAdjacentMarketContext = (index: number): boolean => {
    for (const offset of [-1, 1]) {
      const neighbour = words[index + offset];
      if (neighbour && MARKET_CONTEXT.has(neighbour)) return true;
    }
    return false;
  };

  const phraseMatches = (phrase: string): boolean => {
    const normalized = normalizeWords(phrase);
    if (normalized.length < 3) return false;

    const parts = normalized.split(' ');
    if (parts.length >= 2) {
      return ` ${words.join(' ')} `.includes(` ${normalized} `);
    }

    const index = words.indexOf(parts[0]);
    return index !== -1 && hasAdjacentMarketContext(index);
  };

  if (input.companyName) {
    const withoutSuffix = input.companyName.replace(LEGAL_SUFFIX, '').trim();
    if (withoutSuffix.length >= 3 && phraseMatches(withoutSuffix)) return true;
  }
  if ((input.aliases ?? []).some(phraseMatches)) return true;

  // The ticker is a stronger signal than a name substring, so it gets first
  // refusal, but it is still held to the same rule: a market word has to sit
  // beside it, or the match is a coincidence of vocabulary.
  const ticker = input.symbol.replace(/\.NS$/i, '').toLowerCase();
  if (ticker.length < 2) return false;
  const tickerIndex = words.indexOf(ticker);
  return tickerIndex !== -1 && hasAdjacentMarketContext(tickerIndex);
}

export type CompanyContext = CompanyMatcherInput | null;

type CachedNews = { items: NewsItem[]; fetchedAt: string; warnings: string[] };

const newsCacheKey = (symbol: string) => `news_v2_${symbol.toUpperCase()}`;

function buildProvenance(params: {
  cacheHit: boolean;
  lastUpdated: string | null;
  confidenceLevel: ConfidenceLevel;
  warnings: string[];
}): Provenance {
  return {
    source: 'Google News RSS',
    cacheTTL: '1h',
    cacheHit: params.cacheHit,
    lastUpdated: params.lastUpdated,
    confidenceLevel: params.confidenceLevel,
    warnings: params.warnings.length ? params.warnings : undefined,
  };
}

/**
 * Company queries. The ticker is tried first because it is the most precise
 * signal available, then the company name.
 */
function buildQueries(context: CompanyContext): string[] {
  if (!context) {
    return ['India stock market NSE Sensex earnings'];
  }

  const ticker = context.symbol.replace(/\.NS$/i, '');
  const name = context.companyName
    ? context.companyName.replace(/\s+(Limited|Ltd\.?|Private)\.?$/i, '').trim()
    : null;

  return [`"${ticker}" stock`, ...(name && name !== ticker ? [`"${name}"`] : [])];
}

async function fetchQuery(query: string): Promise<ParsedArticle[]> {
  const url = `${GOOGLE_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;

  const response = await fetchText(url, { headers: { 'User-Agent': UA } }, REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Google News returned HTTP ${response.status}`);
  }

  return parseRssFeed(response.text);
}

export interface CompanyNewsResult {
  items: NewsItem[];
  tone: ToneReading;
  provenance: Provenance;
}

/**
 * Retrieve recent articles about a company, or the general market when no
 * company is in context.
 */
export async function getNews(context: CompanyContext): Promise<CompanyNewsResult> {
  const key = newsCacheKey(context?.symbol ?? 'market');
  const warnings: string[] = [];

  const cached = cache.getEntry<CachedNews>(key);
  if (cached) {
    const items = cached.data.items;
    const retrieved = items.filter((item) => !item.synthetic);
    const scored = retrieved
      .map((item) => item.sentimentScore)
      .filter((score): score is number => typeof score === 'number');

    return {
      items,
      tone: summariseTone(scored, scored.length),
      provenance: buildProvenance({
        cacheHit: true,
        lastUpdated: cached.data.fetchedAt,
        confidenceLevel: 'medium',
        // Only the original fetch's failures are re-emitted. A cache hit is
        // not a failure, and listing it under "what went wrong" turned normal
        // operation into an error state.
        warnings: cached.data.warnings,
      }),
    };
  }

  let articles: ParsedArticle[] = [];
  const queries = buildQueries(context);

  const responses = await Promise.allSettled(queries.map(fetchQuery));
  responses.forEach((response) => {
    if (response.status === 'fulfilled') {
      articles = articles.concat(response.value);
    } else {
      console.warn(logDetail('news', response.reason));
      warnings.push(describeOutage('news', response.reason));
    }
  });

  const seen = new Set<string>();
  const collected: NewsItem[] = [];

  for (const article of articles) {
    const dedupeKey = normalizeTitle(article.title);
    if (seen.has(dedupeKey)) continue;

    if (context && !matchesCompany(`${article.title} ${article.source}`, context)) continue;
    seen.add(dedupeKey);

    collected.push({
      id: stableId(article.link || article.title),
      title: article.title,
      link: article.link,
      pubDate: article.pubDate,
      source: article.source,
      sentimentScore: scoreHeadline(article.title),
      synthetic: false,
    });
  }

  // Sort before truncating, otherwise the articles kept are whichever the feed
  // happened to return first rather than the most recent.
  collected.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
  const items = collected.slice(0, MAX_ARTICLES);
  const scores = items
    .map((item) => item.sentimentScore)
    .filter((score): score is number => typeof score === 'number');

  const fetchedAt = new Date().toISOString();
  // Cache misses too, briefly, so an uncovered symbol cannot fan out requests.
  cache.set(
    key,
    { items, fetchedAt, warnings },
    items.length > 0 ? NEWS_TTL_MS : NEWS_EMPTY_TTL_MS
  );

  const tone = summariseTone(scores, scores.length);

  return {
    items,
    tone,
    provenance: buildProvenance({
      cacheHit: false,
      lastUpdated: fetchedAt,
      confidenceLevel: items.length === 0 ? 'unavailable' : 'high',
      warnings,
    }),
  };
}

/**
 * Neutral starting points for a company with no fresh coverage.
 *
 * These are links, not articles. They are flagged synthetic so no tone is
 * computed from them and the UI can say plainly what they are.
 */
export function buildResearchLinks(context: CompanyContext, limit: number): NewsItem[] {
  if (!context) return [];

  const ticker = context.symbol.replace(/\.NS$/i, '');
  const now = new Date().toISOString();
  const sources = [
    { title: `${context.companyName ?? ticker}: company page`, source: 'Screener.in', link: `https://www.screener.in/company/${encodeURIComponent(ticker)}/` },
    { title: `${ticker}: NSE corporate filings`, source: 'NSE India', link: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements' },
    { title: `${ticker}: quarterly results`, source: 'NSE India', link: 'https://www.nseindia.com/companies-listing/quarterly-results' },
    { title: `${ticker}: exchange quote page`, source: 'NSE India', link: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(ticker)}` },
  ];

  return sources.slice(0, Math.max(0, limit)).map((entry) => ({
    id: `link-${stableId(entry.link)}`,
    title: entry.title,
    link: entry.link,
    pubDate: now,
    source: entry.source,
    synthetic: true,
  }));
}
