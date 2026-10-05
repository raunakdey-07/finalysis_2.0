/**
 * Core data shapes for Fin-alysis.
 *
 * Freshness fields are mandatory, not optional. Every value that reaches a user
 * must be able to say when it was true and where it came from.
 */

export interface StockPrice {
  symbol: string;
  price: number;
  /** Absolute move against the previous completed session. Null when unknown. */
  change: number | null;
  /** Percent move against the previous completed session. Null when unknown. */
  changePercent: number | null;
  volume: number | null;
  previousClose: number | null;
  /**
   * Change across the whole window the provider returned, which is a handful
   * of sessions. One session is mostly noise; this is the first movement
   * signal the app has, and the series is already in the parsed response.
   */
  recentChangePercent: number | null;
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /**
   * When the exchange recorded this price, from the provider. This is the
   * quote time, never the time we happened to fetch it.
   */
  quotedAt: string | null;
  /** When we retrieved it. Always later than or equal to quotedAt. */
  fetchedAt: string;
  /** Exchange timezone reported by the provider, e.g. "Asia/Kolkata". */
  exchangeTimezone: string | null;
  /** How this price reached us, which decides how the UI labels it. */
  freshness: PriceFreshness;
}

export type PriceFreshness =
  /** Direct provider quote for the current or most recent session. */
  | { kind: 'live'; ageMs: number | null }
  /** Retrieved from cache; still a provider quote, just an older one. */
  | { kind: 'cached'; ageMs: number }
  /** End-of-day snapshot taken by the scheduled job. Explicitly not live. */
  | { kind: 'daily-close'; ageMs: number }
  /** Retrieved from cache while the provider was failing. Oldest case. */
  | { kind: 'stale-cache'; ageMs: number };

export interface StockFundamentals {
  symbol: string;
  companyName: string;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  /** Latest completed fiscal year earnings per share, in rupees. */
  eps: number | null;
  bookValue: number | null;
  faceValue: number | null;
  /** Broad sector, e.g. "Energy". Drives the valuation bands. */
  sector: string | null;
  /** Narrow industry, e.g. "Oil, Gas & Consumable Fuels". Shown as company context. */
  industry: string | null;
  roe: number | null;
  roce: number | null;
  /** Reporting date of the latest annual figures, e.g. "2026-03-31". */
  periodEnd: string | null;
  /** When we read the page. */
  fetchedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  /** Keyword score in -1..1, present only on articles we actually retrieved. */
  sentimentScore?: number;
  /**
   * True for stand-in links that are not retrieved articles. These are never
   * counted as evidence and never carry a tone.
   */
  synthetic?: boolean;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unavailable';

export interface Provenance {
  source: string;
  /** ISO timestamp of the underlying data, not of this response. */
  lastUpdated: string | null;
  cacheTTL: string;
  cacheHit: boolean;
  confidenceLevel: ConfidenceLevel;
  /** Human-readable explanations of anything that degraded the result. */
  warnings?: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
}
