/**
 * Defensive fundamentals parser validation.
 * Ensures parsed values are numerically valid and structurally sound.
 */
import { StockFundamentals } from '@/types';

export function isValidFundamentals(f: Partial<StockFundamentals>): boolean {
  if (!f || typeof f !== 'object') return false;

  // Required fields must exist
  if (typeof f.symbol !== 'string' || f.symbol.trim().length === 0) return false;
  if (typeof f.companyName !== 'string' || f.companyName.trim().length < 2) return false;

  // Numeric fields must be finite numbers or null (not NaN/Infinity)
  // Negative book value is financially meaningful (companies with negative net assets)
  // Negative ROE/ROCE are legitimate signals, not invalid data
  const numericFields = [
    'marketCap', 'peRatio', 'pbRatio', 'dividendYield',
    'epsLast4Quarters', 'bookValue', 'roe', 'roce', 'debtToEquity',
    'faceValue', 'revenueGrowth'
  ] as const;

  for (const key of numericFields) {
    const val = f[key];
    if (val === undefined) continue; // optional fields may be missing
    if (val === null) continue; // null is acceptable (unavailable)
    if (typeof val !== 'number') return false;
    if (!Number.isFinite(val)) return false; // reject NaN/Infinity
    // Market cap and face value genuinely cannot be negative for valid securities.
    // Book value CAN be negative (negative net assets) — do NOT reject.
    if (val < 0 && (key === 'marketCap' || key === 'faceValue')) return false;
  }

  return true;
}
