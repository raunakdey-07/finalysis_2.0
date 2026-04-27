/**
 * API response types for Finalysis 3.0
 */

export type ConfidenceLevel = 'high' | 'medium' | 'derived';

export interface Provenance {
  source: string;
  lastUpdated: string; // ISO string when available; otherwise human-readable cache timestamp
  cacheTTL: string; // human-readable TTL window (e.g., "10m", "30-90d")
  confidenceLevel: ConfidenceLevel;
  cacheHit?: boolean;
  warnings?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
  timestamp: string;
  provenance?: Provenance;
}

export interface StockSearchSuggestion {
  symbol: string;
  displaySymbol: string;
  name: string;
  sector: string;
  industry?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
