import cache from '@/lib/cache';
import { ConfidenceLevel, NewsItem, Provenance } from '@/types';
import { describeOutage, logDetail } from '@/lib/errors';
import { fetchText } from '@/lib/utils/fetch-with-timeout';
import { increment } from '@/lib/observability/metrics';
import '@/lib/observability/definitions';

/**
 * News retrieval and tone estimation.
 *
 * The rules that keep this trustworthy:
 *
 * 1. Only articles we actually retrieved and that carry a real publication
 *    date are counted. Nothing is back-filled with "now".
 * 2. Tone is not reported at all below a minimum sample. One headline is not
 *    a signal about a company, and saying "positive" on one article is worse
 *    than saying nothing. Past that sample, a reading needs the headlines
 *    themselves to carry a direction, and reports neutral when they do not.
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

/**
 * Below this many headlines carrying a direction, we report neutral.
 *
 * A fixed count rather than a share of the sample, because the share is the
 * wrong denominator. A feed pads itself with "Share Price Live Updates" and
 * "Prediction for Tomorrow", which carry no direction at all, so three
 * strongly negative headlines out of eight is 37% and looked like no signal at
 * all. On a real Infosys feed that was "shares hit a 6-year low", "stock
 * crash" and "shares fall 5% in 5 sessions". Two is a stray keyword; three
 * pointing the same way is a story.
 */
export const MIN_DIRECTIONAL_FOR_TONE = 3;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Direction is not a property of a word.
 *
 * "Record" is good news in "record profit" and bad news in "record low".
 * "Cuts" is good news in "cuts costs" and bad news in "cuts dividend". "Debt"
 * is bad news about debt and good news about shedding it. Scoring the bare
 * words read every one of those backwards, so "Company posts record low
 * profit" came out at a confident +1 and "Company cuts costs by 20%" came out
 * negative.
 *
 * So a word that is only directional in company is not in the single-word list
 * at all. It appears in a phrase below instead, and a phrase is matched before
 * any single word and masks the words inside it.
 */
const POSITIVE_PHRASES = [
  'record high', 'record highs', 'all time high', 'all time highs',
  'year high', 'month high', 'week high', 'multi year high',
  'record profit', 'record revenue', 'record order book', 'record dividend',
  'profit rises', 'profit rose', 'profit grew', 'profit grows', 'profit growth',
  'raises dividend', 'raised dividend', 'hikes dividend', 'hiked dividend',
  'dividend hike', 'dividend raised', 'dividend increase',
  'wins order', 'wins orders', 'bags order', 'bags orders', 'bagged order',
  'wins contract', 'wins contracts', 'bags contract', 'bags contracts',
  'secures order', 'secures contract', 'bags deal', 'wins deal',
  'cuts cost', 'cuts costs', 'cut cost', 'cut costs', 'cost cuts', 'cost cutting',
  'slashes cost', 'slashes costs', 'slash cost', 'slash costs',
  'cuts debt', 'cut debt', 'pays off debt', 'pay off debt', 'repaid debt',
  'debt free', 'debt-free', 'debt reduction', 'reduce debt', 'reduces debt',
  'reduced debt', 'deleveraging', 'deleverages',
  'beats estimates', 'beat estimates', 'beats expectations', 'beat expectations',
  'exceeds estimates', 'exceeded estimates', 'tops estimates',
  'raises guidance', 'raised guidance', 'hikes guidance', 'boosts guidance',
];

const NEGATIVE_PHRASES = [
  'record low', 'record lows', 'all time low', 'all time lows',
  // "6-year low", "52-week low" and "3-month low" are the same fact with a
  // number in front, and a real feed is full of them. One headline reading
  // "shares hit a 6-year low" scored exactly zero before this.
  'year low', 'month low', 'week low', 'year lows', 'multi year low',
  'record loss', 'record decline', 'record losses',
  'crosses below', 'cross below', 'falls below', 'fell below', 'drops below',
  'slides below', 'slips below', 'trades below', 'traded below',
  'profit falls', 'profit fell', 'profit drops', 'profit decline', 'profit declined',
  'dividend cut', 'dividend cuts', 'cuts dividend', 'cut dividend',
  'slashes dividend', 'slash dividend', 'dividend slashed',
  'loses order', 'loses orders', 'lost order', 'lost orders',
  'cancels order', 'cancels orders', 'cancelled order', 'cancelled orders',
  'order cancelled', 'orders cancelled', 'loses contract', 'lost contract',
  'cuts jobs', 'cut jobs', 'job cuts',
  'awaits approval', 'awaiting approval', 'pending approval', 'approval denied',
  'denied approval', 'rejects approval',
  'profit warning', 'earnings warning', 'guidance cut', 'cuts guidance',
  'cut guidance', 'slashes guidance', 'slash guidance',
  'misses estimates', 'missed estimates', 'misses expectations',
  'missed expectations', 'falls short', 'fell short', 'cuts forecast',
  'debt rises', 'rising debt', 'debt concern', 'debt concerns', 'debt worry',
  'debt worries', 'debt stress', 'debt crisis',
];

/**
 * Single words that are directional on their own.
 *
 * The past and plural forms matter more than they look. "Falls" was here and
 * "fell" was not, so a headline reading "Reliance fell 25% this year" scored
 * exactly zero, and most of a real feed scores zero for reasons like that.
 *
 * "Profit" and "loss" are deliberately absent, though they are the two most
 * obviously directional words in the language. They are metrics, not verdicts:
 * a record low profit, a loss narrowed to nothing and a profit cut all carry
 * them. Scoring them on their own put "record low profit" above zero, so the
 * direction now lives in phrases such as "profit rises" and "profit falls".
 */
const POSITIVE_TERMS = [
  'growth', 'surge', 'surges', 'rally', 'rallies', 'beat',
  'beats', 'upgrade', 'upgraded', 'upgrades', 'expansion', 'wins', 'win', 'strong',
  'robust', 'recovery', 'recovers', 'outperform', 'outperforms', 'buyback',
  'partnership', 'acquisition', 'highs', 'gains', 'gain', 'raises', 'boost',
  'boosts', 'rise', 'rises', 'rose', 'climb', 'climbs', 'climbed', 'jump',
  'jumps', 'jumped', 'advance', 'advances', 'lift', 'lifts', 'soar', 'soars',
  'exceed', 'exceeds', 'expand', 'expands', 'expanded', 'approval', 'approved',
  'approves',
];

const NEGATIVE_TERMS = [
  'loss', 'losses', 'decline', 'declines', 'falls', 'fall', 'fell', 'weak',
  'weaker', 'miss', 'misses', 'downgrade', 'downgraded', 'probe', 'investigation',
  'fraud', 'penalty', 'fine', 'fines', 'lawsuit', 'default', 'layoff', 'layoffs',
  'shutdown', 'halt', 'halts', 'slash', 'warning', 'warns', 'resigns', 'resigned',
  'bankruptcy', 'scam', 'crash', 'crashes', 'slump', 'selloff', 'lows', 'tumble',
  'tumbles', 'plunge', 'plunges', 'plummet', 'plummets', 'slip', 'slips',
  'slide', 'slides', 'tank', 'tanks', 'sink', 'sinks', 'drop', 'drops', 'falling',
  'worry', 'worried', 'worries', 'concern', 'concerns', 'flag', 'flags', 'flagged',
  'recall', 'setback', 'setbacks', 'delay', 'delays', 'downturn', 'bailout',
  'slows', 'slowdown', 'cuts', 'lays off', 'lose', 'loses', 'lost',
];

const NEGATORS = ['not', 'no', 'never', 'without', 'avoids', 'avoided', 'fails', 'failed', 'unlikely'];

/**
 * A negated term flips rather than being discounted.
 *
 * Discounting it left "Company reports no loss" at -0.5, so a company telling
 * the market it lost nothing read as half-negative. Flipping is wrong for a
 * negated noun phrase, which is what the phrases above are for: treating "not a
 * profit warning" as a single flipped phrase lands it positive, where treating
 * "profit" and "warning" as two separate terms does not.
 */
const NEGATED_WEIGHT = 0.8;

function buildWordPattern(terms: string[]): RegExp {
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

/** Phrases first, so a word inside one is already claimed when the words run. */
const PATTERNS: { pattern: RegExp; sign: 1 | -1 }[] = [
  { pattern: buildWordPattern(POSITIVE_PHRASES), sign: 1 },
  { pattern: buildWordPattern(NEGATIVE_PHRASES), sign: -1 },
  { pattern: buildWordPattern(POSITIVE_TERMS), sign: 1 },
  { pattern: buildWordPattern(NEGATIVE_TERMS), sign: -1 },
];

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
 * three words for a negator so the term is flipped rather than discounted.
 *
 * The score is the mean across the directional terms found, so a headline with
 * one mild positive and one mild negative nets to zero. That also means the
 * scale cannot express how strong a term is, only which way it points: a 2%
 * profit rise and a catastrophic collapse both saturate. Intensity is not
 * recoverable from a word list, and is not claimed here.
 */
export function scoreHeadline(text: string): number {
  let score = 0;
  let hits = 0;
  /** Ranges already scored by a phrase, so their words are not counted twice. */
  const claimed: [number, number][] = [];

  for (const { pattern, sign } of PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      if (claimed.some(([from, to]) => start >= from && start < to)) continue;
      claimed.push([start, start + match[0].length]);
      hits += 1;

      const before = text
        .slice(Math.max(0, start - 40), start)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .slice(-3);

      const negated = before.some((word) => NEGATORS.includes(word));
      score += negated ? -sign * NEGATED_WEIGHT : sign;
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
  /** How many of the retrieved headlines carried a direction at all. */
  directionalCount: number;
  /**
   * The tone is neutral because too few headlines carried a direction, rather
   * than because the coverage pointed both ways. A reader cannot tell those
   * apart from the word, and they mean very different things.
   */
  thin: boolean;
  note: string;
}

/**
 * Summarise a set of scored headlines.
 *
 * Below MIN_ARTICLES_FOR_TONE the result is "unknown" rather than "neutral",
 * because "neutral" would read as "we checked and the news was balanced".
 *
 * Past that sample there is a second way to have no answer, and the original
 * code ran straight through it. Most headline language carries no direction at
 * all: an appointment, a filing, a bond issue, a price-prediction column.
 * Averaging those in alongside a couple of genuinely directional headlines
 * pulled the mean to near zero and reported neutral, implying the coverage had
 * been read and found balanced when in practice two articles out of eight had
 * said anything. The direction is therefore taken from the headlines that carry
 * one, and only once at least half of them do.
 */
export function summariseTone(scores: number[], articleCount: number): ToneReading {
  if (articleCount === 0) {
    return {
      tone: 'unknown',
      score: 0,
      articleCount: 0,
      directionalCount: 0,
      thin: false,
      note: 'No articles were retrieved, so no news tone is reported. That is missing data, not a neutral reading.',
    };
  }

  if (articleCount < MIN_ARTICLES_FOR_TONE) {
    return {
      tone: 'unknown',
      score: 0,
      articleCount,
      directionalCount: scores.filter((score) => score !== 0).length,
      thin: false,
      note: `Only ${articleCount} article${articleCount === 1 ? '' : 's'} matched this company. That is too few to call a tone.`,
    };
  }

  const directional = scores.filter((score) => score !== 0);

  // Scores can arrive empty against a non-zero count, so the empty case is
  // checked before the threshold rather than relying on it.
  if (directional.length < MIN_DIRECTIONAL_FOR_TONE) {
    return {
      tone: 'neutral',
      score: 0,
      articleCount,
      directionalCount: directional.length,
      thin: true,
      note: `Only ${directional.length} of ${articleCount} retrieved headlines carried a direction, which is too few to call a tone. That is thin coverage, not a balanced news picture.`,
    };
  }

  const mean = directional.reduce((total, value) => total + value, 0) / directional.length;
  // Shrink toward zero in proportion to how much directional evidence there is,
  // so a thin read cannot land as hard as a well-sampled one.
  const weight = Math.min(1, directional.length / (MIN_ARTICLES_FOR_TONE * 2));
  const adjusted = mean * weight;

  const tone = adjusted > 0.15 ? 'positive' : adjusted < -0.15 ? 'negative' : 'neutral';

  return {
    tone,
    score: adjusted,
    articleCount,
    directionalCount: directional.length,
    thin: false,
    note: `Tone is ${tone} across ${directional.length} of ${articleCount} retrieved headlines that carried a direction.`,
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

  try {
    const response = await fetchText(url, { headers: { 'User-Agent': UA } }, REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Google News returned HTTP ${response.status}`);
    }

    increment('finalysis_upstream_requests_total', { provider: 'news', result: 'success' });
    return parseRssFeed(response.text);
  } catch (error) {
    increment('finalysis_upstream_requests_total', {
      provider: 'news',
      result: error instanceof Error && error.name === 'RateLimited' ? 'rate_limited' : 'error',
    });
    throw error;
  }
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
  increment('finalysis_cache_events_total', {
    cache: 'news',
    event: cached ? 'hit' : 'miss',
  });
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

  if (items.length === 0) {
    increment('finalysis_degraded_responses_total', { reason: 'news_unavailable' });
  }

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
