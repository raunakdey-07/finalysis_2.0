import { StockPrice } from '@/types';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

interface FinnhubQuoteResponse {
  c?: number; // current price
  h?: number; // high price
  l?: number; // low price
  o?: number; // open price
  pc?: number; // previous close price
  t?: number; // time (unix)
}

export async function fetchFinnhubQuote(symbol: string): Promise<StockPrice> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY not set');
  }

  // Convert NSE symbol to Finnhub format (e.g., ITC -> ITC.NS)
  const finnhubSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;

  try {
    const response = await fetchWithTimeout(
      `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${apiKey}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      },
      10_000
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = (await response.json()) as FinnhubQuoteResponse;

    const currentPrice = data.c;
    if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new Error('quote-not-found');
    }

    const previousClose = data.pc ?? currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    const daily_change_percent = changePercent;

    const stockPrice: StockPrice = {
      symbol,
      price: currentPrice,
      change,
      changePercent,
      daily_change_percent,
      volume: 0, // Finnhub free tier doesn't include volume in quote endpoint
      open: data.o ?? currentPrice,
      high: data.h,
      low: data.l,
      previousClose,
      timestamp: new Date(),
    };

    return stockPrice;
  } catch (error) {
    if (error instanceof Error && error.message === 'quote-not-found') {
      throw error;
    }
    throw error instanceof Error ? error : new Error('Finnhub quote fetch failed');
  }
}
