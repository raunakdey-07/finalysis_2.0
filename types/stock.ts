/**
 * Stock data types for Finalysis 3.0
 */

export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface StockFundamentals {
  symbol: string;
  companyName: string;
  marketCap: number;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  epsLast4Quarters: number | null;
  bookValue: number | null;
  faceValue: number;
  industry: string;
  lastUpdated: Date;
}

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentimentScore?: number;
}

export interface StockMetrics {
  symbol: string;
  valuationScore: number;
  growthScore: number;
  profitabilityScore: number;
  momentumScore: number;
  overallScore: number;
  explanation: {
    valuation: string;
    growth: string;
    profitability: string;
    momentum: string;
  };
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}
