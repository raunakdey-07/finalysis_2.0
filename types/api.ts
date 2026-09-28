/**
 * API response envelopes.
 */

import type { Provenance } from './stock';

export type { Provenance, ConfidenceLevel } from './stock';

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
