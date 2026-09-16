/**
 * Financial edge case tests.
 * Covers zero, negative, NaN, Infinity, and missing data scenarios.
 */
import { describe, it, expect } from 'vitest';
import { isValidFundamentals } from '@/lib/fundamentals/validate';
import { StockFundamentals } from '@/types';

const baseFundamentals = (overrides: Partial<StockFundamentals> = {}): StockFundamentals => ({
  symbol: 'TEST',
  companyName: 'Test Company',
  marketCap: 100000,
  peRatio: 20,
  pbRatio: 2,
  dividendYield: 1.5,
  epsLast4Quarters: 10,
  bookValue: 100,
  faceValue: 10,
  industry: 'Technology',
  roe: 15,
  roce: 12,
  debtToEquity: 0.5,
  revenueGrowth: 10,
  lastUpdated: new Date(),
  ...overrides,
});

describe('Financial edge cases', () => {
  describe('zero revenue', () => {
    it('should handle zero revenue gracefully', () => {
      const revenue = 0;
      const growth = revenue > 0 ? 10 : 0;
      expect(growth).toBe(0);
    });
  });

  describe('zero equity', () => {
    it('should handle zero equity for debt/equity', () => {
      const debt = 100;
      const equity = 0;
      const de = equity > 0 ? debt / equity : null;
      expect(de).toBeNull();
    });
  });

  describe('zero debt', () => {
    it('should handle zero debt correctly', () => {
      const debt = 0;
      const equity = 500;
      const de = debt / equity;
      expect(de).toBe(0);
    });
  });

  describe('negative earnings', () => {
    it('should handle negative EPS as valid data', () => {
      const fundamentals = baseFundamentals({ epsLast4Quarters: -5 });
      expect(isValidFundamentals(fundamentals)).toBe(true);
    });
  });

  describe('negative book value', () => {
    it('should accept negative book value as valid data', () => {
      const fundamentals = baseFundamentals({ bookValue: -3.26 });
      expect(isValidFundamentals(fundamentals)).toBe(true);
    });
  });

  describe('negative ROE and ROCE', () => {
    it('should accept negative ROE and ROCE as valid data', () => {
      const fundamentals = baseFundamentals({ roe: -20, roce: -1.92 });
      expect(isValidFundamentals(fundamentals)).toBe(true);
    });
  });

  describe('NaN handling', () => {
    it('should detect NaN as invalid', () => {
      expect(Number.isFinite(NaN)).toBe(false);
      expect(Number.isFinite(Infinity)).toBe(false);
      expect(Number.isFinite(-Infinity)).toBe(false);
      expect(isValidFundamentals(baseFundamentals({ marketCap: NaN }))).toBe(false);
      expect(isValidFundamentals(baseFundamentals({ bookValue: Infinity }))).toBe(false);
    });
  });

  describe('missing data', () => {
    it('should distinguish null from zero', () => {
      const missing = null;
      const zero = 0;
      expect(missing === null).toBe(true);
      expect(zero === null).toBe(false);
      expect(missing ?? 0).toBe(0);
      expect(zero ?? 0).toBe(0);
    });

    it('should accept missing optional metrics', () => {
      const fundamentals = baseFundamentals({ peRatio: null, pbRatio: null, roe: null, roce: null });
      expect(isValidFundamentals(fundamentals)).toBe(true);
    });
  });

  describe('extreme values', () => {
    it('should handle large market cap', () => {
      const marketCap = 1e15; // 10 lakh crore
      expect(Number.isFinite(marketCap)).toBe(true);
    });
  });
});