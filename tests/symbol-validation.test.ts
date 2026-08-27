/**
 * Tests for the shared symbol normalization / validation utility.
 * Verifies deterministic behavior across the common input surface.
 */
import { describe, it, expect } from 'vitest';
import {
  parseRequiredNseSymbol,
  parseOptionalNseSymbol,
  NSE_SYMBOL_REGEX,
} from '@/lib/utils/symbol';

describe('parseRequiredNseSymbol', () => {
  it('accepts a bare uppercase ticker', () => {
    const result = parseRequiredNseSymbol('ITC');
    expect(result).toEqual({ success: true, symbol: 'ITC' });
  });

  it('strips .NS suffix', () => {
    expect(parseRequiredNseSymbol('ITC.NS')).toEqual({ success: true, symbol: 'ITC' });
  });

  it('strips .nse suffix case-insensitively', () => {
    expect(parseRequiredNseSymbol('itc.nse')).toEqual({ success: true, symbol: 'ITC' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseRequiredNseSymbol('  INFY  ')).toEqual({ success: true, symbol: 'INFY' });
  });

  it('accepts ampersand and hyphen in tickers', () => {
    expect(parseRequiredNseSymbol('M&M')).toEqual({ success: true, symbol: 'M&M' });
    expect(parseRequiredNseSymbol('BSOFT')).toEqual({ success: true, symbol: 'BSOFT' });
  });

  it('rejects empty input', () => {
    const result = parseRequiredNseSymbol('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects null/undefined input', () => {
    expect(parseRequiredNseSymbol(null).success).toBe(false);
    expect(parseRequiredNseSymbol(undefined).success).toBe(false);
  });

  it('rejects symbols with illegal characters', () => {
    expect(parseRequiredNseSymbol('ITC!').success).toBe(false);
    expect(parseRequiredNseSymbol('a b').success).toBe(false);
    expect(parseRequiredNseSymbol('INFY/NS').success).toBe(false);
  });

  it('rejects excessively long input', () => {
    expect(parseRequiredNseSymbol('A'.repeat(100)).success).toBe(false);
  });

  it('rejects whitespace-only input', () => {
    expect(parseRequiredNseSymbol('   ').success).toBe(false);
  });
});

describe('parseOptionalNseSymbol', () => {
  it('returns null symbol for empty input', () => {
    expect(parseOptionalNseSymbol(null)).toEqual({ success: true, symbol: null });
    expect(parseOptionalNseSymbol(undefined)).toEqual({ success: true, symbol: null });
    expect(parseOptionalNseSymbol('')).toEqual({ success: true, symbol: null });
  });

  it('delegates to required validation for non-empty input', () => {
    expect(parseOptionalNseSymbol('RELIANCE')).toEqual({ success: true, symbol: 'RELIANCE' });
    expect(parseOptionalNseSymbol('bad!').success).toBe(false);
  });
});

describe('NSE_SYMBOL_REGEX', () => {
  it('is anchored and deterministic', () => {
    expect(NSE_SYMBOL_REGEX.test('RELIANCE')).toBe(true);
    expect(NSE_SYMBOL_REGEX.test('reliance')).toBe(false);
    expect(NSE_SYMBOL_REGEX.test('RELIANCE.NS')).toBe(false);
    expect(NSE_SYMBOL_REGEX.test('')).toBe(false);
  });
});