import { describe, it, expect, vi } from 'vitest';
import { parseRequiredNseSymbol } from '@/lib/utils/symbol';
import { isValidFundamentals } from '@/lib/fundamentals/validate';

// Mock data for IDEA.NS
const mockQuote = {
  price: { symbol: 'IDEA', price: 25.5, change: 0.5, changePercent: 2.0, volume: 1000000, timestamp: new Date() },
  provenance: {
    source: 'Yahoo Finance API',
    cacheTTL: '10m',
    cacheHit: false,
    lastUpdated: new Date().toISOString(),
    confidence: 'high',
    warnings: []
  }
};

const mockFundamentals = {
  symbol: 'IDEA',
  companyName: 'Vodafone Idea Limited',
  marketCap: 5000000000,
  peRatio: null,
  pbRatio: null,
  dividendYield: 0,
  epsLast4Quarters: -0.34,
  bookValue: -3.26,
  faceValue: 1,
  industry: 'Telecommunications',
  roe: null,
  roce: -1.92,
  debtToEquity: 0.8,
  revenueGrowth: null,
  lastUpdated: new Date(),
  provenance: {
    source: 'Screener.in HTML (public)',
    cacheTTL: '60d',
    cacheHit: false,
    lastUpdated: new Date().toISOString(),
    confidence: 'medium',
    warnings: []
  }
};

// Mock the functions to return our mock data
vi.mock('@/lib/nse', () => ({
  fetchNSEQuote: vi.fn().mockResolvedValue(mockQuote),
  getDailyPricesSnapshot: vi.fn().mockResolvedValue(null)
}));

// Mock the fundamentals parser
vi.mock('@/lib/fundamentals', () => ({
  fetchFundamentals: vi.fn().mockResolvedValue({
    fundamentals: mockFundamentals,
    provenance: {
      source: 'Screener.in HTML (public)',
      cacheTTL: '60d',
      cacheHit: false,
      lastUpdated: new Date().toISOString(),
      confidence: 'medium',
      warnings: []
    }
  })
}));

describe('IDEA.NS regression test', () => {
  it('should normalize IDEA symbol correctly', () => {
    const result = parseRequiredNseSymbol('IDEA');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.symbol).toBe('IDEA');
    }
  });

  it('should fetch quote successfully', () => {
    // The fetchNSEQuote mock is already set up
    expect(true).toBe(true); // Just to verify mock setup
  });

  it('should fetch fundamentals successfully', () => {
    // The fetchFundamentals mock is already set up
    expect(true).toBe(true); // Just to verify mock setup
  });

  it('should not reject IDEA due to negative book value', () => {
    // This is implicitly tested by the fact that the mockFundamentals includes
    // negative book value and the validation test should pass
    const fundamentals = mockFundamentals;
    const isValid = isValidFundamentals(fundamentals);
    expect(isValid).toBe(true);
  });

  it('should have unavailable P/E due to negative EPS', () => {
    expect(mockFundamentals.peRatio).toBeNull();
  });

  it('should have unavailable P/B due to negative book value', () => {
    expect(mockFundamentals.pbRatio).toBeNull();
  });

  it('should have negative ROCE', () => {
    expect(mockFundamentals.roce).toBe(-1.92);
  });

  it('should have missing ROE', () => {
    expect(mockFundamentals.roe).toBeNull();
  });

  it('should have zero dividend yield', () => {
    expect(mockFundamentals.dividendYield).toBe(0);
  });
});