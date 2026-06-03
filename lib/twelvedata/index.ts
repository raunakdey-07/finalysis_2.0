import { StockPrice } from '@/types';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

interface TwelveDataQuoteResponse {
  symbol?: string;
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  status?: string;
  message?: string;
  code?: number;
}

interface TwelveDataSearchResponse {
  data?: Array<{ symbol?: string }>;
  status?: string;
  message?: string;
  code?: number;
}

function getApiKey(): string {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error('TWELVEDATA_API_KEY not set');
  }
  return apiKey;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = value.replace(/[,\s]/g, '').replace('%', '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTimestamp(datetime?: string): Date {
  if (!datetime) return new Date();
  const parsed = new Date(datetime);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

export async function fetchTwelveDataQuote(symbol: string): Promise<StockPrice> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({ symbol, apikey: apiKey });
  if (!symbol.includes('.')) {
    params.set('exchange', 'NSE');
  }

  const response = await fetchWithTimeout(
    `${TWELVE_DATA_BASE_URL}/quote?${params.toString()}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    },
    10_000
  );

  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }

  const data = (await response.json()) as TwelveDataQuoteResponse;
  if (data.status === 'error') {
    throw new Error(data.message ?? 'Twelve Data API error');
  }

  const currentPrice = parseNumber(data.close);
  if (!currentPrice || currentPrice <= 0) {
    throw new Error('quote-not-found');
  }

  const previousClose = parseNumber(data.previous_close) ?? currentPrice;
  const change = parseNumber(data.change) ?? currentPrice - previousClose;
  const percentChange = parseNumber(data.percent_change);
  const computedPercent = percentChange ?? (previousClose > 0 ? (change / previousClose) * 100 : 0);

  return {
    symbol,
    price: currentPrice,
    change,
    changePercent: computedPercent,
    daily_change_percent: computedPercent,
    volume: parseNumber(data.volume) ?? 0,
    open: parseNumber(data.open) ?? currentPrice,
    high: parseNumber(data.high) ?? undefined,
    low: parseNumber(data.low) ?? undefined,
    previousClose,
    timestamp: resolveTimestamp(data.datetime),
  };
}

export async function searchTwelveDataSymbols(query: string): Promise<string[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({ symbol: query, apikey: apiKey, exchange: 'NSE' });

  const response = await fetchWithTimeout(
    `${TWELVE_DATA_BASE_URL}/symbol_search?${params.toString()}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    },
    10_000
  );

  if (!response.ok) {
    throw new Error(`Twelve Data search error: ${response.status}`);
  }

  const data = (await response.json()) as TwelveDataSearchResponse;
  if (data.status === 'error') {
    throw new Error(data.message ?? 'Twelve Data search error');
  }

  return (data.data ?? [])
    .map((item) => item.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));
}
