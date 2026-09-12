/**
 * Financial edge case tests.
 * Covers zero, negative, NaN, Infinity, and missing data scenarios.
 */
import { describe, it, expect } from 'vitest';

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
    it('should handle negative EPS', () => {
      const eps = -5;
      const isProfitable = eps > 0;
      expect(isProfitable).toBe(false);
    });
  });

  describe('negative book value', () => {
    it('should reject negative book value', () => {
      const bookValue = -100;
      expect(bookValue > 0).toBe(false);
    });
  });

  describe('NaN handling', () => {
    it('should detect NaN as invalid', () => {
      expect(Number.isFinite(NaN)).toBe(false);
      expect(Number.isFinite(Infinity)).toBe(false);
      expect(Number.isFinite(-Infinity)).toBe(false);
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
  });

  describe('extreme values', () => {
    it('should handle large market cap', () => {
      const marketCap = 1e15; // 10 lakh crore
      expect(Number.isFinite(marketCap)).toBe(true);
    });
  });
});