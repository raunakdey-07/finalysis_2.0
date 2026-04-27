import { NewsItem, Provenance } from '@/types';
import cache from '@/lib/cache';
import stocksIndex from '@/data/stocks.json';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const NEWS_TTL_MS = 8 * 60 * 60 * 1000; // 6–12h window; choose 8h middle
const GOOGLE_NEWS_HOST = 'news.google.com';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY; // optional free tier
const FALLBACK_NEWS_SOURCE = 'Finalysis Resources';
const GOOGLE_NEWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const GOOGLE_NEWS_MIN_ITEMS = 18;
const MAX_RSS_ITEM_AGE_MS = 540 * 24 * 60 * 60 * 1000; // 18 months
const STOCK_NEWS_MIN_RELEVANCE_SCORE = 5;
const FUTURE_NEWS_TOLERANCE_MS = 5 * 60 * 1000;
const GOOGLE_NEWS_TIMEOUT_MS = 12_000;
const GNEWS_TIMEOUT_MS = 12_000;

const CURATED_NEWS_SITE_BATCHES: string[][] = [
  ['moneycontrol.com', 'livemint.com', 'economictimes.indiatimes.com', 'business-standard.com'],
  ['financialexpress.com', 'thehindubusinessline.com', 'reuters.com', 'bloomberg.com'],
];

const STOCK_NEWS_SIGNAL_KEYWORDS = [
  'quarterly',
  'results',
  'earnings',
  'investor presentation',
  'annual report',
  'management commentary',
  'analyst',
  'brokerage',
  'guidance',
  'regulatory',
  'filing',
];

const POSITIVE_KEYWORDS = ['gain', 'growth', 'profit', 'surge', 'rally', 'bullish', 'positive', 'strong', 'rise', 'outperform', 'buy', 'upgrade'];
const NEGATIVE_KEYWORDS = ['loss', 'decline', 'fall', 'drop', 'bearish', 'negative', 'weak', 'underperform', 'sell', 'downgrade', 'crash'];

const IMPORTANCE_KEYWORDS = [
  'results', 'q1', 'q2', 'q3', 'q4', 'quarter', 'earnings', 'board meeting', 'filing', 'sebi', 'regulatory', 'acquisition', 'merger', 'm&a', 'capex', 'investment', 'order win', 'guidance'
];

type SentimentLabel = 'positive' | 'negative' | 'neutral';

type SentimentSnapshot = {
  sentiment: SentimentLabel;
  score: number;
  newsCount: number;
};

type SectorConfig = {
  key: string;
  displayName: string;
  query: string;
  keywords: string[];
};

const DEFAULT_SECTOR: SectorConfig = {
  key: 'broad-market',
  displayName: 'Broad Market',
  query: 'indian stock market nse bse sector outlook',
  keywords: ['market', 'nse', 'bse', 'equity', 'stocks'],
};

const SECTOR_CONFIGS: SectorConfig[] = [
  {
    key: 'banking-financials',
    displayName: 'Banking & Financials',
    query: 'india banking financial services nse outlook',
    keywords: ['bank', 'lender', 'nbfc', 'insurance', 'financial', 'credit'],
  },
  {
    key: 'information-technology',
    displayName: 'Information Technology',
    query: 'india information technology it services nse outlook',
    keywords: ['software', 'it services', 'technology', 'digital', 'ai', 'cloud'],
  },
  {
    key: 'pharma-healthcare',
    displayName: 'Pharma & Healthcare',
    query: 'india pharma healthcare hospitals nse outlook',
    keywords: ['pharma', 'drug', 'healthcare', 'hospital', 'biotech'],
  },
  {
    key: 'auto-ancillaries',
    displayName: 'Auto & Ancillaries',
    query: 'india auto automobile ev nse outlook',
    keywords: ['auto', 'automobile', 'ev', 'vehicle', 'two-wheeler', 'car'],
  },
  {
    key: 'energy-utilities',
    displayName: 'Energy & Utilities',
    query: 'india energy power utilities oil gas nse outlook',
    keywords: ['energy', 'power', 'utility', 'oil', 'gas', 'renewable'],
  },
  {
    key: 'metals-mining',
    displayName: 'Metals & Mining',
    query: 'india metals mining steel aluminium nse outlook',
    keywords: ['steel', 'metal', 'mining', 'aluminium', 'ore'],
  },
  {
    key: 'fmcg-consumer',
    displayName: 'FMCG & Consumer',
    query: 'india fmcg consumer staples discretionary nse outlook',
    keywords: ['fmcg', 'consumer', 'retail', 'beverage', 'foods'],
  },
  {
    key: 'infrastructure-capital-goods',
    displayName: 'Infrastructure & Capital Goods',
    query: 'india infrastructure capital goods engineering nse outlook',
    keywords: ['infrastructure', 'capital goods', 'engineering', 'construction', 'projects'],
  },
];

const SYMBOL_SECTOR_HINTS: Record<string, string> = {
  HDFCBANK: 'banking-financials',
  ICICIBANK: 'banking-financials',
  SBIN: 'banking-financials',
  AXISBANK: 'banking-financials',
  KOTAKBANK: 'banking-financials',
  TCS: 'information-technology',
  INFY: 'information-technology',
  HCLTECH: 'information-technology',
  WIPRO: 'information-technology',
  TECHM: 'information-technology',
  SUNPHARMA: 'pharma-healthcare',
  DRREDDY: 'pharma-healthcare',
  CIPLA: 'pharma-healthcare',
  APOLLOHOSP: 'pharma-healthcare',
  LUPIN: 'pharma-healthcare',
  TATAMOTORS: 'auto-ancillaries',
  MARUTI: 'auto-ancillaries',
  BAJAJAUTO: 'auto-ancillaries',
  HEROMOTOCO: 'auto-ancillaries',
  RELIANCE: 'energy-utilities',
  NTPC: 'energy-utilities',
  POWERGRID: 'energy-utilities',
  ADANIGREEN: 'energy-utilities',
  ONGC: 'energy-utilities',
  JSWSTEEL: 'metals-mining',
  TATASTEEL: 'metals-mining',
  HINDALCO: 'metals-mining',
  COALINDIA: 'metals-mining',
  ITC: 'fmcg-consumer',
  HINDUNILVR: 'fmcg-consumer',
  NESTLEIND: 'fmcg-consumer',
  BRITANNIA: 'fmcg-consumer',
  LT: 'infrastructure-capital-goods',
  SIEMENS: 'infrastructure-capital-goods',
  BHEL: 'infrastructure-capital-goods',
};

type StockDirectoryEntry = {
  symbol: string;
  name: string;
};

const STOCK_DIRECTORY = new Map(
  (stocksIndex as StockDirectoryEntry[]).map((entry) => [entry.symbol.replace(/\.NS$/i, '').toUpperCase(), entry.name])
);

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizeLimit(limit: number, fallback: number, max: number): number {
  if (!Number.isFinite(limit)) return fallback;
  const value = Math.floor(limit);
  if (value < 1) return fallback;
  return Math.min(value, max);
}

function buildSiteScopedQuery(query: string, sites: string[]): string {
  const siteQuery = sites.map((site) => `site:${site}`).join(' OR ');
  return normalizeWhitespace(`${query} (${siteQuery})`);
}

function buildGoogleNewsQueryPlan(query: string): string[] {
  const normalized = normalizeWhitespace(query);
  if (!normalized) return [];

  const scopedQueries = CURATED_NEWS_SITE_BATCHES.map((batch) => buildSiteScopedQuery(normalized, batch));
  return [...scopedQueries, normalized];
}

function normalizeCompanySearchName(companyName: string): string {
  return normalizeWhitespace(
    companyName
      .replace(/\b(limited|ltd|private|pvt|plc|inc|corp|corporation)\b/gi, ' ')
      .replace(/[.,()]/g, ' ')
  );
}

function isFreshNewsItem(item: NewsItem): boolean {
  const timestamp = item.pubDate?.getTime?.();
  if (!timestamp || Number.isNaN(timestamp)) return false;
  if (timestamp > Date.now() + FUTURE_NEWS_TOLERANCE_MS) return false;
  return Date.now() - timestamp <= MAX_RSS_ITEM_AGE_MS;
}

function calculateSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  POSITIVE_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) positiveCount++;
  });

  NEGATIVE_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) negativeCount++;
  });

  const score = (positiveCount - negativeCount) / (positiveCount + negativeCount + 1);

  if (score > 0.2) return { sentiment: 'positive', score };
  if (score < -0.2) return { sentiment: 'negative', score };
  return { sentiment: 'neutral', score };
}

function classifyImportance(text: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  const hit = IMPORTANCE_KEYWORDS.some((k) => lower.includes(k));
  if (hit) return 'high';
  if (lower.includes('market') || lower.includes('industry')) return 'medium';
  return 'low';
}

function decodeHtmlEntities(input: string): string {
  const decodeNumericEntity = (rawCode: string): string => {
    const isHex = rawCode.toLowerCase().startsWith('x');
    const value = Number.parseInt(isHex ? rawCode.slice(1) : rawCode, isHex ? 16 : 10);

    if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
      return '';
    }

    try {
      return String.fromCodePoint(value);
    } catch {
      return '';
    }
  };

  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(x?[0-9a-fA-F]+);/g, (_, code) => decodeNumericEntity(code));
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildNewsId(source: string, link: string, pubDate: Date, title: string): string {
  const seed = `${source}|${link}|${pubDate.toISOString()}|${title}`;
  const sourceKey = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${sourceKey || 'news'}_${stableHash(seed)}`;
}

function stripHtml(input: string): string {
  // Decode HTML entities first (Google News RSS double-encodes)
  let clean = decodeHtmlEntities(input);
  // Unwrap CDATA
  clean = clean.replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1');
  // Remove HTML tags (including <a>, <font>, etc.)
  clean = clean.replace(/<[^>]*>/g, '');
  // Decode again in case tags contained encoded content
  clean = decodeHtmlEntities(clean);
  // Remove leftover URLs (http/https links)
  clean = clean.replace(/https?:\/\/[^\s]+/gi, '');
  // Remove common link remnants from Google News RSS
  clean = clean.replace(/\s*-\s*Read more\s*$/i, '');
  // Collapse multiple spaces and trim
  clean = clean.replace(/\s+/g, ' ').trim();
  // If the result is empty or just the source name, return empty
  if (clean.length < 10) return '';
  return clean;
}

/** Strip " - SourceName" suffix from Google News titles and extract the source */
function cleanTitle(title: string): { cleanedTitle: string; publication: string | null } {
  // Match trailing " - Source" pattern (Google News appends source to titles)
  const match = title.match(/^(.+?)\s+-\s+([A-Za-z][A-Za-z0-9\s.&'-]{2,30})$/);
  if (match) {
    return { cleanedTitle: match[1].trim(), publication: match[2].trim() };
  }
  return { cleanedTitle: title.trim(), publication: null };
}

/** Check if description is just a duplicate of the title */
function isDuplicateDescription(title: string, description: string): boolean {
  if (!description || description.length < 10) return true;
  // Normalize for comparison
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '');
  // If description starts with most of the title, it's a duplicate
  return normDesc.startsWith(normTitle.slice(0, Math.min(50, normTitle.length)));
}

function parseRSSFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const matches = xml.matchAll(itemRegex);

  for (const match of matches) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/s);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/s);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);

    if (titleMatch && linkMatch) {
      const link = linkMatch[1].trim();
      if (!link) {
        continue;
      }

      const parsedPubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
      if (Number.isNaN(parsedPubDate.getTime())) {
        continue;
      }

      const rawTitle = stripHtml(titleMatch[1]);
      const { cleanedTitle: title, publication } = cleanTitle(rawTitle);
      const rawDescription = descMatch ? stripHtml(descMatch[1]) : '';
      // Only keep description if it adds info beyond the title
      const description = isDuplicateDescription(title, rawDescription) ? '' : rawDescription;
      const { sentiment, score } = calculateSentiment(`${title} ${rawDescription}`);
      const importance = classifyImportance(`${title} ${rawDescription}`);

      items.push({
        id: buildNewsId(source, link, parsedPubDate, title),
        title,
        description,
        link,
        pubDate: parsedPubDate,
        source: publication || source,
        sentiment,
        sentimentScore: score,
        importance,
      });
    }
  }

  return items;
}

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  const queryPlan = buildGoogleNewsQueryPlan(query);
  const errors: string[] = [];
  let aggregated: NewsItem[] = [];

  for (const plannedQuery of queryPlan) {
    const encoded = encodeURIComponent(plannedQuery);
    const url = `https://${GOOGLE_NEWS_HOST}/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': GOOGLE_NEWS_USER_AGENT },
      }, GOOGLE_NEWS_TIMEOUT_MS);

      if (!response.ok) {
        errors.push(`Google News RSS error: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const parsed = parseRSSFeed(xml, 'Google News').filter((item) => isFreshNewsItem(item));
      if (parsed.length > 0) {
        aggregated = uniqueNewsItems([...aggregated, ...parsed]);
      }

      if (aggregated.length >= GOOGLE_NEWS_MIN_ITEMS) {
        break;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Google News RSS failed for query: ${plannedQuery}`);
    }
  }

  if (aggregated.length === 0) {
    throw new Error(errors[0] ?? 'Google News RSS returned no items');
  }

  return aggregated;
}

async function fetchGNews(query: string): Promise<NewsItem[]> {
  if (!GNEWS_API_KEY) {
    throw new Error('GNEWS_API_KEY missing');
  }
  const encoded = encodeURIComponent(query);
  const url = `https://gnews.io/api/v4/search?q=${encoded}&lang=en&country=in&max=20&apikey=${GNEWS_API_KEY}`;
  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  }, GNEWS_TIMEOUT_MS);
  if (!response.ok) throw new Error(`GNews error: ${response.status}`);
  let data: { articles?: Array<{ title?: string; description?: string; url?: string; publishedAt?: string }> };
  try {
    data = (await response.json()) as {
      articles?: Array<{ title?: string; description?: string; url?: string; publishedAt?: string }>;
    };
  } catch {
    throw new Error('GNews returned invalid JSON payload');
  }

  const articles = Array.isArray(data.articles) ? data.articles : [];
  return articles.map((item: { title?: string; description?: string; url?: string; publishedAt?: string }) => {
    const title = item.title || '';
    const description = item.description || '';
    const { sentiment, score } = calculateSentiment(`${title} ${description}`);
    const importance = classifyImportance(`${title} ${description}`);
    const link = item.url || '#';

    const parsedDate = item.publishedAt ? new Date(item.publishedAt) : new Date();
    const pubDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    return {
      id: buildNewsId('gnews', link, pubDate, title),
      title,
      description,
      link,
      pubDate,
      source: 'GNews',
      sentiment,
      sentimentScore: score,
      importance,
    } as NewsItem;
  });
}

function buildProvenance(params: {
  source: string;
  cacheHit: boolean;
  cacheTTL: string;
  lastUpdated: Date;
  confidence: Provenance['confidenceLevel'];
  warnings?: string[];
}): Provenance {
  return {
    source: params.source,
    cacheHit: params.cacheHit,
    cacheTTL: params.cacheTTL,
    lastUpdated: params.lastUpdated.toISOString(),
    confidenceLevel: params.confidence,
    warnings: params.warnings,
  };
}

function sortAndLimit(items: NewsItem[], limit: number): NewsItem[] {
  return items
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, limit);
}

function buildFallbackNewsItems(params: {
  symbol?: string;
  companyName?: string;
  topic?: string;
}): NewsItem[] {
  const now = new Date();

  if (params.symbol) {
    const normalizedSymbol = params.symbol.replace(/\.NS$/i, '').toUpperCase();
    const companyName = params.companyName || normalizedSymbol;

    return [
      {
        id: `fallback_${normalizedSymbol}_nse_filings`,
        title: `${companyName}: NSE corporate filings and announcements`,
        description: 'Track official disclosures, board updates, and results from NSE filings.',
        link: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
        pubDate: now,
        source: FALLBACK_NEWS_SOURCE,
        sentiment: 'neutral',
        sentimentScore: 0,
        importance: 'high',
      },
      {
        id: `fallback_${normalizedSymbol}_screener_statements`,
        title: `${companyName}: financial statements and quarterly data`,
        description: 'Review profit and loss, balance sheet, cash flow, and quarterly disclosures.',
        link: `https://www.screener.in/company/${normalizedSymbol}/`,
        pubDate: now,
        source: FALLBACK_NEWS_SOURCE,
        sentiment: 'neutral',
        sentimentScore: 0,
        importance: 'medium',
      },
      {
        id: `fallback_${normalizedSymbol}_bse_announcements`,
        title: `${companyName}: BSE corporate announcement tracker`,
        description: 'Cross-check exchange filings and announcements from BSE corporate disclosures.',
        link: 'https://www.bseindia.com/corporates/ann.html',
        pubDate: now,
        source: FALLBACK_NEWS_SOURCE,
        sentiment: 'neutral',
        sentimentScore: 0,
        importance: 'medium',
      },
    ];
  }

  const topicLabel = params.topic || 'Market';
  return [
    {
      id: 'fallback_market_nse_filings',
      title: `${topicLabel}: NSE market announcements and disclosures`,
      description: 'Follow official exchange-level updates and listed-company announcements.',
      link: 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
      pubDate: now,
      source: FALLBACK_NEWS_SOURCE,
      sentiment: 'neutral',
      sentimentScore: 0,
      importance: 'high',
    },
    {
      id: 'fallback_market_bse_announcements',
      title: `${topicLabel}: BSE corporate updates feed`,
      description: 'Cross-reference announcements and actions from the BSE disclosure stream.',
      link: 'https://www.bseindia.com/corporates/ann.html',
      pubDate: now,
      source: FALLBACK_NEWS_SOURCE,
      sentiment: 'neutral',
      sentimentScore: 0,
      importance: 'medium',
    },
    {
      id: 'fallback_market_moneycontrol',
      title: `${topicLabel}: India markets coverage`,
      description: 'Use this as a temporary market context source while live RSS items are sparse.',
      link: 'https://www.moneycontrol.com/news/business/markets/',
      pubDate: now,
      source: FALLBACK_NEWS_SOURCE,
      sentiment: 'neutral',
      sentimentScore: 0,
      importance: 'medium',
    },
  ];
}

function uniqueNewsItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const item of items) {
    const key = item.link?.trim().toLowerCase() || item.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function buildStockNewsQueries(symbol: string): string[] {
  const normalizedSymbol = symbol.replace(/\.NS$/i, '').toUpperCase();
  const companyName = STOCK_DIRECTORY.get(normalizedSymbol);
  const normalizedCompanyName = companyName ? normalizeCompanySearchName(companyName) : '';
  const companySearchToken = companyName ? `"${companyName}"` : normalizedSymbol;
  const companyAliasToken = normalizedCompanyName && normalizedCompanyName.toLowerCase() !== companyName?.toLowerCase()
    ? `"${normalizedCompanyName}"`
    : null;

  const queries = [
    `${companySearchToken} india quarterly results earnings call investor presentation`,
    `${companySearchToken} india analyst report brokerage target price outlook`,
    `${companySearchToken} india annual report management commentary regulatory filing`,
    `${normalizedSymbol} india nse bse corporate filing exchange announcement`,
  ];

  if (companyAliasToken) {
    queries.push(`${companyAliasToken} india quarterly results earnings guidance`);
  }

  return Array.from(new Set(queries.map((query) => query.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function scoreStockNewsItem(item: NewsItem, symbol: string, companyName?: string): number {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const symbolKey = symbol.toLowerCase();
  let score = 0;

  if (text.includes(symbolKey)) {
    score += 4;
  }

  if (companyName) {
    const tokens = normalizeCompanySearchName(companyName)
      .toLowerCase()
      .split(' ')
      .filter((token) => token.length > 2)
      .slice(0, 5);

    const tokenHits = tokens.reduce((hits, token) => hits + (text.includes(token) ? 1 : 0), 0);
    score += tokenHits * 2;
  }

  if (STOCK_NEWS_SIGNAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score += 3;
  }

  if (item.importance === 'high') score += 2;
  if (item.importance === 'medium') score += 1;

  return score;
}

function hasHighStockRelevance(item: NewsItem, symbol: string, companyName?: string): boolean {
  return scoreStockNewsItem(item, symbol, companyName) >= STOCK_NEWS_MIN_RELEVANCE_SCORE;
}

function rankStockNewsItems(items: NewsItem[], symbol: string, companyName?: string): NewsItem[] {
  return [...items].sort((a, b) => {
    const scoreDelta = scoreStockNewsItem(b, symbol, companyName) - scoreStockNewsItem(a, symbol, companyName);
    if (scoreDelta !== 0) return scoreDelta;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });
}

export interface NewsResult {
  items: NewsItem[];
  provenance: Provenance;
}

export interface SentimentMixResult {
  market: SentimentSnapshot;
  sector: (SentimentSnapshot & { name: string; key: string }) | null;
  company: (SentimentSnapshot & { symbol: string }) | null;
  provenance: Provenance;
}

function aggregateSentiment(items: NewsItem[]): SentimentSnapshot {
  if (items.length === 0) {
    return { sentiment: 'neutral', score: 0, newsCount: 0 };
  }

  const totalScore = items.reduce((sum, item) => sum + (item.sentimentScore || 0), 0);
  const avgScore = totalScore / items.length;

  let sentiment: SentimentLabel = 'neutral';
  if (avgScore > 0.1) sentiment = 'positive';
  else if (avgScore < -0.1) sentiment = 'negative';

  return {
    sentiment,
    score: avgScore,
    newsCount: items.length,
  };
}

function inferSectorConfig(symbol: string, companyItems: NewsItem[]): SectorConfig {
  const symbolKey = symbol.replace(/\.NS$/i, '').toUpperCase();
  const hintedSector = SYMBOL_SECTOR_HINTS[symbolKey];
  if (hintedSector) {
    const config = SECTOR_CONFIGS.find((sector) => sector.key === hintedSector);
    if (config) return config;
  }

  const corpus = companyItems
    .slice(0, 25)
    .map((item) => `${item.title} ${item.description}`.toLowerCase())
    .join(' ');

  let bestConfig: SectorConfig | null = null;
  let bestScore = 0;

  for (const config of SECTOR_CONFIGS) {
    const score = config.keywords.reduce((acc, keyword) => {
      return acc + (corpus.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestConfig = config;
    }
  }

  return bestConfig ?? DEFAULT_SECTOR;
}

async function fetchTopicNews(cacheKey: string, query: string, limit: number): Promise<NewsResult> {
  const safeLimit = normalizeLimit(limit, 20, 50);
  const cached = cache.getEntry<NewsItem[]>(cacheKey);
  if (cached) {
    return {
      items: sortAndLimit(cached.data, safeLimit),
      provenance: buildProvenance({
        source: 'Google News RSS (cached)',
        cacheHit: true,
        cacheTTL: '8h',
        lastUpdated: new Date(cached.timestamp),
        confidence: 'medium',
      }),
    };
  }

  let aggregated: NewsItem[] = [];
  const warnings: string[] = [];
  let usedFallbackResources = false;

  try {
    aggregated = await fetchGoogleNews(query);
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : 'Google News RSS failed');
  }

  if (aggregated.length === 0) {
    try {
      aggregated = await fetchGNews(query);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'GNews fallback failed');
    }
  }

  if (aggregated.length === 0) {
    usedFallbackResources = true;
    aggregated = buildFallbackNewsItems({ topic: 'Sector' });
    warnings.push('Live sector RSS was empty; using fallback market resources.');
  }

  if (aggregated.length > 0) {
    cache.set(cacheKey, aggregated, NEWS_TTL_MS);
  }

  return {
    items: sortAndLimit(aggregated, safeLimit),
    provenance: buildProvenance({
      source: usedFallbackResources ? 'Finalysis fallback resources' : 'Google News RSS',
      cacheHit: false,
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence: usedFallbackResources ? 'derived' : 'high',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}

export async function fetchNews(limit: number = 20): Promise<NewsResult> {
  const safeLimit = normalizeLimit(limit, 20, 50);
  const cacheKey = 'news_all';
  const cached = cache.getEntry<NewsItem[]>(cacheKey);
  if (cached) {
    return {
      items: sortAndLimit(cached.data, safeLimit),
      provenance: buildProvenance({
        source: 'Google News RSS (cached)',
        cacheHit: true,
        cacheTTL: '8h',
        lastUpdated: new Date(cached.timestamp),
        confidence: 'medium',
      }),
    };
  }

  let aggregated: NewsItem[] = [];
  const warnings: string[] = [];
  let usedFallbackResources = false;

  try {
    aggregated = await fetchGoogleNews('indian markets nse bse earnings');
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : 'Google News RSS failed');
  }

  if (aggregated.length === 0) {
    try {
      aggregated = await fetchGNews('indian markets nse bse earnings');
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'GNews fallback failed');
    }
  }

  if (aggregated.length === 0) {
    usedFallbackResources = true;
    aggregated = buildFallbackNewsItems({ topic: 'Market' });
    warnings.push('Live market RSS was empty; using fallback resources.');
  }

  if (aggregated.length > 0) {
    cache.set(cacheKey, aggregated, NEWS_TTL_MS);
  }

  return {
    items: sortAndLimit(aggregated, safeLimit),
    provenance: buildProvenance({
      source: usedFallbackResources ? 'Finalysis fallback resources' : 'Google News RSS',
      cacheHit: false,
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence: usedFallbackResources ? 'derived' : 'high',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}

export async function getStockNews(symbol: string, limit: number = 10): Promise<NewsResult> {
  const safeLimit = normalizeLimit(limit, 10, 50);
  const normalizedSymbol = symbol.replace(/\.NS$/i, '').trim().toUpperCase();
  const cacheKey = `news_v5_${normalizedSymbol}`;
  const cached = cache.getEntry<NewsItem[]>(cacheKey);
  if (cached) {
    return {
      items: cached.data.slice(0, safeLimit),
      provenance: buildProvenance({
        source: 'Google News RSS (cached)',
        cacheHit: true,
        cacheTTL: '8h',
        lastUpdated: new Date(cached.timestamp),
        confidence: 'medium',
      }),
    };
  }

  let aggregated: NewsItem[] = [];
  const warnings: string[] = [];
  const companyName = STOCK_DIRECTORY.get(normalizedSymbol);
  const isKnownSymbol = Boolean(companyName);
  let usedFallbackResources = false;
  let usedMarketFallbackFeed = false;
  let appendedFallbackResources = false;

  if (!isKnownSymbol) {
    usedFallbackResources = true;
    const safeResources = buildFallbackNewsItems({ topic: 'Market' });
    warnings.push(`Symbol ${normalizedSymbol} is outside the local NSE universe; showing trusted market resources.`);

    return {
        items: safeResources.slice(0, safeLimit),
      provenance: buildProvenance({
        source: 'Finalysis fallback resources',
        cacheHit: false,
        cacheTTL: '8h',
        lastUpdated: new Date(),
        confidence: 'derived',
        warnings,
      }),
    };
  }

  const queries = buildStockNewsQueries(normalizedSymbol);

  for (const query of queries) {
    try {
      const items = await fetchGoogleNews(query);
      if (items.length > 0) {
        aggregated = uniqueNewsItems([...aggregated, ...items]);
      }

      // Keep the search bounded while still allowing broader source coverage.
      if (aggregated.length >= Math.max(safeLimit * 2, 20)) {
        break;
      }
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : `Google News RSS failed for query: ${query}`);
    }
  }

  if (aggregated.length === 0) {
    const fallbackQuery = queries[0] ?? `${symbol} india stock news`;
    try {
      aggregated = await fetchGNews(fallbackQuery);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'GNews fallback failed');
    }
  }

  if (aggregated.length === 0) {
    try {
      const marketFallback = await fetchNews(Math.max(safeLimit, 10));
      aggregated = uniqueNewsItems(marketFallback.items);
      usedMarketFallbackFeed = true;
      warnings.push('Stock-specific RSS sparse; served broader market feed fallback.');
    } catch {
      // If market fallback also fails, use deterministic resource links.
    }
  }

  if (aggregated.length > 0) {
    const relevantItems = rankStockNewsItems(aggregated, normalizedSymbol, companyName).filter((item) =>
      hasHighStockRelevance(item, normalizedSymbol, companyName)
    );

    if (relevantItems.length > 0) {
      aggregated = relevantItems;
    } else if (!usedMarketFallbackFeed) {
      aggregated = [];
      warnings.push('Live stock RSS items were low relevance; switching to trusted fallback resources.');
    }
  }

  if (aggregated.length === 0) {
    usedFallbackResources = true;
    aggregated = buildFallbackNewsItems({ symbol: normalizedSymbol, companyName });
    warnings.push('Live stock RSS was empty; using fallback investor resources.');
  }

  if (!usedFallbackResources && aggregated.length < safeLimit) {
    const fallbackResources = buildFallbackNewsItems({ symbol: normalizedSymbol, companyName });
    const blended = uniqueNewsItems([...aggregated, ...fallbackResources]);

    if (blended.length > aggregated.length) {
      aggregated = blended;
      appendedFallbackResources = true;
      warnings.push('Stock RSS depth was limited; appended verified filing resources.');
    }
  }

  const rankedItems = rankStockNewsItems(aggregated, normalizedSymbol, companyName);

  if (rankedItems.length > 0) {
    cache.set(cacheKey, rankedItems, NEWS_TTL_MS);
  }

  return {
    items: rankedItems.slice(0, safeLimit),
    provenance: buildProvenance({
      source: usedFallbackResources
        ? 'Finalysis fallback resources'
        : appendedFallbackResources
          ? 'Google News RSS + Finalysis resources'
          : usedMarketFallbackFeed
            ? 'Google News RSS (market fallback)'
            : 'Google News RSS',
      cacheHit: false,
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence: usedFallbackResources ? 'derived' : usedMarketFallbackFeed || appendedFallbackResources ? 'medium' : 'high',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}

export async function getMarketSentiment(): Promise<{ sentiment: string; score: number; newsCount: number; provenance: Provenance }> {
  const { items, provenance } = await fetchNews(50);
  const snapshot = aggregateSentiment(items);

  return {
    sentiment: snapshot.sentiment,
    score: snapshot.score,
    newsCount: snapshot.newsCount,
    provenance,
  };
}

export async function getSentimentMix(symbol?: string): Promise<SentimentMixResult> {
  const marketResult = await fetchNews(50);
  const market = aggregateSentiment(marketResult.items);

  if (!symbol) {
    return {
      market,
      sector: null,
      company: null,
      provenance: marketResult.provenance,
    };
  }

  const normalizedSymbol = symbol.replace(/\.NS$/i, '').toUpperCase();
  const companyResult = await getStockNews(normalizedSymbol, 30);
  const companySnapshot = aggregateSentiment(companyResult.items);

  const sectorConfig = inferSectorConfig(normalizedSymbol, companyResult.items);
  const sectorResult = await fetchTopicNews(`news_sector_${sectorConfig.key}`, sectorConfig.query, 30);
  const sectorSnapshot = aggregateSentiment(sectorResult.items);

  const warnings = [
    ...(marketResult.provenance.warnings || []),
    ...(companyResult.provenance.warnings || []),
    ...(sectorResult.provenance.warnings || []),
  ];

  return {
    market,
    sector: {
      ...sectorSnapshot,
      name: sectorConfig.displayName,
      key: sectorConfig.key,
    },
    company: {
      ...companySnapshot,
      symbol: normalizedSymbol,
    },
    provenance: buildProvenance({
      source: 'Google News RSS blended sentiment (market + sector + company)',
      cacheHit: Boolean(
        marketResult.provenance.cacheHit &&
        companyResult.provenance.cacheHit &&
        sectorResult.provenance.cacheHit
      ),
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence:
        companySnapshot.newsCount >= 5 && sectorSnapshot.newsCount >= 5
          ? 'high'
          : companySnapshot.newsCount > 0 || sectorSnapshot.newsCount > 0
            ? 'medium'
            : 'derived',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}
