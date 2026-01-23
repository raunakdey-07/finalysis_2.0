/**
 * NSE (National Stock Exchange) API integration
 * Provides functions to fetch stock data from NSE
 */

import { StockPrice } from '@/types';
import cache from '@/lib/cache';

const NSE_BASE_URL = 'https://www.nseindia.com';

/**
 * Default headers for NSE requests
 */
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
});

/**
 * Fetch stock quote from NSE
 * @param symbol - Stock symbol (e.g., 'RELIANCE', 'TCS')
 * @returns Stock price data
 */
export async function fetchNSEQuote(symbol: string): Promise<StockPrice | null> {
  const cacheKey = `nse_quote_${symbol}`;
  const cached = cache.get<StockPrice>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    // Note: This is a placeholder implementation
    // In production, you would use actual NSE API endpoints
    // Free alternatives: Yahoo Finance, Alpha Vantage free tier, or web scraping
    const response = await fetch(`${NSE_BASE_URL}/api/quote-equity?symbol=${symbol}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`NSE API error: ${response.status}`);
    }

    const data = await response.json();

    const stockPrice: StockPrice = {
      symbol: symbol,
      price: data.priceInfo?.lastPrice || 0,
      change: data.priceInfo?.change || 0,
      changePercent: data.priceInfo?.pChange || 0,
      volume: data.preOpenMarket?.totalTradedVolume || 0,
      timestamp: new Date(),
    };

    // Cache for 1 minute
    cache.set(cacheKey, stockPrice, 60000);

    return stockPrice;
  } catch (error) {
    console.error(`Error fetching NSE quote for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch multiple stock quotes
 * @param symbols - Array of stock symbols
 * @returns Array of stock price data
 */
export async function fetchMultipleQuotes(symbols: string[]): Promise<StockPrice[]> {
  const promises = symbols.map((symbol) => fetchNSEQuote(symbol));
  const results = await Promise.allSettled(promises);

  return results
    .filter((result): result is PromiseFulfilledResult<StockPrice | null> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value as StockPrice);
}

/**
 * Search for stocks by keyword
 * @param query - Search query
 * @returns Array of matching symbols
 */
export async function searchStocks(query: string): Promise<string[]> {
  const cacheKey = `nse_search_${query}`;
  const cached = cache.get<string[]>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    // Placeholder - in production, implement actual search
    const response = await fetch(`${NSE_BASE_URL}/api/search/autocomplete?q=${query}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`NSE search error: ${response.status}`);
    }

    const data = await response.json();
    const symbols = data.symbols || [];

    // Cache for 5 minutes
    cache.set(cacheKey, symbols, 300000);

    return symbols;
  } catch (error) {
    console.error(`Error searching NSE stocks:`, error);
    return [];
  }
}
