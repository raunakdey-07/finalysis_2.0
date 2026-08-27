import { StockPrice } from '@/types';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketVolume?: number;
        regularMarketOpen?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

interface YahooSearchQuote {
  symbol?: string;
  quoteType?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  score?: number;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
  error?: string | null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().trim();
}

function stripNseSuffix(symbol: string): string {
  return symbol.replace(/\.NS$/i, '');
}

function buildQuoteCandidates(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (normalized.includes('.')) {
    return [normalized];
  }

  return [normalized, `${normalized}.NS`, `${normalized}.BO`];
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResponse> {
  const response = await fetchWithTimeout(
    `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: YAHOO_HEADERS },
    10_000
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance chart error: ${response.status}`);
  }

  return response.json() as Promise<YahooChartResponse>;
}

function toPrice(result: NonNullable<NonNullable<YahooChartResponse['chart']>['result']>[number]): StockPrice | null {
  const meta = result.meta;
  const currentPrice = meta?.regularMarketPrice;
  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return null;
  }

  const previousClose = meta?.chartPreviousClose ?? currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    symbol: meta?.symbol ?? '',
    price: currentPrice,
    change,
    changePercent,
    daily_change_percent: changePercent,
    volume: meta?.regularMarketVolume ?? 0,
    open: meta?.regularMarketOpen ?? currentPrice,
    high: meta?.regularMarketDayHigh,
    low: meta?.regularMarketDayLow,
    previousClose,
    fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta?.fiftyTwoWeekLow,
    timestamp: new Date((meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000),
  };
}

export async function fetchYahooQuote(symbol: string): Promise<StockPrice> {
  const searchFirst = !symbol.includes('.') && !symbol.includes(':');
  const candidates: string[] = [];

  if (searchFirst) {
    const resolved = await searchYahooSymbol(symbol);
    if (resolved) {
      candidates.push(resolved);
    }
  }

  for (const candidate of buildQuoteCandidates(symbol)) {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const data = await fetchYahooChart(candidate);
      const chartResult = data.chart?.result?.[0];
      if (!chartResult) {
        throw new Error('quote-not-found');
      }

      const stockPrice = toPrice(chartResult);
      if (!stockPrice) {
        throw new Error('quote-not-found');
      }

      return {
        ...stockPrice,
        symbol: stripNseSuffix(stockPrice.symbol || candidate),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Yahoo Finance quote fetch failed');
}

async function searchYahooSymbol(query: string): Promise<string | null> {
  const response = await fetchWithTimeout(
    `${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
    { headers: YAHOO_HEADERS },
    10_000
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance search error: ${response.status}`);
  }

  const data = (await response.json()) as YahooSearchResponse;
  const quote = (data.quotes ?? []).find((item) => item.quoteType === 'EQUITY' && item.symbol);
  return quote?.symbol ?? null;
}

export async function searchYahooSymbols(query: string): Promise<string[]> {
  const response = await fetchWithTimeout(
    `${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
    { headers: YAHOO_HEADERS },
    10_000
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance search error: ${response.status}`);
  }

  const data = (await response.json()) as YahooSearchResponse;
  return (data.quotes ?? [])
    .filter((quote) => quote.quoteType === 'EQUITY' && Boolean(quote.symbol))
    .map((quote) => stripNseSuffix(quote.symbol as string));
}
