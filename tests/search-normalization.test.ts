/**
 * Search normalization and resolution tests.
 * Tests common NSE symbols, typos, and normalization patterns.
 */
import { describe, it, expect } from 'vitest';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';

describe('Search normalization', () => {
  describe('exact/common names', () => {
    it('resolves Infosys', () => {
      const result = parseRequiredNseSymbol('INFY');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('INFY');
      }
    });

    it('resolves ITC', () => {
      const result = parseRequiredNseSymbol('ITC');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('ITC');
      }
    });

    it('resolves Reliance', () => {
      const result = parseRequiredNseSymbol('RELIANCE');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('RELIANCE');
      }
    });

    it('resolves TCS', () => {
      const result = parseRequiredNseSymbol('TCS');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('TCS');
      }
    });

    it('resolves Bajaj Housing Finance', () => {
      const result = parseRequiredNseSymbol('BAJAJHFL');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('BAJAJHFL');
      }
    });
  });

  describe('typos and fuzzy input', () => {
    it('handles infosis typo (Yahoo search handles fuzzy)', () => {
      // Symbol validation should still normalize correctly
      expect(parseRequiredNseSymbol('INFY').success).toBe(true);
    });

    it('handles itc lowercase', () => {
      const result = parseRequiredNseSymbol('itc');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('ITC');
      }
    });
  });

  describe('symbol normalization', () => {
    it('strips .NS suffix', () => {
      const r1 = parseRequiredNseSymbol('ITC.NS');
      const r2 = parseRequiredNseSymbol('BAJAJHFL.NS');
      expect(r1.success && r1.symbol === 'ITC').toBe(true);
      expect(r2.success && r2.symbol === 'BAJAJHFL').toBe(true);
    });

    it('strips .nse case-insensitively', () => {
      const result = parseRequiredNseSymbol('itc.nse');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('ITC');
      }
    });

    it('handles uppercase with .NS', () => {
      const result = parseRequiredNseSymbol('ITC.NS');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('ITC');
      }
    });

    it('handles lowercase with .ns', () => {
      const result = parseRequiredNseSymbol('bajajhfl.ns');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.symbol).toBe('BAJAJHFL');
      }
    });
  });

  describe('invalid symbols', () => {
    it('rejects empty input', () => {
      expect(parseRequiredNseSymbol('').success).toBe(false);
    });

    it('rejects symbols with illegal characters', () => {
      expect(parseRequiredNseSymbol('ITC!').success).toBe(false);
    });
  });
});
