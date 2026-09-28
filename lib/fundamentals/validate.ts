/**
 * Defensive validation for scraped fundamentals.
 *
 * The rule this file exists to enforce: a value is either a real, finite,
 * meaningful number, or null meaning "the provider did not disclose it".
 * Nothing else is allowed through.
 */
import { StockFundamentals } from '@/types';

export function isValidFundamentals(f: Partial<StockFundamentals>): boolean {
  if (!f || typeof f !== 'object') return false;

  if (typeof f.symbol !== 'string' || f.symbol.trim().length === 0) return false;
  if (typeof f.companyName !== 'string' || f.companyName.trim().length < 2) return false;

  if (f.sector !== null && f.sector !== undefined && typeof f.sector !== 'string') return false;
  if (f.industry !== null && f.industry !== undefined && typeof f.industry !== 'string') return false;

  // Negative book value, ROE, ROCE and EPS are all financially meaningful
  // signals, not parsing errors, so they are explicitly allowed.
  const numericFields = [
    'peRatio',
    'pbRatio',
    'dividendYield',
    'eps',
    'bookValue',
    'faceValue',
    'roe',
    'roce',
  ] as const;

  for (const key of numericFields) {
    const value = f[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number') return false;
    if (!Number.isFinite(value)) return false;

    // A P/E derived from a loss cannot be negative in any meaningful reading,
    // and P/B on negative equity is suppressed upstream rather than computed.
    if (value < 0 && (key === 'pbRatio' || key === 'faceValue')) return false;
  }

  if (f.periodEnd !== null && f.periodEnd !== undefined) {
    if (typeof f.periodEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.periodEnd)) return false;
  }

  if (typeof f.fetchedAt !== 'string' || Number.isNaN(Date.parse(f.fetchedAt))) return false;

  return true;
}
