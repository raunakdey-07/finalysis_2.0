import { NewsItem, Provenance } from '@/types';
import cache from '@/lib/cache';

const NEWS_TTL_MS = 8 * 60 * 60 * 1000; // 6–12h window; choose 8h middle
const GOOGLE_NEWS_HOST = 'news.google.com';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY; // optional free tier

const POSITIVE_KEYWORDS = ['gain', 'growth', 'profit', 'surge', 'rally', 'bullish', 'positive', 'strong', 'rise', 'outperform', 'buy', 'upgrade'];
const NEGATIVE_KEYWORDS = ['loss', 'decline', 'fall', 'drop', 'bearish', 'negative', 'weak', 'underperform', 'sell', 'downgrade', 'crash'];

const IMPORTANCE_KEYWORDS = [
  'results', 'q1', 'q2', 'q3', 'q4', 'quarter', 'earnings', 'board meeting', 'filing', 'sebi', 'regulatory', 'acquisition', 'merger', 'm&a', 'capex', 'investment', 'order win', 'guidance'
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
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
      const rawTitle = stripHtml(titleMatch[1]);
      const { cleanedTitle: title, publication } = cleanTitle(rawTitle);
      const rawDescription = descMatch ? stripHtml(descMatch[1]) : '';
      // Only keep description if it adds info beyond the title
      const description = isDuplicateDescription(title, rawDescription) ? '' : rawDescription;
      const { sentiment, score } = calculateSentiment(`${title} ${rawDescription}`);
      const importance = classifyImportance(`${title} ${rawDescription}`);

      items.push({
        id: `${source}_${Date.now()}_${Math.random()}`,
        title,
        description,
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
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
  // Query multiple top Indian finance sources for better coverage
  const sites = [
    'moneycontrol.com',
    'livemint.com',
    'economictimes.indiatimes.com',
    'business-standard.com',
    'financialexpress.com',
    'thehindubusinessline.com',
    'reuters.com',
    'bloomberg.com',
  ];
  const siteQuery = sites.map(s => `site:${s}`).join(' OR ');
  const encoded = encodeURIComponent(`${query} ${siteQuery}`);
  const url = `https://${GOOGLE_NEWS_HOST}/rss/search?q=${encoded}&hl=en-IN&gl=IN&ceid=IN:en`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!response.ok) throw new Error(`Google News RSS error: ${response.status}`);
  const xml = await response.text();
  return parseRSSFeed(xml, 'Google News');
}

async function fetchGNews(query: string): Promise<NewsItem[]> {
  if (!GNEWS_API_KEY) {
    throw new Error('GNEWS_API_KEY missing');
  }
  const encoded = encodeURIComponent(query);
  const url = `https://gnews.io/api/v4/search?q=${encoded}&lang=en&country=in&max=20&apikey=${GNEWS_API_KEY}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!response.ok) throw new Error(`GNews error: ${response.status}`);
  const data = await response.json();
  const articles = data.articles || [];
    return articles.map((item: { title?: string; description?: string; url?: string; publishedAt?: string }) => {
      const title = item.title || '';
      const description = item.description || '';
      const { sentiment, score } = calculateSentiment(`${title} ${description}`);
      const importance = classifyImportance(`${title} ${description}`);
      return {
        id: `gnews_${item.url}`,
        title,
        description,
        link: item.url,
        pubDate: item.publishedAt ? new Date(item.publishedAt) : new Date(),
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

export interface NewsResult {
  items: NewsItem[];
  provenance: Provenance;
}

export async function fetchNews(limit: number = 20): Promise<NewsResult> {
  const cacheKey = 'news_all';
  const cached = cache.getEntry<NewsItem[]>(cacheKey);
  if (cached) {
    return {
      items: sortAndLimit(cached.data, limit),
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

  if (aggregated.length > 0) {
    cache.set(cacheKey, aggregated, NEWS_TTL_MS);
  }

  return {
    items: sortAndLimit(aggregated, limit),
    provenance: buildProvenance({
      source: aggregated.length > 0 ? 'Google News RSS' : 'Google News RSS + GNews (empty)',
      cacheHit: false,
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence: aggregated.length > 0 ? 'high' : 'derived',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}

export async function getStockNews(symbol: string, limit: number = 10): Promise<NewsResult> {
  const cacheKey = `news_${symbol}`;
  const cached = cache.getEntry<NewsItem[]>(cacheKey);
  if (cached) {
    return {
      items: sortAndLimit(cached.data, limit),
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
  const query = `${symbol} india earnings regulatory capex`;

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

  if (aggregated.length > 0) {
    cache.set(cacheKey, aggregated, NEWS_TTL_MS);
  }

  return {
    items: sortAndLimit(aggregated, limit),
    provenance: buildProvenance({
      source: aggregated.length > 0 ? 'Google News RSS' : 'Google News RSS + GNews (empty)',
      cacheHit: false,
      cacheTTL: '8h',
      lastUpdated: new Date(),
      confidence: aggregated.length > 0 ? 'high' : 'derived',
      warnings: warnings.length ? warnings : undefined,
    }),
  };
}

export async function getMarketSentiment(): Promise<{ sentiment: string; score: number; newsCount: number; provenance: Provenance }> {
  const { items, provenance } = await fetchNews(50);

  if (items.length === 0) {
    return { sentiment: 'neutral', score: 0, newsCount: 0, provenance };
  }

  const totalScore = items.reduce((sum, item) => sum + (item.sentimentScore || 0), 0);
  const avgScore = totalScore / items.length;

  let sentiment = 'neutral';
  if (avgScore > 0.1) sentiment = 'positive';
  else if (avgScore < -0.1) sentiment = 'negative';

  return {
    sentiment,
    score: avgScore,
    newsCount: items.length,
    provenance,
  };
}
